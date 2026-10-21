---
name: CV parser runtime compatibility
description: Runtime requirements for readable text extraction and scanned-page rendering.
---

Test a valid, readable PDF after parser upgrades; rejection tests alone can hide a parser that rejects every document. For scanned-page rendering, use the official Node-compatible PDF.js legacy module with the native canvas implementation; unpdf's bundled serverless runtime does not provide the canvas integration.

**Why:** A newer bundled PDF.js used the global Iterator API absent from this project's Node 20 runtime. Separately, the bundled serverless PDF.js could extract text but could not rasterize a page with Node canvas. Malformed-document tests passed, while readable scans failed before vision processing.

**How to apply:** When PDFs unexpectedly appear unreadable, verify runtime compatibility before treating files as corrupt. Keep successful PDF/DOCX extraction, scanned-page rendering, and rejection cases in the same check; externalize native canvas packages in the API build.
