# HTML2PDF Studio

**HTML2PDF Studio** is a production-quality, browser-grade Node.js service that converts HTML documents, zipped web bundles, and live URLs into high-fidelity PDF documents. It features a dual-mode engine for standard vector PDF generation and browser Print-to-PDF emulation (`@media print`, `@page` directives, and page breaks), a live pixel-perfect web preview, and a Model Context Protocol (MCP) server for AI clients such as Claude Desktop, Cursor, and Gemini.

---

## 🌟 Key Features

1. **High-Fidelity PDF Conversion**:
   - Converts raw HTML strings, local `.html` files, zipped asset bundles, and live HTTP/HTTPS URLs.
   - Powered by headless Chromium (Playwright) for exact vector text, sharp SVG rendering, and CSS Grid/Flexbox accuracy.
   - Waits for both `networkidle` and `document.fonts.ready` to ensure no missing webfonts or unrendered images.
   - Auto-enforces `-webkit-print-color-adjust: exact !important` so backgrounds and colored badges are preserved.

2. **Browser Print-to-PDF Emulation**:
   - Strictly honors `@media print` stylesheets and `@page` rules (margins, orientations, page numbering).
   - Respects CSS break directives (`page-break-inside: avoid;`, `break-before: page;`, etc.).
   - Interactive Print Preview tab rendering simulated paper sheets directly in the UI.

3. **Full-Featured Web Studio UI**:
   - Drag-and-drop zone for `.html`, `.htm`, and `.zip` archives (extracts and resolves relative CSS/images automatically).
   - In-browser sandboxed live iframe preview with responsive viewport presets (Desktop 1440px, Tablet 768px, Mobile 375px) and Zoom controls (50% to 175%).
   - Conversion options panel: page sizes (A4, A3, Letter, Legal, Tabloid, custom mm), margins, scale (50–200%), background graphics, header/footer templates with `pageNumber` / `totalPages` tokens, and custom CSS injection.
   - Embedded PDF viewer with instant download and local path copying.

4. **Gemini AI Print Optimizer**:
   - Analyzes uploaded HTML DOM structure and detects unpaginated cards, tables, sticky navbars, and contrast issues.
   - Automatically generates targeted print CSS rules to ensure pages break cleanly without orphaned headers.

5. **Model Context Protocol (MCP) Server**:
   - Exposes tools to AI assistants: `html_to_pdf`, `print_to_pdf`, `preview_html`, and `list_pdfs`.
   - Dual transports: **stdio** (for Claude Desktop / CLI) and **Streamable HTTP SSE** on `/mcp`.
   - Reuses a lazy-launched, crash-recycled Chromium singleton instance.

---

## 🚀 Quick Start

### 1. Installation

```bash
# Clone or navigate to the repository
cd html2pdf-studio

# Install dependencies (automatically installs Playwright Chromium via postinstall)
npm install
```

### 2. Run the Application

```bash
# Start both Web UI, REST API, and Streamable MCP Server on port 3000
npm start
# or during development:
npm run dev
```

Visit **`http://localhost:3000`** in your browser.

---

## 🔌 Model Context Protocol (MCP) Integration

HTML2PDF Studio enables AI clients to render, screenshot, and convert documents directly.

### Claude Desktop Configuration

Open your `claude_desktop_config.json`:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

Add the `html2pdf-studio` entry:

```json
{
  "mcpServers": {
    "html2pdf-studio": {
      "command": "npx",
      "args": [
        "-y",
        "tsx",
        "/ABSOLUTE/PATH/TO/html2pdf-studio/bin/mcp-stdio.ts"
      ]
    }
  }
}
```

### Streamable HTTP MCP (Web Agents & Cursor)

HTML2PDF Studio runs an SSE transport endpoint at:
```
http://localhost:3000/mcp
```
Clients post messages to `/mcp/messages?sessionId=<session-id>`.

---

## 🛠️ MCP Tools Reference

### 1. `html_to_pdf`
Converts an HTML string, local file path, or web URL into a vector PDF.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "html": { "type": "string", "description": "Raw HTML string" },
    "filePath": { "type": "string", "description": "Absolute or relative file path" },
    "url": { "type": "string", "description": "Web URL to navigate and render" },
    "pageSize": { "type": "string", "enum": ["A4", "A3", "A5", "Letter", "Legal", "Tabloid", "Executive"], "default": "A4" },
    "orientation": { "type": "string", "enum": ["portrait", "landscape"], "default": "portrait" },
    "margins": {
      "type": "object",
      "properties": {
        "top": { "type": "string", "default": "10mm" },
        "bottom": { "type": "string", "default": "10mm" },
        "left": { "type": "string", "default": "10mm" },
        "right": { "type": "string", "default": "10mm" }
      }
    },
    "scale": { "type": "number", "minimum": 0.1, "maximum": 2.0, "default": 1.0 },
    "background": { "type": "boolean", "default": true },
    "headerTemplate": { "type": "string", "description": "HTML template for header. Supports variables: {{pageNumber}}, {{totalPages}}, {{date}}, {{title}}, {{url}} or Chromium classes like <span class=\"pageNumber\"></span>" },
    "footerTemplate": { "type": "string", "description": "HTML template for footer. Supports variables: {{pageNumber}}, {{totalPages}}, {{date}}, {{title}}, {{url}} or Chromium classes like <span class=\"pageNumber\"></span>" },
    "displayHeaderFooter": { "type": "boolean", "default": false, "description": "Whether to display headers and footers" },
    "pageRanges": { "type": "string", "example": "1-3, 5" },
    "css": { "type": "string", "description": "Custom CSS injected before conversion" },
    "watermark": {
      "type": "object",
      "description": "Watermark overlay injected across all pages",
      "properties": {
        "enabled": { "type": "boolean", "default": false },
        "type": { "type": "string", "enum": ["text", "image"], "default": "text" },
        "text": { "type": "string", "default": "CONFIDENTIAL" },
        "fontSize": { "type": "number", "default": 64 },
        "color": { "type": "string", "default": "#dc2626" },
        "imageUrl": { "type": "string", "description": "URL or base64 data URI of the stamp/logo" },
        "imageWidth": { "type": "number", "default": 280 },
        "opacity": { "type": "number", "minimum": 0.01, "maximum": 1.0, "default": 0.15 },
        "rotation": { "type": "number", "default": -45, "description": "Rotation angle in degrees (-90 to 90)" },
        "layout": { "type": "string", "enum": ["center", "tiled", "absolute"], "default": "center" },
        "x": { "type": "number", "default": 20, "description": "Horizontal coordinate for absolute placement" },
        "y": { "type": "number", "default": 20, "description": "Vertical coordinate for absolute placement" },
        "coordinateUnit": { "type": "string", "enum": ["px", "mm", "%"], "default": "px" },
        "zIndex": { "type": "string", "enum": ["front", "back"], "default": "front", "description": "Layer ordering: front overlay or back underlay" }
      }
    },
    "metadata": {
      "type": "object",
      "description": "Document metadata dictionary embedded directly into PDF binary and DOM for indexing and SEO",
      "properties": {
        "title": { "type": "string", "description": "PDF Document Title (e.g. Q4 Financial Report)" },
        "author": { "type": "string", "description": "Author or Organization name (e.g. Acme Corp)" },
        "subject": { "type": "string", "description": "Subject / abstract summary of the PDF document" },
        "keywords": { "type": "string", "description": "Comma-separated keywords/tags for search indexing" }
      }
    },
    "compression": {
      "type": "string",
      "enum": ["high", "balanced", "small"],
      "default": "high",
      "description": "File size optimization setting: 'high' (uncompressed/lossless), 'balanced' (max 1200px images, 80% JPEG), or 'small' (downsampled to 800px max, 60% JPEG + PDF stream compression)"
    },
    "toc": {
      "type": "object",
      "description": "Automatically generate a Table of Contents (TOC) page based on <h1>-<h3> headings",
      "properties": {
        "enabled": { "type": "boolean", "default": false },
        "title": { "type": "string", "default": "Table of Contents" },
        "maxLevel": { "type": "number", "enum": [1, 2, 3], "default": 3, "description": "1 = H1 only, 2 = H1+H2, 3 = H1+H2+H3" }
      }
    }
  }
}
```

### 2. `print_to_pdf`
Renders the document emulating browser "Print → Save as PDF" (`media: 'print'`), honoring all `@media print` rules and `@page` declarations.
Same input arguments as `html_to_pdf`.

### 3. `preview_html`
Renders an HTML snippet or URL and captures a crisp 2x PNG screenshot along with page title and console errors so the AI model can "see" and verify the visual layout.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "html": { "type": "string" },
    "filePath": { "type": "string" },
    "url": { "type": "string" },
    "emulateMedia": { "type": "string", "enum": ["screen", "print"], "default": "screen" },
    "viewportWidth": { "type": "number", "default": 1280 },
    "viewportHeight": { "type": "number", "default": 800 },
    "css": { "type": "string" }
  }
}
```

### 4. `list_pdfs`
Returns an array of all generated PDF files stored in `./output/` with file sizes, creation timestamps, and absolute paths.

---

## 📡 REST API Reference

### `POST /api/convert`
Generate a standard vector PDF.
```bash
curl -X POST http://localhost:3000/api/convert \
  -H "Content-Type: application/json" \
  -d '{
    "html": "<html><body><h1>Hello World</h1><p>Converted via HTML2PDF Studio</p></body></html>",
    "options": {
      "pageSize": "A4",
      "orientation": "portrait",
      "margins": { "top": "10mm", "bottom": "10mm", "left": "10mm", "right": "10mm" },
      "background": true
    }
  }'
```

**Response:**
```json
{
  "pdfPath": "/app/applet/output/doc_2026-11-10T08-15-00-000Z_ab12cd34ef56.pdf",
  "fileName": "doc_2026-11-10T08-15-00-000Z_ab12cd34ef56.pdf",
  "pages": 1,
  "fileSize": 38412,
  "durationMs": 420,
  "downloadUrl": "/api/download/doc_2026-11-10T08-15-00-000Z_ab12cd34ef56.pdf"
}
```

### `POST /api/print-pdf`
Forces print media emulation (`@media print`).
```bash
curl -X POST http://localhost:3000/api/print-pdf \
  -H "Content-Type: application/json" \
  -d '{
    "url": "http://localhost:3000/samples/invoice.html",
    "options": { "pageSize": "A4" }
  }'
```

### `POST /api/upload`
Upload a `.html` file or `.zip` archive containing `index.html` plus relative CSS/JS/images.
```bash
curl -X POST http://localhost:3000/api/upload \
  -F "file=@invoice_bundle.zip"
```

### `GET /api/preview/:id/:file`
Serves the uploaded bundle for sandboxed iframe live preview with relative asset resolution.

### `GET /api/download/:file`
Streams the generated PDF as an attachment download (`Content-Disposition: attachment`).

### `GET /api/output/:file`
Streams the generated PDF inline for embedding in browser viewers.

### `POST /api/ai/optimize-css`
Sends HTML to Gemini AI to generate print-perfection CSS overrides (preventing orphan page breaks, repeating table headers, and hiding screen-only menus).

---

## 🎨 Recommended CSS Recipes for Printable HTML

To guarantee flawless PDF layouts, you can apply or inject the following CSS:

```css
/* 1. Avoid breaking cards, rows, or blocks across pages */
table, tr, td, th, blockquote, pre, figure, .card, .avoid-break {
  page-break-inside: avoid !important;
  break-inside: avoid !important;
}

/* 2. Repeat table headers across every page */
thead {
  display: table-header-group !important;
}

/* 3. Force page breaks before major headings */
h1, .page-break {
  page-break-before: always !important;
  break-before: page !important;
}

/* 4. Prevent orphaned headers at the bottom of pages */
h1, h2, h3, h4, h5, h6 {
  page-break-after: avoid !important;
  break-after: avoid !important;
}

/* 5. Hide screen-only widgets */
@media print {
  nav, .navbar, .sidebar, button, footer.site-footer, .no-print {
    display: none !important;
  }
}
```

---

## 🔧 Troubleshooting & Linux Environments

1. **Linux Sandbox Flags**:
   The engine automatically starts Chromium with `--no-sandbox`, `--disable-setuid-sandbox`, and `--disable-dev-shm-usage` so it operates reliably in containerized or headless Linux server environments.

2. **Webfont Loading**:
   If webfonts (e.g., Google Fonts) appear as fallback serifs, HTML2PDF Studio explicitly executes `await page.evaluate(() => document.fonts.ready)` and waits for `networkidle` prior to invoking `page.pdf()`. Ensure your HTML includes valid `<link>` or `@import` font tags.

3. **Heavy Single Page Applications (SPAs)**:
   For JavaScript-heavy SPAs that render content asynchronously after page load, use `options.waitForSelector` or `options.delayMs` (e.g. `1000`) to grant the client application time to complete rendering before capturing the PDF.

4. **Canvas / WebGL Diagrams**:
   Enable the **Raster 2x Mode** in the options panel or pass `"rasterMode": true` to ensure canvas charts and WebGL renders appear razor-sharp at high DPI.

---

## 📄 License
Apache-2.0

---

## Rendering profiles and security

See [Rendering profiles, API authentication, sandboxing and egress requirements](docs/RENDERING_SECURITY.md). Production public-web rendering requires network-level egress filtering; application request interception is not sufficient to defeat DNS rebinding.
