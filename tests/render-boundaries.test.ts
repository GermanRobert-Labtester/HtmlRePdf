import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import net from 'node:net';
import { spawn } from 'node:child_process';
import AdmZip from 'adm-zip';
import { chromium } from 'playwright';
import {
  assertNetworkUrl, isPublicAddress, cleanBundleRelative, prepareSource,
  withinRoot, RenderPolicyError,
} from '../lib/render-policy.ts';
import { createRenderPage, fetchPublicRoute, closeBrowser } from '../lib/browser.ts';

test('public address classification denies private, loopback, link-local and mapped ranges', () => {
  for (const address of ['127.0.0.1', '10.0.0.1', '192.168.1.1',
    '172.16.0.1', '169.254.169.254', '100.64.0.1', '0.0.0.0',
    '192.0.2.1', '::1', 'fe80::1', 'fc00::1', '::ffff:127.0.0.1']) {
    assert.equal(isPublicAddress(address), false, address);
  }
  assert.equal(isPublicAddress('1.1.1.1'), true);
  assert.equal(isPublicAddress('2606:4700:4700::1111'), true);
});

test('URL validation denies unsupported schemes, credentials, local and private destinations', async () => {
  for (const url of ['file:///etc/passwd', 'ftp://example.com/x', 'http://localhost/admin',
    'http://foo.local/a', 'http://127.0.0.1/', 'http://169.254.169.254/latest',
    'http://[::1]/', 'http://[::ffff:127.0.0.1]/', 'http://user:pass@1.1.1.1/']) {
    await assert.rejects(assertNetworkUrl(url, 'public-web'), RenderPolicyError, url);
  }
  await assertNetworkUrl('https://1.1.1.1/', 'public-web');
});

test('redirect target is validated before following, including for subresources', async () => {
  let fetches = 0;
  const route = {
    request: () => ({ url: () => 'https://1.1.1.1/assets/style.css', method: () => 'GET' }),
    fetch: async () => {
      fetches++;
      return { status: () => 302, headers: () => ({ location: 'http://127.0.0.1/secret' }) };
    },
    fulfill: async () => { throw new Error('Private redirect must never be fulfilled'); },
  };
  await assert.rejects(fetchPublicRoute(route as any, 'public-web'), /private|loopback|link-local|reserved/i);
  assert.equal(fetches, 1);
});

test('bundle path canonicalization rejects traversal, double-encoding and unsupported paths', async () => {
  for (const bad of ['../secret', 'a/../secret', '%2e%2e/secret', '%252e%252e/secret',
    'a\\secret', '/etc/passwd', 'C:/windows', 'a//b', 'a/./b', 'a%2fb']) {
    assert.throws(() => cleanBundleRelative(bad), RenderPolicyError, bad);
  }
  assert.equal(cleanBundleRelative('assets/image%20file.png'), 'assets/image file.png');
});

test('file access stays inside configured roots, including symlinks; no HTTP trust bypass', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'html2pdf-roots-'));
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'html2pdf-escape-'));
  const oldRoots = process.env.RENDER_LOCAL_ROOTS;
  const oldTrust = process.env.RENDER_TRUSTED_STDIO;
  try {
    await fs.writeFile(path.join(root, 'index.html'), '<h1>local</h1>');
    await fs.writeFile(path.join(outside, 'secret.html'), 'outside');
    await fs.symlink(path.join(outside, 'secret.html'), path.join(root, 'link.html'));
    process.env.RENDER_LOCAL_ROOTS = root;
    process.env.RENDER_TRUSTED_STDIO = 'true';
    const a = await prepareSource({ filePath: path.join(root, 'index.html') }, false);
    assert.equal(a.profile, 'local-bundle');
    const b = await prepareSource({ filePath: path.join(root, 'index.html') }, true);
    assert.equal(b.profile, 'trusted-local');
    await assert.rejects(withinRoot(root, 'link.html'), /symlink escapes/);
    await assert.rejects(prepareSource({ filePath: path.join(outside, 'secret.html') }), RenderPolicyError);
    await assert.rejects(prepareSource({ filePath: '../secret.html' }), RenderPolicyError);
    assert.equal((await prepareSource({ html: '<p>safe</p>' }, false)).profile, 'local-bundle');
  } finally {
    if (oldRoots === undefined) delete process.env.RENDER_LOCAL_ROOTS;
    else process.env.RENDER_LOCAL_ROOTS = oldRoots;
    if (oldTrust === undefined) delete process.env.RENDER_TRUSTED_STDIO;
    else process.env.RENDER_TRUSTED_STDIO = oldTrust;
    await fs.rm(root, { recursive: true, force: true });
    await fs.rm(outside, { recursive: true, force: true });
  }
});

test('offline bundle renders bundled CSS without allowing external loads', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'html2pdf-bundle-'));
  const oldRoots = process.env.RENDER_LOCAL_ROOTS;
  let cleanup: (() => Promise<void>) | undefined;
  try {
    await fs.writeFile(path.join(root, 'index.html'),
      '<link rel="stylesheet" href="style.css"><h1 id="test">Offline pass</h1><img src="https://example.com/not-allowed.png">');
    await fs.writeFile(path.join(root, 'style.css'), 'h1 { color: rgb(0, 128, 0); }');
    process.env.RENDER_LOCAL_ROOTS = root;
    const render = await createRenderPage({ source: { filePath: path.join(root, 'index.html') } });
    cleanup = render.cleanup;
    assert.equal(render.profile, 'local-bundle');
    await render.page.goto(render.entryUrl, { waitUntil: 'load' });
    assert.equal(await render.page.locator('#test').textContent(), 'Offline pass');
    assert.equal(await render.page.locator('#test').evaluate(node => getComputedStyle(node).color), 'rgb(0, 128, 0)');
    assert.ok(render.blockedResources.some(item => item.url.includes('example.com')));
  } finally {
    if (cleanup) await cleanup();
    if (oldRoots === undefined) delete process.env.RENDER_LOCAL_ROOTS;
    else process.env.RENDER_LOCAL_ROOTS = oldRoots;
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('public HTTP(S) page is renderable while the private URL is denied', async () => {
  const render = await createRenderPage({ source: { url: 'https://example.com/' } });
  try {
    await render.page.goto(render.entryUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    assert.equal(render.profile, 'public-web');
    assert.ok((await render.page.locator('body').innerText()).trim().length > 20,
      'Public HTTP(S) page must render meaningful body content');
  } finally { await render.cleanup(); }
  await assert.rejects(prepareSource({ url: 'http://127.0.0.1/' }), RenderPolicyError);
});

async function freePort(): Promise<number> {
  const server = net.createServer();
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as net.AddressInfo;
  await new Promise<void>(resolve => server.close(() => resolve()));
  return address.port;
}

test('hosted REST/MCP require server-side credentials; uploaded scripts cannot access application origin', { timeout: 90_000 }, async () => {
  const port = await freePort();
  const token = 'test-secret-credential';
  const base = 'http://127.0.0.1:' + port;
  let serverDiagnostics = '';
  const child = spawn(path.resolve('node_modules/.bin/tsx'), ['server.ts'], {
    cwd: process.cwd(), env: { ...process.env, PORT: String(port), NODE_ENV: 'production',
      STUDIO_BIND_HOST: '127.0.0.1', STUDIO_API_TOKEN: token,
      STUDIO_PUBLIC_EGRESS_READY: 'false', APP_URL: base },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const capture = (chunk: Buffer) => { serverDiagnostics = (serverDiagnostics + chunk.toString('utf8')).slice(-10000); };
  child.stdout?.on('data', capture);
  child.stderr?.on('data', capture);
  const headers = { Authorization: 'Bearer ' + token };
  try {
    let started = false;
    for (let i = 0; i < 80; i++) {
      if (child.exitCode !== null) break;
      try {
        const res = await fetch(base + '/api/render-policy', { headers });
        if (res.ok) { started = true; break; }
      } catch {}
      await new Promise(resolve => setTimeout(resolve, 150));
    }
    assert.ok(started, 'Server failed to start');
    assert.equal((await fetch(base + '/api/render-policy')).status, 401);
    assert.equal((await fetch(base + '/mcp')).status, 401);
    assert.equal((await fetch(base + '/api/render-policy', { headers: { ...headers, Origin: 'https://evil.example' } })).status, 403);

    const form = new FormData();
    form.append('file', new File([
      '<script>parent.document.body.dataset.compromised="true"</script><h1 id="safe">Uploaded</h1>',
    ], 'index.html', { type: 'text/html' }));
    const upload = await fetch(base + '/api/upload', { method: 'POST', body: form, headers });
    assert.equal(upload.status, 200);
    const info = await upload.json() as { previewUrl: string };
    const asset = await fetch(base + info.previewUrl, { headers });
    assert.match(asset.headers.get('content-security-policy') || '', /sandbox;.*script-src 'none'/);
    assert.ok(!('fullDiskPath' in info), 'Physical filesystem paths must not be returned');

    const linkedBundle = new AdmZip();
    linkedBundle.addFile('index.html', Buffer.from('<link rel="stylesheet" href="theme.css"><h1 id="linked">Bundle CSS</h1>'));
    linkedBundle.addFile('theme.css', Buffer.from('h1 { color: rgb(0, 128, 0) }'));
    const zipForm = new FormData();
    zipForm.append('file', new File([Uint8Array.from(linkedBundle.toBuffer()).buffer as ArrayBuffer], 'bundle.zip'));
    const zipResponse = await fetch(base + '/api/upload', { method: 'POST', headers, body: zipForm });
    assert.equal(zipResponse.status, 200);
    const linked = await zipResponse.json() as { previewUrl: string };

    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext({ extraHTTPHeaders: headers });
      const page = await context.newPage();
      await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => { document.body.dataset.compromised = 'false'; });
      await page.evaluate(url => {
        const frame = document.createElement('iframe');
        frame.src = url; frame.sandbox.value = ''; document.body.appendChild(frame);
      }, base + info.previewUrl);
      await page.waitForTimeout(800);
      assert.equal(await page.evaluate(() => document.body.dataset.compromised), 'false');
      await page.evaluate(url => {
        const frame = document.createElement('iframe');
        frame.id = 'bundle'; frame.src = url; frame.sandbox.value = '';
        document.body.appendChild(frame);
      }, base + linked.previewUrl);
      await page.frameLocator('iframe#bundle').locator('#linked').waitFor();
      const color = await page.frameLocator('iframe#bundle').locator('#linked')
        .evaluate(node => getComputedStyle(node).color);
      assert.equal(color, 'rgb(0, 128, 0)', 'Bundled CSS must load in opaque-origin preview iframe');

      await context.close();
    } finally { await browser.close(); }

    const conversion = await fetch(base + '/api/convert', {
      signal: AbortSignal.timeout(20_000),
      method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: info.previewUrl, options: { pageSize: 'A4' } }),
    }).catch(err => { throw new Error('Hosted PDF conversion request failed: ' + String(err) + '\nServer output:\n' + serverDiagnostics); });
    assert.equal(conversion.status, 200, await conversion.text().catch(() => '') + '\nServer output:\n' + serverDiagnostics);
    const bad = await fetch(base + '/api/convert', {
      method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'http://127.0.0.1/private' }),
    });
    assert.equal(bad.status, 403);

    const zip = new AdmZip();
    zip.addFile('../escape.html', Buffer.from('bad'));
    const malicious = new FormData();
    malicious.append('file', new File([Uint8Array.from(zip.toBuffer()).buffer as ArrayBuffer], 'bad.zip'));
    const denied = await fetch(base + '/api/upload', { method: 'POST', headers, body: malicious });
    assert.ok(denied.status >= 400);
  } finally {
    child.kill('SIGTERM');
    await Promise.race([
      new Promise<void>(resolve => { if (child.exitCode !== null) resolve(); else child.once('exit', () => resolve()); }),
      new Promise<void>(resolve => setTimeout(() => { child.kill('SIGKILL'); resolve(); }, 3000)),
    ]);
    await closeBrowser();
  }
});
