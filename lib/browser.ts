/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import path from 'node:path';
import fs from 'node:fs/promises';
import { chromium, type Browser, type BrowserContext, type Page, type Route } from 'playwright';
import {
  BUNDLE_ORIGIN, type RenderProfile, type RenderSource, type BlockedResource,
  RenderPolicyError, assertNetworkUrl, cleanBundleRelative, prepareSource, withinRoot,
} from './render-policy.ts';

let browserInstance: Browser | null = null;
let launchPromise: Promise<Browser> | null = null;
const CHROMIUM_ARGS = [
  '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
  '--no-first-run', '--no-zygote', '--disable-gpu',
];
// Chromium's --no-sandbox is an existing deployment constraint, not a security guarantee.
// Run Chromium in a constrained OS/container sandbox with an egress-deny network policy.

export async function getBrowser(): Promise<Browser> {
  if (browserInstance?.isConnected()) return browserInstance;
  if (launchPromise) return launchPromise;
  launchPromise = (async () => {
    if (browserInstance) await browserInstance.close().catch(() => {});
    const browser = await chromium.launch({ headless: true, args: CHROMIUM_ARGS });
    browser.on('disconnected', () => { browserInstance = null; });
    browserInstance = browser;
    return browser;
  })();
  try { return await launchPromise; }
  finally { launchPromise = null; }
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.ttf': 'font/ttf', '.otf': 'font/otf', '.json': 'application/json',
};
const OFFLINE_CSP = "default-src 'none'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; script-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
function safeDisplayUrl(raw: string): string {
  try { const u = new URL(raw); return u.origin + u.pathname; }
  catch { return raw.slice(0, 160); }
}
export async function fetchPublicRoute(route: Route, profile: RenderProfile): Promise<void> {
  // Route.fetch is explicitly configured not to follow redirects. Every hop,
  // including subresource redirects, is validated before another fetch.
  let current = route.request().url();
  let method = route.request().method();
  for (let hops = 0; hops < 10; hops++) {
    await assertNetworkUrl(current, profile);
    const response = await route.fetch({ url: current, method, maxRedirects: 0, timeout: 30000 });
    const status = response.status();
    const location = response.headers()['location'];
    if (status >= 300 && status < 400) {
      if (!location) throw new RenderPolicyError('Redirect without location denied', current);
      current = new URL(location, current).href;
      if ([301, 302, 303].includes(status)) method = 'GET';
      continue;
    }
    await route.fulfill({ response });
    return;
  }
  throw new RenderPolicyError('Too many redirects', current);
}

export async function createRenderPage(options: {
  source: RenderSource;
  trustedStdio?: boolean;
  viewport?: { width: number; height: number };
  deviceScaleFactor?: number;
  emulateMedia?: 'screen' | 'print';
}): Promise<{
  context: BrowserContext; page: Page; cleanup: () => Promise<void>;
  entryUrl: string; profile: RenderProfile; blockedResources: BlockedResource[];
}> {
  const prepared = await prepareSource(options.source, options.trustedStdio === true);
  const browser = await getBrowser();
  const context = await browser.newContext({
    viewport: options.viewport || { width: 1280, height: 960 },
    deviceScaleFactor: options.deviceScaleFactor || 2,
    ignoreHTTPSErrors: false,
    bypassCSP: false,
    javaScriptEnabled: prepared.profile !== 'local-bundle',
    serviceWorkers: 'block',
    acceptDownloads: false,
  });
  const blockedResources: BlockedResource[] = [];
  const blocked = (url: string, reason: string) => {
    const display = safeDisplayUrl(url);
    if (blockedResources.length < 50 &&
        !blockedResources.some(item => item.url === display && item.reason === reason)) {
      blockedResources.push({ url: display, reason });
    }
  };
  try {
    await context.route('**/*', async route => {
      const raw = route.request().url();
      try {
        const url = new URL(raw);
        if (url.origin === BUNDLE_ORIGIN && prepared.entryUrl.startsWith(BUNDLE_ORIGIN)) {
          const relative = cleanBundleRelative(url.pathname.slice(1));
          let bytes: Buffer;
          if (prepared.html !== undefined) {
            if (relative !== 'index.html') throw new RenderPolicyError('Asset not in raw HTML document', raw);
            bytes = Buffer.from(prepared.html, 'utf8');
          } else if (prepared.root) {
            const file = await withinRoot(prepared.root, relative);
            bytes = await fs.readFile(file);
          } else {
            throw new RenderPolicyError('No configured local bundle root', raw);
          }
          await route.fulfill({
            status: 200, body: bytes,
            contentType: MIME[path.extname(relative).toLowerCase()] || 'application/octet-stream',
            headers: {
              'Content-Security-Policy': prepared.profile === 'trusted-local'
                ? "default-src 'self' data: http: https:; img-src 'self' data: http: https:; style-src 'self' 'unsafe-inline' http: https:; font-src 'self' data: http: https:; script-src 'self' 'unsafe-inline' http: https:; connect-src http: https:; object-src 'none'"
                : OFFLINE_CSP,
              'X-Content-Type-Options': 'nosniff',
            },
          });
          return;
        }
        if (prepared.profile === 'local-bundle') {
          throw new RenderPolicyError('External request blocked in Local bundle', raw);
        }
        await fetchPublicRoute(route, prepared.profile);
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'Request rejected';
        blocked(raw, reason);
        await route.abort('blockedbyclient').catch(() => {});
      }
    });
    const page = await context.newPage();
    page.on('requestfailed', request => {
      const reason = request.failure()?.errorText || 'Browser blocked or failed this request';
      blocked(request.url(), reason);
    });
    // WebSockets are not covered by HTTP route interception.
    await page.routeWebSocket('**/*', socket => socket.close());
    page.on('popup', popup => { void popup.close(); });
    if (options.emulateMedia) await page.emulateMedia({ media: options.emulateMedia });
    const cleanup = async () => {
      await context.close().catch(() => {});
    };
    return { context, page, cleanup, entryUrl: prepared.entryUrl, profile: prepared.profile, blockedResources };
  } catch (error) {
    await context.close().catch(() => {});
    throw error;
  }
}

export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close().catch(() => {});
    browserInstance = null;
  }
}
process.on('SIGINT', () => { void closeBrowser(); });
process.on('SIGTERM', () => { void closeBrowser(); });
