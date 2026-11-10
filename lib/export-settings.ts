/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ============================================================================
 * EXPORT SETTINGS NORMALIZER & SHARED RUNTIME VALIDATION
 * ============================================================================
 *
 * This module defines the single authoritative contract for PDF export
 * settings across REST API endpoints (/api/convert, /api/print-pdf), MCP tool
 * boundaries (html_to_pdf, print_to_pdf), and the React UI (single & batch).
 *
 * Compatibility Mapping:
 * 1. pageSizeAuthority:
 *    - Explicit 'css' | 'ui' takes priority.
 *    - Legacy boolean `preferCSSPageSize`:
 *        true  => pageSizeAuthority: 'css' (CSS @page rules dictate size)
 *        false => pageSizeAuthority: 'ui'  (UI paper size strictly enforces size)
 *    - Default when omitted: 'css' (preserves historical default where preferCSSPageSize: true).
 *
 * 2. media:
 *    - Explicit 'screen' | 'print' is honored equally by both routes.
 *    - Default when omitted:
 *        /api/print-pdf (and MCP print_to_pdf) => 'print'
 *        /api/convert   (and MCP html_to_pdf)  => 'screen'
 *
 * 3. rasterMode:
 *    - Renderer implementation is not yet available.
 *    - Flags any requested rasterMode: true as unavailable (normalized to false),
 *      recording a diagnostic warning rather than misrepresenting behavior.
 *
 * 4. margins:
 *    - Presets: 'none' (0mm), 'minimal' (5mm), 'normal' (10mm, 15mm with headers).
 *    - Custom inputs are validated for non-negative values and checked to guarantee
 *      usable printable space (horizontal margins < page width; vertical margins < page height).
 */

export type PrintMedia = 'screen' | 'print';
export type PageSizeAuthority = 'css' | 'ui';

export type StandardPageSize =
  | 'A4'
  | 'A3'
  | 'A5'
  | 'Letter'
  | 'Legal'
  | 'Tabloid'
  | 'Executive';

export interface CustomPageDimensions {
  width: string;
  height: string;
}

export type PageSizeOption = StandardPageSize | CustomPageDimensions | 'Custom' | string;

export interface MarginsSettings {
  top: string;
  bottom: string;
  left: string;
  right: string;
}

export interface WatermarkSettings {
  enabled: boolean;
  type: 'text' | 'image';
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

export interface DocumentMetadataSettings {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string | string[];
  creator?: string;
  producer?: string;
}

export interface TocSettings {
  enabled: boolean;
  title: string;
  maxLevel: 1 | 2 | 3;
}

export interface ConvertSource {
  html?: string;
  url?: string;
  filePath?: string;
}

/**
 * Clean, fully normalized and validated export settings.
 */
export interface NormalizedExportSettings {
  media: PrintMedia;
  pageSizeAuthority: PageSizeAuthority;
  pageSize: StandardPageSize | CustomPageDimensions;
  orientation: 'portrait' | 'landscape';
  margins: MarginsSettings;
  scale: number;
  background: boolean;
  displayHeaderFooter: boolean;
  headerTemplate?: string;
  footerTemplate?: string;
  pageRanges?: string;
  css?: string;
  watermark?: WatermarkSettings;
  metadata?: DocumentMetadataSettings;
  compression: 'high' | 'balanced' | 'small';
  toc?: TocSettings;
  rasterMode: false; // Explicitly false while renderer is unavailable
  waitForSelector?: string;
  delayMs?: number;
}

export interface ValidationErrorItem {
  field: string;
  message: string;
}

export interface ValidationResult<T> {
  isValid: boolean;
  data?: T;
  errors: Record<string, string>;
  errorList: ValidationErrorItem[];
  warnings: string[];
}

export const STANDARD_PAGE_SIZES_MM: Record<StandardPageSize, { width: number; height: number }> = {
  A4: { width: 210, height: 297 },
  A3: { width: 297, height: 420 },
  A5: { width: 148, height: 210 },
  Letter: { width: 215.9, height: 279.4 },
  Legal: { width: 215.9, height: 355.6 },
  Tabloid: { width: 279.4, height: 431.8 },
  Executive: { width: 184.15, height: 266.7 },
};

export const MAX_TEMPLATE_LENGTH = 15000;
export const MIN_SCALE = 0.1;
export const MAX_SCALE = 2.0;
export const MAX_PAGE_DIMENSION_MM = 5000;
export const MIN_PAGE_DIMENSION_MM = 10;

/**
 * Parses a CSS dimension string or number into millimeters.
 * Supports: mm, cm, in, pt, px (at 96 DPI CSS standard), or bare numeric (default mm).
 */
export function parseDimensionToMm(val: string | number | undefined | null): number | null {
  if (val === undefined || val === null) return null;
  if (typeof val === 'number') {
    return Number.isFinite(val) ? val : null;
  }
  const str = String(val).trim();
  if (!str) return null;

  const match = str.match(/^([+-]?\d+(?:\.\d+)?)\s*(mm|cm|in|pt|px)?$/i);
  if (!match) return null;

  const num = parseFloat(match[1]);
  if (!Number.isFinite(num)) return null;

  const unit = (match[2] || 'mm').toLowerCase();
  switch (unit) {
    case 'mm':
      return num;
    case 'cm':
      return num * 10;
    case 'in':
      return num * 25.4;
    case 'pt':
      return (num * 25.4) / 72;
    case 'px':
      return (num * 25.4) / 96;
    default:
      return null;
  }
}

/**
 * Formats a value into a canonical CSS unit string (e.g., "10mm").
 */
export function formatToCssUnit(val: string | number | undefined | null, fallback = '10mm'): string {
  if (val === undefined || val === null || val === '') return fallback;
  if (typeof val === 'number') return `${val}mm`;
  const str = String(val).trim();
  if (/^[+-]?\d+(\.\d+)?$/.test(str)) {
    return `${str}mm`;
  }
  return str;
}

/**
 * Calculates page dimensions in millimeters for a given page size and orientation.
 */
export function getPageDimensionsMm(
  pageSize: StandardPageSize | CustomPageDimensions | string,
  orientation: 'portrait' | 'landscape' = 'portrait'
): { width: number; height: number } {
  let w = 210;
  let h = 297;

  if (typeof pageSize === 'string') {
    const key = pageSize as StandardPageSize;
    if (STANDARD_PAGE_SIZES_MM[key]) {
      w = STANDARD_PAGE_SIZES_MM[key].width;
      h = STANDARD_PAGE_SIZES_MM[key].height;
    }
  } else if (pageSize && typeof pageSize === 'object') {
    const parsedW = parseDimensionToMm(pageSize.width);
    const parsedH = parseDimensionToMm(pageSize.height);
    if (parsedW && parsedW > 0) w = parsedW;
    if (parsedH && parsedH > 0) h = parsedH;
  }

  if (orientation === 'landscape') {
    return { width: Math.max(w, h), height: Math.min(w, h) };
  }
  return { width: Math.min(w, h), height: Math.max(w, h) };
}

/**
 * Validates page-range syntax strictly.
 * Valid examples: "1", "1-5", "1, 3, 5", "2-", "-4", "1-3, 5-8".
 * Invalid examples: "0", "-0", "5-2", "abc", "1,,3".
 */
export function validatePageRanges(rangeStr?: string): { isValid: boolean; error?: string } {
  if (!rangeStr || !rangeStr.trim()) return { isValid: true };
  const str = rangeStr.trim();
  const segments = str.split(',').map((s) => s.trim());
  if (segments.length === 0) return { isValid: true };

  for (const seg of segments) {
    if (!seg) {
      return {
        isValid: false,
        error: `Empty segment in page ranges "${rangeStr}". Please remove consecutive or trailing commas.`,
      };
    }

    // Single page: e.g. "3"
    if (/^\d+$/.test(seg)) {
      const num = parseInt(seg, 10);
      if (num < 1) {
        return {
          isValid: false,
          error: `Invalid page number ${num} in "${seg}". Page numbers must be 1 or greater.`,
        };
      }
      continue;
    }

    // Range: e.g. "1-5"
    const rangeMatch = seg.match(/^(\d+)-(\d+)$/);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1], 10);
      const end = parseInt(rangeMatch[2], 10);
      if (start < 1 || end < 1) {
        return {
          isValid: false,
          error: `Invalid range "${seg}". Page numbers must be 1 or greater.`,
        };
      }
      if (start > end) {
        return {
          isValid: false,
          error: `Inverted page range "${seg}": start (${start}) cannot exceed end (${end}).`,
        };
      }
      continue;
    }

    // Open end: e.g. "2-"
    const openEndMatch = seg.match(/^(\d+)-$/);
    if (openEndMatch) {
      const start = parseInt(openEndMatch[1], 10);
      if (start < 1) {
        return {
          isValid: false,
          error: `Invalid start page in "${seg}". Page numbers must be 1 or greater.`,
        };
      }
      continue;
    }

    // Open start: e.g. "-4"
    const openStartMatch = seg.match(/^-(\d+)$/);
    if (openStartMatch) {
      const end = parseInt(openStartMatch[1], 10);
      if (end < 1) {
        return {
          isValid: false,
          error: `Invalid end page in "${seg}". Page numbers must be 1 or greater.`,
        };
      }
      continue;
    }

    return {
      isValid: false,
      error: `Invalid page range syntax: "${seg}". Allowed formats: "1-5", "1, 3, 5", "2-", or "-4".`,
    };
  }

  return { isValid: true };
}

/**
 * Validates that exactly one source (html, url, or filePath) is provided and valid.
 */
export function validateExportSource(source?: ConvertSource): {
  isValid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};
  if (!source) {
    errors['source'] = 'Exactly one source (html, url, or filePath) must be provided.';
    return { isValid: false, errors };
  }

  const hasHtml = typeof source.html === 'string' && source.html.trim().length > 0;
  const hasUrl = typeof source.url === 'string' && source.url.trim().length > 0;
  const hasFilePath = typeof source.filePath === 'string' && source.filePath.trim().length > 0;

  const count = (hasHtml ? 1 : 0) + (hasUrl ? 1 : 0) + (hasFilePath ? 1 : 0);

  if (count === 0) {
    errors['source'] = 'Exactly one source must be provided: provide either html, url, or filePath.';
  } else if (count > 1) {
    const present = [hasHtml && 'html', hasUrl && 'url', hasFilePath && 'filePath'].filter(Boolean).join(', ');
    errors['source'] = `Multiple sources provided (${present}). Please provide exactly one source.`;
  } else if (hasUrl) {
    const trimmed = source.url!.trim();
    const isValidProtocol =
      trimmed.startsWith('http://') ||
      trimmed.startsWith('https://') ||
      trimmed.startsWith('/api/preview/');
    if (!isValidProtocol) {
      errors['url'] = 'URL must begin with http://, https://, or /api/preview/';
    }
  }

  return { isValid: Object.keys(errors).length === 0, errors };
}

/**
 * Normalizes and validates export settings against dimension, margin, scale,
 * page-range, and template limit rules.
 */
export function normalizeExportSettings(
  rawInput: any = {},
  routeDefaultMedia: PrintMedia = 'print'
): ValidationResult<NormalizedExportSettings> {
  const errors: Record<string, string> = {};
  const warnings: string[] = [];

  const raw = rawInput || {};

  // 1. Explicit Screen / Print Media
  let media: PrintMedia = routeDefaultMedia;
  if (raw.media === 'screen' || raw.media === 'print') {
    media = raw.media;
  } else if (raw.media !== undefined && raw.media !== null && raw.media !== '') {
    errors['media'] = `Invalid media type "${raw.media}". Must be "screen" or "print".`;
  }

  // 2. Choice between CSS @page size and UI paper size (with legacy preferCSSPageSize compatibility)
  let pageSizeAuthority: PageSizeAuthority = 'css';
  if (raw.pageSizeAuthority === 'css' || raw.pageSizeAuthority === 'ui') {
    pageSizeAuthority = raw.pageSizeAuthority;
  } else if (typeof raw.preferCSSPageSize === 'boolean') {
    pageSizeAuthority = raw.preferCSSPageSize ? 'css' : 'ui';
  } else if (raw.pageSizeAuthority !== undefined && raw.pageSizeAuthority !== null && raw.pageSizeAuthority !== '') {
    errors['pageSizeAuthority'] = `Invalid pageSizeAuthority "${raw.pageSizeAuthority}". Must be "css" or "ui".`;
  }

  // 3. Orientation
  const orientation: 'portrait' | 'landscape' = raw.orientation === 'landscape' ? 'landscape' : 'portrait';

  // 4. Page Size & Dimensions
  let finalPageSize: StandardPageSize | CustomPageDimensions = 'A4';
  let isCustom = false;
  let customWidthStr = '';
  let customHeightStr = '';

  if (raw.pageSize === 'Custom' || (typeof raw.pageSize === 'object' && raw.pageSize !== null)) {
    isCustom = true;
    if (typeof raw.pageSize === 'object') {
      customWidthStr = String(raw.pageSize.width || '');
      customHeightStr = String(raw.pageSize.height || '');
    } else {
      customWidthStr = String(raw.customWidth || '');
      customHeightStr = String(raw.customHeight || '');
    }
  } else if (typeof raw.pageSize === 'string') {
    const standardKeys: StandardPageSize[] = ['A4', 'A3', 'A5', 'Letter', 'Legal', 'Tabloid', 'Executive'];
    const matched = standardKeys.find((k) => k.toLowerCase() === raw.pageSize.toLowerCase());
    if (matched) {
      finalPageSize = matched;
    } else if (raw.customWidth && raw.customHeight) {
      isCustom = true;
      customWidthStr = String(raw.customWidth);
      customHeightStr = String(raw.customHeight);
    } else {
      errors['pageSize'] = `Unsupported page size "${raw.pageSize}". Choose from ${standardKeys.join(', ')} or Custom.`;
    }
  }

  if (isCustom) {
    const widthMm = parseDimensionToMm(customWidthStr);
    const heightMm = parseDimensionToMm(customHeightStr);

    if (widthMm === null || widthMm <= 0) {
      errors['customWidth'] = 'Custom width must be a finite positive dimension (e.g. "210mm", "8.5in").';
    } else if (widthMm < MIN_PAGE_DIMENSION_MM || widthMm > MAX_PAGE_DIMENSION_MM) {
      errors['customWidth'] = `Custom width must be between ${MIN_PAGE_DIMENSION_MM}mm and ${MAX_PAGE_DIMENSION_MM}mm.`;
    }

    if (heightMm === null || heightMm <= 0) {
      errors['customHeight'] = 'Custom height must be a finite positive dimension (e.g. "297mm", "11in").';
    } else if (heightMm < MIN_PAGE_DIMENSION_MM || heightMm > MAX_PAGE_DIMENSION_MM) {
      errors['customHeight'] = `Custom height must be between ${MIN_PAGE_DIMENSION_MM}mm and ${MAX_PAGE_DIMENSION_MM}mm.`;
    }

    if (!errors['customWidth'] && !errors['customHeight']) {
      finalPageSize = {
        width: formatToCssUnit(customWidthStr),
        height: formatToCssUnit(customHeightStr),
      };
    }
  }

  // 5. Scale Factor
  let scale = 1.0;
  if (raw.scale !== undefined && raw.scale !== null && raw.scale !== '') {
    const parsedScale = typeof raw.scale === 'number' ? raw.scale : parseFloat(String(raw.scale));
    if (!Number.isFinite(parsedScale) || parsedScale < MIN_SCALE || parsedScale > MAX_SCALE) {
      errors['scale'] = `Scale must be a finite number between ${MIN_SCALE} and ${MAX_SCALE} (got ${raw.scale}).`;
    } else {
      scale = parsedScale;
    }
  }

  // 6. Header / Footer display & limits
  const hasExplicitHeader = Boolean(raw.headerTemplate && String(raw.headerTemplate).trim().length > 0);
  const hasExplicitFooter = Boolean(raw.footerTemplate && String(raw.footerTemplate).trim().length > 0);
  const displayHeaderFooter = Boolean(raw.displayHeaderFooter || hasExplicitHeader || hasExplicitFooter);

  let headerTemplate = raw.headerTemplate ? String(raw.headerTemplate) : undefined;
  let footerTemplate = raw.footerTemplate ? String(raw.footerTemplate) : undefined;

  if (headerTemplate && headerTemplate.length > MAX_TEMPLATE_LENGTH) {
    errors['headerTemplate'] = `Header template exceeds maximum length of ${MAX_TEMPLATE_LENGTH} characters.`;
  }
  if (footerTemplate && footerTemplate.length > MAX_TEMPLATE_LENGTH) {
    errors['footerTemplate'] = `Footer template exceeds maximum length of ${MAX_TEMPLATE_LENGTH} characters.`;
  }

  // 7. Usable Margins & Dimensions Check
  const ensureRoom = displayHeaderFooter;
  const defaultTop = ensureRoom ? '15mm' : '10mm';
  const defaultBottom = ensureRoom ? '15mm' : '10mm';

  let rawTop = raw.margins?.top ?? raw.marginTop;
  let rawBottom = raw.margins?.bottom ?? raw.marginBottom;
  let rawLeft = raw.margins?.left ?? raw.marginLeft;
  let rawRight = raw.margins?.right ?? raw.marginRight;

  if (raw.marginPreset === 'none') {
    rawTop = '0mm';
    rawBottom = '0mm';
    rawLeft = '0mm';
    rawRight = '0mm';
  } else if (raw.marginPreset === 'minimal') {
    rawTop = '5mm';
    rawBottom = '5mm';
    rawLeft = '5mm';
    rawRight = '5mm';
  } else if (raw.marginPreset === 'normal' || (!rawTop && !rawBottom && !rawLeft && !rawRight)) {
    rawTop = defaultTop;
    rawBottom = defaultBottom;
    rawLeft = '10mm';
    rawRight = '10mm';
  }

  const topMm = parseDimensionToMm(rawTop ?? defaultTop);
  const bottomMm = parseDimensionToMm(rawBottom ?? defaultBottom);
  const leftMm = parseDimensionToMm(rawLeft ?? '10mm');
  const rightMm = parseDimensionToMm(rawRight ?? '10mm');

  if (topMm === null || topMm < 0) {
    errors['marginTop'] = 'Top margin must be a finite non-negative dimension (e.g. "10mm", "0.5in").';
  }
  if (bottomMm === null || bottomMm < 0) {
    errors['marginBottom'] = 'Bottom margin must be a finite non-negative dimension (e.g. "10mm", "0.5in").';
  }
  if (leftMm === null || leftMm < 0) {
    errors['marginLeft'] = 'Left margin must be a finite non-negative dimension (e.g. "10mm", "0.5in").';
  }
  if (rightMm === null || rightMm < 0) {
    errors['marginRight'] = 'Right margin must be a finite non-negative dimension (e.g. "10mm", "0.5in").';
  }

  // Ensure printable area is usable (margins do not exceed page dimensions)
  if (!errors['customWidth'] && !errors['customHeight'] && !errors['pageSize']) {
    const pageDims = getPageDimensionsMm(finalPageSize, orientation);
    if (leftMm !== null && rightMm !== null && leftMm + rightMm >= pageDims.width) {
      errors['margins'] = `Total horizontal margins (${(leftMm + rightMm).toFixed(1)}mm) must be strictly less than page width (${pageDims.width.toFixed(1)}mm).`;
    }
    if (topMm !== null && bottomMm !== null && topMm + bottomMm >= pageDims.height) {
      errors['margins'] = `Total vertical margins (${(topMm + bottomMm).toFixed(1)}mm) must be strictly less than page height (${pageDims.height.toFixed(1)}mm).`;
    }
  }

  const normalizedMargins: MarginsSettings = {
    top: formatToCssUnit(rawTop ?? defaultTop, defaultTop),
    bottom: formatToCssUnit(rawBottom ?? defaultBottom, defaultBottom),
    left: formatToCssUnit(rawLeft ?? '10mm', '10mm'),
    right: formatToCssUnit(rawRight ?? '10mm', '10mm'),
  };

  // 8. Page Ranges
  let pageRanges: string | undefined = undefined;
  if (raw.pageRanges && String(raw.pageRanges).trim().length > 0) {
    const rangeCheck = validatePageRanges(String(raw.pageRanges));
    if (!rangeCheck.isValid) {
      errors['pageRanges'] = rangeCheck.error!;
    } else {
      pageRanges = String(raw.pageRanges).trim();
    }
  }

  // 9. RasterMode Handling (Renderer not implemented)
  if (raw.rasterMode === true) {
    warnings.push(
      'rasterMode flag has no renderer implementation in current engine and has been normalized to vector rendering.'
    );
  }

  // 10. Watermark Settings
  let watermark: WatermarkSettings | undefined = undefined;
  if (raw.watermark && raw.watermark.enabled) {
    watermark = {
      enabled: true,
      type: raw.watermark.type === 'image' ? 'image' : 'text',
      text: raw.watermark.text || 'CONFIDENTIAL',
      fontSize: typeof raw.watermark.fontSize === 'number' ? raw.watermark.fontSize : 64,
      color: raw.watermark.color || '#dc2626',
      imageUrl: raw.watermark.imageUrl || '',
      imageWidth: typeof raw.watermark.imageWidth === 'number' ? raw.watermark.imageWidth : 260,
      opacity: typeof raw.watermark.opacity === 'number' ? Math.max(0.01, Math.min(1.0, raw.watermark.opacity)) : 0.15,
      rotation: typeof raw.watermark.rotation === 'number' ? raw.watermark.rotation : -45,
      layout: raw.watermark.layout === 'tiled' || raw.watermark.layout === 'absolute' ? raw.watermark.layout : 'center',
      x: raw.watermark.x !== undefined ? raw.watermark.x : 20,
      y: raw.watermark.y !== undefined ? raw.watermark.y : 20,
      coordinateUnit: raw.watermark.coordinateUnit === '%' || raw.watermark.coordinateUnit === 'mm' ? raw.watermark.coordinateUnit : 'px',
      zIndex: raw.watermark.zIndex === 'back' ? 'back' : 'front',
    };
  }

  // 11. Metadata Settings
  let metadata: DocumentMetadataSettings | undefined = undefined;
  if (raw.metadata) {
    metadata = {
      title: raw.metadata.title ? String(raw.metadata.title).trim() : undefined,
      author: raw.metadata.author ? String(raw.metadata.author).trim() : undefined,
      subject: raw.metadata.subject ? String(raw.metadata.subject).trim() : undefined,
      keywords: raw.metadata.keywords,
      creator: raw.metadata.creator ? String(raw.metadata.creator).trim() : 'HTML2PDF Studio',
      producer: raw.metadata.producer ? String(raw.metadata.producer).trim() : 'HTML2PDF Studio',
    };
  }

  // 12. TOC Settings
  let toc: TocSettings | undefined = undefined;
  if (raw.toc && raw.toc.enabled) {
    toc = {
      enabled: true,
      title: raw.toc.title ? String(raw.toc.title).trim() : 'Table of Contents',
      maxLevel: raw.toc.maxLevel === 1 || raw.toc.maxLevel === 2 ? raw.toc.maxLevel : 3,
    };
  }

  const compression: 'high' | 'balanced' | 'small' =
    raw.compression === 'balanced' || raw.compression === 'small' ? raw.compression : 'high';

  const errorList: ValidationErrorItem[] = Object.entries(errors).map(([field, message]) => ({
    field,
    message,
  }));

  const isValid = errorList.length === 0;

  const normalizedData: NormalizedExportSettings | undefined = isValid
    ? {
        media,
        pageSizeAuthority,
        pageSize: finalPageSize,
        orientation,
        margins: normalizedMargins,
        scale,
        background: raw.background !== false,
        displayHeaderFooter,
        headerTemplate,
        footerTemplate,
        pageRanges,
        css: raw.css ? String(raw.css) : undefined,
        watermark,
        metadata,
        compression,
        toc,
        rasterMode: false,
        waitForSelector: raw.waitForSelector ? String(raw.waitForSelector) : undefined,
        delayMs: typeof raw.delayMs === 'number' ? Math.max(0, raw.delayMs) : undefined,
      }
    : undefined;

  return {
    isValid,
    data: normalizedData,
    errors,
    errorList,
    warnings,
  };
}

/**
 * Validates full convert requests (source + options) at REST and MCP boundaries.
 */
export function validateAndNormalizeConvertRequest(
  body: any,
  routeDefaultMedia: PrintMedia = 'print'
): ValidationResult<{ source: ConvertSource; options: NormalizedExportSettings }> {
  const rawBody = body || {};

  // Extract source
  const source: ConvertSource = {
    html: rawBody.html,
    url: rawBody.url,
    filePath: rawBody.filePath,
  };

  const sourceValidation = validateExportSource(source);
  const rawOptions = rawBody.options || rawBody; // MCP tools pass options at top level
  const optionsValidation = normalizeExportSettings(rawOptions, routeDefaultMedia);

  const mergedErrors = {
    ...sourceValidation.errors,
    ...optionsValidation.errors,
  };

  const errorList: ValidationErrorItem[] = Object.entries(mergedErrors).map(([field, message]) => ({
    field,
    message,
  }));

  const isValid = errorList.length === 0;

  return {
    isValid,
    data: isValid
      ? {
          source,
          options: optionsValidation.data!,
        }
      : undefined,
    errors: mergedErrors,
    errorList,
    warnings: optionsValidation.warnings,
  };
}

/**
 * Formats validation errors into a clean, human-readable summary.
 */
export function formatValidationErrorsSummary(errors: Record<string, string>): string {
  const entries = Object.entries(errors);
  if (entries.length === 0) return 'No errors';
  return entries.map(([field, msg]) => `${field}: ${msg}`).join('; ');
}
