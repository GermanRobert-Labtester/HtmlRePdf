/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';

let browserInstance: Browser | null = null;
let isLaunching = false;
let launchPromise: Promise<Browser> | null = null;

const CHROMIUM_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-accelerated-2d-canvas',
  '--no-first-run',
  '--no-zygote',
  '--disable-gpu',
  '--font-render-hinting=medium',
  '--enable-font-antialiasing',
];

/**
 * Gets or initializes the shared Chromium singleton instance.
 * Automatically handles lazy launch, recycling on disconnect, and safe flags.
 */
export async function getBrowser(): Promise<Browser> {
  if (browserInstance && browserInstance.isConnected()) {
    return browserInstance;
  }

  if (isLaunching && launchPromise) {
    return launchPromise;
  }

  isLaunching = true;
  launchPromise = (async () => {
    try {
      if (browserInstance) {
        try {
          await browserInstance.close();
        } catch {
          // ignore cleanup errors on dead instances
        }
        browserInstance = null;
      }

      console.log('[Browser] Launching shared Chromium instance...');
      const browser = await chromium.launch({
        headless: true,
        args: CHROMIUM_ARGS,
      });

      browser.on('disconnected', () => {
        console.warn('[Browser] Chromium instance disconnected. Recycling on next request.');
        browserInstance = null;
      });

      browserInstance = browser;
      console.log('[Browser] Chromium instance ready.');
      return browser;
    } finally {
      isLaunching = false;
      launchPromise = null;
    }
  })();

  return launchPromise;
}

/**
 * Creates an isolated browser context and page optimized for PDF rendering and screenshot capture.
 */
export async function createRenderPage(options: {
  viewport?: { width: number; height: number };
  deviceScaleFactor?: number;
  emulateMedia?: 'screen' | 'print';
} = {}): Promise<{ context: BrowserContext; page: Page; cleanup: () => Promise<void> }> {
  const browser = await getBrowser();

  const context = await browser.newContext({
    viewport: options.viewport || { width: 1280, height: 960 },
    deviceScaleFactor: options.deviceScaleFactor || 2, // 2x for crisp raster rendering
    ignoreHTTPSErrors: true,
    bypassCSP: true,
  });

  const page = await context.newPage();

  if (options.emulateMedia) {
    await page.emulateMedia({ media: options.emulateMedia });
  }

  const cleanup = async () => {
    try {
      await page.close().catch(() => {});
      await context.close().catch(() => {});
    } catch (err) {
      console.error('[Browser] Error during page cleanup:', err);
    }
  };

  return { context, page, cleanup };
}

/**
 * Gracefully closes the Chromium instance when server terminates.
 */
export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    console.log('[Browser] Closing Chromium instance...');
    try {
      await browserInstance.close();
    } catch (err) {
      console.error('[Browser] Error closing browser:', err);
    }
    browserInstance = null;
  }
}

// Register process exit listeners for graceful teardown
process.on('SIGINT', async () => {
  await closeBrowser();
});
process.on('SIGTERM', async () => {
  await closeBrowser();
});
