import { db, skillsTable, rolesTable, roleSkillsTable, coursesTable, courseSkillsTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { SKILLS } from "../data/skills";
import { ROLES } from "../data/roles";
import { COURSES } from "../data/courses";
import { logger } from "./logger";

// Date the course catalogue entries (URLs, cost type) were last reviewed.
export const CATALOG_REVIEWED = "2026-10-21";

export async function seedCatalog(): Promise<void> {
  await db.transaction(async (tx) => {
    for (const s of SKILLS) {
      await tx
        .insert(skillsTable)
        .values(s)
        .onConflictDoUpdate({ target: skillsTable.name, set: { category: s.category, aliases: s.aliases } });
    }
    const skillRows = await tx.select().from(skillsTable);
    const skillId = new Map(skillRows.map((r) => [r.name, r.id]));
    const need = (name: string) => {
      const id = skillId.get(name);
      if (!id) throw new Error(`Seed references unknown skill: ${name}`);
      return id;
    };

    for (const r of ROLES) {
      const { skills, ...role } = r;
      const [row] = await tx
        .insert(rolesTable)
        .values(role)
        .onConflictDoUpdate({
          target: rolesTable.title,
          set: {
            socCode: role.socCode,
            titleMs: role.titleMs,
            sector: role.sector,
            riasecCode: role.riasecCode,
            myColCritical: role.myColCritical,
            description: role.description,
          },
        })
        .returning();
      await tx.delete(roleSkillsTable).where(sql`${roleSkillsTable.roleId} = ${row.id}`);
      await tx.insert(roleSkillsTable).values(skills.map(([n, imp]) => ({ roleId: row.id, skillId: need(n), importance: imp })));
    }

    for (const c of COURSES) {
      const { skills, sdg, ...course } = c;
      const values = { ...course, sdgCodes: sdg, lastVerified: CATALOG_REVIEWED };
      const [row] = await tx
        .insert(coursesTable)
        .values(values)
        .onConflictDoUpdate({ target: coursesTable.title, set: values })
        .returning();
      await tx.delete(courseSkillsTable).where(sql`${courseSkillsTable.courseId} = ${row.id}`);
      await tx.insert(courseSkillsTable).values(skills.map((n) => ({ courseId: row.id, skillId: need(n) })));
    }
  });
  logger.info({ skills: SKILLS.length, roles: ROLES.length, courses: COURSES.length }, "Catalog seeded");
}
