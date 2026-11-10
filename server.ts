/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import crypto from 'node:crypto';
import multer from 'multer';
import AdmZip from 'adm-zip';
import dotenv from 'dotenv';
import { convert, listGeneratedPdfs, previewHtml, ConvertOptions } from './lib/converter.ts';
import { isBrowserConnected, closeBrowser } from './lib/browser.ts';
import { handleMcpSseConnection, handleMcpPostMessage, startStdioMcpServer } from './lib/mcp.ts';
import { optimizePrintCss } from './lib/gemini.ts';
import { cleanBundleRelative, RenderPolicyError } from './lib/render-policy.ts';
import {
  validateAndNormalizeConvertRequest,
  formatValidationErrorsSummary,
} from './lib/export-settings.ts';

dotenv.config();

// If --stdio flag is passed on command line, run in MCP stdio mode
if (process.argv.includes('--stdio')) {
  startStdioMcpServer().catch((err) => {
    console.error('Fatal MCP stdio error:', err);
    process.exit(1);
  });
} else {
  startServer().catch((err) => {
    console.error('Fatal server startup error:', err);
    process.exit(1);
  });
}

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);
  const isDev = process.env.NODE_ENV !== 'production';
  const bindHost = process.env.STUDIO_BIND_HOST || '127.0.0.1';
  const localOnly = bindHost === '127.0.0.1' || bindHost === '::1';
  const restToken = process.env.STUDIO_API_TOKEN || '';
  const proxySecret = process.env.STUDIO_PROXY_AUTH_SECRET || '';
  if ((!isDev || !localOnly) && !restToken && !proxySecret) {
    throw new Error('Hosted or network-bound server requires STUDIO_API_TOKEN or STUDIO_PROXY_AUTH_SECRET');
  }
  const allowedOrigins = new Set((process.env.STUDIO_ALLOWED_ORIGINS || '').split(',').map(x => x.trim()).filter(Boolean));
  if (process.env.APP_URL) {
    try { allowedOrigins.add(new URL(process.env.APP_URL).origin); } catch {}
  }
  if (localOnly) { allowedOrigins.add('http://localhost:' + PORT); allowedOrigins.add('http://127.0.0.1:' + PORT); }
  const secretMatches = (provided: string | undefined, expected: string): boolean => {
    if (!provided || !expected) return false;
    const a = Buffer.from(provided), b = Buffer.from(expected);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  };
  const apiGuard = (req: Request, res: Response, next: NextFunction) => {
    const origin = req.get('Origin');
    const opaquePreviewAsset = origin === 'null' && req.method === 'GET' && req.originalUrl.startsWith('/api/preview/');
    if (origin && !allowedOrigins.has(origin) && !opaquePreviewAsset) return res.status(403).json({ error: 'Origin not allowed' });
    if (localOnly && isDev && !restToken && !proxySecret) return next();
    const bearer = req.get('Authorization')?.match(/^Bearer (.+)$/i)?.[1];
    const proxy = req.get('X-Studio-Proxy-Secret');
    if (secretMatches(bearer, restToken) || secretMatches(proxy, proxySecret)) return next();
    return res.status(401).json({ error: 'Authentication required' });
  };

  // Ensure directories exist
  const uploadsDir = path.resolve(process.cwd(), 'uploads');
  const outputDir = path.resolve(process.cwd(), 'output');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  // Middleware
  app.use(cors({
    origin: (origin, callback) => callback(null, Boolean(origin && allowedOrigins.has(origin))),
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
  }));
  app.use('/api', apiGuard);
  app.use('/mcp', apiGuard);
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Multer config for file uploads
  const storage = multer.memoryStorage();
  const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  });

  // ---------------- MCP Endpoints (Streamable SSE HTTP) ----------------
  app.get('/mcp', async (req: Request, res: Response) => {
    await handleMcpSseConnection(req, res);
  });

  app.post('/mcp/messages', async (req: Request, res: Response) => {
    await handleMcpPostMessage(req, res);
  });

  // ---------------- REST API Endpoints ----------------
  app.get('/api/render-policy', (_req: Request, res: Response) => {
    res.json({ profiles: ['local-bundle', 'public-web'], trustedLocal: 'operator-only stdio',
      detail: 'Local bundle blocks external requests. Public web denies non-public network targets.' });
  });

  // Health check
  app.get('/api/health', async (_req: Request, res: Response) => {
    try {
      res.json({
        status: 'ok',
        browserConnected: isBrowserConnected(),
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        renderingProfiles: ['local-bundle', 'public-web'],
      });
    } catch (err: any) {
      res.status(500).json({ status: 'error', message: err.message });
    }
  });

  // Safe image-only UI preview for public pages: never put an arbitrary URL
  // directly in an application-origin iframe. The same server-side request
  // policy used for PDF/MCP rendering applies to every screenshot resource.
  app.post('/api/preview-html', async (req: Request, res: Response) => {
    try {
      const source = { html: req.body?.html, url: req.body?.url, filePath: req.body?.filePath };
      const viewport = req.body?.viewport;
      const width = Number(viewport?.width) || 1200;
      const height = Number(viewport?.height) || 800;
      if (!Number.isFinite(width) || !Number.isFinite(height) ||
          width < 320 || width > 1920 || height < 320 || height > 1600) {
        return res.status(400).json({ error: 'Invalid preview viewport' });
      }
      const screenshot = await previewHtml(source, {
        emulateMedia: req.body?.emulateMedia === 'print' ? 'print' : 'screen',
        viewport: { width, height },
      });
      res.setHeader('Cache-Control', 'no-store');
      res.json(screenshot);
    } catch (err: any) {
      console.error('[API] /api/preview-html error:', err);
      res.status(err instanceof RenderPolicyError ? 403 : 500).json({
        error: err.message || 'Preview failed',
        blockedResources: err instanceof RenderPolicyError ? [{ url: err.url || '', reason: err.message }] : [],
      });
    }
  });

  // Convert HTML / URL / File to PDF
  app.post('/api/convert', async (req: Request, res: Response) => {
    try {
      const validation = validateAndNormalizeConvertRequest(req.body, 'screen');
      if (!validation.isValid) {
        return res.status(400).json({
          error: `Validation error: ${formatValidationErrorsSummary(validation.errors)}`,
          errors: validation.errors,
          details: validation.errorList,
          warnings: validation.warnings,
        });
      }

      const { source, options } = validation.data!;
      const result = await convert(source, options, 'convert');
      res.json(result);
    } catch (err: any) {
      console.error('[API] /api/convert error:', err);
      res.status(err instanceof RenderPolicyError ? 403 : 500).json({ error: err.message || 'Conversion failed', blockedResources: err instanceof RenderPolicyError ? [{ url: err.url || '', reason: err.message }] : [] });
    }
  });

  // Print-to-PDF (emulates browser Print dialog with @media print)
  app.post('/api/print-pdf', async (req: Request, res: Response) => {
    try {
      const validation = validateAndNormalizeConvertRequest(req.body, 'print');
      if (!validation.isValid) {
        return res.status(400).json({
          error: `Validation error: ${formatValidationErrorsSummary(validation.errors)}`,
          errors: validation.errors,
          details: validation.errorList,
          warnings: validation.warnings,
        });
      }

      const { source, options } = validation.data!;
      const result = await convert(source, options, 'print');
      res.json(result);
    } catch (err: any) {
      console.error('[API] /api/print-pdf error:', err);
      res.status(err instanceof RenderPolicyError ? 403 : 500).json({ error: err.message || 'Print to PDF failed', blockedResources: err instanceof RenderPolicyError ? [{ url: err.url || '', reason: err.message }] : [] });
    }
  });

  // Upload HTML file or ZIP bundle
  app.post('/api/upload', upload.single('file'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded.' });
      }

      const uploadId = crypto.randomUUID();
      const targetDir = path.join(uploadsDir, uploadId);
      await fsPromises.mkdir(targetDir, { recursive: true });

      const originalName = req.file.originalname.toLowerCase();
      let mainHtmlFile = 'index.html';
      let assetCount = 0;

      if (originalName.endsWith('.zip')) {
        // Extract ZIP bundle safely
        const zip = new AdmZip(req.file.buffer);
        const entries = zip.getEntries();
        if (entries.length > 500) throw new RenderPolicyError('ZIP contains too many entries');
        let expandedBytes = 0;
        for (const entry of entries) {
          const rel = cleanBundleRelative(entry.entryName.replace(/\/$/, ''));
          const fileType = (entry.attr >>> 16) & 0o170000;
          if (fileType === 0o120000) throw new RenderPolicyError('ZIP symbolic links are not allowed', rel);
          if (entry.isDirectory) continue;
          expandedBytes += entry.header.size;
          if (expandedBytes > 100 * 1024 * 1024 ||
              (entry.header.size > 1024 * 1024 && entry.header.size > Math.max(1, entry.header.compressedSize) * 150)) {
            throw new RenderPolicyError('ZIP extraction limit exceeded', rel);
          }
          const out = path.resolve(targetDir, rel);
          if (!out.startsWith(targetDir + path.sep)) throw new RenderPolicyError('ZIP path traversal denied', rel);
          await fsPromises.mkdir(path.dirname(out), { recursive: true });
          const data = entry.getData();
          if (data.length !== entry.header.size) throw new RenderPolicyError('ZIP entry size mismatch', rel);
          await fsPromises.writeFile(out, data, { flag: 'wx' });
        }

        // Find index.html or first .html file
        const findHtmlFiles = (dir: string): string[] => {
          let results: string[] = [];
          const list = fs.readdirSync(dir, { withFileTypes: true });
          for (const item of list) {
            const fullPath = path.join(dir, item.name);
            if (item.isDirectory()) {
              results = results.concat(findHtmlFiles(fullPath));
            } else if (item.name.toLowerCase().endsWith('.html') || item.name.toLowerCase().endsWith('.htm')) {
              results.push(path.relative(targetDir, fullPath));
            } else {
              assetCount++;
            }
          }
          return results;
        };

        const htmlFiles = findHtmlFiles(targetDir);
        if (htmlFiles.length === 0) {
          throw new Error('No .html or .htm file found inside the uploaded ZIP archive.');
        }

        const preferred = htmlFiles.find((f) => path.basename(f).toLowerCase() === 'index.html');
        mainHtmlFile = preferred || htmlFiles[0];
      } else if (originalName.endsWith('.html') || originalName.endsWith('.htm')) {
        // Single HTML file
        const savePath = path.join(targetDir, 'index.html');
        await fsPromises.writeFile(savePath, req.file.buffer);
        mainHtmlFile = 'index.html';
      } else {
        return res.status(400).json({ error: 'Unsupported file type. Please upload a .html, .htm, or .zip archive.' });
      }

      const previewUrl = `/api/preview/${uploadId}/${mainHtmlFile}`;
      const fullDiskPath = path.join(targetDir, mainHtmlFile);

      // Read content for the editor
      const rawHtml = await fsPromises.readFile(fullDiskPath, 'utf-8');

      res.json({
        id: uploadId,
        fileName: req.file.originalname,
        previewUrl,
        rawHtml,
        mainFile: mainHtmlFile,
        assetCount,
      });
    } catch (err: any) {
      console.error('[API] /api/upload error:', err);
      res.status(err instanceof RenderPolicyError ? 400 : 500).json({ error: err.message || 'Upload processing failed' });
    }
  });

  // Uploaded documents are opaque-origin, scriptless even when opened directly.
  // A dedicated preview hostname is preferable for hosted installations.
  app.use('/api/preview/:id', (req: Request, res: Response, next: NextFunction) => {
    const uploadId = req.params.id;
    if (!/^[a-f0-9-]{36}$/.test(uploadId)) return res.status(400).send('Invalid bundle id');
    const targetDir = path.join(uploadsDir, uploadId);
    if (!fs.existsSync(targetDir)) return res.status(404).send('Preview upload session not found');
    res.setHeader('Content-Security-Policy',
      "sandbox; default-src 'none'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; script-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'");
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // An iframe with CSP sandbox has an opaque origin; allow its own static assets.
    // Authentication still applies to these unpredictable bundle URLs.
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Access-Control-Allow-Origin', 'null');
    res.setHeader('Cache-Control', 'no-store');
    express.static(targetDir, { index: 'index.html', dotfiles: 'deny', fallthrough: false })(req, res, next);
  });

  // Download generated PDF as attachment
  app.get('/api/download/:file', (req: Request, res: Response) => {
    const fileName = path.basename(req.params.file);
    const filePath = path.join(outputDir, fileName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'PDF file not found or expired.' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    fs.createReadStream(filePath).pipe(res);
  });

  // Inline view of generated PDF (for embedded PDF viewer)
  app.get('/api/output/:file', (req: Request, res: Response) => {
    const fileName = path.basename(req.params.file);
    const filePath = path.join(outputDir, fileName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'PDF file not found.' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    fs.createReadStream(filePath).pipe(res);
  });

  // List all generated PDFs
  app.get('/api/list', async (_req: Request, res: Response) => {
    try {
      const list = await listGeneratedPdfs();
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Optimize CSS for print using Gemini AI
  app.post('/api/ai/optimize-css', async (req: Request, res: Response) => {
    try {
      const { html } = req.body;
      if (!html) {
        return res.status(400).json({ error: 'HTML string required for CSS optimization.' });
      }

      const result = await optimizePrintCss(html);
      res.json(result);
    } catch (err: any) {
      console.error('[API] /api/ai/optimize-css error:', err);
      res.status(500).json({ error: err.message || 'AI optimization failed' });
    }
  });

  // ---------------- UI & Vite Dev Server / Static Files ----------------
  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('[Server] Vite middleware mounted in dev mode (HMR disabled).');
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req: Request, res: Response) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  const server = app.listen(PORT, bindHost, () => {
    console.log(`=================================================`);
    console.log(`🚀 HTML2PDF Studio live at: http://localhost:${PORT}`);
    console.log(`📡 MCP SSE endpoint ready:  http://localhost:${PORT}/mcp`);
    console.log(`📑 REST API ready at:       http://localhost:${PORT}/api/convert`);
    console.log(`=================================================`);
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('[Server] Gracefully shutting down...');
    await closeBrowser();
    server.close(() => {
      console.log('[Server] HTTP server closed.');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
