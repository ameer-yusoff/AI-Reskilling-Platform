import assert from "node:assert/strict";
import { test } from "node:test";
import { loadImage } from "@napi-rs/canvas";
import { extractCvDocument, extractCvText, validateCvImage } from "./cv";
import { applySectionEvidence, retrieveCv, retrieveReferences, validateExtraction, cvExtractionKey } from "./cv-retrieval";
import { imageOnlyCvPdf, malformedPageCvPdf, syntheticCvJpeg, textOnlyCvPdf } from "./test-cv-fixtures";
import { scoreRiasec } from "./riasec-scoring";
import { RIASEC_QUESTIONS } from "../data/riasec";
import { csvRows } from "./onet";

const cv = "Dummy Worker\nEducation: Diploma in Engineering\nExperience: Equipment Maintenance and Troubleshooting\nSkills: Programming and Mathematics\n";
function zipFiles(files: Record<string, string>) {
  const locals: Buffer[] = [], dirs: Buffer[] = [];
  let offset = 0;
  for (const [path, text] of Object.entries(files)) {
    const name = Buffer.from(path), data = Buffer.from(text);
    let crc = 0xffffffff;
    for (const byte of data) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); }
    crc = (crc ^ 0xffffffff) >>> 0;
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4);
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(name.length, 26);
    const dir = Buffer.alloc(46); dir.writeUInt32LE(0x02014b50); dir.writeUInt16LE(20, 4); dir.writeUInt16LE(20, 6);
    dir.writeUInt32LE(crc, 16); dir.writeUInt32LE(data.length, 20); dir.writeUInt32LE(data.length, 24); dir.writeUInt16LE(name.length, 28); dir.writeUInt32LE(offset, 42);
    locals.push(local, name, data); dirs.push(dir, name); offset += local.length + name.length + data.length;
  }
  const central = Buffer.concat(dirs), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(Object.keys(files).length, 8); end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(central.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, central, end]);
}
test("real DOCX and PDF parsers extract readable text (no AI involved)", async () => {
  const docx = zipFiles({
    "[Content_Types].xml": '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    "_rels/.rels": '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    "word/document.xml": `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${cv.trim()}</w:t></w:r></w:p></w:body></w:document>`,
  });
  assert.match(await extractCvText("readable.docx", docx.toString("base64")), /Diploma in Engineering/);
  const readablePdf = textOnlyCvPdf(cv);
  const pdfDocument = await extractCvDocument("readable.pdf", readablePdf.toString("base64"));
  assert.ok("text" in pdfDocument);
  assert.match(pdfDocument.text ?? "", /Diploma in Engineering/);
  assert.match(await extractCvText("readable.pdf", readablePdf.toString("base64")), /Diploma in Engineering/);
});
test("TXT extraction rejects empty, unsupported, corrupt, scanned/corrupt and oversized documents", async () => {
  assert.equal(await extractCvText("cv.TXT", Buffer.from(cv).toString("base64")), cv.trim());
  await assert.rejects(extractCvText("empty.txt", ""), /cv_empty/);
  await assert.rejects(extractCvText("cv.exe", Buffer.from(cv).toString("base64")), /cv_unsupported/);
  await assert.rejects(extractCvText("cv.txt", "%%%"), /cv_corrupt/);
  await assert.rejects(extractCvText("cv.txt", Buffer.from("hi").toString("base64")), /cv_unreadable/);
  await assert.rejects(extractCvText("cv.docx", Buffer.from("broken docx").toString("base64")));
  await assert.rejects(extractCvText("cv.pdf", Buffer.from("broken pdf").toString("base64")));
  await assert.rejects(extractCvDocument("malformed-page.pdf", malformedPageCvPdf().toString("base64")));
  await assert.rejects(extractCvText("cv.txt", Buffer.alloc(8 * 1024 * 1024 + 1, "x").toString("base64")), /cv_too_large/);
});
test("image CV validation accepts supported signatures and rejects mismatched or oversized data", () => {
  const png = Buffer.alloc(32);
  png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const jpeg = Buffer.alloc(32);
  jpeg.set([0xff, 0xd8, 0xff]);
  const webp = Buffer.alloc(32);
  webp.write("RIFF", 0, "ascii");
  webp.writeUInt32LE(webp.length - 8, 4);
  webp.write("WEBP", 8, "ascii");
  webp.write("VP8 ", 12, "ascii");

  assert.equal(validateCvImage("cv.png", png.toString("base64")).mediaType, "image/png");
  assert.equal(validateCvImage("cv.jpeg", jpeg.toString("base64")).mediaType, "image/jpeg");
  assert.equal(validateCvImage("cv.webp", webp.toString("base64")).mediaType, "image/webp");
  assert.throws(() => validateCvImage("cv.webp", png.toString("base64")), /cv_corrupt/);
  assert.throws(() => validateCvImage("cv.png", Buffer.from("not an image").toString("base64")), /cv_corrupt/);
  assert.throws(() => validateCvImage("cv.png", Buffer.alloc(8 * 1024 * 1024 + 1, 1).toString("base64")), /cv_too_large/);
});
test("scanned PDF pages are rendered as compact vision-ready JPEGs", async () => {
  const pdf = imageOnlyCvPdf(syntheticCvJpeg());
  const document = await extractCvDocument("scanned-cv.pdf", pdf.toString("base64"));
  assert.ok("pages" in document);
  const pages = document.pages ?? [];
  assert.equal(pages.length, 1);
  assert.equal(pages[0]?.pageNumber, 1);
  assert.equal(pages[0]?.image?.mediaType, "image/jpeg");
  assert.ok(Buffer.from(pages[0]!.image!.base64, "base64").byteLength < pdf.byteLength);
  const rendered = await loadImage(Buffer.from(pages[0]!.image!.base64, "base64"));
  assert.ok(rendered.width >= 1100, "ordinary CV pages retain the 1200px OCR render target");
  assert.ok(rendered.height >= 1400);
});
test("scanned PDF rendering bounds extreme page dimensions before allocating canvases", async () => {
  const image = syntheticCvJpeg();
  const tallPage = imageOnlyCvPdf(image, 1, { width: 612, height: 12240 });
  const document = await extractCvDocument("tall-scan.pdf", tallPage.toString("base64"));
  assert.ok("pages" in document);
  const encoded = document.pages?.[0]?.image?.base64;
  assert.ok(encoded);
  const rendered = await loadImage(Buffer.from(encoded, "base64"));
  assert.ok(rendered.width <= 8192);
  assert.ok(rendered.height <= 8192);
  assert.ok(rendered.width * rendered.height <= 12_000_000);
  assert.ok(rendered.width >= 64 && rendered.height >= 64);

  const widePage = imageOnlyCvPdf(image, 1, { width: 61200, height: 792 });
  await assert.rejects(
    extractCvDocument("wide-scan.pdf", widePage.toString("base64")),
    /cv_unreadable/,
  );
});
test("PDF limits reject more than 10 image-only pages and more than 50 total pages", async () => {
  const image = syntheticCvJpeg();
  await assert.rejects(
    extractCvDocument("too-many-scanned-pages.pdf", imageOnlyCvPdf(image, 11).toString("base64")),
    /cv_too_many_pages/,
  );
  await assert.rejects(
    extractCvDocument("too-many-pages.pdf", textOnlyCvPdf(cv, 51).toString("base64")),
    /cv_too_many_pages/,
  );
});
test("retrieval uses only the supplied user's document and sourced relevant references", () => {
  assert.ok(retrieveCv(cv).every((c) => cv.includes(c.content)));
  assert.ok(retrieveCv("x".repeat(60000)).length <= 18);
  assert.ok(retrieveReferences(cv).some((r) => r.name === "Programming" && r.url.startsWith("https://www.onet")));
  assert.ok(!retrieveCv(cv).some((r) => r.content.includes("OTHER_USER_PRIVATE")));
  assert.notEqual(cvExtractionKey(cv, "en"), cvExtractionKey(cv, "zh"));
  const image = { mediaType: "image/png" as const, base64: "c2FtZQ==" };
  assert.notEqual(cvExtractionKey("", "en", image), cvExtractionKey("", "en", { ...image, base64: "b3RoZXI=" }));
  assert.notEqual(cvExtractionKey("", "en", image), cvExtractionKey("", "ms", image));
  assert.notEqual(cvExtractionKey("Page 1\ntext A", "en", image), cvExtractionKey("Page 1\ntext B", "en", image));
});
test("structured extraction rejects unsupported facts even when the model claims evidence", () => {
  const out = validateExtraction(JSON.stringify({
    name: { value: "Dummy Worker", quote: "Dummy Worker" },
    education: { value: "PhD", quote: "Education: Diploma in Engineering" },
    experience: { value: "CEO", quote: "CEO at invented company" },
    currentRole: null, organization: null,
  }), cv);
  assert.equal(out.fields.name, "Dummy Worker");
  assert.equal(out.fields.education, null);
  assert.equal(out.fields.experience, null);
  assert.equal(out.evidence.filter((e) => e.source === "no_evidence").length, 4);
  assert.throws(() => validateExtraction("not-json", cv), /invalid_structured_output/);
});
test("CV evidence tolerates OCR line wrapping and case while preserving exact source text", () => {
  const source = "NAME:\n  Dummy   Worker\nEducation: Diploma in Engineering";
  const result = validateExtraction(JSON.stringify({
    name: { value: "dummy worker", quote: "Name: Dummy Worker" },
    education: { value: "diploma in engineering", quote: "EDUCATION:\tDiploma in Engineering" },
    experience: { value: "Invented Director", quote: "Director at Example Corp" },
    currentRole: null, organization: null,
  }), source);
  assert.equal(result.fields.name, "Dummy   Worker");
  assert.equal(result.fields.education, "Diploma in Engineering");
  assert.equal(result.evidence.find((entry) => entry.field === "name")?.quote, "NAME:\n  Dummy   Worker");
  assert.equal(result.evidence.find((entry) => entry.field === "education")?.quote, "Education: Diploma in Engineering");
  assert.equal(result.fields.experience, null);
});
test("historical work entries are not presented as the current role", () => {
  const source = [
    "EDUCATION",
    "Bachelor of Real Estate",
    "WORK EXPERIENCE",
    "SINE DORBY",
    "Business Operation Intern",
    "Oct 2023 - Mar 2024",
    "Gained experience in managing daily operations.",
    "SKILLS",
    "Excel",
  ].join("\n");
  const extracted = validateExtraction(JSON.stringify({
    name: null,
    currentRole: { value: "Business Operation Intern", quote: "SINE DORBY\nBusiness Operation Intern" },
    organization: { value: "SINE DORBY", quote: "SINE DORBY\nBusiness Operation Intern" },
    education: null,
    experience: null,
  }), source);
  const result = applySectionEvidence(extracted, source);
  assert.equal(result.fields.currentRole, null);
  assert.equal(result.fields.education, "Bachelor of Real Estate");
  assert.match(result.fields.experience!, /Oct 2023 - Mar 2024/);
  assert.equal(result.evidence.find((entry) => entry.field === "currentRole")?.source, "no_evidence");
});
test("RIASEC is deterministic, balanced, duplicate-safe and independent of CV text", () => {
  const answers = RIASEC_QUESTIONS.map((q) => ({ questionId: q.id, value: q.type === "S" ? 5 : 3 }));
  const out = scoreRiasec(answers);
  assert.equal(out.code, "SRI"); assert.equal(out.scores.S, 5);
  assert.deepEqual(scoreRiasec([...answers].reverse()), out);
  assert.throws(() => scoreRiasec([...answers, answers[0]]), /invalid_input/);
  assert.throws(() => scoreRiasec(answers.map((a) => ({ ...a, questionId: 999 }))), /invalid_input/);
  assert.throws(() => scoreRiasec(answers.slice(0, 17)), /riasec_incomplete/);
  assert.throws(() => scoreRiasec(answers.map((a) => ({ ...a, value: 6 }))), /invalid_input/);
});
test("official CSV preserves quoted commas, newlines and escaped quotations", () => {
  assert.deepEqual(csvRows('code,title\r\n1,"A, B"\r\n2,"two\nlines ""quoted"""\r\n'), [
    { code: "1", title: "A, B" }, { code: "2", title: 'two\nlines "quoted"' },
  ]);
});
