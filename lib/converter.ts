/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import path from 'node:path';
import fs from 'node:fs/promises';
import { existsSync, mkdirSync } from 'node:fs';
import crypto from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
import { createRenderPage } from './browser.ts';

export interface PdfMetadata {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string | string[];
  creator?: string;
  producer?: string;
}

export interface WatermarkOptions {
  enabled?: boolean;
  type?: 'text' | 'image';
  text?: string;
  fontSize?: number;
  color?: string;
  imageUrl?: string;
  imageWidth?: number;
  opacity?: number;
  rotation?: number;
  layout?: 'center' | 'tiled' | 'absolute';
  x?: number | string;
  y?: number | string;
  coordinateUnit?: 'px' | 'mm' | '%';
  zIndex?: 'front' | 'back' | number;
}

export type CompressionLevel = 'high' | 'balanced' | 'small';

export interface TocOptions {
  enabled?: boolean;
  title?: string;
  maxLevel?: 1 | 2 | 3;
}

export interface ConvertOptions {
  media?: 'screen' | 'print';
  pageSizeAuthority?: 'css' | 'ui';
  preferCSSPageSize?: boolean;
  pageSize?: 'A4' | 'A3' | 'A5' | 'Letter' | 'Legal' | 'Tabloid' | 'Executive' | { width: string; height: string };
  orientation?: 'portrait' | 'landscape';
  margins?: {
    top?: string;
    bottom?: string;
    left?: string;
    right?: string;
  };
  scale?: number;
  background?: boolean;
  headerTemplate?: string;
  footerTemplate?: string;
  displayHeaderFooter?: boolean;
  pageRanges?: string;
  css?: string;
  watermark?: WatermarkOptions;
  metadata?: PdfMetadata;
  compression?: CompressionLevel;
  toc?: TocOptions;
  rasterMode?: boolean;
  waitForSelector?: string;
  delayMs?: number;
}

export interface ConvertSource {
  html?: string;
  url?: string;
  filePath?: string;
}

export interface ConvertResult {
  pdfPath: string;
  fileName: string;
  pages: number;
  fileSize: number;
  durationMs: number;
  downloadUrl: string;
  metadata?: PdfMetadata;
  profile: import('./render-policy.ts').RenderProfile;
  blockedResources: import('./render-policy.ts').BlockedResource[];
}

export interface PreviewResult {
  title: string;
  screenshotBase64: string;
  consoleErrors: string[];
  consoleLogs: string[];
  durationMs: number;
  profile: import('./render-policy.ts').RenderProfile;
  blockedResources: import('./render-policy.ts').BlockedResource[];
}

const OUTPUT_DIR = path.resolve(process.cwd(), 'output');
if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Counts PDF pages from raw binary content by scanning standard PDF object dictionaries.
 */
function extractPdfPageCount(buffer: Buffer): number {
  try {
    const text = buffer.toString('latin1');
    // Match /Type /Page (excluding /Pages)
    const matches = text.match(/\/Type\s*\/Page(?!\w)/g);
    if (matches && matches.length > 0) {
      return matches.length;
    }

    // Secondary fallback: check /Count
    const countMatch = text.match(/\/Count\s+(\d+)/);
    if (countMatch && countMatch[1]) {
      const parsed = parseInt(countMatch[1], 10);
      if (parsed > 0) return parsed;
    }
  } catch (err) {
    console.warn('[Converter] Failed to parse page count from buffer, fallback to 1:', err);
  }
  return 1;
}

/**
 * Normalizes margins into CSS-compatible units (e.g. "10mm", "0.5in").
 */
function normalizeMargins(margins?: ConvertOptions['margins'], ensureHeaderFooterRoom = false) {
  const formatUnit = (val?: string | number, fallback = '10mm') => {
    if (val === undefined || val === null || val === '') return fallback;
    if (typeof val === 'number') return `${val}mm`;
    if (/^\d+(\.\d+)?$/.test(val.trim())) return `${val.trim()}mm`;
    return val.trim();
  };

  const topDefault = ensureHeaderFooterRoom ? '15mm' : '10mm';
  const bottomDefault = ensureHeaderFooterRoom ? '15mm' : '10mm';

  if (!margins) {
    return { top: topDefault, bottom: bottomDefault, left: '10mm', right: '10mm' };
  }

  const top = formatUnit(margins.top, topDefault);
  const bottom = formatUnit(margins.bottom, bottomDefault);

  return {
    top: ensureHeaderFooterRoom && (top === '0mm' || top === '0') ? '15mm' : top,
    bottom: ensureHeaderFooterRoom && (bottom === '0mm' || bottom === '0') ? '15mm' : bottom,
    left: formatUnit(margins.left, '10mm'),
    right: formatUnit(margins.right, '10mm'),
  };
}

/**
 * Normalizes and styles Chromium header/footer templates.
 * Translates {{pageNumber}}, {{totalPages}}, {{date}}, {{title}}, {{url}} tokens
 * into Chromium-recognized <span class="..."></span> tags, and guarantees explicit font-size
 * so text is rendered cleanly (Chromium defaults to 0px font size in header/footers).
 */
export function formatChromiumTemplate(rawTemplate?: string, defaultFontSize = '10px'): string {
  if (!rawTemplate || !rawTemplate.trim()) return '<div></div>';

  let processed = rawTemplate
    .replace(/\{\{pageNumber\}\}/g, '<span class="pageNumber"></span>')
    .replace(/\{\{totalPages\}\}/g, '<span class="totalPages"></span>')
    .replace(/\{\{date\}\}/g, '<span class="date"></span>')
    .replace(/\{\{title\}\}/g, '<span class="title"></span>')
    .replace(/\{\{url\}\}/g, '<span class="url"></span>');

  // Chromium templates require explicit font-size and width on the root element
  if (!processed.includes('font-size:') && !processed.includes('fontSize')) {
    processed = `<div style="font-size: ${defaultFontSize}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; width: 100%; box-sizing: border-box; -webkit-print-color-adjust: exact;">${processed}</div>`;
  }
  return processed;
}

/**
 * Converts HTML, a local file, or a URL into a high-fidelity PDF.
 */
export async function convert(
  source: ConvertSource,
  options: ConvertOptions = {},
  mode: 'convert' | 'print' = 'convert',
  trustedStdio = false
): Promise<ConvertResult> {
  const startTime = Date.now();
  const effectiveMedia: 'screen' | 'print' =
    options.media === 'screen' || options.media === 'print'
      ? options.media
      : mode === 'print'
      ? 'print'
      : 'screen';

  const { page, cleanup, entryUrl, profile, blockedResources } = await createRenderPage({
    source, trustedStdio, deviceScaleFactor: 2,
    emulateMedia: effectiveMedia,
  });

  try {
    // 1. Open only the policy-approved virtual bundle or validated web URL.
    await page.goto(entryUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // 2. Wait for networkidle (with graceful timeout in case of streaming/analytics requests)
    try {
      await page.waitForLoadState('networkidle', { timeout: 6000 });
    } catch {
      // Network idle timed out, continue anyway as DOM is loaded
    }

    // 3. Wait for all webfonts to finish loading
    try {
      await page.evaluate(() => document.fonts.ready);
    } catch (err) {
      console.warn('[Converter] Font readiness check skipped or timed out:', err);
    }

    // 4. Inject quality preservation CSS rules (exact color reproduction, vector text, print breaks)
    const injectedQualityCss = `
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      @page {
        margin: auto;
      }
    `;
    await page.addStyleTag({ content: injectedQualityCss });

    // 5. Inject custom user CSS if provided
    if (options.css && options.css.trim().length > 0) {
      await page.addStyleTag({ content: options.css });
    }

    // 5b. Inject watermark if enabled
    if (options.watermark && options.watermark.enabled) {
      await injectWatermark(page, options.watermark);
    }

    // 5c. Inject document metadata into DOM if specified
    if (options.metadata) {
      await page.evaluate((meta) => {
        if (meta.title) document.title = meta.title;
        if (meta.author) {
          let authorMeta = document.querySelector('meta[name="author"]');
          if (!authorMeta) {
            authorMeta = document.createElement('meta');
            authorMeta.setAttribute('name', 'author');
            document.head.appendChild(authorMeta);
          }
          authorMeta.setAttribute('content', meta.author);
        }
        if (meta.subject) {
          let descMeta = document.querySelector('meta[name="description"]');
          if (!descMeta) {
            descMeta = document.createElement('meta');
            descMeta.setAttribute('name', 'description');
            document.head.appendChild(descMeta);
          }
          descMeta.setAttribute('content', meta.subject);
        }
        if (meta.keywords) {
          const kwStr = Array.isArray(meta.keywords) ? meta.keywords.join(', ') : meta.keywords;
          let kwMeta = document.querySelector('meta[name="keywords"]');
          if (!kwMeta) {
            kwMeta = document.createElement('meta');
            kwMeta.setAttribute('name', 'keywords');
            document.head.appendChild(kwMeta);
          }
          kwMeta.setAttribute('content', kwStr);
        }
      }, options.metadata);
    }

    // 5d. Optimize & downsample images according to compression settings
    const compression = options.compression || 'high';
    if (compression !== 'high') {
      console.log(`[Converter] Applying image compression & downsampling (level: ${compression})`);
      await optimizeDocumentImages(page, compression);
    }

    // 5e. Automatically generate & inject Table of Contents (TOC) page if requested
    if (options.toc && options.toc.enabled) {
      console.log('[Converter] Generating Table of Contents from headings <h1>-<h3>...');
      await generateAndInjectToc(page, options.toc, options.margins);
    }

    // 6. Optional waitForSelector or delay
    if (options.waitForSelector) {
      await page.waitForSelector(options.waitForSelector, { timeout: 10000 });
    }
    if (options.delayMs && options.delayMs > 0) {
      await page.waitForTimeout(Math.min(options.delayMs, 10000));
    }

    // 7. Configure PDF layout & margins
    const landscape = options.orientation === 'landscape';
    const scale = options.scale ? Math.max(0.1, Math.min(2.0, options.scale)) : 1.0;
    const printBackground = options.background !== false; // default true

    let format: any = undefined;
    let width: string | undefined = undefined;
    let height: string | undefined = undefined;

    if (options.pageSize) {
      if (typeof options.pageSize === 'string') {
        const standardSizes = ['A4', 'A3', 'A5', 'Letter', 'Legal', 'Tabloid', 'Executive'];
        if (standardSizes.includes(options.pageSize)) {
          format = options.pageSize;
        } else {
          format = 'A4';
        }
      } else if (typeof options.pageSize === 'object') {
        width = options.pageSize.width;
        height = options.pageSize.height;
      }
    } else {
      format = 'A4';
    }

    const hasHeaderOrFooter = Boolean(
      options.displayHeaderFooter ||
      (options.headerTemplate && options.headerTemplate.trim()) ||
      (options.footerTemplate && options.footerTemplate.trim())
    );

    const margins = normalizeMargins(options.margins, hasHeaderOrFooter);

    const preferCSSPageSize =
      options.pageSizeAuthority === 'ui'
        ? false
        : options.pageSizeAuthority === 'css'
        ? true
        : typeof options.preferCSSPageSize === 'boolean'
        ? options.preferCSSPageSize
        : true;

    // 8. Generate the PDF buffer
    console.log(
      `[Converter] Rendering PDF (mode: ${mode}, media: ${effectiveMedia}, preferCSSPageSize: ${preferCSSPageSize}, format: ${
        format || `${width}x${height}`
      }, landscape: ${landscape}, headerFooter: ${hasHeaderOrFooter})`
    );
    let pdfBuffer: Buffer = await page.pdf({
      format,
      width,
      height,
      landscape,
      margin: margins,
      scale,
      printBackground,
      displayHeaderFooter: hasHeaderOrFooter,
      headerTemplate: hasHeaderOrFooter ? formatChromiumTemplate(options.headerTemplate) : '<div></div>',
      footerTemplate: hasHeaderOrFooter ? formatChromiumTemplate(options.footerTemplate) : '<div></div>',
      pageRanges: options.pageRanges && options.pageRanges.trim() ? options.pageRanges.trim() : undefined,
      preferCSSPageSize,
    });

    let pages = extractPdfPageCount(pdfBuffer);

    // 8b. Embed Document Info Dictionary (Metadata & SEO) and optimize PDF streams
    const hasMetadata = Boolean(
      options.metadata &&
      (options.metadata.title || options.metadata.author || options.metadata.subject || options.metadata.keywords)
    );

    if (hasMetadata || compression === 'small') {
      try {
        const pdfDoc = await PDFDocument.load(pdfBuffer);
        if (options.metadata?.title) pdfDoc.setTitle(options.metadata.title);
        if (options.metadata?.author) pdfDoc.setAuthor(options.metadata.author);
        if (options.metadata?.subject) pdfDoc.setSubject(options.metadata.subject);
        if (options.metadata?.keywords) {
          const kwList = Array.isArray(options.metadata.keywords)
            ? options.metadata.keywords
            : options.metadata.keywords.split(',').map((k) => k.trim()).filter(Boolean);
          pdfDoc.setKeywords(kwList);
        }
        pdfDoc.setProducer(options.metadata?.producer || 'HTML2PDF Studio');
        pdfDoc.setCreator(options.metadata?.creator || 'HTML2PDF Studio (Playwright)');
        pdfDoc.setModificationDate(new Date());

        pages = pdfDoc.getPageCount();
        const modifiedBytes = await pdfDoc.save({
          useObjectStreams: compression === 'small',
        });
        pdfBuffer = Buffer.from(modifiedBytes);
        if (hasMetadata) {
          console.log(`[Converter] Embedded PDF Metadata: Title="${options.metadata?.title || ''}", Author="${options.metadata?.author || ''}"`);
        }
      } catch (metaErr) {
        console.warn('[Converter] Error embedding PDF metadata dictionary or compressing streams:', metaErr);
      }
    }

    // 9. Save PDF to ./output/
    const id = crypto.randomUUID().slice(0, 12);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `doc_${timestamp}_${id}.pdf`;
    const pdfPath = path.join(OUTPUT_DIR, fileName);

    await fs.writeFile(pdfPath, pdfBuffer);

    const durationMs = Date.now() - startTime;
    const fileSize = pdfBuffer.length;

    console.log(`[Converter] Generated ${fileName} (${pages} pages, ${(fileSize / 1024).toFixed(1)} KB) in ${durationMs}ms`);

    return {
      pdfPath,
      fileName,
      pages,
      fileSize,
      durationMs,
      downloadUrl: `/api/download/${fileName}`,
      metadata: options.metadata,
      profile,
      blockedResources,
    };
  } finally {
    await cleanup();
  }
}

/**
 * Captures a 2x crisp screenshot and diagnostic metadata from an HTML string or URL.
 * Designed for the MCP preview_html tool and UI live preview.
 */
export async function previewHtml(
  source: ConvertSource,
  options: {
    viewport?: { width: number; height: number };
    emulateMedia?: 'screen' | 'print';
    css?: string;
    watermark?: WatermarkOptions;
  } = {},
  trustedStdio = false
): Promise<PreviewResult> {
  const startTime = Date.now();
  const consoleErrors: string[] = [];
  const consoleLogs: string[] = [];

  const { page, cleanup, entryUrl, profile, blockedResources } = await createRenderPage({
    source, trustedStdio,
    viewport: options.viewport || { width: 1200, height: 800 },
    deviceScaleFactor: 2,
    emulateMedia: options.emulateMedia,
  });

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    } else {
      consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
    }
  });

  page.on('pageerror', (err) => {
    consoleErrors.push(err.message);
  });

  try {
    await page.goto(entryUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });

    try {
      await page.waitForLoadState('networkidle', { timeout: 5000 });
    } catch {}

    try {
      await page.evaluate(() => document.fonts.ready);
    } catch {}

    if (options.css) {
      await page.addStyleTag({ content: options.css });
    }

    if (options.watermark && options.watermark.enabled) {
      await injectWatermark(page, options.watermark);
    }

    const title = await page.title();
    const screenshotBuffer = await page.screenshot({
      fullPage: true,
      type: 'png',
    });

    return {
      title: title || 'Untitled Document',
      screenshotBase64: screenshotBuffer.toString('base64'),
      consoleErrors,
      consoleLogs: consoleLogs.slice(-20),
      durationMs: Date.now() - startTime,
      profile,
      blockedResources,
    };
  } finally {
    await cleanup();
  }
}

/**
 * Injects a vector text or image watermark into the page DOM.
 * Utilizes CSS position: fixed to ensure repeat display on every printed page in Chromium.
 */
export async function injectWatermark(page: any, watermark?: WatermarkOptions): Promise<void> {
  if (!watermark || !watermark.enabled) return;

  await page.evaluate((wm: WatermarkOptions) => {
    const existing = document.getElementById('html2pdf-watermark-container');
    if (existing) existing.remove();

    const container = document.createElement('div');
    container.id = 'html2pdf-watermark-container';
    container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      pointer-events: none;
      z-index: 2147483647;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    `;

    const opacity = typeof wm.opacity === 'number' ? Math.max(0.01, Math.min(1.0, wm.opacity)) : 0.15;
    const rotation = typeof wm.rotation === 'number' ? wm.rotation : -45;

    // Determine z-index: front (overlay) vs back (underlay behind body content)
    let computedZIndex = '2147483647';
    if (wm.zIndex === 'back') {
      computedZIndex = '0';
      // In print rendering, ensure body is transparent if watermark is in back
      document.body.style.backgroundColor = 'transparent';
    } else if (typeof wm.zIndex === 'number') {
      computedZIndex = String(wm.zIndex);
    }

    container.style.zIndex = computedZIndex;

    if (wm.layout === 'tiled') {
      const grid = document.createElement('div');
      grid.style.cssText = `
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        grid-template-rows: repeat(4, 1fr);
        width: 180vw;
        height: 180vh;
        gap: 80px;
        align-items: center;
        justify-items: center;
        opacity: ${opacity};
        transform: rotate(${rotation}deg);
        user-select: none;
      `;
      for (let i = 0; i < 16; i++) {
        if (wm.type === 'image' && wm.imageUrl) {
          const img = document.createElement('img');
          img.src = wm.imageUrl;
          img.style.cssText = `
            width: ${wm.imageWidth || 160}px;
            max-width: 100%;
            object-fit: contain;
          `;
          grid.appendChild(img);
        } else {
          const item = document.createElement('div');
          item.textContent = wm.text || 'CONFIDENTIAL';
          item.style.cssText = `
            font-size: ${wm.fontSize ? Math.round(wm.fontSize * 0.5) : 28}px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-weight: 800;
            letter-spacing: 3px;
            color: ${wm.color || '#ef4444'};
            text-transform: uppercase;
            white-space: nowrap;
          `;
          grid.appendChild(item);
        }
      }
      container.appendChild(grid);
    } else if (wm.layout === 'absolute') {
      // Absolute placement using X & Y coordinates
      const unit = wm.coordinateUnit || 'px';
      const xVal = wm.x !== undefined && wm.x !== '' ? wm.x : 20;
      const yVal = wm.y !== undefined && wm.y !== '' ? wm.y : 20;
      const posX = typeof xVal === 'number' ? `${xVal}${unit}` : xVal;
      const posY = typeof yVal === 'number' ? `${yVal}${unit}` : yVal;

      const absWrapper = document.createElement('div');
      absWrapper.style.cssText = `
        position: absolute;
        left: ${posX};
        top: ${posY};
        opacity: ${opacity};
        transform: rotate(${rotation}deg);
        transform-origin: center center;
        user-select: none;
        display: inline-block;
      `;

      if (wm.type === 'image' && wm.imageUrl) {
        const img = document.createElement('img');
        img.src = wm.imageUrl;
        img.style.cssText = `
          width: ${wm.imageWidth || 180}px;
          display: block;
          object-fit: contain;
        `;
        absWrapper.appendChild(img);
      } else {
        const textElem = document.createElement('div');
        textElem.textContent = wm.text || 'STAMP';
        const color = wm.color || '#ef4444';
        textElem.style.cssText = `
          font-size: ${wm.fontSize || 36}px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-weight: 800;
          letter-spacing: 4px;
          color: ${color};
          text-transform: uppercase;
          white-space: nowrap;
          border: 3.5px solid ${color};
          padding: 8px 24px;
          border-radius: 6px;
        `;
        absWrapper.appendChild(textElem);
      }
      container.appendChild(absWrapper);
    } else {
      // Default center layout
      const inner = document.createElement('div');
      inner.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: ${opacity};
        transform: rotate(${rotation}deg);
        user-select: none;
      `;

      if (wm.type === 'image' && wm.imageUrl) {
        const img = document.createElement('img');
        img.src = wm.imageUrl;
        img.style.cssText = `
          width: ${wm.imageWidth || 320}px;
          max-width: 80vw;
          object-fit: contain;
        `;
        inner.appendChild(img);
      } else {
        const textElem = document.createElement('div');
        textElem.textContent = wm.text || 'CONFIDENTIAL';
        const color = wm.color || '#ef4444';
        textElem.style.cssText = `
          font-size: ${wm.fontSize || 64}px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-weight: 800;
          letter-spacing: 6px;
          color: ${color};
          text-transform: uppercase;
          white-space: nowrap;
          border: 4px solid ${color};
          padding: 10px 32px;
          border-radius: 8px;
        `;
        inner.appendChild(textElem);
      }
      container.appendChild(inner);
    }

    document.body.appendChild(container);
  }, watermark);
}

/**
 * Returns a list of all generated PDF files stored in ./output/.
 */
export async function listGeneratedPdfs(): Promise<
  Array<{
    fileName: string;
    pdfPath: string;
    fileSizeBytes: number;
    fileSizeFormatted: string;
    createdAt: string;
    downloadUrl: string;
  }>
> {
  try {
    const entries = await fs.readdir(OUTPUT_DIR, { withFileTypes: true });
    const pdfFiles = entries.filter((e) => e.isFile() && e.name.endsWith('.pdf'));

    const results = await Promise.all(
      pdfFiles.map(async (file) => {
        const fullPath = path.join(OUTPUT_DIR, file.name);
        const stats = await fs.stat(fullPath);
        const kb = (stats.size / 1024).toFixed(1);
        return {
          fileName: file.name,
          pdfPath: fullPath,
          fileSizeBytes: stats.size,
          fileSizeFormatted: `${kb} KB`,
          createdAt: stats.mtime.toISOString(),
          downloadUrl: `/api/download/${file.name}`,
        };
      })
    );

    // Sort newest first
    return results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err) {
    console.error('[Converter] Error listing output directory:', err);
    return [];
  }
}

/**
 * Optimizes and downsamples images within the document page according to the compression level.
 * - 'high': Uncompressed, keeps original resolution and fidelity.
 * - 'balanced': Downsamples large images to max 1200px width/height and compresses JPEGs at 80% quality.
 * - 'small': Downsamples images to max 800px width/height and compresses JPEGs at 60% quality.
 */
export async function optimizeDocumentImages(page: any, compression: CompressionLevel = 'high'): Promise<void> {
  if (compression === 'high') return;

  await page.evaluate(async (level: CompressionLevel) => {
    const images = Array.from(document.querySelectorAll('img')) as HTMLImageElement[];
    const maxDim = level === 'small' ? 800 : 1200;
    const quality = level === 'small' ? 0.60 : 0.80;

    for (const img of images) {
      try {
        if (!img.complete || img.naturalWidth === 0 || img.naturalHeight === 0) continue;
        // Skip tiny icon graphics, SVG vector graphics or small badges
        if (img.naturalWidth <= 120 && img.naturalHeight <= 120) continue;
        if (img.src && img.src.startsWith('data:image/svg+xml')) continue;

        let targetW = img.naturalWidth;
        let targetH = img.naturalHeight;

        // Downsample if dimensions exceed max threshold
        if (Math.max(targetW, targetH) > maxDim) {
          const ratio = maxDim / Math.max(targetW, targetH);
          targetW = Math.round(targetW * ratio);
          targetH = Math.round(targetH * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;

        // Draw and compress image
        ctx.drawImage(img, 0, 0, targetW, targetH);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);

        // Only replace if successful and not empty
        if (compressedDataUrl && compressedDataUrl.length > 50) {
          img.src = compressedDataUrl;
        }
      } catch (err) {
        // Cross-origin tainted canvas or other silent issue; keep original image
        console.warn('Image optimization skipped for image:', err);
      }
    }
  }, compression);

  // Give Chromium a brief tick to decode updated compressed image buffers
  await page.waitForTimeout(100);
}

export interface TocHeadingItem {
  id: string;
  title: string;
  level: number;
  pageNumber: number;
}

/**
 * Automatically detects <h1>-<h3> headings within the page, calculates their
 * respective page numbers based on layout geometry and explicit page-breaks,
 * and generates a Table of Contents (TOC) page inserted at the beginning of the document.
 */
export async function generateAndInjectToc(
  page: any,
  tocOptions?: TocOptions,
  margins?: { top?: string; bottom?: string; left?: string; right?: string }
): Promise<TocHeadingItem[]> {
  if (!tocOptions || !tocOptions.enabled) return [];

  const maxLevel = tocOptions.maxLevel || 3;
  const tocTitle = tocOptions.title || 'Table of Contents';

  const headings = await page.evaluate(
    ({ maxLvl, titleText }: { maxLvl: number; titleText: string }) => {
      // 1. Remove previous TOC container if any exists
      const existing = document.getElementById('html2pdf-toc-page');
      if (existing) existing.remove();

      // 2. Select eligible headings according to maxLevel
      const selector = Array.from({ length: maxLvl }, (_, i) => `h${i + 1}`).join(', ');
      const rawHeadings = Array.from(document.querySelectorAll(selector)) as HTMLElement[];

      if (rawHeadings.length === 0) return [];

      // Approximate printable page height in 96DPI pixels (standard A4 = ~970px printable)
      const printableHeight = 970;

      // Check if document uses explicit .page or .pdf-page structures
      const pageContainers = Array.from(document.querySelectorAll('.page, .pdf-page, section.page')) as HTMLElement[];
      const hasPageContainers = pageContainers.length > 1;

      // 3. Process each heading
      const items: TocHeadingItem[] = rawHeadings.map((h, idx) => {
        if (!h.id || h.id.trim() === '') {
          h.id = `section-heading-${idx + 1}`;
        }

        let pageNum = 1;

        if (hasPageContainers) {
          const parentPage = h.closest('.page, .pdf-page, section.page');
          if (parentPage) {
            pageNum = pageContainers.indexOf(parentPage as HTMLElement) + 1;
          }
        } else {
          // Count explicit page breaks preceding this heading
          const allElements = Array.from(document.body.querySelectorAll('*')) as HTMLElement[];
          const hIdx = allElements.indexOf(h);
          let explicitBreakCount = 0;

          for (let i = 0; i < hIdx; i++) {
            const el = allElements[i];
            const style = window.getComputedStyle(el);
            if (
              style.pageBreakBefore === 'always' ||
              style.breakBefore === 'page' ||
              style.pageBreakAfter === 'always' ||
              style.breakAfter === 'page' ||
              el.classList.contains('page-break')
            ) {
              explicitBreakCount++;
            }
          }

          if (explicitBreakCount > 0) {
            pageNum = explicitBreakCount + 1;
          } else {
            const rect = h.getBoundingClientRect();
            const top = rect.top + window.scrollY;
            pageNum = Math.max(1, Math.floor(top / printableHeight) + 1);
          }
        }

        // Because inserting a TOC page will shift all content by +1 page,
        // we offset the target page reference by 1!
        const shiftedPage = pageNum + 1;

        return {
          id: h.id,
          title: (h.textContent || '').trim(),
          level: parseInt(h.tagName.substring(1), 10),
          pageNumber: shiftedPage,
        };
      });

      // 4. Construct high-fidelity Table of Contents HTML
      const tocWrapper = document.createElement('div');
      tocWrapper.id = 'html2pdf-toc-page';
      tocWrapper.className = 'html2pdf-toc-container';
      tocWrapper.style.pageBreakAfter = 'always';
      tocWrapper.style.breakAfter = 'page';
      tocWrapper.style.padding = '10px 0 35px 0';
      tocWrapper.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
      tocWrapper.style.color = '#0f172a';
      tocWrapper.style.boxSizing = 'border-box';

      let html = `
        <div style="border-bottom: 2.5px solid #2563eb; padding-bottom: 12px; margin-bottom: 24px;">
          <h2 style="margin: 0; font-size: 24px; font-weight: 700; color: #0f172a; letter-spacing: -0.02em;">
            ${titleText}
          </h2>
          <div style="font-size: 11px; color: #64748b; margin-top: 4px;">
            Document Outline & Page Index
          </div>
        </div>
        <div style="display: flex; flex-direction: column; gap: 10px;">
      `;

      for (const item of items) {
        const indent = (item.level - 1) * 22;
        const fontWeight = item.level === 1 ? '600' : item.level === 2 ? '500' : '400';
        const fontSize = item.level === 1 ? '13.5px' : item.level === 2 ? '12.5px' : '11.5px';
        const textColor = item.level === 1 ? '#0f172a' : item.level === 2 ? '#334155' : '#64748b';

        html += `
          <div style="display: flex; align-items: baseline; justify-content: space-between; padding-left: ${indent}px; font-size: ${fontSize}; line-height: 1.4;">
            <a href="#${item.id}" style="text-decoration: none; color: ${textColor}; font-weight: ${fontWeight}; flex-shrink: 0; max-width: 78%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              ${item.title}
            </a>
            <div style="flex-grow: 1; border-bottom: 1.5px dotted #cbd5e1; margin: 0 10px; height: 1px; min-width: 15px;"></div>
            <a href="#${item.id}" style="text-decoration: none; font-weight: 600; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; color: #2563eb; flex-shrink: 0; font-size: 12px;">
              ${item.pageNumber}
            </a>
          </div>
        `;
      }

      html += '</div>';
      tocWrapper.innerHTML = html;

      // Insert at the very top of document body
      document.body.insertBefore(tocWrapper, document.body.firstChild);

      return items;
    },
    { maxLvl: maxLevel, titleText: tocTitle }
  );

  return headings;
}
