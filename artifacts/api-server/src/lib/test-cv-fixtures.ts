import { createCanvas } from "@napi-rs/canvas";

export const syntheticCvText = [
  "Name: Kiran Example",
  "Current role: Data Analyst",
  "Organization: Sample Research Lab",
  "Education: Diploma in Data Analytics",
  "Experience: Prepared monthly reports for operations teams.",
  "Skills: Python, Excel, and SQL.",
].join("\n");

export function syntheticCvJpeg(): Buffer {
  const canvas = createCanvas(1200, 1600);
  const context = canvas.getContext("2d");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, 1200, 1600);
  context.fillStyle = "#111";
  context.font = "bold 46px Arial";
  context.fillText("SAMPLE CV", 90, 110);
  context.font = "32px Arial";
  syntheticCvText.split("\n").forEach((line, index) => context.fillText(line, 90, 220 + index * 82));
  return canvas.toBuffer("image/jpeg", 92);
}

function makePdf(objects: Buffer[]): Buffer {
  const chunks: Buffer[] = [Buffer.from("%PDF-1.4\n")];
  const offsets: number[] = [];
  let offset = chunks[0]!.length;
  objects.forEach((object, index) => {
    offsets.push(offset);
    const start = Buffer.from(`${index + 1} 0 obj\n`);
    const end = Buffer.from("\nendobj\n");
    chunks.push(start, object, end);
    offset += start.length + object.length + end.length;
  });
  const xrefOffset = offset;
  const xref = [
    `xref\n0 ${objects.length + 1}\n`,
    "0000000000 65535 f \n",
    ...offsets.map((entry) => `${String(entry).padStart(10, "0")} 00000 n \n`),
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`,
  ].join("");
  chunks.push(Buffer.from(xref));
  return Buffer.concat(chunks);
}

export function textOnlyCvPdf(text: string, pageCount = 1): Buffer {
  const pageIds = Array.from({ length: pageCount }, (_, index) => index + 3);
  const fontId = pageCount + 3;
  const firstContentId = fontId + 1;
  const literal = text.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)").replace(/\s+/g, " ");
  const objects = [
    Buffer.from("<< /Type /Catalog /Pages 2 0 R >>"),
    Buffer.from(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageCount} >>`),
    ...pageIds.map((_, index) => Buffer.from(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${firstContentId + index} 0 R >>`,
    )),
    Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"),
    ...pageIds.map(() => {
      const stream = `BT /F1 12 Tf 50 700 Td (${literal}) Tj ET`;
      return Buffer.from(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
    }),
  ];
  return makePdf(objects);
}

export function malformedPageCvPdf(): Buffer {
  return makePdf([
    Buffer.from("<< /Type /Catalog /Pages 2 0 R >>"),
    Buffer.from("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
    Buffer.from("this is not a PDF page dictionary"),
  ]);
}

export function imageOnlyCvPdf(
  jpeg = syntheticCvJpeg(),
  pageCount = 1,
  pageSize: { width: number; height: number } = { width: 612, height: 792 },
): Buffer {
  const imageId = pageCount + 3;
  const firstContentId = imageId + 1;
  const imageObject = Buffer.concat([
    Buffer.from(`<< /Type /XObject /Subtype /Image /Width 1200 /Height 1600 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`),
    jpeg,
    Buffer.from("\nendstream"),
  ]);
  const content = `q ${pageSize.width} 0 0 ${pageSize.height} 0 0 cm /Im0 Do Q`;
  const pageObjects = Array.from({ length: pageCount }, (_, index) => [
    Buffer.from(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageSize.width} ${pageSize.height}] /Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${firstContentId + index} 0 R >>`),
    Buffer.from(`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`),
  ]).flat();
  return makePdf([
    Buffer.from("<< /Type /Catalog /Pages 2 0 R >>"),
    Buffer.from(`<< /Type /Pages /Kids [${Array.from({ length: pageCount }, (_, index) => `${index + 3} 0 R`).join(" ")}] /Count ${pageCount} >>`),
    ...pageObjects.filter((_, index) => index % 2 === 0),
    imageObject,
    ...pageObjects.filter((_, index) => index % 2 === 1),
  ]);
}
