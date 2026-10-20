import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";
import type { SkillRow, StoredProfileSkill } from "@workspace/db";

export class CvError extends Error {}

const MAX_BYTES = 8 * 1024 * 1024;

export async function extractCvText(fileName: string, contentBase64: string): Promise<string> {
  const buf = Buffer.from(contentBase64.replace(/^data:[^,]+,/, ""), "base64");
  if (buf.length === 0) throw new CvError("Fail kosong");
  if (buf.length > MAX_BYTES) throw new CvError("Fail melebihi 8 MB");
  const ext = fileName.toLowerCase().split(".").pop();
  let text: string;
  if (ext === "pdf") {
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const out = await extractText(pdf, { mergePages: true });
    text = Array.isArray(out.text) ? out.text.join("\n") : out.text;
  } else if (ext === "docx") {
    text = (await mammoth.extractRawText({ buffer: buf })).value;
  } else if (ext === "txt" || ext === "md") {
    text = buf.toString("utf8");
  } else {
    throw new CvError("Format tidak disokong. Gunakan PDF, DOCX atau TXT.");
  }
  text = text.replace(/\u0000/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (text.length < 40) throw new CvError("Teks tidak dapat dibaca daripada fail ini (mungkin imej imbasan).");
  return text.slice(0, 60000);
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
