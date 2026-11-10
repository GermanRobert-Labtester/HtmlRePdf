/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from '@google/genai';

let aiInstance: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiInstance;
}

export interface OptimizeCssResult {
  css: string;
  explanations: string[];
  summary: string;
}

/**
 * High-quality fallback print optimization CSS when AI is unavailable or not configured.
 */
const DEFAULT_PRINT_OPTIMIZATION_CSS = `/* Standard HTML2PDF Studio Print Rules */
@media print {
  /* Prevent awkward splits inside crucial content blocks */
  table, tr, td, th, blockquote, pre, code, figure, .card, .widget, .chart {
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }

  /* Repeat table headers cleanly on every printed page */
  thead {
    display: table-header-group !important;
  }
  tfoot {
    display: table-footer-group !important;
  }

  /* Force clean page breaks before primary sections */
  h1, .page-break, .chapter, section.new-page {
    page-break-before: always !important;
    break-before: page !important;
  }

  /* Avoid orphan headers at page bottoms */
  h1, h2, h3, h4, h5, h6 {
    page-break-after: avoid !important;
    break-after: avoid !important;
  }

  /* Hide screen-only interactive navigation and floating widgets */
  nav, header.nav, .navbar, .sidebar, .menu, footer.site-footer,
  .cookie-banner, .toast, .modal-backdrop, button:not(.print-keep),
  input[type="submit"], input[type="button"], .no-print {
    display: none !important;
  }

  /* Crisp color and ink-friendly contrast */
  body {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    background: #ffffff !important;
    color: #111827 !important;
  }

  /* Clean hyperlink formatting */
  a {
    color: inherit !important;
    text-decoration: underline !important;
  }
}`;

/**
 * Analyzes an HTML document and generates custom CSS for print-perfection using Gemini.
 */
export async function optimizePrintCss(htmlContent: string): Promise<OptimizeCssResult> {
  const ai = getAiClient();

  if (!ai) {
    return {
      css: DEFAULT_PRINT_OPTIMIZATION_CSS,
      explanations: [
        'Applied standard anti-orphan rules for headings (h1-h6).',
        'Enabled automatic table header repetition across multi-page tables (thead display: table-header-group).',
        'Prevented break-inside on tables, cards, blockquotes, and figures.',
        'Automatically hid screen-only navigation bars, buttons, and footers.',
      ],
      summary: 'Used standard print-perfection template (configure GEMINI_API_KEY for custom AI analysis).',
    };
  }

  try {
    // Truncate safely to first 25,000 chars of HTML to analyze structure without overwhelming tokens
    const sampleHtml = htmlContent.length > 25000 ? htmlContent.slice(0, 25000) + '\n<!-- [truncated for analysis] -->' : htmlContent;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `You are an expert CSS Print & Typography engineer.
Analyze the following HTML document and write tailor-made CSS rules to make it look pixel-perfect when converted to PDF or printed.

Consider:
1. Identifying elements that should not split across page breaks (e.g. cards, invoice rows, signature blocks, diagrams).
2. Elements that should trigger a new page (e.g. major headers or section dividers).
3. Repeating table headers on every page for multi-page tables.
4. Screen-only UI to hide (navbars, sticky headers, back buttons, sidebars).
5. Contrast, typography, margins, and dark mode handling for ink-friendly printing.

HTML Sample:
\`\`\`html
${sampleHtml}
\`\`\``,
      config: {
        systemInstruction: 'Return valid JSON with "css" (plain CSS string), "explanations" (array of brief bullet points explaining key fixes), and "summary" (one sentence description).',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            css: { type: Type.STRING, description: 'CSS rules to inject' },
            explanations: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Explanations of improvements',
            },
            summary: { type: Type.STRING, description: 'Brief summary' },
          },
          required: ['css', 'explanations', 'summary'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    if (parsed.css) {
      return {
        css: parsed.css,
        explanations: parsed.explanations || [],
        summary: parsed.summary || 'AI print optimization generated successfully.',
      };
    }
  } catch (err) {
    console.warn('[Gemini] Print CSS optimization error, using default print rules:', err);
  }

  return {
    css: DEFAULT_PRINT_OPTIMIZATION_CSS,
    explanations: [
      'Fallback standard anti-orphan rules applied.',
      'Table headers repeated across page boundaries.',
      'Hidden navigation, sticky bars, and buttons.',
    ],
    summary: 'Standard print optimization rules applied.',
  };
}
