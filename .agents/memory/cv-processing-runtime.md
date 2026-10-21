---
name: CV parser runtime compatibility
description: Why readable PDF fixtures are necessary when upgrading the server-side parser.
---

Test a valid, readable PDF after parser upgrades; rejection tests alone can hide a parser that rejects every document.

**Why:** A newer bundled PDF.js used the global Iterator API absent from this project's Node 20 runtime. Malformed-document tests passed, while every readable PDF failed before extraction. We retained the existing runtime rather than changing the project's toolchain.

**How to apply:** When PDFs unexpectedly appear unreadable, verify runtime compatibility before treating files as corrupt. Keep both successful PDF/DOCX extraction and rejection cases in the same check.
