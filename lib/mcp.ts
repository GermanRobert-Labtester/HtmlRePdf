/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  CallToolResult,
} from '@modelcontextprotocol/sdk/types.js';
import type { Request, Response } from 'express';
import { convert, previewHtml, listGeneratedPdfs, ConvertOptions } from './converter.ts';
import {
  validateAndNormalizeConvertRequest,
  validateExportSource,
  formatValidationErrorsSummary,
} from './export-settings.ts';

/**
 * Creates an instance of the MCP Server configured with all HTML2PDF Studio tools.
 */
export function createMcpServer(trustedStdio = false): Server {
  const server = new Server(
    {
      name: 'html2pdf-studio',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // 1. Tool Listing
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'html_to_pdf',
          description:
            'Convert an HTML string, local HTML file path, or web URL into a high-fidelity vector PDF. Returns absolute PDF path and page count.',
          inputSchema: {
            type: 'object',
            properties: {
              html: {
                type: 'string',
                description: 'Raw HTML string content to convert into PDF.',
              },
              filePath: {
                type: 'string',
                description: 'Absolute or relative path to a local .html file.',
              },
              url: {
                type: 'string',
                description: 'Full HTTP/HTTPS URL of a webpage to render and convert.',
              },
              pageSize: {
                type: 'string',
                enum: ['A4', 'A3', 'A5', 'Letter', 'Legal', 'Tabloid', 'Executive', 'Custom'],
                default: 'A4',
                description: 'Standard page size or "Custom".',
              },
              customWidth: {
                type: 'string',
                description: 'Custom width if pageSize is Custom (e.g. "210mm", "8.5in").',
              },
              customHeight: {
                type: 'string',
                description: 'Custom height if pageSize is Custom (e.g. "297mm", "11in").',
              },
              pageSizeAuthority: {
                type: 'string',
                enum: ['css', 'ui'],
                default: 'css',
                description: 'Page size authority: "css" gives @page rules in CSS authority; "ui" enforces the specified paper size.',
              },
              media: {
                type: 'string',
                enum: ['screen', 'print'],
                default: 'screen',
                description: 'CSS media emulation type ("screen" or "print").',
              },
              orientation: {
                type: 'string',
                enum: ['portrait', 'landscape'],
                default: 'portrait',
                description: 'Page orientation.',
              },
              margins: {
                type: 'object',
                properties: {
                  top: { type: 'string', default: '10mm' },
                  bottom: { type: 'string', default: '10mm' },
                  left: { type: 'string', default: '10mm' },
                  right: { type: 'string', default: '10mm' },
                },
                description: 'Page margins in mm or inches (e.g. "10mm", "0.5in").',
              },
              scale: {
                type: 'number',
                minimum: 0.1,
                maximum: 2.0,
                default: 1.0,
                description: 'Render scale factor (0.1 to 2.0).',
              },
              background: {
                type: 'boolean',
                default: true,
                description: 'Print background graphics and colors.',
              },
              headerTemplate: {
                type: 'string',
                description: 'HTML template for page headers. Supports standard Chromium classes like "pageNumber", "totalPages".',
              },
              footerTemplate: {
                type: 'string',
                description: 'HTML template for page footers. Supports standard Chromium classes like "pageNumber", "totalPages".',
              },
              pageRanges: {
                type: 'string',
                description: 'Paper ranges to print, e.g. "1-5", "1, 3, 5". Default is all.',
              },
              css: {
                type: 'string',
                description: 'Custom CSS injected into the page before rendering PDF.',
              },
              watermark: {
                type: 'object',
                properties: {
                  enabled: { type: 'boolean', default: false },
                  type: { type: 'string', enum: ['text', 'image'], default: 'text' },
                  text: { type: 'string', default: 'CONFIDENTIAL' },
                  fontSize: { type: 'number', default: 64 },
                  color: { type: 'string', default: '#ef4444' },
                  imageUrl: { type: 'string', description: 'URL or base64 data URI of the watermark image' },
                  imageWidth: { type: 'number', default: 300 },
                  opacity: { type: 'number', minimum: 0.01, maximum: 1.0, default: 0.15 },
                  rotation: { type: 'number', default: -45, description: 'Rotation in degrees' },
                  layout: { type: 'string', enum: ['center', 'tiled', 'absolute'], default: 'center' },
                  x: { type: 'number', default: 20, description: 'Horizontal X coordinate for absolute positioning' },
                  y: { type: 'number', default: 20, description: 'Vertical Y coordinate for absolute positioning' },
                  coordinateUnit: { type: 'string', enum: ['px', 'mm', '%'], default: 'px' },
                  zIndex: { type: 'string', enum: ['front', 'back'], default: 'front', description: 'Z-index layering: "front" (overlay on top of content) or "back" (underlay behind content)' },
                },
                description: 'Watermark overlay settings injected across all pages.',
              },
              metadata: {
                type: 'object',
                properties: {
                  title: { type: 'string', description: 'Document Title' },
                  author: { type: 'string', description: 'Document Author or Organization' },
                  subject: { type: 'string', description: 'Document Subject or Description' },
                  keywords: { type: 'string', description: 'Comma-separated search keywords for SEO and indexing' },
                  creator: { type: 'string', description: 'Application or creator tag' },
                },
                description: 'Document metadata dictionary embedded directly into PDF for SEO, search engines, and document indexers.',
              },
              compression: {
                type: 'string',
                enum: ['high', 'balanced', 'small'],
                default: 'high',
                description: 'Compression optimization level: "high" (uncompressed/full resolution), "balanced" (downsampled to 1200px max, 80% JPEG), or "small" (downsampled to 800px max, 60% JPEG + PDF stream compression).',
              },
              toc: {
                type: 'object',
                properties: {
                  enabled: { type: 'boolean', default: false },
                  title: { type: 'string', default: 'Table of Contents' },
                  maxLevel: { type: 'number', enum: [1, 2, 3], default: 3 },
                },
                description: 'Automatically generate and inject a Table of Contents page from <h1>-<h3> headings with page number references.',
              },
            },
          },
        },
        {
          name: 'print_to_pdf',
          description:
            'Render an HTML string, local file, or URL emulating browser "Print -> Save as PDF", strictly respecting @media print CSS rules and @page breaks.',
          inputSchema: {
            type: 'object',
            properties: {
              html: {
                type: 'string',
                description: 'Raw HTML string content to convert with print emulation.',
              },
              filePath: {
                type: 'string',
                description: 'Absolute or relative path to a local .html file.',
              },
              url: {
                type: 'string',
                description: 'Full HTTP/HTTPS URL of a webpage to render with print emulation.',
              },
              pageSize: {
                type: 'string',
                enum: ['A4', 'A3', 'A5', 'Letter', 'Legal', 'Tabloid', 'Executive', 'Custom'],
                default: 'A4',
                description: 'Page size.',
              },
              customWidth: {
                type: 'string',
                description: 'Custom width if pageSize is Custom (e.g. "210mm", "8.5in").',
              },
              customHeight: {
                type: 'string',
                description: 'Custom height if pageSize is Custom (e.g. "297mm", "11in").',
              },
              pageSizeAuthority: {
                type: 'string',
                enum: ['css', 'ui'],
                default: 'css',
                description: 'Page size authority: "css" gives @page rules in CSS authority; "ui" enforces the specified paper size.',
              },
              media: {
                type: 'string',
                enum: ['screen', 'print'],
                default: 'print',
                description: 'CSS media emulation type ("screen" or "print").',
              },
              orientation: {
                type: 'string',
                enum: ['portrait', 'landscape'],
                default: 'portrait',
                description: 'Page orientation.',
              },
              margins: {
                type: 'object',
                properties: {
                  top: { type: 'string', default: '10mm' },
                  bottom: { type: 'string', default: '10mm' },
                  left: { type: 'string', default: '10mm' },
                  right: { type: 'string', default: '10mm' },
                },
                description: 'Page margins.',
              },
              scale: {
                type: 'number',
                minimum: 0.1,
                maximum: 2.0,
                default: 1.0,
                description: 'Render scale factor.',
              },
              background: {
                type: 'boolean',
                default: true,
                description: 'Print background graphics and colors.',
              },
              headerTemplate: {
                type: 'string',
                description: 'HTML template for page headers.',
              },
              footerTemplate: {
                type: 'string',
                description: 'HTML template for page footers.',
              },
              pageRanges: {
                type: 'string',
                description: 'Paper ranges to print, e.g. "1-3, 5".',
              },
              css: {
                type: 'string',
                description: 'Custom CSS injected into the page before printing.',
              },
              watermark: {
                type: 'object',
                properties: {
                  enabled: { type: 'boolean', default: false },
                  type: { type: 'string', enum: ['text', 'image'], default: 'text' },
                  text: { type: 'string', default: 'CONFIDENTIAL' },
                  fontSize: { type: 'number', default: 64 },
                  color: { type: 'string', default: '#ef4444' },
                  imageUrl: { type: 'string', description: 'URL or base64 data URI of the watermark image' },
                  imageWidth: { type: 'number', default: 300 },
                  opacity: { type: 'number', minimum: 0.01, maximum: 1.0, default: 0.15 },
                  rotation: { type: 'number', default: -45, description: 'Rotation in degrees' },
                  layout: { type: 'string', enum: ['center', 'tiled', 'absolute'], default: 'center' },
                  x: { type: 'number', default: 20, description: 'Horizontal X coordinate for absolute positioning' },
                  y: { type: 'number', default: 20, description: 'Vertical Y coordinate for absolute positioning' },
                  coordinateUnit: { type: 'string', enum: ['px', 'mm', '%'], default: 'px' },
                  zIndex: { type: 'string', enum: ['front', 'back'], default: 'front', description: 'Z-index layering: "front" (overlay on top of content) or "back" (underlay behind content)' },
                },
                description: 'Watermark overlay settings injected across all pages.',
              },
              metadata: {
                type: 'object',
                properties: {
                  title: { type: 'string', description: 'Document Title' },
                  author: { type: 'string', description: 'Document Author or Organization' },
                  subject: { type: 'string', description: 'Document Subject or Description' },
                  keywords: { type: 'string', description: 'Comma-separated search keywords for SEO and indexing' },
                  creator: { type: 'string', description: 'Application or creator tag' },
                },
                description: 'Document metadata dictionary embedded directly into PDF for SEO, search engines, and document indexers.',
              },
              compression: {
                type: 'string',
                enum: ['high', 'balanced', 'small'],
                default: 'high',
                description: 'Compression optimization level: "high" (uncompressed/full resolution), "balanced" (downsampled to 1200px max, 80% JPEG), or "small" (downsampled to 800px max, 60% JPEG + PDF stream compression).',
              },
              toc: {
                type: 'object',
                properties: {
                  enabled: { type: 'boolean', default: false },
                  title: { type: 'string', default: 'Table of Contents' },
                  maxLevel: { type: 'number', enum: [1, 2, 3], default: 3 },
                },
                description: 'Automatically generate and inject a Table of Contents page from <h1>-<h3> headings with page number references.',
              },
            },
          },
        },
        {
          name: 'preview_html',
          description:
            'Render an HTML string or URL and capture a high-resolution 2x screenshot plus page title and console errors so the AI can visually verify the layout.',
          inputSchema: {
            type: 'object',
            properties: {
              html: {
                type: 'string',
                description: 'Raw HTML string content to preview.',
              },
              filePath: {
                type: 'string',
                description: 'Absolute or relative path to local .html file.',
              },
              url: {
                type: 'string',
                description: 'Web URL to preview.',
              },
              emulateMedia: {
                type: 'string',
                enum: ['screen', 'print'],
                default: 'screen',
                description: 'Whether to render in screen mode or print emulation mode.',
              },
              viewportWidth: {
                type: 'number',
                default: 1280,
                description: 'Simulated viewport width in pixels.',
              },
              viewportHeight: {
                type: 'number',
                default: 800,
                description: 'Simulated viewport height in pixels.',
              },
              css: {
                type: 'string',
                description: 'Optional custom CSS to inject into the preview.',
              },
            },
          },
        },
        {
          name: 'list_pdfs',
          description:
            'List all generated PDF documents stored in the output directory with their file sizes, timestamps, and paths.',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
      ],
    };
  });

  // 2. Tool Invocation
  server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
    const { name, arguments: args = {} } = request.params;

    try {
      if (name === 'html_to_pdf' || name === 'print_to_pdf') {
        const mode = name === 'print_to_pdf' ? 'print' : 'convert';
        const defaultMedia = name === 'print_to_pdf' ? 'print' : 'screen';
        const validation = validateAndNormalizeConvertRequest(args, defaultMedia);

        if (!validation.isValid) {
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: `Validation Error: ${formatValidationErrorsSummary(validation.errors)}\nDetails:\n${validation.errorList.map((e) => `• ${e.field}: ${e.message}`).join('\n')}`,
              },
            ],
          };
        }

        const { source, options } = validation.data!;
        const result = await convert(source, options, mode, trustedStdio);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  status: 'success',
                  mode,
                  media: options.media,
                  pageSizeAuthority: options.pageSizeAuthority,
                  pdfPath: result.pdfPath,
                  fileName: result.fileName,
                  pages: result.pages,
                  fileSizeBytes: result.fileSize,
                  durationMs: result.durationMs,
                  downloadUrl: result.downloadUrl,
                  profile: result.profile,
                  blockedResources: result.blockedResources,
                  warnings: validation.warnings.length > 0 ? validation.warnings : undefined,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      if (name === 'preview_html') {
        const {
          html,
          filePath,
          url,
          emulateMedia,
          viewportWidth,
          viewportHeight,
          css,
        } = args as any;

        const sourceCheck = validateExportSource({ html, filePath, url });
        if (!sourceCheck.isValid) {
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: `Validation Error: ${formatValidationErrorsSummary(sourceCheck.errors)}`,
              },
            ],
          };
        }

        const preview = await previewHtml(
          { html, filePath, url },
          {
            emulateMedia: emulateMedia || 'screen',
            viewport: {
              width: viewportWidth || 1280,
              height: viewportHeight || 800,
            },
            css,
          },
          trustedStdio
        );

        return {
          content: [
            {
              type: 'text',
              text: `Preview captured successfully: "${preview.title}" (${preview.durationMs}ms). Profile: ${preview.profile}. Blocked resources: ${JSON.stringify(preview.blockedResources)}. Console errors: ${
                preview.consoleErrors.length > 0 ? preview.consoleErrors.join(', ') : 'None'
              }`,
            },
            {
              type: 'image',
              data: preview.screenshotBase64,
              mimeType: 'image/png',
            },
          ],
        };
      }

      if (name === 'list_pdfs') {
        const pdfs = await listGeneratedPdfs();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ count: pdfs.length, pdfs }, null, 2),
            },
          ],
        };
      }

      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Unknown tool requested: ${name}`,
          },
        ],
      };
    } catch (err: any) {
      console.error(`[MCP] Tool execution error for "${name}":`, err);
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Error executing ${name}: ${err.message || String(err)}`,
          },
        ],
      };
    }
  });

  return server;
}

/**
 * Starts the stdio transport MCP server (used when spawned via CLI or Claude Desktop config).
 */
export async function startStdioMcpServer(): Promise<void> {
  const server = createMcpServer(true);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[MCP] Stdio transport active and connected.');
}

/**
 * Active SSE transports mapped by session ID.
 */
const activeSseTransports = new Map<string, SSEServerTransport>();

/**
 * Handles incoming SSE connection on GET /mcp
 */
export async function handleMcpSseConnection(req: Request, res: Response): Promise<void> {
  console.log('[MCP] New SSE client connection requested at /mcp');
  const server = createMcpServer();
  const transport = new SSEServerTransport('/mcp/messages', res);

  const sessionId = transport.sessionId;
  activeSseTransports.set(sessionId, transport);

  req.on('close', () => {
    console.log(`[MCP] SSE connection closed for session: ${sessionId}`);
    activeSseTransports.delete(sessionId);
  });

  await server.connect(transport);
}

/**
 * Handles client POST messages for active SSE sessions on POST /mcp/messages
 */
export async function handleMcpPostMessage(req: Request, res: Response): Promise<void> {
  const sessionId = req.query.sessionId as string;
  if (!sessionId) {
    res.status(400).json({ error: 'Missing sessionId query parameter' });
    return;
  }

  const transport = activeSseTransports.get(sessionId);
  if (!transport) {
    res.status(404).json({ error: `Session not found: ${sessionId}` });
    return;
  }

  await transport.handlePostMessage(req, res);
}
