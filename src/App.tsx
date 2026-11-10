/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  Printer,
  Upload,
  Globe,
  Code,
  Sparkles,
  Settings,
  Download,
  ExternalLink,
  RefreshCw,
  Copy,
  Check,
  Layers,
  Monitor,
  Tablet,
  Smartphone,
  ZoomIn,
  ZoomOut,
  Sliders,
  AlertCircle,
  FileCheck,
  Cpu,
  Clock,
  ChevronDown,
  ChevronRight,
  FolderArchive,
  History,
  X,
  Terminal,
  Stamp,
  Image as ImageIcon,
  Type,
  Tag,
  Search,
  Bookmark,
  Minimize2,
  Gauge,
  Play,
  Trash2,
  ListChecks,
  Loader2,
  ListTree,
  BookOpen,
} from 'lucide-react';
import {
  PrintMedia,
  PageSizeAuthority,
  NormalizedExportSettings,
  ConvertSource,
  validateAndNormalizeConvertRequest,
  formatValidationErrorsSummary,
  STANDARD_PAGE_SIZES_MM,
} from '@/lib/export-settings.ts';

const STAMP_PRESETS = {
  confidential: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="120" viewBox="0 0 300 120"><rect x="8" y="8" width="284" height="104" rx="12" fill="none" stroke="%23dc2626" stroke-width="8" stroke-dasharray="14,6"/><text x="150" y="68" font-family="sans-serif" font-weight="900" font-size="30" fill="%23dc2626" text-anchor="middle" letter-spacing="4">CONFIDENTIAL</text><text x="150" y="94" font-family="sans-serif" font-weight="700" font-size="11" fill="%23dc2626" text-anchor="middle" letter-spacing="2">DO NOT DISTRIBUTE</text></svg>`,
  approved: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="120" viewBox="0 0 300 120"><rect x="8" y="8" width="284" height="104" rx="12" fill="none" stroke="%2316a34a" stroke-width="8"/><circle cx="150" cy="30" r="10" fill="%2316a34a"/><text x="150" y="74" font-family="sans-serif" font-weight="900" font-size="34" fill="%2316a34a" text-anchor="middle" letter-spacing="4">APPROVED</text><text x="150" y="96" font-family="sans-serif" font-weight="700" font-size="11" fill="%2316a34a" text-anchor="middle" letter-spacing="2">OFFICIAL COPY</text></svg>`,
  draft: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="120" viewBox="0 0 300 120"><rect x="8" y="8" width="284" height="104" rx="12" fill="none" stroke="%234f46e5" stroke-width="8" stroke-dasharray="8,6"/><text x="150" y="74" font-family="sans-serif" font-weight="900" font-size="38" fill="%234f46e5" text-anchor="middle" letter-spacing="6">DRAFT</text></svg>`,
};

/**
 * Builds clean, Chromium-compatible HTML for headerTemplate and footerTemplate.
 * Formats tokens like {{pageNumber}}, {{totalPages}}, {{date}}, {{title}}, {{url}}
 * and ensures explicit font styling so headers and footers render at crisp high fidelity.
 */
function buildHeaderFooterHtml({
  left,
  center,
  right,
  border,
  fontSize,
  color,
  isHeader,
}: {
  left: string;
  center: string;
  right: string;
  border: boolean;
  fontSize: string;
  color: string;
  isHeader: boolean;
}): string {
  const formatText = (t: string) =>
    t
      .replace(/\{\{pageNumber\}\}/g, '<span class="pageNumber"></span>')
      .replace(/\{\{totalPages\}\}/g, '<span class="totalPages"></span>')
      .replace(/\{\{date\}\}/g, '<span class="date"></span>')
      .replace(/\{\{title\}\}/g, '<span class="title"></span>')
      .replace(/\{\{url\}\}/g, '<span class="url"></span>');

  const borderStyle = border
    ? isHeader
      ? 'border-bottom: 1px solid rgba(148, 163, 184, 0.4); padding-bottom: 5px;'
      : 'border-top: 1px solid rgba(148, 163, 184, 0.4); padding-top: 5px;'
    : '';

  return `<div style="font-size: ${fontSize}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; width: 100%; display: flex; justify-content: space-between; align-items: center; padding: 0 15mm; color: ${color}; box-sizing: border-box; -webkit-print-color-adjust: exact; ${borderStyle}">
  <div style="flex: 1; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${formatText(left)}</div>
  <div style="flex: 1; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${formatText(center)}</div>
  <div style="flex: 1; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${formatText(right)}</div>
</div>`;
}

interface ConversionOptions {
  media: 'screen' | 'print';
  pageSizeAuthority: 'css' | 'ui';
  pageSize: string;
  customWidth: string;
  customHeight: string;
  orientation: 'portrait' | 'landscape';
  marginPreset: 'none' | 'normal' | 'minimal' | 'custom';
  marginTop: string;
  marginBottom: string;
  marginLeft: string;
  marginRight: string;
  scale: number;
  background: boolean;
  rasterMode: boolean;
  enableHeaderFooter: boolean;
  headerTemplate: string;
  footerTemplate: string;
  pageRanges: string;
  customCss: string;
  watermarkEnabled: boolean;
  watermarkType: 'text' | 'image';
  watermarkText: string;
  watermarkFontSize: number;
  watermarkColor: string;
  watermarkImageUrl: string;
  watermarkImageWidth: number;
  watermarkOpacity: number;
  watermarkRotation: number;
  watermarkLayout: 'center' | 'tiled' | 'absolute';
  watermarkX: number;
  watermarkY: number;
  watermarkUnit: 'px' | 'mm' | '%';
  watermarkZIndex: 'front' | 'back';
  enableMetadata: boolean;
  metaTitle: string;
  metaAuthor: string;
  metaSubject: string;
  metaKeywords: string;
  compression: 'high' | 'balanced' | 'small';
  enableToc: boolean;
  tocTitle: string;
  tocMaxLevel: 1 | 2 | 3;
}

interface ConvertResult {
  pdfPath: string;
  fileName: string;
  pages: number;
  fileSize: number;
  durationMs: number;
  downloadUrl: string;
  profile?: 'local-bundle' | 'public-web' | 'trusted-local';
  blockedResources?: { url: string; reason: string }[];
  metadata?: {
    title?: string;
    author?: string;
    subject?: string;
    keywords?: string;
  };
}

interface PdfHistoryItem {
  fileName: string;
  pdfPath: string;
  fileSizeBytes: number;
  fileSizeFormatted: string;
  createdAt: string;
  downloadUrl: string;
}

interface BatchItem {
  id: string;
  file: File;
  name: string;
  size: number;
  status: 'pending' | 'uploading' | 'converting' | 'done' | 'error';
  error?: string;
  result?: ConvertResult;
}

export default function App() {
  // Input mode: 'upload' | 'code' | 'url'
  const [inputMode, setInputMode] = useState<'upload' | 'code' | 'url'>('upload');
  const [isBatchMode, setIsBatchMode] = useState<boolean>(false);
  const [batchQueue, setBatchQueue] = useState<BatchItem[]>([]);
  const [isBatchRunning, setIsBatchRunning] = useState<boolean>(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const batchCancelRef = useRef<boolean>(false);
  const [uploadedFile, setUploadedFile] = useState<{
    id: string;
    fileName: string;
    previewUrl: string;
    fullDiskPath: string;
    assetCount: number;
  } | null>(null);

  const [rawHtml, setRawHtml] = useState<string>('');
  const [urlInput, setUrlInput] = useState<string>('https://example.com');
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Preview state
  const [previewTab, setPreviewTab] = useState<'screen' | 'print' | 'pdf'>('screen');
  const [previewWidth, setPreviewWidth] = useState<'100%' | '1440px' | '768px' | '375px'>('100%');
  const [previewZoom, setPreviewZoom] = useState<number>(100);
  const [previewKey, setPreviewKey] = useState<number>(1);
  const [blockedResources, setBlockedResources] = useState<{ url: string; reason: string }[]>([]);

  // Conversion options
  const [options, setOptions] = useState<ConversionOptions>({
    media: 'print',
    pageSizeAuthority: 'css',
    pageSize: 'A4',
    customWidth: '210',
    customHeight: '297',
    orientation: 'portrait',
    marginPreset: 'normal',
    marginTop: '10',
    marginBottom: '10',
    marginLeft: '10',
    marginRight: '10',
    scale: 1.0,
    background: true,
    rasterMode: false,
    enableHeaderFooter: false,
    headerTemplate: '<div style="font-size:9px; width:100%; text-align:right; padding:0 20px; color:#888;">Document Title</div>',
    footerTemplate: '<div style="font-size:9px; width:100%; text-align:center; color:#888;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>',
    pageRanges: '',
    customCss: '',
    watermarkEnabled: false,
    watermarkType: 'text',
    watermarkText: 'CONFIDENTIAL',
    watermarkFontSize: 60,
    watermarkColor: '#dc2626',
    watermarkImageUrl: '',
    watermarkImageWidth: 260,
    watermarkOpacity: 0.15,
    watermarkRotation: -45,
    watermarkLayout: 'center',
    watermarkX: 20,
    watermarkY: 20,
    watermarkUnit: 'px',
    watermarkZIndex: 'front',
    enableMetadata: false,
    metaTitle: '',
    metaAuthor: '',
    metaSubject: '',
    metaKeywords: '',
    compression: 'high',
    enableToc: false,
    tocTitle: 'Table of Contents',
    tocMaxLevel: 3,
  });

  // UI accordion sections
  const [openSection, setOpenSection] = useState<'page' | 'margins' | 'header' | 'watermark' | 'metadata' | 'toc' | 'css' | null>('page');

  // Conversion & Progress state
  const [isConverting, setIsConverting] = useState<boolean>(false);
  const [convertStep, setConvertStep] = useState<string>('');
  const [lastResult, setLastResult] = useState<ConvertResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Modals & Drawers
  const [showMcpModal, setShowMcpModal] = useState<boolean>(false);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState<boolean>(false);
  const [historyList, setHistoryList] = useState<PdfHistoryItem[]>([]);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // AI CSS Optimizer state
  const [isOptimizingAi, setIsOptimizingAi] = useState<boolean>(false);
  const [aiSuggestions, setAiSuggestions] = useState<{
    summary: string;
    explanations: string[];
  } | null>(null);

  // Header / Footer Dynamic Auto-Injection State
  const [hfPreset, setHfPreset] = useState<string>('page-x-of-y');
  const [hfViewMode, setHfViewMode] = useState<'builder' | 'raw'>('builder');
  const [headerEnabled, setHeaderEnabled] = useState<boolean>(false);
  const [headerLeft, setHeaderLeft] = useState<string>('{{title}}');
  const [headerCenter, setHeaderCenter] = useState<string>('');
  const [headerRight, setHeaderRight] = useState<string>('{{date}}');
  const [headerBorder, setHeaderBorder] = useState<boolean>(true);

  const [footerEnabled, setFooterEnabled] = useState<boolean>(true);
  const [footerLeft, setFooterLeft] = useState<string>('');
  const [footerCenter, setFooterCenter] = useState<string>('Page <span class="pageNumber"></span> of <span class="totalPages"></span>');
  const [footerRight, setFooterRight] = useState<string>('');
  const [footerBorder, setFooterBorder] = useState<boolean>(false);

  const [hfFontSize, setHfFontSize] = useState<string>('9px');
  const [hfColor, setHfColor] = useState<string>('#64748b');

  // Synchronize builder state to options headerTemplate / footerTemplate
  useEffect(() => {
    if (hfViewMode === 'builder') {
      const hHtml = headerEnabled
        ? buildHeaderFooterHtml({
            left: headerLeft,
            center: headerCenter,
            right: headerRight,
            border: headerBorder,
            fontSize: hfFontSize,
            color: hfColor,
            isHeader: true,
          })
        : '<div></div>';

      const fHtml = footerEnabled
        ? buildHeaderFooterHtml({
            left: footerLeft,
            center: footerCenter,
            right: footerRight,
            border: footerBorder,
            fontSize: hfFontSize,
            color: hfColor,
            isHeader: false,
          })
        : '<div></div>';

      setOptions((prev) => ({
        ...prev,
        headerTemplate: hHtml,
        footerTemplate: fHtml,
      }));
    }
  }, [
    hfViewMode,
    headerEnabled,
    headerLeft,
    headerCenter,
    headerRight,
    headerBorder,
    footerEnabled,
    footerLeft,
    footerCenter,
    footerRight,
    footerBorder,
    hfFontSize,
    hfColor,
  ]);

  const applyHfPreset = (preset: string) => {
    setHfPreset(preset);
    if (preset === 'page-x-of-y') {
      setHeaderEnabled(false);
      setFooterEnabled(true);
      setFooterLeft('');
      setFooterCenter('Page <span class="pageNumber"></span> of <span class="totalPages"></span>');
      setFooterRight('');
      setFooterBorder(false);
    } else if (preset === 'formal') {
      setHeaderEnabled(true);
      setHeaderLeft('{{title}}');
      setHeaderCenter('');
      setHeaderRight('{{date}}');
      setHeaderBorder(true);

      setFooterEnabled(true);
      setFooterLeft('');
      setFooterCenter('');
      setFooterRight('Page <span class="pageNumber"></span> of <span class="totalPages"></span>');
      setFooterBorder(true);
    } else if (preset === 'executive') {
      setHeaderEnabled(true);
      setHeaderLeft('{{title}}');
      setHeaderCenter('CONFIDENTIAL');
      setHeaderRight('{{date}}');
      setHeaderBorder(true);

      setFooterEnabled(true);
      setFooterLeft('Internal Distribution Only');
      setFooterCenter('');
      setFooterRight('Page <span class="pageNumber"></span> of <span class="totalPages"></span>');
      setFooterBorder(true);
    } else if (preset === 'metadata') {
      setHeaderEnabled(true);
      setHeaderLeft('{{title}}');
      setHeaderCenter('');
      setHeaderRight('{{url}}');
      setHeaderBorder(true);

      setFooterEnabled(true);
      setFooterLeft('Generated on: {{date}}');
      setFooterCenter('');
      setFooterRight('Page <span class="pageNumber"></span> of <span class="totalPages"></span>');
      setFooterBorder(true);
    } else if (preset === 'minimal') {
      setHeaderEnabled(false);
      setFooterEnabled(true);
      setFooterLeft('{{date}}');
      setFooterCenter('');
      setFooterRight('<span class="pageNumber"></span> / <span class="totalPages"></span>');
      setFooterBorder(true);
    }
  };

  // Server health
  const [serverHealth, setServerHealth] = useState<{ browserConnected: boolean; hasGeminiApiKey: boolean } | null>(null);

  // Load sample on mount
  useEffect(() => {
    checkHealth();
    loadSample('invoice');
    fetchHistory();
  }, []);

  const checkHealth = async () => {
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        setServerHealth(data);
      }
    } catch {
      // server starting
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/list');
      if (res.ok) {
        const data = await res.json();
        setHistoryList(data);
      }
    } catch (e) {
      console.warn('Failed to fetch history', e);
    }
  };

  // Helper to load templates
  const loadSample = async (type: 'invoice' | 'report' | 'demo') => {
    try {
      const path =
        type === 'invoice'
          ? '/samples/invoice.html'
          : type === 'report'
          ? '/samples/report.html'
          : '/samples/screen-print-demo.html';
      const res = await fetch(path);
      if (res.ok) {
        const html = await res.text();
        setRawHtml(html);
        setInputMode('code');
        setUploadedFile(null);
        setPreviewKey((k) => k + 1);
      }
    } catch (err) {
      console.error('Failed to load sample:', err);
    }
  };

  // Handle file uploads (HTML or ZIP)
  const handleFileUpload = async (file: File) => {
    setErrorMsg(null);
    setIsConverting(true);
    setConvertStep('Uploading and unzipping document assets...');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(errData.error || 'Upload failed');
      }

      const data = await res.json();
      setUploadedFile({
        id: data.id,
        fileName: data.fileName,
        previewUrl: data.previewUrl,
        fullDiskPath: data.fullDiskPath,
        assetCount: data.assetCount,
      });

      if (data.rawHtml) {
        setRawHtml(data.rawHtml);
      }

      setInputMode('upload');
      setPreviewKey((k) => k + 1);
    } catch (err: any) {
      setErrorMsg(err.message || 'File upload error');
    } finally {
      setIsConverting(false);
      setConvertStep('');
    }
  };

  // Add multiple files to the batch queue
  const addFilesToBatch = (fileList: FileList | File[]) => {
    const newItems: BatchItem[] = Array.from(fileList).map((f) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      file: f,
      name: f.name,
      size: f.size,
      status: 'pending',
    }));
    setBatchQueue((prev) => [...prev, ...newItems]);
    setIsBatchMode(true);
  };

  // Remove single item from batch queue
  const removeBatchItem = (id: string) => {
    setBatchQueue((prev) => prev.filter((item) => item.id !== id));
  };

  // Clear entire batch queue
  const clearBatchQueue = () => {
    if (isBatchRunning) {
      batchCancelRef.current = true;
    }
    setBatchQueue([]);
    setBatchProgress({ current: 0, total: 0 });
  };

  // Focus accordion section corresponding to an invalid field
  const focusSectionForError = (field: string) => {
    if (
      field === 'pageSize' ||
      field === 'customWidth' ||
      field === 'customHeight' ||
      field === 'scale' ||
      field === 'pageRanges' ||
      field === 'media' ||
      field === 'pageSizeAuthority'
    ) {
      setOpenSection('page');
    } else if (
      field === 'margins' ||
      field === 'marginTop' ||
      field === 'marginBottom' ||
      field === 'marginLeft' ||
      field === 'marginRight'
    ) {
      setOpenSection('margins');
    } else if (field === 'headerTemplate' || field === 'footerTemplate') {
      setOpenSection('header');
    } else if (field.startsWith('watermark')) {
      setOpenSection('watermark');
    } else if (field.startsWith('meta')) {
      setOpenSection('metadata');
    } else if (field.startsWith('toc')) {
      setOpenSection('toc');
    }
  };

  // Typed single/batch export payload builder and normalizer
  const buildSingleOrBatchPayload = (
    opts: ConversionOptions,
    source: ConvertSource,
    defaultMedia: 'screen' | 'print'
  ) => {
    const margins =
      opts.marginPreset === 'none'
        ? { top: '0mm', bottom: '0mm', left: '0mm', right: '0mm' }
        : opts.marginPreset === 'minimal'
        ? { top: '5mm', bottom: '5mm', left: '5mm', right: '5mm' }
        : opts.marginPreset === 'custom'
        ? {
            top: `${opts.marginTop}mm`,
            bottom: `${opts.marginBottom}mm`,
            left: `${opts.marginLeft}mm`,
            right: `${opts.marginRight}mm`,
          }
        : { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' };

    const pageSize =
      opts.pageSize === 'Custom'
        ? { width: `${opts.customWidth}mm`, height: `${opts.customHeight}mm` }
        : opts.pageSize;

    const rawOptions = {
      media: opts.media,
      pageSizeAuthority: opts.pageSizeAuthority,
      pageSize,
      customWidth: opts.customWidth,
      customHeight: opts.customHeight,
      orientation: opts.orientation,
      margins,
      scale: opts.scale,
      background: opts.background,
      displayHeaderFooter: opts.enableHeaderFooter,
      headerTemplate: opts.enableHeaderFooter ? opts.headerTemplate : undefined,
      footerTemplate: opts.enableHeaderFooter ? opts.footerTemplate : undefined,
      pageRanges: opts.pageRanges,
      css: opts.customCss,
      rasterMode: false,
      compression: opts.compression,
      toc: opts.enableToc
        ? {
            enabled: true,
            title: opts.tocTitle.trim() || 'Table of Contents',
            maxLevel: opts.tocMaxLevel,
          }
        : undefined,
      metadata: opts.enableMetadata
        ? {
            title: opts.metaTitle.trim() || undefined,
            author: opts.metaAuthor.trim() || undefined,
            subject: opts.metaSubject.trim() || undefined,
            keywords: opts.metaKeywords.trim() || undefined,
          }
        : undefined,
      watermark: opts.watermarkEnabled
        ? {
            enabled: true,
            type: opts.watermarkType,
            text: opts.watermarkText,
            fontSize: opts.watermarkFontSize,
            color: opts.watermarkColor,
            imageUrl: opts.watermarkImageUrl,
            imageWidth: opts.watermarkImageWidth,
            opacity: opts.watermarkOpacity,
            rotation: opts.watermarkRotation,
            layout: opts.watermarkLayout,
            x: opts.watermarkX,
            y: opts.watermarkY,
            coordinateUnit: opts.watermarkUnit,
            zIndex: opts.watermarkZIndex,
          }
        : undefined,
    };

    return validateAndNormalizeConvertRequest({ ...source, options: rawOptions }, defaultMedia);
  };

  // Sequential Batch Queue Executor
  const runBatchQueue = async (mode: 'convert' | 'print' = 'convert') => {
    if (batchQueue.length === 0 || isBatchRunning) return;

    setErrorMsg(null);
    setFieldErrors({});

    // Pre-validate export settings
    const dummySource: ConvertSource = { url: 'https://example.com/' };
    const preCheck = buildSingleOrBatchPayload(options, dummySource, mode === 'print' ? 'print' : 'screen');
    const optionErrors = { ...preCheck.errors };
    delete optionErrors['source'];
    delete optionErrors['url'];

    if (Object.keys(optionErrors).length > 0) {
      setFieldErrors(optionErrors);
      setErrorMsg(`Settings validation error: ${formatValidationErrorsSummary(optionErrors)}`);
      focusSectionForError(Object.keys(optionErrors)[0]);
      return;
    }

    setIsBatchRunning(true);
    batchCancelRef.current = false;
    setConvertStep('Starting sequential batch conversion...');

    const endpoint = mode === 'print' ? '/api/print-pdf' : '/api/convert';
    const queueSnapshot = [...batchQueue];
    let lastGenerated: ConvertResult | null = null;

    for (let i = 0; i < queueSnapshot.length; i++) {
      if (batchCancelRef.current) {
        break;
      }

      const item = queueSnapshot[i];
      if (item.status === 'done') continue;

      setBatchProgress({ current: i + 1, total: queueSnapshot.length });
      setConvertStep(`[Batch ${i + 1}/${queueSnapshot.length}] Uploading ${item.name}...`);

      setBatchQueue((prev) =>
        prev.map((q) => (q.id === item.id ? { ...q, status: 'uploading' } : q))
      );

      try {
        const formData = new FormData();
        formData.append('file', item.file);

        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!uploadRes.ok) {
          const errData = await uploadRes.json().catch(() => ({ error: 'Upload failed' }));
          throw new Error(errData.error || 'Upload failed');
        }

        const uploadData = await uploadRes.json();

        setBatchQueue((prev) =>
          prev.map((q) => (q.id === item.id ? { ...q, status: 'converting' } : q))
        );
        setConvertStep(`[Batch ${i + 1}/${queueSnapshot.length}] Rendering PDF for ${item.name}...`);

        const itemSource: ConvertSource = { url: uploadData.previewUrl };
        const payload = buildSingleOrBatchPayload(options, itemSource, mode === 'print' ? 'print' : 'screen');

        if (!payload.isValid) {
          throw new Error(`Validation error: ${formatValidationErrorsSummary(payload.errors)}`);
        }

        const convertRes = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...payload.data!.source,
            options: payload.data!.options,
          }),
        });

        if (!convertRes.ok) {
          const errData = await convertRes.json().catch(() => ({ error: 'Convert failed' }));
          throw new Error(errData.error || 'Convert failed');
        }

        const convertData: ConvertResult = await convertRes.json();
        lastGenerated = convertData;

        setBatchQueue((prev) =>
          prev.map((q) =>
            q.id === item.id ? { ...q, status: 'done', result: convertData, error: undefined } : q
          )
        );
      } catch (itemErr: any) {
        console.error(`Batch error on ${item.name}:`, itemErr);
        setBatchQueue((prev) =>
          prev.map((q) =>
            q.id === item.id ? { ...q, status: 'error', error: itemErr.message || 'Failed' } : q
          )
        );
      }
    }

    if (lastGenerated) {
      setBlockedResources(lastGenerated.blockedResources || []);
      setLastResult(lastGenerated);
      setPreviewTab('pdf');
      fetchHistory();
    }

    setIsBatchRunning(false);
    setConvertStep('');
  };

  // Drag and drop handlers
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const onDragLeave = () => setIsDragging(false);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      if (isBatchMode || e.dataTransfer.files.length > 1) {
        addFilesToBatch(e.dataTransfer.files);
      } else {
        handleFileUpload(e.dataTransfer.files[0]);
      }
    }
  };

  // Auto-detect Document Metadata & SEO from HTML
  const autoDetectMetadataFromHtml = () => {
    if (!rawHtml) return;
    const titleMatch = rawHtml.match(/<title[^>]*>([^<]+)<\/title>/i);
    const authorMatch = rawHtml.match(/<meta[^>]*name=["']author["'][^>]*content=["']([^"']+)["']/i);
    const descMatch = rawHtml.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
    const kwMatch = rawHtml.match(/<meta[^>]*name=["']keywords["'][^>]*content=["']([^"']+)["']/i);

    setOptions((prev) => ({
      ...prev,
      enableMetadata: true,
      metaTitle: titleMatch ? titleMatch[1].trim() : prev.metaTitle || (uploadedFile ? uploadedFile.fileName.replace(/\.(html|htm)$/i, '') : 'HTML Document'),
      metaAuthor: authorMatch ? authorMatch[1].trim() : prev.metaAuthor || 'HTML2PDF Studio',
      metaSubject: descMatch ? descMatch[1].trim() : prev.metaSubject || 'Generated with HTML2PDF Studio',
      metaKeywords: kwMatch ? kwMatch[1].trim() : prev.metaKeywords || 'html2pdf, export, document',
    }));
    setOpenSection('metadata');
  };

  // Trigger PDF Generation
  const executeConversion = async (mode: 'convert' | 'print') => {
    setErrorMsg(null);
    setFieldErrors({});
    setBlockedResources([]);

    let source: ConvertSource = {};
    if (inputMode === 'upload' && uploadedFile) {
      source = { url: uploadedFile.previewUrl };
    } else if (inputMode === 'url') {
      source = { url: urlInput };
    } else {
      source = { html: rawHtml };
    }

    const payload = buildSingleOrBatchPayload(options, source, mode === 'print' ? 'print' : 'screen');

    if (!payload.isValid) {
      setFieldErrors(payload.errors);
      setErrorMsg(`Validation error: ${formatValidationErrorsSummary(payload.errors)}`);
      focusSectionForError(Object.keys(payload.errors)[0]);
      return;
    }

    setIsConverting(true);
    setConvertStep(mode === 'print' ? 'Emulating browser print dialog...' : 'Initializing rendering engine...');

    try {
      const endpoint = mode === 'print' ? '/api/print-pdf' : '/api/convert';

      setConvertStep('Waiting for webfonts and networkidle...');
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload.data!.source,
          options: payload.data!.options,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Conversion failed' }));
        if (err.errors) {
          setFieldErrors(err.errors);
          focusSectionForError(Object.keys(err.errors)[0]);
        }
        setBlockedResources(err.blockedResources || []);
        throw new Error(err.error || 'Conversion failed');
      }

      setConvertStep('Rendering high-fidelity vector pages...');
      const result: ConvertResult = await res.json();
      setBlockedResources(result.blockedResources || []);
      setLastResult(result);
      setPreviewTab('pdf');
      fetchHistory();
    } catch (err: any) {
      console.error('Conversion failed:', err);
      setErrorMsg(err.message || 'Conversion failed');
    } finally {
      setIsConverting(false);
      setConvertStep('');
    }
  };

  // AI Print Optimizer
  const handleAiOptimize = async () => {
    setIsOptimizingAi(true);
    setErrorMsg(null);
    try {
      const content =
        inputMode === 'code'
          ? rawHtml
          : uploadedFile
          ? rawHtml || '<div class="page">Document</div>'
          : `<html><body><h1>Web Page Preview</h1><p>${urlInput}</p></body></html>`;

      const res = await fetch('/api/ai/optimize-css', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: content }),
      });

      if (!res.ok) {
        throw new Error('AI optimization failed');
      }

      const data = await res.json();
      setOptions((prev) => ({
        ...prev,
        customCss: prev.customCss ? `${prev.customCss}\n\n${data.css}` : data.css,
      }));
      setAiSuggestions({
        summary: data.summary,
        explanations: data.explanations,
      });
      setOpenSection('css');
    } catch (err: any) {
      setErrorMsg(err.message || 'AI Print Optimization failed');
    } finally {
      setIsOptimizingAi(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2500);
  };

  const activeRenderProfile = previewTab === 'pdf' && lastResult?.profile
    ? lastResult.profile : (inputMode === 'url' ? 'public-web' : 'local-bundle');
  const rawPreviewHtml = '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data: blob:; style-src \'unsafe-inline\'; font-src data:; script-src \'none\'; connect-src \'none\'; frame-src \'none\'; object-src \'none\'; base-uri \'none\'">' + rawHtml;

  // Determine iframe source
  const getIframeSrc = () => {
    if (inputMode === 'upload' && uploadedFile) {
      return `${uploadedFile.previewUrl}?v=${previewKey}`;
    }
    return null;
  };

  // Watermark Live Preview overlay
  const renderWatermarkOverlay = () => {
    if (!options.watermarkEnabled) return null;

    const zIndexVal = options.watermarkZIndex === 'back' ? 5 : 30;
    const posX = `${options.watermarkX}${options.watermarkUnit}`;
    const posY = `${options.watermarkY}${options.watermarkUnit}`;

    return (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: zIndexVal,
          overflow: 'hidden',
          display: options.watermarkLayout === 'absolute' ? 'block' : 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {options.watermarkLayout === 'tiled' ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gridTemplateRows: 'repeat(4, 1fr)',
              width: '180%',
              height: '180%',
              gap: '60px',
              alignItems: 'center',
              justifyItems: 'center',
              opacity: options.watermarkOpacity,
              transform: `rotate(${options.watermarkRotation}deg)`,
              userSelect: 'none',
            }}
          >
            {Array.from({ length: 16 }).map((_, i) =>
              options.watermarkType === 'image' && options.watermarkImageUrl ? (
                <img
                  key={i}
                  src={options.watermarkImageUrl}
                  alt="Watermark"
                  style={{
                    width: `${Math.round(options.watermarkImageWidth * 0.55)}px`,
                    maxWidth: '100%',
                    objectFit: 'contain',
                  }}
                />
              ) : (
                <div
                  key={i}
                  style={{
                    fontSize: `${Math.round(options.watermarkFontSize * 0.5)}px`,
                    fontFamily: 'sans-serif',
                    fontWeight: 800,
                    letterSpacing: '3px',
                    color: options.watermarkColor,
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {options.watermarkText || 'CONFIDENTIAL'}
                </div>
              )
            )}
          </div>
        ) : options.watermarkLayout === 'absolute' ? (
          <div
            style={{
              position: 'absolute',
              left: posX,
              top: posY,
              opacity: options.watermarkOpacity,
              transform: `rotate(${options.watermarkRotation}deg)`,
              transformOrigin: 'center center',
              userSelect: 'none',
              display: 'inline-block',
            }}
          >
            {options.watermarkType === 'image' && options.watermarkImageUrl ? (
              <img
                src={options.watermarkImageUrl}
                alt="Watermark"
                style={{
                  width: `${options.watermarkImageWidth}px`,
                  maxWidth: '100%',
                  objectFit: 'contain',
                  display: 'block',
                }}
              />
            ) : (
              <div
                style={{
                  fontSize: `${options.watermarkFontSize}px`,
                  fontFamily: 'sans-serif',
                  fontWeight: 800,
                  letterSpacing: '4px',
                  color: options.watermarkColor,
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                  border: `3px solid ${options.watermarkColor}`,
                  padding: '6px 20px',
                  borderRadius: '6px',
                }}
              >
                {options.watermarkText || 'STAMP'}
              </div>
            )}
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: options.watermarkOpacity,
              transform: `rotate(${options.watermarkRotation}deg)`,
              userSelect: 'none',
            }}
          >
            {options.watermarkType === 'image' && options.watermarkImageUrl ? (
              <img
                src={options.watermarkImageUrl}
                alt="Watermark"
                style={{
                  width: `${options.watermarkImageWidth}px`,
                  maxWidth: '85%',
                  objectFit: 'contain',
                }}
              />
            ) : (
              <div
                style={{
                  fontSize: `${options.watermarkFontSize}px`,
                  fontFamily: 'sans-serif',
                  fontWeight: 800,
                  letterSpacing: '6px',
                  color: options.watermarkColor,
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                  border: `4px solid ${options.watermarkColor}`,
                  padding: '8px 28px',
                  borderRadius: '8px',
                }}
              >
                {options.watermarkText || 'CONFIDENTIAL'}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 font-sans">
      {/* ── Top Header ────────────────────────────────────────────── */}
      <header className="h-14 border-b border-slate-800 bg-slate-900/90 px-4 flex items-center justify-between shrink-0 z-20 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Printer className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base tracking-tight text-white">HTML2PDF Studio</span>
              <span className="text-[10px] bg-blue-500/20 text-blue-400 font-medium px-2 py-0.5 rounded-full border border-blue-500/30">
                v1.0.0
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Status Indicators */}
          <div className="hidden md:flex items-center gap-2 text-xs bg-slate-800/80 px-3 py-1.5 rounded-md border border-slate-700/60">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Chromium Ready
            </span>
            <span className="text-slate-600">|</span>
            <span className="text-indigo-400 flex items-center gap-1">
              <Terminal className="w-3 h-3" />
              MCP: <code className="text-slate-300">/mcp</code>
            </span>
            {serverHealth?.hasGeminiApiKey && (
              <>
                <span className="text-slate-600">|</span>
                <span className="text-amber-300 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Gemini AI
                </span>
              </>
            )}
          </div>

          {/* MCP Config Button */}
          <button
            onClick={() => setShowMcpModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 transition"
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>MCP Config</span>
          </button>

          {/* History Button */}
          <button
            onClick={() => setShowHistoryDrawer(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
          >
            <History className="w-3.5 h-3.5" />
            <span>Output ({historyList.length})</span>
          </button>
        </div>
      </header>

      {/* ── Main Workspace ────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT COLUMN: Input & Controls (460px) */}
        <div className="w-[480px] shrink-0 border-r border-slate-800 bg-slate-900/60 flex flex-col overflow-hidden">
          {/* Input Source Tabs */}
          <div className="p-3 border-b border-slate-800 bg-slate-900/80">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Source Document</span>
              <div className="flex gap-2">
                <button
                  onClick={() => loadSample('invoice')}
                  className="text-[11px] text-blue-400 hover:text-blue-300 underline"
                >
                  + Invoice
                </button>
                <button
                  onClick={() => loadSample('report')}
                  className="text-[11px] text-blue-400 hover:text-blue-300 underline"
                >
                  + Report
                </button>
                <button
                  onClick={() => loadSample('demo')}
                  className="text-[11px] text-emerald-400 hover:text-emerald-300 underline font-medium"
                >
                  + Media/Size Fixture
                </button>
              </div>
            </div>

            {(fieldErrors['source'] || fieldErrors['url']) && (
              <div className="mb-2 p-2 rounded bg-rose-950/60 border border-rose-800 text-[11px] text-rose-300 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span>{fieldErrors['source'] || fieldErrors['url']}</span>
              </div>
            )}

            <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
              <button
                onClick={() => setInputMode('upload')}
                className={`flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-md transition ${
                  inputMode === 'upload'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload / ZIP</span>
              </button>
              <button
                onClick={() => setInputMode('code')}
                className={`flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-md transition ${
                  inputMode === 'code'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <Code className="w-3.5 h-3.5" />
                <span>HTML Code</span>
              </button>
              <button
                onClick={() => setInputMode('url')}
                className={`flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-md transition ${
                  inputMode === 'url'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Web URL</span>
              </button>
            </div>
          </div>

          {/* Active Input Panel */}
          <div className="p-3 border-b border-slate-800 bg-slate-950/40">
            {inputMode === 'upload' && (
              <div className="space-y-3">
                {/* Single vs Batch Mode Switcher */}
                <div className="flex items-center justify-between p-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs">
                  <div className="flex items-center gap-1.5 text-slate-300 font-medium">
                    <ListChecks className="w-3.5 h-3.5 text-blue-400" />
                    <span>Mode:</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setIsBatchMode(false)}
                      className={`px-2.5 py-1 rounded text-[11px] font-medium transition ${
                        !isBatchMode ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Single File
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsBatchMode(true)}
                      className={`px-2.5 py-1 rounded text-[11px] font-medium transition flex items-center gap-1 ${
                        isBatchMode ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span>Batch Queue</span>
                      {batchQueue.length > 0 && (
                        <span className="px-1.5 py-0.2 bg-white/20 text-white rounded-full text-[9px] font-mono">
                          {batchQueue.length}
                        </span>
                      )}
                    </button>
                  </div>
                </div>

                {/* Dropzone */}
                <div
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onDrop={onDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition ${
                    isDragging
                      ? 'border-blue-500 bg-blue-500/10'
                      : isBatchMode
                      ? 'border-indigo-600/60 hover:border-indigo-500 bg-indigo-950/20'
                      : 'border-slate-700/80 hover:border-slate-600 bg-slate-900/50'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple={isBatchMode}
                    accept=".html,.htm,.zip"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        if (isBatchMode || e.target.files.length > 1) {
                          addFilesToBatch(e.target.files);
                        } else {
                          handleFileUpload(e.target.files[0]);
                        }
                      }
                    }}
                  />
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center mx-auto mb-1.5 ${
                    isBatchMode ? 'bg-indigo-500/20 text-indigo-400' : 'bg-blue-500/10 text-blue-400'
                  }`}>
                    {isBatchMode ? <ListChecks className="w-4 h-4" /> : <FolderArchive className="w-4 h-4" />}
                  </div>
                  <p className="text-xs font-semibold text-slate-200">
                    {isBatchMode
                      ? 'Drop multiple .html, .htm or .zip files here'
                      : 'Drop .html, .htm or .zip bundle here'}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {isBatchMode
                      ? 'Select multiple files to convert sequentially in a queue'
                      : 'ZIP archives automatically unzip and preserve relative images/CSS'}
                  </p>
                </div>

                {/* Single file upload active preview */}
                {!isBatchMode && uploadedFile && (
                  <div className="p-2.5 bg-slate-800/80 rounded-lg border border-slate-700 flex items-center justify-between">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <FileCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                      <div className="truncate">
                        <div className="text-xs font-medium text-slate-200 truncate">
                          {uploadedFile.fileName}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {uploadedFile.assetCount > 0 ? `${uploadedFile.assetCount} linked assets extracted` : 'Single file'}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPreviewKey((k) => k + 1)}
                      title="Reload Preview"
                      className="p-1 hover:bg-slate-700 rounded text-slate-300"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Batch Queue Section */}
                {isBatchMode && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                        <ListChecks className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Pending Batch Queue ({batchQueue.length})</span>
                      </span>
                      {batchQueue.length > 0 && !isBatchRunning && (
                        <button
                          type="button"
                          onClick={clearBatchQueue}
                          className="text-[10px] text-rose-400 hover:text-rose-300 flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Clear All</span>
                        </button>
                      )}
                    </div>

                    {batchQueue.length === 0 ? (
                      <div className="p-3 bg-slate-900/50 border border-slate-800/80 rounded-lg text-center text-slate-400 text-[11px]">
                        No files in queue. Click above to select multiple HTML or ZIP files.
                      </div>
                    ) : (
                      <div className="max-h-56 overflow-y-auto space-y-1.5 pr-0.5">
                        {batchQueue.map((item, idx) => (
                          <div
                            key={item.id}
                            className={`p-2 rounded-lg border flex items-center justify-between text-xs transition ${
                              item.status === 'converting' || item.status === 'uploading'
                                ? 'bg-indigo-950/40 border-indigo-600/60 shadow-sm'
                                : item.status === 'done'
                                ? 'bg-emerald-950/20 border-emerald-800/50'
                                : item.status === 'error'
                                ? 'bg-rose-950/20 border-rose-800/50'
                                : 'bg-slate-900/70 border-slate-800'
                            }`}
                          >
                            <div className="flex items-center gap-2 overflow-hidden flex-1 mr-2">
                              <span className="font-mono text-[10px] text-slate-500 w-4 text-right">
                                {idx + 1}.
                              </span>
                              <div className="truncate flex-1">
                                <div className="text-slate-200 font-medium truncate text-[11px]">
                                  {item.name}
                                </div>
                                <div className="text-[9px] text-slate-400 flex items-center gap-2">
                                  <span>{(item.size / 1024).toFixed(1)} KB</span>
                                  {item.result && (
                                    <span className="text-emerald-400 font-mono">
                                      {item.result.pages}p • {(item.result.fileSize / 1024).toFixed(1)}KB • {item.result.durationMs}ms
                                    </span>
                                  )}
                                  {item.error && <span className="text-rose-400">{item.error}</span>}
                                </div>
                              </div>
                            </div>

                            {/* Status and Action */}
                            <div className="flex items-center gap-1.5 shrink-0">
                              {item.status === 'pending' && (
                                <span className="px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded text-[9px] uppercase font-mono">
                                  Pending
                                </span>
                              )}
                              {(item.status === 'uploading' || item.status === 'converting') && (
                                <span className="px-1.5 py-0.5 bg-indigo-500/20 text-indigo-300 rounded text-[9px] font-medium flex items-center gap-1">
                                  <Loader2 className="w-2.5 h-2.5 animate-spin text-indigo-400" />
                                  <span>{item.status === 'uploading' ? 'Upload...' : 'Rendering...'}</span>
                                </span>
                              )}
                              {item.status === 'done' && (
                                <div className="flex items-center gap-1">
                                  <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 rounded text-[9px] font-semibold flex items-center gap-0.5">
                                    <Check className="w-2.5 h-2.5 text-emerald-400" />
                                    <span>Done</span>
                                  </span>
                                  {item.result && (
                                    <a
                                      href={item.result.downloadUrl}
                                      download={item.result.fileName}
                                      title="Download generated PDF"
                                      className="p-1 text-slate-400 hover:text-emerald-300 hover:bg-slate-800 rounded"
                                    >
                                      <Download className="w-3 h-3" />
                                    </a>
                                  )}
                                </div>
                              )}
                              {item.status === 'error' && (
                                <span className="px-1.5 py-0.5 bg-rose-500/20 text-rose-300 rounded text-[9px] font-semibold">
                                  Error
                                </span>
                              )}

                              {!isBatchRunning && (
                                <button
                                  type="button"
                                  onClick={() => removeBatchItem(item.id)}
                                  className="p-1 text-slate-500 hover:text-rose-400 rounded"
                                  title="Remove item"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Batch Actions Button */}
                    {batchQueue.length > 0 && (
                      <div className="pt-1.5 space-y-1.5">
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            disabled={isBatchRunning}
                            onClick={() => runBatchQueue('convert')}
                            className="py-2 px-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg font-semibold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/20 transition"
                          >
                            {isBatchRunning ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Play className="w-3.5 h-3.5" />
                            )}
                            <span>{isBatchRunning ? `Processing ${batchProgress.current}/${batchProgress.total}` : `Convert All (${batchQueue.length})`}</span>
                          </button>

                          <button
                            type="button"
                            disabled={isBatchRunning}
                            onClick={() => runBatchQueue('print')}
                            className="py-2 px-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 rounded-lg font-semibold text-xs flex items-center justify-center gap-1.5 border border-slate-700 transition"
                          >
                            <Printer className="w-3.5 h-3.5 text-indigo-400" />
                            <span>Print All ({batchQueue.length})</span>
                          </button>
                        </div>

                        {isBatchRunning && (
                          <button
                            type="button"
                            onClick={() => {
                              batchCancelRef.current = true;
                              setIsBatchRunning(false);
                            }}
                            className="w-full py-1 text-[11px] text-rose-400 hover:text-rose-300 bg-rose-950/30 border border-rose-900/50 rounded text-center transition"
                          >
                            Cancel Remaining Queue
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {inputMode === 'code' && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-medium text-slate-400">HTML Source with live edit:</span>
                  <span className="text-[10px] text-slate-500">{(rawHtml.length / 1024).toFixed(1)} KB</span>
                </div>
                <textarea
                  value={rawHtml}
                  onChange={(e) => {
                    setRawHtml(e.target.value);
                    setPreviewKey((k) => k + 1);
                  }}
                  rows={6}
                  placeholder="<!DOCTYPE html><html><body><h1>Hello World</h1></body></html>"
                  className="w-full font-mono text-[11px] bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-blue-500 leading-relaxed resize-none"
                />
              </div>
            )}

            {inputMode === 'url' && (
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1.5">
                  Target Web URL:
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Globe className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                    <input
                      type="url"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      placeholder="https://example.com"
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <button
                    onClick={() => setPreviewKey((k) => k + 1)}
                    className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700"
                  >
                    Load
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Engine waits for full networkidle and webfonts before converting.
                </p>
              </div>
            )}
          </div>

          {/* Conversion Options Accordion */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
              <span className="flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-blue-400" />
                Print & PDF Options
              </span>
            </div>

            {/* Section 1: Page Format & Layout */}
            <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-900/40">
              <button
                onClick={() => setOpenSection(openSection === 'page' ? null : 'page')}
                className="w-full px-3 py-2 text-xs font-medium text-slate-200 flex items-center justify-between hover:bg-slate-800/50"
              >
                <span>Page Size & Orientation</span>
                {openSection === 'page' ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
              {openSection === 'page' && (
                <div className="p-3 border-t border-slate-800 space-y-3.5 bg-slate-950/30 text-xs">
                  {/* Media Emulation */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-slate-400 font-medium">Render Media</label>
                      <span className="text-[10px] text-blue-400 font-mono">
                        {options.media === 'print' ? '@media print' : '@media screen'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1 bg-slate-900 p-0.5 rounded border border-slate-800">
                      <button
                        type="button"
                        onClick={() => setOptions({ ...options, media: 'print' })}
                        className={`py-1.5 px-2 text-center rounded text-xs font-medium transition ${
                          options.media === 'print' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Print (@media print)
                      </button>
                      <button
                        type="button"
                        onClick={() => setOptions({ ...options, media: 'screen' })}
                        className={`py-1.5 px-2 text-center rounded text-xs font-medium transition ${
                          options.media === 'screen' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Screen (@media screen)
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                      {options.media === 'print'
                        ? 'Evaluates @media print rules, page-breaks, and print color preservation.'
                        : 'Evaluates standard desktop screen styles without print overrides.'}
                    </p>
                    {fieldErrors['media'] && (
                      <p className="text-[10px] text-rose-400 mt-0.5 font-medium">{fieldErrors['media']}</p>
                    )}
                  </div>

                  {/* Size Authority: CSS @page vs UI Paper Size */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-slate-400 font-medium">Page Size Authority</label>
                      <span className="text-[10px] font-mono text-indigo-400">
                        {options.pageSizeAuthority === 'css' ? 'CSS @page Priority' : 'UI Paper Priority'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1 bg-slate-900 p-0.5 rounded border border-slate-800">
                      <button
                        type="button"
                        onClick={() => setOptions({ ...options, pageSizeAuthority: 'css' })}
                        className={`py-1.5 px-2 text-center rounded text-xs font-medium transition ${
                          options.pageSizeAuthority === 'css' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        CSS @page Priority
                      </button>
                      <button
                        type="button"
                        onClick={() => setOptions({ ...options, pageSizeAuthority: 'ui' })}
                        className={`py-1.5 px-2 text-center rounded text-xs font-medium transition ${
                          options.pageSizeAuthority === 'ui' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        UI Paper Priority
                      </button>
                    </div>
                    <div className="mt-1.5 p-2 rounded bg-slate-900/90 border border-slate-800 text-[11px] leading-relaxed">
                      {options.pageSizeAuthority === 'css' ? (
                        <span className="text-indigo-300">
                          <strong>Governed by:</strong> Document <code>@page &#123; size &#125;</code> rules take precedence. Selected UI size (<strong>{options.pageSize}</strong>) acts as fallback if not declared in CSS.
                        </span>
                      ) : (
                        <span className="text-blue-300">
                          <strong>Governed by:</strong> UI Paper Size (<strong>{options.pageSize}</strong>) strictly enforced, overriding any document CSS @page rules.
                        </span>
                      )}
                    </div>
                    {fieldErrors['pageSizeAuthority'] && (
                      <p className="text-[10px] text-rose-400 mt-0.5 font-medium">{fieldErrors['pageSizeAuthority']}</p>
                    )}
                  </div>

                  {/* Page Size & Orientation */}
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800">
                    <div>
                      <label className="text-slate-400 block mb-1">Paper Format</label>
                      <select
                        value={options.pageSize}
                        onChange={(e) => setOptions({ ...options, pageSize: e.target.value })}
                        className={`w-full bg-slate-900 border rounded p-1.5 text-slate-200 ${
                          fieldErrors['pageSize'] ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-700'
                        }`}
                      >
                        <option value="A4">A4 (210 × 297 mm)</option>
                        <option value="Letter">US Letter (8.5 × 11 in)</option>
                        <option value="A3">A3 (297 × 420 mm)</option>
                        <option value="Legal">Legal (8.5 × 14 in)</option>
                        <option value="Tabloid">Tabloid (11 × 17 in)</option>
                        <option value="Executive">Executive</option>
                        <option value="Custom">Custom Dimensions</option>
                      </select>
                      {fieldErrors['pageSize'] && (
                        <p className="text-[10px] text-rose-400 mt-0.5">{fieldErrors['pageSize']}</p>
                      )}
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Orientation</label>
                      <div className="grid grid-cols-2 gap-1 bg-slate-900 p-0.5 rounded border border-slate-800">
                        <button
                          type="button"
                          onClick={() => setOptions({ ...options, orientation: 'portrait' })}
                          className={`py-1 text-center rounded ${
                            options.orientation === 'portrait' ? 'bg-blue-600 text-white' : 'text-slate-400'
                          }`}
                        >
                          Portrait
                        </button>
                        <button
                          type="button"
                          onClick={() => setOptions({ ...options, orientation: 'landscape' })}
                          className={`py-1 text-center rounded ${
                            options.orientation === 'landscape' ? 'bg-blue-600 text-white' : 'text-slate-400'
                          }`}
                        >
                          Landscape
                        </button>
                      </div>
                    </div>
                  </div>

                  {options.pageSize === 'Custom' && (
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800">
                      <div>
                        <label className="text-slate-400 block mb-1">Width (mm)</label>
                        <input
                          type="text"
                          value={options.customWidth}
                          onChange={(e) => setOptions({ ...options, customWidth: e.target.value })}
                          className={`w-full bg-slate-900 border rounded p-1.5 text-slate-200 ${
                            fieldErrors['customWidth'] ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-700'
                          }`}
                        />
                        {fieldErrors['customWidth'] && (
                          <p className="text-[10px] text-rose-400 mt-0.5">{fieldErrors['customWidth']}</p>
                        )}
                      </div>
                      <div>
                        <label className="text-slate-400 block mb-1">Height (mm)</label>
                        <input
                          type="text"
                          value={options.customHeight}
                          onChange={(e) => setOptions({ ...options, customHeight: e.target.value })}
                          className={`w-full bg-slate-900 border rounded p-1.5 text-slate-200 ${
                            fieldErrors['customHeight'] ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-700'
                          }`}
                        />
                        {fieldErrors['customHeight'] && (
                          <p className="text-[10px] text-rose-400 mt-0.5">{fieldErrors['customHeight']}</p>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 items-start pt-1 border-t border-slate-800">
                    <div>
                      <div className="flex justify-between text-slate-400 mb-1">
                        <span>Scale: {Math.round(options.scale * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.1"
                        max="2.0"
                        step="0.05"
                        value={options.scale}
                        onChange={(e) => setOptions({ ...options, scale: parseFloat(e.target.value) })}
                        className="w-full accent-blue-500"
                      />
                      {fieldErrors['scale'] && (
                        <p className="text-[10px] text-rose-400 mt-0.5">{fieldErrors['scale']}</p>
                      )}
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Page Ranges</label>
                      <input
                        type="text"
                        placeholder="e.g. 1-3, 5 (all)"
                        value={options.pageRanges}
                        onChange={(e) => setOptions({ ...options, pageRanges: e.target.value })}
                        className={`w-full bg-slate-900 border rounded p-1.5 text-slate-200 ${
                          fieldErrors['pageRanges'] ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-700'
                        }`}
                      />
                      {fieldErrors['pageRanges'] && (
                        <p className="text-[10px] text-rose-400 mt-0.5">{fieldErrors['pageRanges']}</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-800">
                    <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                      <input
                        type="checkbox"
                        checked={options.background}
                        onChange={(e) => setOptions({ ...options, background: e.target.checked })}
                        className="rounded bg-slate-900 border-slate-700 text-blue-600 accent-blue-500"
                      />
                      <span>Background graphics</span>
                    </label>

                    {/* Raster 2x Mode marked unavailable */}
                    <div className="p-2 rounded bg-slate-900/60 border border-slate-800 space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 text-slate-400 cursor-not-allowed">
                          <input
                            type="checkbox"
                            checked={false}
                            disabled={true}
                            className="rounded bg-slate-950 border-slate-700 text-slate-600 cursor-not-allowed opacity-50"
                          />
                          <span className="line-through text-slate-400">Raster 2x mode (Canvas)</span>
                        </label>
                        <span className="text-[9px] bg-amber-500/20 text-amber-300 font-mono px-1.5 py-0.5 rounded border border-amber-500/30">
                          Unavailable (Vector only)
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 pl-6">
                        Raster renderer is currently unavailable. All exports are generated using standard vector emulation.
                      </p>
                    </div>
                  </div>

                  {/* Compression & Optimization Settings */}
                  <div className="pt-2 border-t border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-slate-300 font-medium flex items-center gap-1.5">
                        <Gauge className="w-3.5 h-3.5 text-blue-400" />
                        <span>Compression & Quality</span>
                      </label>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-mono">
                        {options.compression === 'high' ? 'Lossless' : options.compression === 'balanced' ? 'Balanced' : 'Max Compact'}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => setOptions({ ...options, compression: 'high' })}
                        className={`p-2 rounded-lg border text-left transition flex flex-col justify-between ${
                          options.compression === 'high'
                            ? 'bg-blue-600/20 border-blue-500 text-white shadow-sm'
                            : 'bg-slate-900/70 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                        }`}
                      >
                        <div className="font-semibold text-[11px] leading-tight flex items-center justify-between mb-1">
                          <span>High Quality</span>
                          {options.compression === 'high' && <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
                        </div>
                        <span className="text-[10px] text-slate-400 leading-snug">
                          Uncompressed, 100% original image fidelity
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setOptions({ ...options, compression: 'balanced' })}
                        className={`p-2 rounded-lg border text-left transition flex flex-col justify-between ${
                          options.compression === 'balanced'
                            ? 'bg-blue-600/20 border-blue-500 text-white shadow-sm'
                            : 'bg-slate-900/70 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                        }`}
                      >
                        <div className="font-semibold text-[11px] leading-tight flex items-center justify-between mb-1">
                          <span>Balanced</span>
                          {options.compression === 'balanced' && <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
                        </div>
                        <span className="text-[10px] text-slate-400 leading-snug">
                          Optimal web size (max 1200px, 80% JPEG)
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setOptions({ ...options, compression: 'small' })}
                        className={`p-2 rounded-lg border text-left transition flex flex-col justify-between ${
                          options.compression === 'small'
                            ? 'bg-blue-600/20 border-blue-500 text-white shadow-sm'
                            : 'bg-slate-900/70 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                        }`}
                      >
                        <div className="font-semibold text-[11px] leading-tight flex items-center justify-between mb-1">
                          <span>Small Size</span>
                          {options.compression === 'small' && <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
                        </div>
                        <span className="text-[10px] text-slate-400 leading-snug">
                          Compressed / Downsampled (max 800px, 60%)
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Section 2: Margins */}
            <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-900/40">
              <button
                onClick={() => setOpenSection(openSection === 'margins' ? null : 'margins')}
                className="w-full px-3 py-2 text-xs font-medium text-slate-200 flex items-center justify-between hover:bg-slate-800/50"
              >
                <span>Margins (Presets & Custom mm)</span>
                {openSection === 'margins' ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
              {openSection === 'margins' && (
                <div className="p-3 border-t border-slate-800 space-y-2.5 bg-slate-950/30 text-xs">
                  {fieldErrors['margins'] && (
                    <div className="p-2 rounded bg-rose-950/60 border border-rose-800 text-[11px] text-rose-300">
                      {fieldErrors['margins']}
                    </div>
                  )}

                  <div className="grid grid-cols-4 gap-1 bg-slate-900 p-0.5 rounded border border-slate-800">
                    {(['none', 'normal', 'minimal', 'custom'] as const).map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setOptions({ ...options, marginPreset: preset })}
                        className={`py-1 text-center capitalize rounded ${
                          options.marginPreset === preset ? 'bg-blue-600 text-white' : 'text-slate-400'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>

                  {options.marginPreset === 'custom' && (
                    <div className="grid grid-cols-4 gap-2 pt-1">
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">Top (mm)</label>
                        <input
                          type="text"
                          value={options.marginTop}
                          onChange={(e) => setOptions({ ...options, marginTop: e.target.value })}
                          className={`w-full bg-slate-900 border rounded p-1 text-slate-200 ${
                            fieldErrors['marginTop'] ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-700'
                          }`}
                        />
                        {fieldErrors['marginTop'] && (
                          <p className="text-[9px] text-rose-400 mt-0.5">{fieldErrors['marginTop']}</p>
                        )}
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">Bottom (mm)</label>
                        <input
                          type="text"
                          value={options.marginBottom}
                          onChange={(e) => setOptions({ ...options, marginBottom: e.target.value })}
                          className={`w-full bg-slate-900 border rounded p-1 text-slate-200 ${
                            fieldErrors['marginBottom'] ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-700'
                          }`}
                        />
                        {fieldErrors['marginBottom'] && (
                          <p className="text-[9px] text-rose-400 mt-0.5">{fieldErrors['marginBottom']}</p>
                        )}
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">Left (mm)</label>
                        <input
                          type="text"
                          value={options.marginLeft}
                          onChange={(e) => setOptions({ ...options, marginLeft: e.target.value })}
                          className={`w-full bg-slate-900 border rounded p-1 text-slate-200 ${
                            fieldErrors['marginLeft'] ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-700'
                          }`}
                        />
                        {fieldErrors['marginLeft'] && (
                          <p className="text-[9px] text-rose-400 mt-0.5">{fieldErrors['marginLeft']}</p>
                        )}
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">Right (mm)</label>
                        <input
                          type="text"
                          value={options.marginRight}
                          onChange={(e) => setOptions({ ...options, marginRight: e.target.value })}
                          className={`w-full bg-slate-900 border rounded p-1 text-slate-200 ${
                            fieldErrors['marginRight'] ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-700'
                          }`}
                        />
                        {fieldErrors['marginRight'] && (
                          <p className="text-[9px] text-rose-400 mt-0.5">{fieldErrors['marginRight']}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Section 3: Headers & Footers with Dynamic Variables */}
            <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-900/40">
              <button
                onClick={() => setOpenSection(openSection === 'header' ? null : 'header')}
                className="w-full px-3 py-2 text-xs font-medium text-slate-200 flex items-center justify-between hover:bg-slate-800/50"
              >
                <span className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-blue-400" />
                  <span>Header & Footer (Page Numbers)</span>
                  {options.enableHeaderFooter && (
                    <span className="text-[9px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded-full border border-blue-500/40 font-mono">
                      ON
                    </span>
                  )}
                </span>
                {openSection === 'header' ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
              {openSection === 'header' && (
                <div className="p-3 border-t border-slate-800 space-y-3 bg-slate-950/30 text-xs">
                  {/* Master Toggle */}
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                      <input
                        type="checkbox"
                        checked={options.enableHeaderFooter}
                        onChange={(e) => setOptions({ ...options, enableHeaderFooter: e.target.checked })}
                        className="rounded bg-slate-900 border-slate-700 text-blue-600 accent-blue-500"
                      />
                      <span className="font-medium text-slate-200">Inject Header & Footer into PDF</span>
                    </label>
                    {options.enableHeaderFooter && (
                      <div className="flex gap-1 bg-slate-900 p-0.5 rounded border border-slate-800">
                        <button
                          type="button"
                          onClick={() => setHfViewMode('builder')}
                          className={`px-2 py-0.5 rounded text-[10px] ${
                            hfViewMode === 'builder' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          Visual Builder
                        </button>
                        <button
                          type="button"
                          onClick={() => setHfViewMode('raw')}
                          className={`px-2 py-0.5 rounded text-[10px] ${
                            hfViewMode === 'raw' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          Raw HTML
                        </button>
                      </div>
                    )}
                  </div>

                  {options.enableHeaderFooter && (
                    <div className="space-y-3 pt-1 border-t border-slate-800/80">
                      {/* 1-Click Auto-Injection Presets */}
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-1">1-Click Layout Presets</label>
                        <div className="grid grid-cols-2 gap-1">
                          <button
                            type="button"
                            onClick={() => applyHfPreset('page-x-of-y')}
                            className={`p-1.5 rounded text-left border transition text-[10px] ${
                              hfPreset === 'page-x-of-y'
                                ? 'bg-blue-950/80 text-blue-200 border-blue-500'
                                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
                            }`}
                          >
                            <div className="font-semibold">Page X of Y (Center)</div>
                            <div className="text-[9px] text-slate-400">Clean footer page count only</div>
                          </button>
                          <button
                            type="button"
                            onClick={() => applyHfPreset('formal')}
                            className={`p-1.5 rounded text-left border transition text-[10px] ${
                              hfPreset === 'formal'
                                ? 'bg-blue-950/80 text-blue-200 border-blue-500'
                                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
                            }`}
                          >
                            <div className="font-semibold">Formal Document</div>
                            <div className="text-[9px] text-slate-400">Title + Date header, Page # footer</div>
                          </button>
                          <button
                            type="button"
                            onClick={() => applyHfPreset('executive')}
                            className={`p-1.5 rounded text-left border transition text-[10px] ${
                              hfPreset === 'executive'
                                ? 'bg-blue-950/80 text-blue-200 border-blue-500'
                                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
                            }`}
                          >
                            <div className="font-semibold">Executive Report</div>
                            <div className="text-[9px] text-slate-400">Title + Date, Confidential notice</div>
                          </button>
                          <button
                            type="button"
                            onClick={() => applyHfPreset('metadata')}
                            className={`p-1.5 rounded text-left border transition text-[10px] ${
                              hfPreset === 'metadata'
                                ? 'bg-blue-950/80 text-blue-200 border-blue-500'
                                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
                            }`}
                          >
                            <div className="font-semibold">Audit Metadata</div>
                            <div className="text-[9px] text-slate-400">Title, URL, Date & Page #</div>
                          </button>
                        </div>
                      </div>

                      {/* Dynamic Variable Token Badges */}
                      <div className="p-2 bg-slate-900/80 rounded-lg border border-slate-800">
                        <div className="text-[10px] text-slate-400 mb-1 font-medium">Available Dynamic Variables:</div>
                        <div className="flex flex-wrap gap-1">
                          <button
                            type="button"
                            onClick={() => setFooterCenter((prev) => `${prev} {{pageNumber}}`)}
                            className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-blue-300 rounded font-mono text-[9px] border border-slate-700"
                            title="Click to insert"
                          >
                            + {'{{pageNumber}}'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setFooterCenter((prev) => `${prev} {{totalPages}}`)}
                            className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-blue-300 rounded font-mono text-[9px] border border-slate-700"
                            title="Click to insert"
                          >
                            + {'{{totalPages}}'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setHeaderRight('{{date}}')}
                            className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-emerald-300 rounded font-mono text-[9px] border border-slate-700"
                            title="Click to insert"
                          >
                            + {'{{date}}'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setHeaderLeft('{{title}}')}
                            className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded font-mono text-[9px] border border-slate-700"
                            title="Click to insert"
                          >
                            + {'{{title}}'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setHeaderRight('{{url}}')}
                            className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded font-mono text-[9px] border border-slate-700"
                            title="Click to insert"
                          >
                            + {'{{url}}'}
                          </button>
                        </div>
                      </div>

                      {hfViewMode === 'builder' ? (
                        <div className="space-y-3">
                          {/* HEADER BUILDER */}
                          <div className="p-2.5 bg-slate-900/60 rounded-lg border border-slate-800 space-y-2">
                            <div className="flex items-center justify-between">
                              <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-200">
                                <input
                                  type="checkbox"
                                  checked={headerEnabled}
                                  onChange={(e) => setHeaderEnabled(e.target.checked)}
                                  className="rounded bg-slate-900 border-slate-700 text-blue-600 accent-blue-500"
                                />
                                <span>Header Section</span>
                              </label>
                              {headerEnabled && (
                                <label className="flex items-center gap-1 text-[10px] text-slate-400 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={headerBorder}
                                    onChange={(e) => setHeaderBorder(e.target.checked)}
                                    className="rounded bg-slate-900 border-slate-700 text-blue-600 accent-blue-500"
                                  />
                                  <span>Divider Line</span>
                                </label>
                              )}
                            </div>

                            {headerEnabled && (
                              <div className="grid grid-cols-3 gap-1.5 pt-1">
                                <div>
                                  <label className="text-[9px] text-slate-400 block mb-0.5">Left</label>
                                  <input
                                    type="text"
                                    value={headerLeft}
                                    onChange={(e) => setHeaderLeft(e.target.value)}
                                    placeholder="{{title}}"
                                    className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-[10px] text-slate-200 font-mono"
                                  />
                                </div>
                                <div>
                                  <label className="text-[9px] text-slate-400 block mb-0.5">Center</label>
                                  <input
                                    type="text"
                                    value={headerCenter}
                                    onChange={(e) => setHeaderCenter(e.target.value)}
                                    placeholder="Company Name"
                                    className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-[10px] text-slate-200 font-mono"
                                  />
                                </div>
                                <div>
                                  <label className="text-[9px] text-slate-400 block mb-0.5">Right</label>
                                  <input
                                    type="text"
                                    value={headerRight}
                                    onChange={(e) => setHeaderRight(e.target.value)}
                                    placeholder="{{date}}"
                                    className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-[10px] text-slate-200 font-mono"
                                  />
                                </div>
                              </div>
                            )}
                          </div>

                          {/* FOOTER BUILDER */}
                          <div className="p-2.5 bg-slate-900/60 rounded-lg border border-slate-800 space-y-2">
                            <div className="flex items-center justify-between">
                              <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-200">
                                <input
                                  type="checkbox"
                                  checked={footerEnabled}
                                  onChange={(e) => setFooterEnabled(e.target.checked)}
                                  className="rounded bg-slate-900 border-slate-700 text-blue-600 accent-blue-500"
                                />
                                <span>Footer Section</span>
                              </label>
                              {footerEnabled && (
                                <label className="flex items-center gap-1 text-[10px] text-slate-400 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={footerBorder}
                                    onChange={(e) => setFooterBorder(e.target.checked)}
                                    className="rounded bg-slate-900 border-slate-700 text-blue-600 accent-blue-500"
                                  />
                                  <span>Divider Line</span>
                                </label>
                              )}
                            </div>

                            {footerEnabled && (
                              <div className="grid grid-cols-3 gap-1.5 pt-1">
                                <div>
                                  <label className="text-[9px] text-slate-400 block mb-0.5">Left</label>
                                  <input
                                    type="text"
                                    value={footerLeft}
                                    onChange={(e) => setFooterLeft(e.target.value)}
                                    placeholder="Notice"
                                    className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-[10px] text-slate-200 font-mono"
                                  />
                                </div>
                                <div>
                                  <label className="text-[9px] text-slate-400 block mb-0.5">Center (Page Numbers)</label>
                                  <input
                                    type="text"
                                    value={footerCenter}
                                    onChange={(e) => setFooterCenter(e.target.value)}
                                    placeholder="Page {{pageNumber}} of {{totalPages}}"
                                    className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-[10px] text-slate-200 font-mono"
                                  />
                                </div>
                                <div>
                                  <label className="text-[9px] text-slate-400 block mb-0.5">Right</label>
                                  <input
                                    type="text"
                                    value={footerRight}
                                    onChange={(e) => setFooterRight(e.target.value)}
                                    placeholder="{{date}}"
                                    className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-[10px] text-slate-200 font-mono"
                                  />
                                </div>
                              </div>
                            )}
                          </div>

                          {/* STYLE & MARGIN CONTROLS */}
                          <div className="grid grid-cols-2 gap-2 pt-1">
                            <div>
                              <label className="text-slate-400 block mb-1">Font Size</label>
                              <select
                                value={hfFontSize}
                                onChange={(e) => setHfFontSize(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-slate-200 text-xs"
                              >
                                <option value="8px">8px (Micro)</option>
                                <option value="9px">9px (Standard Small)</option>
                                <option value="10px">10px (Regular)</option>
                                <option value="11px">11px (Prominent)</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-slate-400 block mb-1">Text Color</label>
                              <div className="flex items-center gap-1.5">
                                {['#64748b', '#1e293b', '#4f46e5', '#dc2626'].map((c) => (
                                  <button
                                    key={c}
                                    type="button"
                                    onClick={() => setHfColor(c)}
                                    style={{ backgroundColor: c }}
                                    className={`w-4 h-4 rounded-full border-2 transition ${
                                      hfColor === c ? 'border-white scale-110' : 'border-transparent'
                                    }`}
                                  />
                                ))}
                                <input
                                  type="color"
                                  value={hfColor}
                                  onChange={(e) => setHfColor(e.target.value)}
                                  className="w-6 h-5 rounded cursor-pointer bg-transparent border-0 ml-1"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* RAW HTML MODE */
                        <div className="space-y-2">
                          <div>
                            <label className="text-slate-400 block mb-1">Header HTML Template</label>
                            <input
                              type="text"
                              value={options.headerTemplate}
                              onChange={(e) => setOptions({ ...options, headerTemplate: e.target.value })}
                              className={`w-full bg-slate-900 border rounded p-1.5 font-mono text-[10px] text-slate-200 ${
                                fieldErrors['headerTemplate'] ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-700'
                              }`}
                            />
                            {fieldErrors['headerTemplate'] && (
                              <p className="text-[10px] text-rose-400 mt-0.5">{fieldErrors['headerTemplate']}</p>
                            )}
                          </div>
                          <div>
                            <label className="text-slate-400 block mb-1">Footer HTML Template</label>
                            <input
                              type="text"
                              value={options.footerTemplate}
                              onChange={(e) => setOptions({ ...options, footerTemplate: e.target.value })}
                              className={`w-full bg-slate-900 border rounded p-1.5 font-mono text-[10px] text-slate-200 ${
                                fieldErrors['footerTemplate'] ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-700'
                              }`}
                            />
                            {fieldErrors['footerTemplate'] && (
                              <p className="text-[10px] text-rose-400 mt-0.5">{fieldErrors['footerTemplate']}</p>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="p-2 bg-blue-950/40 border border-blue-900/50 rounded text-[10px] text-blue-300">
                        <strong>Automatic Margin Safety:</strong> Playwright reserves at least 15mm top and bottom margin room when headers/footers are active, preventing text clipping and overlapping.
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Section 4: Watermark (Text & Image) */}
            <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-900/40">
              <button
                onClick={() => setOpenSection(openSection === 'watermark' ? null : 'watermark')}
                className="w-full px-3 py-2 text-xs font-medium text-slate-200 flex items-center justify-between hover:bg-slate-800/50"
              >
                <span className="flex items-center gap-1.5">
                  <Stamp className="w-3.5 h-3.5 text-rose-400" />
                  <span>Watermark</span>
                  {options.watermarkEnabled && (
                    <span className="text-[9px] bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded-full border border-rose-500/40 font-mono">
                      ON ({options.watermarkType})
                    </span>
                  )}
                </span>
                {openSection === 'watermark' ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
              {openSection === 'watermark' && (
                <div className="p-3 border-t border-slate-800 space-y-3 bg-slate-950/30 text-xs">
                  {/* Watermark Toggle */}
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                      <input
                        type="checkbox"
                        checked={options.watermarkEnabled}
                        onChange={(e) => setOptions({ ...options, watermarkEnabled: e.target.checked })}
                        className="rounded bg-slate-900 border-slate-700 text-rose-600 accent-rose-500"
                      />
                      <span className="font-medium text-slate-200">Inject Watermark across all pages</span>
                    </label>
                  </div>

                  {options.watermarkEnabled && (
                    <div className="space-y-3 pt-1 border-t border-slate-800/80">
                      {/* Watermark Type Selector */}
                      <div className="grid grid-cols-2 gap-1 bg-slate-900 p-0.5 rounded border border-slate-800">
                        <button
                          type="button"
                          onClick={() => setOptions({ ...options, watermarkType: 'text' })}
                          className={`flex items-center justify-center gap-1.5 py-1 rounded text-center transition ${
                            options.watermarkType === 'text' ? 'bg-rose-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <Type className="w-3.5 h-3.5" />
                          <span>Text Watermark</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setOptions({ ...options, watermarkType: 'image' })}
                          className={`flex items-center justify-center gap-1.5 py-1 rounded text-center transition ${
                            options.watermarkType === 'image' ? 'bg-rose-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <ImageIcon className="w-3.5 h-3.5" />
                          <span>Image / Stamp</span>
                        </button>
                      </div>

                      {/* TEXT CONTROLS */}
                      {options.watermarkType === 'text' && (
                        <div className="space-y-2.5">
                          {/* Quick Text Presets */}
                          <div>
                            <label className="text-[10px] text-slate-400 block mb-1">Quick Text Presets</label>
                            <div className="flex flex-wrap gap-1">
                              {[
                                { text: 'CONFIDENTIAL', color: '#dc2626' },
                                { text: 'DRAFT', color: '#4f46e5' },
                                { text: 'SAMPLE', color: '#64748b' },
                                { text: 'DO NOT COPY', color: '#dc2626' },
                                { text: 'INTERNAL ONLY', color: '#d97706' },
                              ].map((preset) => (
                                <button
                                  key={preset.text}
                                  type="button"
                                  onClick={() =>
                                    setOptions({
                                      ...options,
                                      watermarkText: preset.text,
                                      watermarkColor: preset.color,
                                    })
                                  }
                                  className={`px-2 py-0.5 rounded text-[10px] border transition ${
                                    options.watermarkText === preset.text
                                      ? 'bg-rose-950 text-rose-200 border-rose-600'
                                      : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
                                  }`}
                                >
                                  {preset.text}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Custom Text input */}
                          <div>
                            <label className="text-slate-400 block mb-1">Watermark Text</label>
                            <input
                              type="text"
                              value={options.watermarkText}
                              onChange={(e) => setOptions({ ...options, watermarkText: e.target.value })}
                              placeholder="e.g. CONFIDENTIAL or PRIVATE"
                              className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-slate-200 font-semibold tracking-wider uppercase text-xs"
                            />
                          </div>

                          {/* Color picker & presets */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-slate-400">Color</label>
                              <span className="font-mono text-[10px] text-slate-400">{options.watermarkColor}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex gap-1.5">
                                {['#dc2626', '#64748b', '#4f46e5', '#059669', '#d97706'].map((c) => (
                                  <button
                                    key={c}
                                    type="button"
                                    onClick={() => setOptions({ ...options, watermarkColor: c })}
                                    style={{ backgroundColor: c }}
                                    className={`w-5 h-5 rounded-full border-2 transition ${
                                      options.watermarkColor === c ? 'border-white scale-110' : 'border-transparent'
                                    }`}
                                  />
                                ))}
                              </div>
                              <input
                                type="color"
                                value={options.watermarkColor}
                                onChange={(e) => setOptions({ ...options, watermarkColor: e.target.value })}
                                className="w-7 h-6 rounded cursor-pointer bg-transparent border-0"
                              />
                            </div>
                          </div>

                          {/* Font size */}
                          <div>
                            <div className="flex justify-between text-slate-400 mb-1">
                              <span>Font Size</span>
                              <span className="font-mono text-slate-300">{options.watermarkFontSize}px</span>
                            </div>
                            <input
                              type="range"
                              min="24"
                              max="120"
                              step="2"
                              value={options.watermarkFontSize}
                              onChange={(e) => setOptions({ ...options, watermarkFontSize: parseInt(e.target.value, 10) })}
                              className="w-full accent-rose-500"
                            />
                          </div>
                        </div>
                      )}

                      {/* IMAGE CONTROLS */}
                      {options.watermarkType === 'image' && (
                        <div className="space-y-2.5">
                          {/* Vector Stamp Presets */}
                          <div>
                            <label className="text-[10px] text-slate-400 block mb-1">Vector Stamp Presets</label>
                            <div className="grid grid-cols-3 gap-1">
                              <button
                                type="button"
                                onClick={() => setOptions({ ...options, watermarkImageUrl: STAMP_PRESETS.confidential, watermarkImageWidth: 260 })}
                                className="px-2 py-1 bg-red-950/40 hover:bg-red-900/40 border border-red-800 text-red-300 rounded text-[10px] font-bold"
                              >
                                [CONFIDENTIAL]
                              </button>
                              <button
                                type="button"
                                onClick={() => setOptions({ ...options, watermarkImageUrl: STAMP_PRESETS.approved, watermarkImageWidth: 260 })}
                                className="px-2 py-1 bg-emerald-950/40 hover:bg-emerald-900/40 border border-emerald-800 text-emerald-300 rounded text-[10px] font-bold"
                              >
                                [APPROVED]
                              </button>
                              <button
                                type="button"
                                onClick={() => setOptions({ ...options, watermarkImageUrl: STAMP_PRESETS.draft, watermarkImageWidth: 260 })}
                                className="px-2 py-1 bg-indigo-950/40 hover:bg-indigo-900/40 border border-indigo-800 text-indigo-300 rounded text-[10px] font-bold"
                              >
                                [DRAFT]
                              </button>
                            </div>
                          </div>

                          {/* Image File Upload */}
                          <div>
                            <label className="text-slate-400 block mb-1">Upload Local Image (Logo / Stamp)</label>
                            <label className="flex items-center justify-center gap-1.5 py-1.5 px-3 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg cursor-pointer text-slate-300 transition">
                              <Upload className="w-3.5 h-3.5 text-rose-400" />
                              <span className="text-[11px]">Choose PNG, SVG, or JPG</span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  if (e.target.files && e.target.files[0]) {
                                    const reader = new FileReader();
                                    reader.onload = (event) => {
                                      if (event.target?.result) {
                                        setOptions({
                                          ...options,
                                          watermarkImageUrl: event.target.result as string,
                                        });
                                      }
                                    };
                                    reader.readAsDataURL(e.target.files[0]);
                                  }
                                }}
                              />
                            </label>
                          </div>

                          {/* Image URL input */}
                          <div>
                            <label className="text-slate-400 block mb-1">Or Direct Image URL / Base64</label>
                            <input
                              type="text"
                              value={options.watermarkImageUrl.startsWith('data:') ? '[Base64 Image Loaded]' : options.watermarkImageUrl}
                              onChange={(e) => setOptions({ ...options, watermarkImageUrl: e.target.value })}
                              placeholder="https://example.com/logo.png"
                              className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-slate-200 text-xs font-mono"
                            />
                          </div>

                          {/* Image Width slider */}
                          <div>
                            <div className="flex justify-between text-slate-400 mb-1">
                              <span>Image Width</span>
                              <span className="font-mono text-slate-300">{options.watermarkImageWidth}px</span>
                            </div>
                            <input
                              type="range"
                              min="80"
                              max="500"
                              step="10"
                              value={options.watermarkImageWidth}
                              onChange={(e) => setOptions({ ...options, watermarkImageWidth: parseInt(e.target.value, 10) })}
                              className="w-full accent-rose-500"
                            />
                          </div>
                        </div>
                      )}

                      {/* SHARED CONTROLS: Opacity, Rotation, Layout */}
                      <div className="space-y-2.5 pt-2 border-t border-slate-800/80">
                        {/* Opacity */}
                        <div>
                          <div className="flex justify-between text-slate-400 mb-1">
                            <span>Opacity</span>
                            <span className="font-mono text-slate-300 font-semibold">{Math.round(options.watermarkOpacity * 100)}%</span>
                          </div>
                          <input
                            type="range"
                            min="0.05"
                            max="0.80"
                            step="0.05"
                            value={options.watermarkOpacity}
                            onChange={(e) => setOptions({ ...options, watermarkOpacity: parseFloat(e.target.value) })}
                            className="w-full accent-rose-500"
                          />
                        </div>

                        {/* Rotation */}
                        <div>
                          <div className="flex justify-between items-center text-slate-400 mb-1">
                            <span>Rotation Angle</span>
                            <div className="flex items-center gap-1">
                              <span className="font-mono text-slate-300 font-semibold">{options.watermarkRotation}°</span>
                              <button
                                type="button"
                                onClick={() => setOptions({ ...options, watermarkRotation: -45 })}
                                className="px-1 text-[9px] bg-slate-800 hover:bg-slate-700 rounded text-slate-300"
                              >
                                -45°
                              </button>
                              <button
                                type="button"
                                onClick={() => setOptions({ ...options, watermarkRotation: 0 })}
                                className="px-1 text-[9px] bg-slate-800 hover:bg-slate-700 rounded text-slate-300"
                              >
                                0°
                              </button>
                              <button
                                type="button"
                                onClick={() => setOptions({ ...options, watermarkRotation: 45 })}
                                className="px-1 text-[9px] bg-slate-800 hover:bg-slate-700 rounded text-slate-300"
                              >
                                45°
                              </button>
                            </div>
                          </div>
                          <input
                            type="range"
                            min="-90"
                            max="90"
                            step="5"
                            value={options.watermarkRotation}
                            onChange={(e) => setOptions({ ...options, watermarkRotation: parseInt(e.target.value, 10) })}
                            className="w-full accent-rose-500"
                          />
                        </div>

                        {/* Layout Placement */}
                        <div>
                          <label className="text-slate-400 block mb-1">Layout Placement</label>
                          <div className="grid grid-cols-3 gap-1 bg-slate-900 p-0.5 rounded border border-slate-800 text-[11px]">
                            <button
                              type="button"
                              onClick={() => setOptions({ ...options, watermarkLayout: 'center' })}
                              className={`py-1 rounded text-center transition ${
                                options.watermarkLayout === 'center' ? 'bg-rose-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              Center
                            </button>
                            <button
                              type="button"
                              onClick={() => setOptions({ ...options, watermarkLayout: 'tiled' })}
                              className={`py-1 rounded text-center transition ${
                                options.watermarkLayout === 'tiled' ? 'bg-rose-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              Tiled Grid
                            </button>
                            <button
                              type="button"
                              onClick={() => setOptions({ ...options, watermarkLayout: 'absolute' })}
                              className={`py-1 rounded text-center transition ${
                                options.watermarkLayout === 'absolute' ? 'bg-rose-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              Custom (X, Y)
                            </button>
                          </div>
                        </div>

                        {/* Absolute Coordinates (X, Y) Controls */}
                        {options.watermarkLayout === 'absolute' && (
                          <div className="p-2.5 bg-slate-900/80 border border-slate-800 rounded-lg space-y-2.5">
                            <div className="flex items-center justify-between text-slate-300 font-medium">
                              <span>Position Coordinates</span>
                              <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded border border-slate-800">
                                {(['px', 'mm', '%'] as const).map((unit) => (
                                  <button
                                    key={unit}
                                    type="button"
                                    onClick={() => setOptions({ ...options, watermarkUnit: unit })}
                                    className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                                      options.watermarkUnit === unit
                                        ? 'bg-rose-600 text-white font-semibold'
                                        : 'text-slate-400 hover:text-slate-200'
                                    }`}
                                  >
                                    {unit}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <div className="flex justify-between text-slate-400 mb-0.5 text-[11px]">
                                  <span>X (Left)</span>
                                  <span className="font-mono text-slate-300">{options.watermarkX}{options.watermarkUnit}</span>
                                </div>
                                <input
                                  type="number"
                                  value={options.watermarkX}
                                  onChange={(e) => setOptions({ ...options, watermarkX: parseFloat(e.target.value) || 0 })}
                                  className="w-full bg-slate-950 border border-slate-700 rounded p-1 text-slate-200 text-xs font-mono"
                                />
                              </div>
                              <div>
                                <div className="flex justify-between text-slate-400 mb-0.5 text-[11px]">
                                  <span>Y (Top)</span>
                                  <span className="font-mono text-slate-300">{options.watermarkY}{options.watermarkUnit}</span>
                                </div>
                                <input
                                  type="number"
                                  value={options.watermarkY}
                                  onChange={(e) => setOptions({ ...options, watermarkY: parseFloat(e.target.value) || 0 })}
                                  className="w-full bg-slate-950 border border-slate-700 rounded p-1 text-slate-200 text-xs font-mono"
                                />
                              </div>
                            </div>

                            {/* Quick Position Presets */}
                            <div>
                              <span className="text-[10px] text-slate-400 block mb-1">Corner Presets:</span>
                              <div className="grid grid-cols-4 gap-1 text-[9px]">
                                <button
                                  type="button"
                                  onClick={() => setOptions({ ...options, watermarkX: 20, watermarkY: 20, watermarkUnit: 'px', watermarkRotation: 0 })}
                                  className="px-1 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-center"
                                >
                                  Top-Left
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setOptions({ ...options, watermarkX: 80, watermarkY: 5, watermarkUnit: '%', watermarkRotation: 0 })}
                                  className="px-1 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-center"
                                >
                                  Top-Right
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setOptions({ ...options, watermarkX: 10, watermarkY: 85, watermarkUnit: '%', watermarkRotation: 0 })}
                                  className="px-1 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-center"
                                >
                                  Bot-Left
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setOptions({ ...options, watermarkX: 75, watermarkY: 85, watermarkUnit: '%', watermarkRotation: -15 })}
                                  className="px-1 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-center"
                                >
                                  Bot-Right
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Z-Index Layering (Front vs Back) */}
                        <div className="pt-2 border-t border-slate-800/80">
                          <label className="text-slate-400 block mb-1">Layer Ordering (Z-Index)</label>
                          <div className="grid grid-cols-2 gap-1.5 bg-slate-900 p-0.5 rounded border border-slate-800 text-[11px]">
                            <button
                              type="button"
                              onClick={() => setOptions({ ...options, watermarkZIndex: 'front' })}
                              className={`py-1 rounded text-center transition ${
                                options.watermarkZIndex === 'front'
                                  ? 'bg-rose-600 text-white font-medium'
                                  : 'text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              Front (Overlay on Content)
                            </button>
                            <button
                              type="button"
                              onClick={() => setOptions({ ...options, watermarkZIndex: 'back' })}
                              className={`py-1 rounded text-center transition ${
                                options.watermarkZIndex === 'back'
                                  ? 'bg-rose-600 text-white font-medium'
                                  : 'text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              Back (Underlay behind Content)
                            </button>
                          </div>
                          <span className="text-[10px] text-slate-500 mt-1 block">
                            {options.watermarkZIndex === 'front'
                              ? 'Watermark renders on top of text, tables, and images with transparency.'
                              : 'Watermark renders as a subtle background under document text.'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Section 5: Document Metadata & SEO */}
            <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-900/40">
              <button
                type="button"
                onClick={() => setOpenSection(openSection === 'metadata' ? null : 'metadata')}
                className="w-full px-3 py-2 text-xs font-medium text-slate-200 flex items-center justify-between hover:bg-slate-800/50"
              >
                <span className="flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-teal-400" />
                  <span>Document Metadata & SEO</span>
                  {options.enableMetadata && (
                    <span className="px-1 py-0.2 bg-teal-500/20 text-teal-400 rounded text-[9px] font-semibold border border-teal-500/30">
                      ON
                    </span>
                  )}
                </span>
                {openSection === 'metadata' ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>

              {openSection === 'metadata' && (
                <div className="p-3 border-t border-slate-800 space-y-3 bg-slate-950/30 text-xs">
                  {/* Master Toggle */}
                  <div className="flex items-center justify-between p-2 bg-slate-900/80 border border-slate-800 rounded">
                    <div>
                      <span className="font-medium text-slate-200 block">Embed PDF Metadata</span>
                      <span className="text-[10px] text-slate-400">Sets Title, Author, Subject & Keywords into PDF binary</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={options.enableMetadata}
                        onChange={(e) => setOptions({ ...options, enableMetadata: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-8 h-4 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-teal-600"></div>
                    </label>
                  </div>

                  {options.enableMetadata && (
                    <div className="space-y-2.5">
                      {/* Auto-detect button */}
                      <button
                        type="button"
                        onClick={autoDetectMetadataFromHtml}
                        className="w-full py-1.5 px-2 bg-teal-950/60 hover:bg-teal-900/60 text-teal-300 border border-teal-800/60 rounded flex items-center justify-center gap-1.5 text-[11px] transition"
                      >
                        <Search className="w-3 h-3" />
                        <span>Auto-Detect from HTML &lt;title&gt; and &lt;meta&gt;</span>
                      </button>

                      {/* Title */}
                      <div>
                        <label className="text-slate-400 block mb-1">Document Title (PDF Title)</label>
                        <input
                          type="text"
                          value={options.metaTitle}
                          onChange={(e) => setOptions({ ...options, metaTitle: e.target.value })}
                          placeholder="e.g., Annual Financial Report 2026"
                          className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-slate-200 text-xs"
                        />
                      </div>

                      {/* Author */}
                      <div>
                        <label className="text-slate-400 block mb-1">Author / Organization (PDF Author)</label>
                        <input
                          type="text"
                          value={options.metaAuthor}
                          onChange={(e) => setOptions({ ...options, metaAuthor: e.target.value })}
                          placeholder="e.g., Acme Corp / Jane Doe"
                          className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-slate-200 text-xs"
                        />
                      </div>

                      {/* Subject */}
                      <div>
                        <label className="text-slate-400 block mb-1">Subject / Description (PDF Subject)</label>
                        <input
                          type="text"
                          value={options.metaSubject}
                          onChange={(e) => setOptions({ ...options, metaSubject: e.target.value })}
                          placeholder="e.g., Comprehensive quarterly financial report & analytics"
                          className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-slate-200 text-xs"
                        />
                      </div>

                      {/* Keywords */}
                      <div>
                        <label className="text-slate-400 block mb-1">Keywords / Tags (Comma-separated)</label>
                        <input
                          type="text"
                          value={options.metaKeywords}
                          onChange={(e) => setOptions({ ...options, metaKeywords: e.target.value })}
                          placeholder="e.g., report, finance, quarterly, audit"
                          className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-slate-200 text-xs"
                        />
                        {/* Quick Presets */}
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {['Report', 'Invoice', 'Documentation', 'Executive', 'Confidential', 'Audit'].map((kw) => (
                            <button
                              key={kw}
                              type="button"
                              onClick={() => {
                                const current = options.metaKeywords
                                  .split(',')
                                  .map((k) => k.trim())
                                  .filter(Boolean);
                                if (!current.includes(kw.toLowerCase())) {
                                  const updated = [...current, kw.toLowerCase()].join(', ');
                                  setOptions({ ...options, metaKeywords: updated });
                                }
                              }}
                              className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] transition"
                            >
                              + {kw}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="p-2 bg-slate-900/60 rounded border border-slate-800/80 text-[10px] text-slate-400 leading-relaxed">
                        <strong className="text-slate-300">SEO & Indexing Note:</strong> Embedded metadata is written directly into the PDF Info dictionary (Title, Author, Subject, Keywords, Creator) as well as the HTML head, allowing spotlight search, document management systems, and web crawlers to categorize your PDF accurately.
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Section 6: Table of Contents (TOC) Generator */}
            <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-900/40">
              <button
                type="button"
                onClick={() => setOpenSection(openSection === 'toc' ? null : 'toc')}
                className="w-full px-3 py-2 text-xs font-medium text-slate-200 flex items-center justify-between hover:bg-slate-800/50"
              >
                <span className="flex items-center gap-1.5">
                  <ListTree className="w-3.5 h-3.5 text-blue-400" />
                  <span>Table of Contents (TOC)</span>
                  {options.enableToc && (
                    <span className="px-1 py-0.2 bg-blue-500/20 text-blue-400 rounded text-[9px] font-semibold border border-blue-500/30">
                      ON (H1-H{options.tocMaxLevel})
                    </span>
                  )}
                </span>
                {openSection === 'toc' ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>

              {openSection === 'toc' && (
                <div className="p-3 border-t border-slate-800 space-y-3 bg-slate-950/30 text-xs">
                  {/* Master Toggle */}
                  <div className="flex items-center justify-between p-2 bg-slate-900/80 border border-slate-800 rounded">
                    <div>
                      <span className="font-medium text-slate-200 block">Generate Table of Contents</span>
                      <span className="text-[10px] text-slate-400">
                        Automatically scans &lt;h1&gt;-&lt;h3&gt; tags and prepends a formatted index page
                      </span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={options.enableToc}
                        onChange={(e) => setOptions({ ...options, enableToc: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-8 h-4 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  {options.enableToc && (
                    <div className="space-y-3 pt-1">
                      {/* TOC Title */}
                      <div>
                        <label className="text-slate-400 block mb-1">TOC Page Title</label>
                        <input
                          type="text"
                          value={options.tocTitle}
                          onChange={(e) => setOptions({ ...options, tocTitle: e.target.value })}
                          placeholder="Table of Contents"
                          className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-slate-200 text-xs"
                        />
                      </div>

                      {/* Heading Depth Level */}
                      <div>
                        <label className="text-slate-400 block mb-1">Include Heading Levels</label>
                        <div className="grid grid-cols-3 gap-1.5 bg-slate-900 p-1 rounded border border-slate-800">
                          <button
                            type="button"
                            onClick={() => setOptions({ ...options, tocMaxLevel: 1 })}
                            className={`py-1 px-2 rounded text-center transition text-[11px] font-medium ${
                              options.tocMaxLevel === 1 ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            H1 Only
                          </button>
                          <button
                            type="button"
                            onClick={() => setOptions({ ...options, tocMaxLevel: 2 })}
                            className={`py-1 px-2 rounded text-center transition text-[11px] font-medium ${
                              options.tocMaxLevel === 2 ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            H1 &amp; H2
                          </button>
                          <button
                            type="button"
                            onClick={() => setOptions({ ...options, tocMaxLevel: 3 })}
                            className={`py-1 px-2 rounded text-center transition text-[11px] font-medium ${
                              options.tocMaxLevel === 3 ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            H1, H2, H3
                          </button>
                        </div>
                      </div>

                      {/* Feature overview card */}
                      <div className="p-2.5 bg-blue-950/30 border border-blue-900/40 rounded-lg space-y-1.5 text-[11px] text-slate-300">
                        <div className="flex items-center gap-1.5 font-semibold text-blue-300">
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>TOC Features &amp; Page Calculation</span>
                        </div>
                        <ul className="list-disc list-inside space-y-1 text-slate-400 text-[10px] leading-relaxed">
                          <li>Detects heading hierarchy, indentation, and dot-leader alignment.</li>
                          <li>Automatically computes page numbers using print layout geometry and page-breaks.</li>
                          <li>Clickable intra-document links navigate directly to each section in PDF viewers.</li>
                          <li>Adds clean page breaks after the TOC so chapter 1 begins on a fresh page.</li>
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Section 7: Custom CSS & AI Optimizer */}
            <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-900/40">
              <button
                onClick={() => setOpenSection(openSection === 'css' ? null : 'css')}
                className="w-full px-3 py-2 text-xs font-medium text-slate-200 flex items-center justify-between hover:bg-slate-800/50"
              >
                <span className="flex items-center gap-1.5">
                  <span>Custom CSS & Print Rules</span>
                  {options.customCss && <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
                </span>
                {openSection === 'css' ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
              {openSection === 'css' && (
                <div className="p-3 border-t border-slate-800 space-y-2.5 bg-slate-950/30 text-xs">
                  {/* AI Optimize button */}
                  <div className="p-2.5 bg-gradient-to-r from-blue-950/60 to-indigo-950/60 border border-blue-800/50 rounded-lg">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-semibold text-blue-200 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                        Gemini Print Optimizer
                      </span>
                      <button
                        type="button"
                        disabled={isOptimizingAi}
                        onClick={handleAiOptimize}
                        className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded font-medium text-[11px] flex items-center gap-1 transition"
                      >
                        {isOptimizingAi ? (
                          <>
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            Analyzing...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3 h-3" />
                            Auto-Fix Print CSS
                          </>
                        )}
                      </button>
                    </div>
                    <p className="text-[10px] text-blue-300/80">
                      Analyzes your DOM to eliminate awkward page splits, repeat multi-page table headers, and hide screen-only headers.
                    </p>

                    {aiSuggestions && (
                      <div className="mt-2 p-2 bg-slate-900/90 rounded border border-blue-500/30 text-[11px]">
                        <div className="font-medium text-emerald-400 mb-1">{aiSuggestions.summary}</div>
                        <ul className="list-disc pl-4 space-y-0.5 text-slate-300 text-[10px]">
                          {aiSuggestions.explanations.map((item, idx) => (
                            <li key={idx}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Quick rule injection presets */}
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setOptions((o) => ({
                          ...o,
                          customCss:
                            o.customCss +
                            '\ntable, tr, td { page-break-inside: avoid !important; break-inside: avoid !important; }',
                        }))
                      }
                      className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px]"
                    >
                      + Avoid Table Break
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setOptions((o) => ({
                          ...o,
                          customCss:
                            o.customCss +
                            '\nnav, header.navbar, .sidebar, button { display: none !important; }',
                        }))
                      }
                      className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px]"
                    >
                      + Hide Navbars
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setOptions((o) => ({
                          ...o,
                          customCss:
                            o.customCss +
                            '\nh1, .new-page { page-break-before: always !important; break-before: page !important; }',
                        }))
                      }
                      className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px]"
                    >
                      + Section Page Breaks
                    </button>
                  </div>

                  <textarea
                    rows={4}
                    value={options.customCss}
                    onChange={(e) => setOptions({ ...options, customCss: e.target.value })}
                    placeholder="/* Custom CSS injected before print / PDF */&#10;@page { margin: 15mm; }"
                    className="w-full font-mono text-[11px] bg-slate-900 border border-slate-700 rounded p-2 text-slate-200 resize-none"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Primary Action Buttons Bar */}
          <div className="p-3 border-t border-slate-800 bg-slate-900/90 space-y-2 shrink-0">
            {/* Active Settings Governance Indicator */}
            <div className="px-2.5 py-1.5 rounded bg-slate-950/70 border border-slate-800 text-[11px] flex items-center justify-between text-slate-400">
              <span className="flex items-center gap-1.5">
                <Sliders className="w-3 h-3 text-blue-400" />
                <span>Media: <strong className="text-slate-200 uppercase font-mono text-[10px]">{options.media}</strong></span>
              </span>
              <span className="text-slate-600">•</span>
              <span className="truncate">
                Size Authority: <strong className="text-indigo-300 font-medium">{options.pageSizeAuthority === 'css' ? 'CSS @page' : `UI (${options.pageSize})`}</strong>
              </span>
            </div>

            {errorMsg && (
              <div className="p-2.5 bg-rose-950/70 border border-rose-800 rounded-lg text-xs text-rose-200 space-y-1.5">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span className="flex-1 font-medium">{errorMsg}</span>
                </div>
                {Object.keys(fieldErrors).length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1 pl-6">
                    {Object.entries(fieldErrors).map(([field, msg]) => (
                      <button
                        key={field}
                        type="button"
                        onClick={() => focusSectionForError(field)}
                        className="px-2 py-0.5 rounded bg-rose-900/60 hover:bg-rose-800 text-rose-200 text-[10px] font-mono border border-rose-700/60 transition"
                        title="Click to navigate to field"
                      >
                        {field}: {msg}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              {isBatchMode && batchQueue.length > 0 ? (
                <>
                  <button
                    type="button"
                    disabled={isBatchRunning || isConverting}
                    onClick={() => runBatchQueue('convert')}
                    className="py-2.5 px-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg font-semibold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/20 transition"
                  >
                    {isBatchRunning ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                    <span>{isBatchRunning ? `Processing ${batchProgress.current}/${batchProgress.total}` : `Batch Convert (${batchQueue.length})`}</span>
                  </button>

                  <button
                    type="button"
                    disabled={isBatchRunning || isConverting}
                    onClick={() => runBatchQueue('print')}
                    className="py-2.5 px-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg font-semibold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-purple-600/20 transition"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Batch Print ({batchQueue.length})</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={isConverting}
                    onClick={() => executeConversion('convert')}
                    className="py-2.5 px-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg font-semibold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/20 transition"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Convert to PDF</span>
                  </button>

                  <button
                    type="button"
                    disabled={isConverting}
                    onClick={() => executeConversion('print')}
                    className="py-2.5 px-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg font-semibold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/20 transition"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print to PDF</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Live Viewport, Print Preview & PDF Viewer */}
        <div className="flex-1 flex flex-col bg-slate-950 overflow-hidden">
          {/* Viewport Control Bar */}
          <div className="h-11 border-b border-slate-800 bg-slate-900/60 px-4 flex items-center justify-between shrink-0">
            {/* View Mode Tabs */}
            <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800">
              <button
                onClick={() => setPreviewTab('screen')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition ${
                  previewTab === 'screen'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Monitor className="w-3.5 h-3.5" />
                <span>Live Browser View</span>
              </button>

              <button
                onClick={() => setPreviewTab('print')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition ${
                  previewTab === 'print'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Preview</span>
              </button>

              <button
                onClick={() => setPreviewTab('pdf')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition ${
                  previewTab === 'pdf'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Generated PDF {lastResult ? `(${lastResult.pages}p)` : ''}</span>
              </button>
            </div>

            <span className="text-[11px] text-sky-300 font-mono" title="Trusted local automation is an operator-only stdio setting">Profile: {activeRenderProfile === 'public-web' ? 'Public web' : activeRenderProfile === 'trusted-local' ? 'Trusted local automation' : 'Local bundle'}</span>
            {/* Viewport Size & Zoom Controls */}
            {previewTab !== 'pdf' && (
              <div className="flex items-center gap-3">
                {/* Device widths */}
                <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800">
                  <button
                    onClick={() => setPreviewWidth('100%')}
                    title="Responsive (100%)"
                    className={`p-1 rounded ${previewWidth === '100%' ? 'bg-slate-800 text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    <Monitor className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setPreviewWidth('1440px')}
                    title="Desktop 1440px"
                    className={`px-1.5 py-0.5 text-[10px] rounded font-mono ${previewWidth === '1440px' ? 'bg-slate-800 text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    1440
                  </button>
                  <button
                    onClick={() => setPreviewWidth('768px')}
                    title="Tablet 768px"
                    className={`p-1 rounded ${previewWidth === '768px' ? 'bg-slate-800 text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    <Tablet className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setPreviewWidth('375px')}
                    title="Mobile 375px"
                    className={`p-1 rounded ${previewWidth === '375px' ? 'bg-slate-800 text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Zoom control */}
                <div className="flex items-center gap-1 text-xs text-slate-400">
                  <button
                    onClick={() => setPreviewZoom((z) => Math.max(50, z - 25))}
                    className="p-1 hover:text-slate-200"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="font-mono text-[11px] w-9 text-center">{previewZoom}%</span>
                  <button
                    onClick={() => setPreviewZoom((z) => Math.min(175, z + 25))}
                    className="p-1 hover:text-slate-200"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Refresh */}
                <button
                  onClick={() => setPreviewKey((k) => k + 1)}
                  title="Reload frame"
                  className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {previewTab === 'pdf' && lastResult && (
              <div className="flex items-center gap-2">
                <a
                  href={lastResult.downloadUrl}
                  download={lastResult.fileName}
                  className="flex items-center gap-1.5 px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-md shadow transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PDF</span>
                </a>
                <a
                  href={`/api/output/${lastResult.fileName}`}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded"
                  title="Open in new window"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            )}
          </div>

          {blockedResources.length > 0 && (
            <div role="status" className="bg-amber-950/60 border-b border-amber-800 px-4 py-2 text-xs text-amber-100 max-h-28 overflow-auto">
              <strong>{blockedResources.length} blocked resource(s):</strong> {blockedResources.map((item, index) => (
                <div key={index} className="break-all">{item.url}: {item.reason}</div>
              ))}
            </div>
          )}
          {/* Viewport Content Area */}
          <div className="flex-1 bg-slate-950 p-4 overflow-auto flex items-center justify-center relative">
            {/* Live Screen Preview */}
            {previewTab === 'screen' && (
              <div
                style={{
                  width: previewWidth,
                  maxWidth: '100%',
                  height: '100%',
                  transform: `scale(${previewZoom / 100})`,
                  transformOrigin: 'top center',
                  transition: 'width 0.2s ease, transform 0.15s ease',
                }}
                className="bg-white rounded-lg shadow-2xl border border-slate-800 overflow-hidden flex flex-col relative"
              >
                {inputMode === 'upload' && uploadedFile ? (
                  <iframe
                    key={`upload-screen-${previewKey}`}
                    src={getIframeSrc() || 'about:blank'}
                    className="w-full h-full border-0"
                    title="Live Upload Preview"
                    sandbox=""
                  />
                ) : inputMode === 'url' ? (
                  <iframe
                    key={`url-screen-${previewKey}`}
                    src={urlInput}
                    className="w-full h-full border-0"
                    title="Live URL Preview"
                    sandbox="allow-scripts"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <iframe
                    key={`code-screen-${previewKey}`}
                    srcDoc={rawPreviewHtml}
                    className="w-full h-full border-0"
                    title="Raw HTML Preview"
                    sandbox=""
                  />
                )}
                {renderWatermarkOverlay()}
              </div>
            )}

            {/* Print Preview (Emulates @media print sheet) */}
            {previewTab === 'print' && (
              <div
                style={{
                  transform: `scale(${previewZoom / 100})`,
                  transformOrigin: 'top center',
                  transition: 'transform 0.15s ease',
                }}
                className="flex flex-col items-center py-6 w-full h-full overflow-y-auto"
              >
                <div className="text-center mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400 bg-indigo-950/80 px-3 py-1 rounded-full border border-indigo-800/60">
                    Print Media Simulation ({options.pageSize} {options.orientation})
                  </span>
                </div>

                {/* Simulated Paper Sheet */}
                <div
                  style={{
                    width: options.orientation === 'landscape' ? '297mm' : '210mm',
                    minHeight: options.orientation === 'landscape' ? '210mm' : '297mm',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
                  }}
                  className="bg-white text-slate-900 rounded-sm border border-slate-700 overflow-hidden relative"
                >
                  {/* Print emulation iframe */}
                  <iframe
                    key={`print-sim-${previewKey}`}
                    src={inputMode === 'upload' ? getIframeSrc() || undefined : inputMode === 'url' ? urlInput : undefined}
                    srcDoc={inputMode === 'code' ? rawPreviewHtml : undefined}
                    sandbox={inputMode === 'url' ? 'allow-scripts' : ''}
                    referrerPolicy="no-referrer"
                    className="w-full h-full min-h-[900px] border-0"
                    title="Print Media Emulation"
                  />
                  {renderWatermarkOverlay()}
                </div>
              </div>
            )}

            {/* Generated PDF Embedded Viewer */}
            {previewTab === 'pdf' && (
              <div className="w-full h-full flex flex-col items-center justify-center">
                {lastResult ? (
                  <div className="w-full h-full flex flex-col bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-2xl">
                    <div className="bg-slate-900 px-4 py-2 border-b border-slate-800 flex items-center justify-between text-xs text-slate-300">
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-white">{lastResult.fileName}</span>
                        <span className="bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded font-mono">
                          {lastResult.pages} {lastResult.pages === 1 ? 'page' : 'pages'}
                        </span>
                        <span className="text-slate-400">
                          {(lastResult.fileSize / 1024).toFixed(1)} KB
                        </span>
                        <span className="text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-500" />
                          {lastResult.durationMs}ms
                        </span>
                        {lastResult.metadata?.title && (
                          <span className="hidden lg:inline-flex items-center gap-1 px-2 py-0.5 bg-teal-500/10 text-teal-300 border border-teal-500/20 rounded font-medium text-[11px]" title={`Subject: ${lastResult.metadata.subject || 'None'}\nKeywords: ${lastResult.metadata.keywords || 'None'}`}>
                            <Tag className="w-3 h-3 text-teal-400" />
                            <span className="max-w-[140px] truncate">{lastResult.metadata.title}</span>
                            {lastResult.metadata.author && <span className="text-teal-500 font-normal">by {lastResult.metadata.author}</span>}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {lastResult.metadata?.keywords && (
                          <div className="hidden xl:flex items-center gap-1">
                            {lastResult.metadata.keywords.split(',').slice(0, 3).map((kw, i) => (
                              <span key={i} className="px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded text-[10px]">
                                #{kw.trim()}
                              </span>
                            ))}
                          </div>
                        )}
                        <button
                          onClick={() => copyToClipboard(lastResult.pdfPath, 'path')}
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded flex items-center gap-1 text-[11px]"
                        >
                          {copiedText === 'path' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedText === 'path' ? 'Copied Path!' : 'Copy Local Path'}</span>
                        </button>
                      </div>
                    </div>

                    <iframe
                      src={`/api/output/${lastResult.fileName}`}
                      className="w-full flex-1 border-0 bg-slate-900"
                      title="Generated PDF Viewer"
                    />
                  </div>
                ) : (
                  <div className="text-center p-8 max-w-sm">
                    <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-3 text-slate-400">
                      <FileText className="w-6 h-6" />
                    </div>
                    <h3 className="text-sm font-semibold text-slate-200">No PDF Generated Yet</h3>
                    <p className="text-xs text-slate-400 mt-1 mb-4">
                      Configure your document settings on the left and click "Convert to PDF" or "Print to PDF".
                    </p>
                    <button
                      onClick={() => executeConversion('convert')}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow"
                    >
                      Convert Now
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Progress Overlay Modal ─────────────────────────────────── */}
      {isConverting && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center mx-auto shadow-lg shadow-blue-500/30">
              <RefreshCw className="w-7 h-7 text-white animate-spin" />
            </div>

            <div>
              <h3 className="text-base font-bold text-white">Rendering High-Fidelity PDF</h3>
              <p className="text-xs text-slate-400 mt-1">Playwright Chromium Headless Engine</p>
            </div>

            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs font-mono text-blue-300">
              {convertStep || 'Processing document layout...'}
            </div>

            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full w-2/3 animate-pulse" />
            </div>
          </div>
        </div>
      )}

      {/* ── Output History Drawer ─────────────────────────────────── */}
      {showHistoryDrawer && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-40 flex justify-end">
          <div className="w-96 bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-bold text-white">Generated PDFs</h3>
              </div>
              <button
                onClick={() => setShowHistoryDrawer(false)}
                className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {historyList.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">
                  No generated PDFs in ./output/ yet.
                </div>
              ) : (
                historyList.map((item) => (
                  <div
                    key={item.fileName}
                    className="p-3 bg-slate-950 rounded-lg border border-slate-800 hover:border-slate-700 transition"
                  >
                    <div className="flex items-start justify-between">
                      <div className="overflow-hidden">
                        <div className="text-xs font-semibold text-slate-200 truncate">{item.fileName}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {item.fileSizeFormatted} • {new Date(item.createdAt).toLocaleTimeString()}
                        </div>
                      </div>
                      <a
                        href={item.downloadUrl}
                        download={item.fileName}
                        className="p-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded transition shrink-0 ml-2"
                        title="Download"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MCP Server Config Modal ───────────────────────────────── */}
      {showMcpModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-2xl w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-600/30 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                  <Terminal className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Model Context Protocol (MCP) Setup</h3>
                  <p className="text-xs text-slate-400">Connect Claude Desktop, Cursor, or Gemini to HTML2PDF Studio</p>
                </div>
              </div>
              <button
                onClick={() => setShowMcpModal(false)}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick config tabs */}
            <div className="space-y-3 text-xs">
              <div>
                <span className="font-semibold text-slate-200 block mb-1">
                  1. Claude Desktop Configuration (claude_desktop_config.json):
                </span>
                <p className="text-slate-400 mb-2">
                  Add this block to your <code className="text-indigo-300">claude_desktop_config.json</code> under <code className="text-indigo-300">mcpServers</code>:
                </p>
                <div className="relative">
                  <pre className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-[11px] text-slate-300 overflow-x-auto">
{`{
  "mcpServers": {
    "html2pdf-studio": {
      "command": "npx",
      "args": [
        "-y",
        "tsx",
        "${window.location.origin ? '/app/applet/bin/mcp-stdio.ts' : 'bin/mcp-stdio.ts'}"
      ]
    }
  }
}`}
                  </pre>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        JSON.stringify(
                          {
                            mcpServers: {
                              'html2pdf-studio': {
                                command: 'npx',
                                args: ['-y', 'tsx', 'bin/mcp-stdio.ts'],
                              },
                            },
                          },
                          null,
                          2
                        ),
                        'claude-json'
                      )
                    }
                    className="absolute top-2 right-2 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] flex items-center gap-1 border border-slate-700"
                  >
                    {copiedText === 'claude-json' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedText === 'claude-json' ? 'Copied!' : 'Copy JSON'}</span>
                  </button>
                </div>
              </div>

              <div>
                <span className="font-semibold text-slate-200 block mb-1">
                  2. Streamable HTTP / Web Endpoint:
                </span>
                <p className="text-slate-400 mb-2">
                  HTML2PDF Studio exposes an SSE streamable endpoint on <code className="text-indigo-300">/mcp</code> for web-based agents:
                </p>
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 font-mono text-[11px] text-indigo-300 flex items-center justify-between">
                  <span>http://localhost:3000/mcp</span>
                  <button
                    onClick={() => copyToClipboard('http://localhost:3000/mcp', 'mcp-url')}
                    className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
                  >
                    {copiedText === 'mcp-url' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>

              <div>
                <span className="font-semibold text-slate-200 block mb-1">
                  3. Available MCP Tools:
                </span>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                    <div className="font-bold text-blue-400">html_to_pdf</div>
                    <div className="text-slate-400 text-[10px] mt-0.5">
                      Converts HTML string, filePath, or URL into vector PDF.
                    </div>
                  </div>
                  <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                    <div className="font-bold text-indigo-400">print_to_pdf</div>
                    <div className="text-slate-400 text-[10px] mt-0.5">
                      Browser Print emulation honoring @media print and @page breaks.
                    </div>
                  </div>
                  <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                    <div className="font-bold text-emerald-400">preview_html</div>
                    <div className="text-slate-400 text-[10px] mt-0.5">
                      Captures 2x PNG screenshot + console errors for AI inspection.
                    </div>
                  </div>
                  <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                    <div className="font-bold text-amber-400">list_pdfs</div>
                    <div className="text-slate-400 text-[10px] mt-0.5">
                      Lists all generated PDF files with size, path, and timestamp.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setShowMcpModal(false)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
