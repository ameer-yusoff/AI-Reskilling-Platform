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

export function imageOnlyCvPdf(jpeg = syntheticCvJpeg()): Buffer {
  const imageObject = Buffer.concat([
    Buffer.from(`<< /Type /XObject /Subtype /Image /Width 1200 /Height 1600 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`),
    jpeg,
    Buffer.from("\nendstream"),
  ]);
  return makePdf([
    Buffer.from("<< /Type /Catalog /Pages 2 0 R >>"),
    Buffer.from("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
    Buffer.from("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>"),
    imageObject,
    Buffer.from("<< /Length 33 >>\nstream\nq 612 0 0 792 0 0 cm /Im0 Do Q\nendstream"),
  ]);
}
