import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";
import type { SkillRow, StoredProfileSkill } from "@workspace/db";

export class CvError extends Error {}

const MAX_BYTES = 8 * 1024 * 1024;

export type CvImageInput = {
  mediaType: "image/png" | "image/jpeg" | "image/webp";
  base64: string;
};

export function isCvImageFile(fileName: string): boolean {
  return /\.(?:png|jpe?g|webp)$/i.test(fileName);
}

function decodeBase64(contentBase64: string): Buffer {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(contentBase64) || contentBase64.length % 4 !== 0) {
    throw new CvError("cv_corrupt");
  }
  const buf = Buffer.from(contentBase64, "base64");
  if (buf.toString("base64") !== contentBase64) throw new CvError("cv_corrupt");
  if (buf.length === 0) throw new CvError("cv_empty");
  if (buf.length > MAX_BYTES) throw new CvError("cv_too_large");
  return buf;
}

export function validateCvImage(fileName: string, contentBase64: string): CvImageInput {
  const buf = decodeBase64(contentBase64);
  const ext = fileName.toLowerCase().split(".").pop();
  const signatureMime = buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    ? "image/png"
    : buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff
      ? "image/jpeg"
      : buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP"
        ? "image/webp"
        : null;
  const extensionMime = ext === "png" ? "image/png" : ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "webp" ? "image/webp" : null;
  if (!signatureMime || signatureMime !== extensionMime || buf.length < 24) throw new CvError("cv_corrupt");
  return { mediaType: signatureMime, base64: contentBase64 };
}

export function normalizeCvText(value: string): string {
  return value.replace(/\u0000/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, 60000);
}

export async function extractCvText(fileName: string, contentBase64: string): Promise<string> {
  const buf = decodeBase64(contentBase64);
  const ext = fileName.toLowerCase().split(".").pop();
  let text: string;
  if (ext === "pdf") {
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    try {
      const out = await extractText(pdf, { mergePages: true });
      text = Array.isArray(out.text) ? out.text.join("\n") : out.text;
    } finally {
      await pdf.destroy();
    }
  } else if (ext === "docx") {
    text = (await mammoth.extractRawText({ buffer: buf })).value;
  } else if (ext === "txt") {
    text = new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } else {
    throw new CvError("cv_unsupported");
  }
  text = normalizeCvText(text);
  if (text.length < 40 || !/[\p{L}]{2}/u.test(text)) throw new CvError("cv_unreadable");
  return text;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

export function extractSkills(text: string, skills: SkillRow[]): StoredProfileSkill[] {
  const found: StoredProfileSkill[] = [];
  const flat = text.replace(/\s+/g, " ");
  for (const s of skills) {
    const terms = [s.name, ...s.aliases];
    for (const t of terms) {
      const re = new RegExp(`(^|[^a-z0-9])${escape(t.toLowerCase())}([^a-z0-9]|$)`, "i");
      const m = re.exec(flat);
      if (m) {
        const start = Math.max(0, m.index - 50);
        const end = Math.min(flat.length, m.index + t.length + 60);
        found.push({ skillId: s.id, status: "evidenced", evidence: `...${flat.slice(start, end).trim()}...` });
        break;
      }
    }
  }
  return found;
}
