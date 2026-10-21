import { inflateRawSync } from "node:zlib";
import { db, rolesTable, skillsTable, roleSkillsTable, marketSourcesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export const ONET_VERSION = "31.0";
export const ONET_URL = "https://www.onetcenter.org/dl_files/database/db_31_0_csv.zip";

// Read only named central-directory entries; no files extracted to disk.
export function zipMember(zip: Buffer, file: string): string {
  for (let i = 0; i + 46 <= zip.length; i++) {
    if (zip.readUInt32LE(i) !== 0x02014b50) continue;
    const n = zip.readUInt16LE(i + 28), extra = zip.readUInt16LE(i + 30), comment = zip.readUInt16LE(i + 32);
    const name = zip.subarray(i + 46, i + 46 + n).toString();
    if (name.endsWith(`/${file}`)) {
      const offset = zip.readUInt32LE(i + 42), size = zip.readUInt32LE(i + 20);
      const start = offset + 30 + zip.readUInt16LE(offset + 26) + zip.readUInt16LE(offset + 28);
      const payload = zip.subarray(start, start + size), method = zip.readUInt16LE(i + 10);
      if (method !== 8 && method !== 0) throw new Error("Unsupported O*NET archive method");
      return (method === 8 ? inflateRawSync(payload, { maxOutputLength: 32 * 1024 * 1024 }) : payload).toString("utf8");
    }
    i += 45 + n + extra + comment;
  }
  throw new Error(`O*NET archive is missing ${file}`);
}

export function csvRows(text: string): Record<string, string>[] {
  const rows: string[][] = []; let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted;
    } else if (!quoted && c === ",") { row.push(cell); cell = ""; }
    else if (!quoted && c === "\n") { row.push(cell.replace(/\r$/, "")); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell.replace(/\r$/, "")); rows.push(row); }
  const header = rows.shift() ?? [];
  return rows.filter((r) => r.length === header.length).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}

export async function ingestOnet() {
  const [state] = await db.select().from(marketSourcesTable).where(eq(marketSourcesTable.id, "onet"));
  if (state?.version === ONET_VERSION && state.status === "ok") return;
  const response = await fetch(ONET_URL, { signal: AbortSignal.timeout(90000) });
  if (!response.ok) throw new Error(`O*NET download HTTP ${response.status}`);
  if (Number(response.headers.get("content-length")) > 30 * 1024 * 1024) throw new Error("O*NET archive too large");
  const zip = Buffer.from(await response.arrayBuffer());
  if (zip.length > 30 * 1024 * 1024) throw new Error("O*NET archive too large");
  const occupations = new Map(csvRows(zipMember(zip, "occupation_data.csv")).map((r) => [r["O*NET-SOC Code"], r]));
  const skills = [...csvRows(zipMember(zip, "essential_skills.csv")), ...csvRows(zipMember(zip, "transferable_skills.csv"))];
  const interests = csvRows(zipMember(zip, "career_interest_types.csv"));
  const roles = await db.select().from(rolesTable);
  let count = 0;
  await db.transaction(async (tx) => {
    for (const role of roles) {
      // Explicit app crosswalk: six-digit SOC -> the .00 broad O*NET occupation.
      // Never fuzzy-match names or pretend this is a MASCO/MyCOL crosswalk.
      const code = `${role.socCode}.00`, occupation = occupations.get(code);
      if (!occupation) continue;
      const actualSkills = skills.filter((r) => r["O*NET-SOC Code"] === code && r["Scale ID"] === "IM" && r["Recommend Suppress"] !== "Y" && Number(r["Data Value"]) >= 3)
        .sort((a, b) => Number(b["Data Value"]) - Number(a["Data Value"])).slice(0, 12);
      const actualInterests = interests.filter((r) => r["O*NET-SOC Code"] === code && r["Scale ID"] === "OI")
        .sort((a, b) => Number(b["Data Value"]) - Number(a["Data Value"]));
      if (!actualSkills.length || actualInterests.length !== 6) continue;
      const codeLetters: Record<string, string> = { Realistic: "R", Investigative: "I", Artistic: "A", Social: "S", Enterprising: "E", Conventional: "C" };
      await tx.update(rolesTable).set({
        officialTitle: occupation.Title, description: occupation.Description,
        sourceUrl: `https://www.onetonline.org/link/summary/${code}`, sourceVersion: ONET_VERSION,
        sourceFetchedAt: new Date().toISOString(), myColCritical: false,
        riasecCode: actualInterests.slice(0, 3).map((r) => codeLetters[r["Element Name"]]).join(""),
      }).where(eq(rolesTable.id, role.id));
      await tx.delete(roleSkillsTable).where(eq(roleSkillsTable.roleId, role.id));
      for (const s of actualSkills) {
        const [skill] = await tx.insert(skillsTable).values({ name: s["Element Name"], category: "Human", aliases: [] })
          .onConflictDoUpdate({ target: skillsTable.name, set: { name: s["Element Name"] } }).returning();
        await tx.insert(roleSkillsTable).values({ roleId: role.id, skillId: skill.id, importance: Math.max(1, Math.min(3, Math.round(1 + (Number(s["Data Value"]) - 1) / 2))) });
      }
      count++;
    }
    if (!count) throw new Error("No compatible O*NET occupations");
    await tx.insert(marketSourcesTable).values({ id: "onet", status: "ok", version: ONET_VERSION, dataDate: "2026-08", lastFetchedAt: new Date(), recordCount: count, error: null })
      .onConflictDoUpdate({ target: marketSourcesTable.id, set: { status: "ok", version: ONET_VERSION, dataDate: "2026-08", lastFetchedAt: new Date(), recordCount: count, error: null } });
  });
}
