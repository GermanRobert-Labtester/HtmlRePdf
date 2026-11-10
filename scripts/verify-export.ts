/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  normalizeExportSettings,
  validateAndNormalizeConvertRequest,
  validatePageRanges,
  parseDimensionToMm,
  getPageDimensionsMm,
  STANDARD_PAGE_SIZES_MM,
} from '../lib/export-settings.ts';
import { convert } from '../lib/converter.ts';
import { closeBrowser } from '../lib/browser.ts';
import { PDFDocument } from 'pdf-lib';
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';

async function runTests() {
  console.log('====================================================');
  console.log('🧪 Starting HTML2PDF Export Settings Verification');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, desc: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${desc}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${desc}`);
      failed++;
    }
  }

  // -------------------------------------------------------------------------
  // Test 1: Identical normalization between single and batch
  // -------------------------------------------------------------------------
  console.log('--- Test 1: Single & Batch Normalization Identicality ---');
  const commonOptions = {
    pageSize: 'A4',
    orientation: 'landscape',
    marginPreset: 'custom',
    marginTop: '15',
    marginBottom: '15',
    marginLeft: '20',
    marginRight: '20',
    scale: 0.95,
    media: 'print',
    pageSizeAuthority: 'ui',
    rasterMode: true, // Should be normalized to false with warning
    pageRanges: '1-2',
  };

  const singleReq = validateAndNormalizeConvertRequest({
    html: '<div>Single doc</div>',
    options: commonOptions,
  });

  const batchReq = validateAndNormalizeConvertRequest({
    url: 'http://localhost:3000/api/preview/batch-test/index.html',
    options: commonOptions,
  });

  assert(singleReq.isValid, 'Single request validates successfully');
  assert(batchReq.isValid, 'Batch request validates successfully');
  assert(
    JSON.stringify(singleReq.data?.options) === JSON.stringify(batchReq.data?.options),
    'Single and batch request options normalize to identical JSON representations'
  );
  assert(
    singleReq.data?.options.rasterMode === false,
    'rasterMode is normalized to false'
  );
  assert(
    singleReq.warnings.some((w) => w.includes('rasterMode')),
    'rasterMode warning is emitted when requested'
  );

  // -------------------------------------------------------------------------
  // Test 2: Source validation (exactly one source)
  // -------------------------------------------------------------------------
  console.log('\n--- Test 2: Source Validation (Exactly One Source) ---');
  const noSource = validateAndNormalizeConvertRequest({
    options: commonOptions,
  });
  assert(!noSource.isValid, 'Fails when no source (html/url/filePath) is provided');
  assert(Boolean(noSource.errors['source']), 'Returns field error for "source" when missing');

  const multipleSources = validateAndNormalizeConvertRequest({
    html: '<div>Hello</div>',
    url: 'https://example.com',
    options: commonOptions,
  });
  assert(!multipleSources.isValid, 'Fails when multiple sources (html + url) are provided');
  assert(Boolean(multipleSources.errors['source']), 'Returns field error for "source" when multiple provided');

  const invalidUrl = validateAndNormalizeConvertRequest({
    url: 'ftp://invalid-protocol.com',
    options: commonOptions,
  });
  assert(!invalidUrl.isValid, 'Fails on invalid URL protocol');
  assert(Boolean(invalidUrl.errors['url']), 'Returns field error for "url"');

  // -------------------------------------------------------------------------
  // Test 3: Finite dimensions & Custom page sizes
  // -------------------------------------------------------------------------
  console.log('\n--- Test 3: Finite Dimensions Validation ---');
  const zeroDim = validateAndNormalizeConvertRequest({
    html: '<p>test</p>',
    options: { pageSize: 'Custom', customWidth: '0', customHeight: '297' },
  });
  assert(!zeroDim.isValid, 'Fails when custom width is 0');
  assert(Boolean(zeroDim.errors['customWidth']), 'Reports field-specific error on customWidth');

  const negativeDim = validateAndNormalizeConvertRequest({
    html: '<p>test</p>',
    options: { pageSize: 'Custom', customWidth: '-50mm', customHeight: '297mm' },
  });
  assert(!negativeDim.isValid, 'Fails on negative custom dimension');
  assert(Boolean(negativeDim.errors['customWidth']), 'Reports field-specific error on negative customWidth');

  const nonNumericDim = validateAndNormalizeConvertRequest({
    html: '<p>test</p>',
    options: { pageSize: 'Custom', customWidth: 'wide', customHeight: 'tall' },
  });
  assert(!nonNumericDim.isValid, 'Fails on non-numeric custom dimension');
  assert(Boolean(nonNumericDim.errors['customWidth']) && Boolean(nonNumericDim.errors['customHeight']), 'Reports field errors for customWidth and customHeight');

  // -------------------------------------------------------------------------
  // Test 4: Usable margins check
  // -------------------------------------------------------------------------
  console.log('\n--- Test 4: Usable Margins Validation ---');
  // A4 portrait width is 210mm. Left 120mm + Right 100mm = 220mm > 210mm
  const excessiveMargins = validateAndNormalizeConvertRequest({
    html: '<p>test</p>',
    options: {
      pageSize: 'A4',
      orientation: 'portrait',
      marginPreset: 'custom',
      marginTop: '10',
      marginBottom: '10',
      marginLeft: '120',
      marginRight: '100',
    },
  });
  assert(!excessiveMargins.isValid, 'Fails when total horizontal margins exceed page width');
  assert(Boolean(excessiveMargins.errors['margins']), 'Reports field-specific error on "margins" for unusable space');

  const negativeMargin = validateAndNormalizeConvertRequest({
    html: '<p>test</p>',
    options: {
      marginPreset: 'custom',
      marginTop: '-5',
    },
  });
  assert(!negativeMargin.isValid, 'Fails when margin is negative');
  assert(Boolean(negativeMargin.errors['marginTop']), 'Reports field-specific error on "marginTop"');

  // -------------------------------------------------------------------------
  // Test 5: Scale factor validation
  // -------------------------------------------------------------------------
  console.log('\n--- Test 5: Scale Factor Validation ---');
  const scaleTooLow = validateAndNormalizeConvertRequest({
    html: '<p>test</p>',
    options: { scale: 0.05 },
  });
  assert(!scaleTooLow.isValid, 'Fails when scale < 0.1');
  assert(Boolean(scaleTooLow.errors['scale']), 'Reports field error for scale when too low');

  const scaleTooHigh = validateAndNormalizeConvertRequest({
    html: '<p>test</p>',
    options: { scale: 2.5 },
  });
  assert(!scaleTooHigh.isValid, 'Fails when scale > 2.0');
  assert(Boolean(scaleTooHigh.errors['scale']), 'Reports field error for scale when too high');

  const scaleValid = validateAndNormalizeConvertRequest({
    html: '<p>test</p>',
    options: { scale: 1.25 },
  });
  assert(scaleValid.isValid && scaleValid.data?.options.scale === 1.25, 'Valid scale 1.25 is preserved');

  // -------------------------------------------------------------------------
  // Test 6: Page Ranges validation
  // -------------------------------------------------------------------------
  console.log('\n--- Test 6: Page Ranges Syntax Validation ---');
  assert(validatePageRanges('1-5').isValid, 'Valid range "1-5" passes');
  assert(validatePageRanges('1, 3, 5').isValid, 'Valid list "1, 3, 5" passes');
  assert(validatePageRanges('2-').isValid, 'Valid open range "2-" passes');
  assert(validatePageRanges('-4').isValid, 'Valid open start "-4" passes');
  assert(!validatePageRanges('0').isValid, 'Invalid range "0" fails (pages must be >= 1)');
  assert(!validatePageRanges('5-2').isValid, 'Inverted range "5-2" fails (start > end)');
  assert(!validatePageRanges('abc').isValid, 'Non-numeric range "abc" fails');
  assert(!validatePageRanges('1,,3').isValid, 'Empty segment "1,,3" fails');

  // -------------------------------------------------------------------------
  // Test 7: Template length limits
  // -------------------------------------------------------------------------
  console.log('\n--- Test 7: Template Length Limits ---');
  const hugeTemplate = '<div>' + 'A'.repeat(20000) + '</div>';
  const templateTooLong = validateAndNormalizeConvertRequest({
    html: '<p>test</p>',
    options: { headerTemplate: hugeTemplate },
  });
  assert(!templateTooLong.isValid, 'Fails when headerTemplate exceeds 15,000 characters');
  assert(Boolean(templateTooLong.errors['headerTemplate']), 'Reports field-specific error for headerTemplate');

  // -------------------------------------------------------------------------
  // Test 8: Conflicting CSS @page size vs UI paper size
  // -------------------------------------------------------------------------
  console.log('\n--- Test 8: CSS @page Size Authority vs UI Paper Size ---');
  const demoHtmlPath = path.resolve(process.cwd(), 'public/samples/screen-print-demo.html');
  const demoHtml = await fs.readFile(demoHtmlPath, 'utf-8');

  // Case A: pageSizeAuthority: 'css' (CSS @page { size: 140mm 200mm } dictates output)
  console.log('Rendering with pageSizeAuthority: "css"...');
  const cssResult = await convert(
    { html: demoHtml },
    {
      pageSizeAuthority: 'css',
      pageSize: 'A4', // UI specifies A4, but CSS @page specifies 140mm x 200mm
    },
    'convert'
  );

  const cssPdfDoc = await PDFDocument.load(await fs.readFile(cssResult.pdfPath));
  const cssPage = cssPdfDoc.getPage(0);
  const { width: cssPtW, height: cssPtH } = cssPage.getSize();
  // 140mm in points = 140 * 72 / 25.4 = ~396.85 pt
  // 200mm in points = 200 * 72 / 25.4 = ~566.93 pt
  const cssExpectedW = (140 * 72) / 25.4;
  const cssExpectedH = (200 * 72) / 25.4;
  const obeysCssSize = Math.abs(cssPtW - cssExpectedW) < 2 && Math.abs(cssPtH - cssExpectedH) < 2;
  assert(
    obeysCssSize,
    `pageSizeAuthority: "css" produces CSS @page dimensions (140x200mm -> got ${cssPtW.toFixed(1)}x${cssPtH.toFixed(1)} pt, expected ~${cssExpectedW.toFixed(1)}x${cssExpectedH.toFixed(1)} pt)`
  );

  // Case B: pageSizeAuthority: 'ui' (UI Paper Size A4 overrides CSS @page)
  console.log('Rendering with pageSizeAuthority: "ui"...');
  const uiResult = await convert(
    { html: demoHtml },
    {
      pageSizeAuthority: 'ui',
      pageSize: 'A4', // A4 = 210mm x 297mm -> 595.28 pt x 841.89 pt
    },
    'convert'
  );

  const uiPdfDoc = await PDFDocument.load(await fs.readFile(uiResult.pdfPath));
  const uiPage = uiPdfDoc.getPage(0);
  const { width: uiPtW, height: uiPtH } = uiPage.getSize();
  const a4PtW = (210 * 72) / 25.4;
  const a4PtH = (297 * 72) / 25.4;
  const obeysUiSize = Math.abs(uiPtW - a4PtW) < 2 && Math.abs(uiPtH - a4PtH) < 2;
  assert(
    obeysUiSize,
    `pageSizeAuthority: "ui" enforces UI paper dimensions A4 (got ${uiPtW.toFixed(1)}x${uiPtH.toFixed(1)} pt, expected ~${a4PtW.toFixed(1)}x${a4PtH.toFixed(1)} pt)`
  );

  // -------------------------------------------------------------------------
  // Test 9: Screen vs Print Media layout differentiation
  // -------------------------------------------------------------------------
  console.log('\n--- Test 9: Screen vs Print Media Layout Differentiation ---');
  // In screen-print-demo.html:
  // - .screen-banner is visible on screen, hidden on @media print
  // - .print-banner is hidden on screen, visible on @media print
  console.log('Rendering screen media PDF...');
  const screenPdfResult = await convert(
    { html: demoHtml },
    {
      media: 'screen',
      pageSizeAuthority: 'ui',
      pageSize: 'A4',
    },
    'convert'
  );

  console.log('Rendering print media PDF...');
  const printPdfResult = await convert(
    { html: demoHtml },
    {
      media: 'print',
      pageSizeAuthority: 'ui',
      pageSize: 'A4',
    },
    'print'
  );

  const screenBytes = await fs.readFile(screenPdfResult.pdfPath);
  const printBytes = await fs.readFile(printPdfResult.pdfPath);

  // Extract decompressed content streams from PDFs to inspect media-specific vector elements
  function extractDecompressedStreams(buf: Buffer): string {
    let offset = 0;
    let allDecompressed = '';
    while (true) {
      const streamIdx = buf.indexOf(Buffer.from('stream\n'), offset);
      if (streamIdx === -1) break;
      const start = streamIdx + 7;
      const end = buf.indexOf(Buffer.from('\nendstream'), start);
      if (end === -1) break;
      const slice = buf.subarray(start, end);
      try {
        allDecompressed += zlib.inflateSync(slice).toString('utf-8') + '\n';
      } catch {
        // Not a flate stream, keep scanning
      }
      offset = end + 10;
    }
    return allDecompressed;
  }

  const screenStream = extractDecompressedStreams(screenBytes);
  const printStream = extractDecompressedStreams(printBytes);

  // In screen mode:
  // - Screen banner (.screen-banner: #eff6ff -> RGB .9372 .9647 1) is rendered
  // - Print banner (.print-banner: #f0fdf4 -> RGB .9412 .9922 .9569) is display: none
  const screenHasScreenBanner = screenStream.includes('.937') && !screenStream.includes('.9412 .9922');

  // In print mode:
  // - Print banner (.print-banner: #f0fdf4 -> RGB .9412 .9922 .9569) is rendered
  // - Screen banner (.screen-banner: #eff6ff -> RGB .9372 .9647 1) is display: none
  const printHasPrintBanner = printStream.includes('.9412 .9922') && !printStream.includes('.937');

  assert(screenHasScreenBanner, 'Screen-emulated PDF renders screen-only styles (.screen-banner) and suppresses print-only styles');
  assert(printHasPrintBanner, 'Print-emulated PDF renders print-only styles (.print-banner) and suppresses screen-only styles');
  assert(screenBytes.length > 10000 && printBytes.length > 10000, 'Both screen and print PDFs are valid non-empty files');

  console.log('\n====================================================');
  console.log(`Summary: ${passed} passed, ${failed} failed`);
  console.log('====================================================');

  await closeBrowser();

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(async (err) => {
  console.error('Fatal test error:', err);
  try {
    await closeBrowser();
  } catch {
    // ignore
  }
  process.exit(1);
});
