import { db, profilesTable, plansTable, usersTable, type StoredRiasec } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { DEMO_ACCOUNTS } from "./auth";
import { loadCourses, loadRoles, loadSkills } from "./catalog";
import { scoreRole } from "./scoring";
import { buildPlan } from "./planner";
import { logger } from "./logger";

// Clearly labelled sample members so the HR and TVET demo dashboards are not empty.
type Member = {
  name: string;
  segment: "worker" | "graduate";
  currentRole: string | null;
  skills: string[];
  riasec: StoredRiasec;
  plan?: string;
};

const HR_MEMBERS: Member[] = [
  { name: "Aisyah Rahman (Demo)", segment: "worker", currentRole: "Bookkeeping and Accounts Clerk", skills: ["Bookkeeping", "Microsoft Excel", "Office Administration", "Financial Accounting"], riasec: { R: 2, I: 3.4, A: 2.2, S: 3, E: 2.6, C: 4.6 }, plan: "Data Analyst" },
  { name: "Lim Wei Jie (Demo)", segment: "worker", currentRole: "Customer Service Representative", skills: ["Customer Service", "CRM Systems", "Communication (Bahasa Melayu and English)", "Mandarin"], riasec: { R: 1.8, I: 2.6, A: 3, S: 4.2, E: 3.8, C: 3 } },
  { name: "Muthu Kumar (Demo)", segment: "worker", currentRole: "Production Operator", skills: ["Production Line Operation", "Quality Control", "Occupational Safety and Health", "Mechanical Maintenance"], riasec: { R: 4.6, I: 3, A: 1.8, S: 2.4, E: 2.2, C: 3.6 }, plan: "Mechatronics / Automation Engineer" },
  { name: "Nurul Huda (Demo)", segment: "worker", currentRole: "Administrative Assistant", skills: ["Office Administration", "Microsoft Excel", "Business Writing"], riasec: { R: 1.6, I: 2.8, A: 3.2, S: 3.6, E: 3, C: 4.2 } },
  { name: "Tan Mei Ling (Demo)", segment: "worker", currentRole: "Sales Representative", skills: ["Sales and Negotiation", "Customer Service", "Social Media Management"], riasec: { R: 1.8, I: 2.4, A: 3.4, S: 3.2, E: 4.6, C: 2.6 }, plan: "Digital Marketing Specialist" },
];

const TVET_MEMBERS: Member[] = [
  { name: "Amirul Hakim (Demo)", segment: "graduate", currentRole: null, skills: ["Electrical Systems", "Electronics", "Occupational Safety and Health"], riasec: { R: 4.4, I: 3.6, A: 2, S: 2.2, E: 2.4, C: 3.2 }, plan: "Solar PV Installer" },
  { name: "Siti Mariam (Demo)", segment: "graduate", currentRole: null, skills: ["Microsoft Excel", "Statistics", "Communication (Bahasa Melayu and English)"], riasec: { R: 2, I: 4.2, A: 2.6, S: 3, E: 2.4, C: 3.8 } },
  { name: "Ravi Chandran (Demo)", segment: "graduate", currentRole: null, skills: ["PLC and Industrial Automation", "Mechanical Maintenance", "CAD Drafting"], riasec: { R: 4.8, I: 3.8, A: 2.4, S: 1.8, E: 2.2, C: 3.4 }, plan: "Industrial Maintenance Technician" },
  { name: "Chong Kar Yan (Demo)", segment: "graduate", currentRole: null, skills: ["Graphic Design", "Video Editing", "Social Media Management"], riasec: { R: 2.2, I: 2.6, A: 4.6, S: 3, E: 3.4, C: 2 } },
  { name: "Farah Izzati (Demo)", segment: "graduate", currentRole: null, skills: ["HTML and CSS", "JavaScript", "Problem Solving"], riasec: { R: 2.6, I: 4, A: 3.6, S: 2.4, E: 2.2, C: 3 }, plan: "Web Developer" },
  { name: "Daniel Wong (Demo)", segment: "graduate", currentRole: null, skills: ["IT Support and Troubleshooting", "Networking", "Linux"], riasec: { R: 3.8, I: 3.8, A: 2, S: 2.6, E: 2, C: 3.6 } },
];

function code(r: StoredRiasec): string {
  const order = ["R", "I", "A", "S", "E", "C"] as const;
  return [...order].sort((a, b) => r[b] - r[a] || order.indexOf(a) - order.indexOf(b)).slice(0, 3).join("");
}

export async function seedDemoMembers(): Promise<void> {
  const [skills, roles, courses] = await Promise.all([loadSkills(), loadRoles(), loadCourses()]);
  const skillId = new Map(skills.map((s) => [s.name, s.id]));
  for (const acct of DEMO_ACCOUNTS) {
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(profilesTable).where(eq(profilesTable.organization, acct.organization));
    if (count > 0) continue;
    const [owner] = await db.select().from(usersTable).where(eq(usersTable.email, acct.email));
    if (!owner) continue;
    const members = acct.role === "hr" ? HR_MEMBERS : TVET_MEMBERS;
    for (const m of members) {
      const [p] = await db
        .insert(profilesTable)
        .values({
          name: m.name,
          segment: m.segment,
          currentRole: m.currentRole,
          organization: acct.organization,
          ownerUserId: owner.id,
          weeklyHours: acct.role === "hr" ? 4 : 10,
          budgetMyr: acct.role === "hr" ? 300 : 100,
          hrdcEligible: acct.role === "hr",
          skills: m.skills.map((n) => ({ skillId: skillId.get(n)!, status: "self_reported" as const, evidence: null })).filter((s) => s.skillId),
          riasecScores: m.riasec,
          riasecCode: code(m.riasec),
        })
        .returning();
      const role = m.plan ? roles.find((r) => r.title === m.plan) : undefined;
      if (role) {
        const { gapSkills } = scoreRole(p, role, skills, courses);
        const plan = buildPlan({ gaps: gapSkills, courses, budgetMyr: p.budgetMyr, weeklyHours: p.weeklyHours, hrdcEligible: p.hrdcEligible });
        await db.insert(plansTable).values({ profileId: p.id, roleId: role.id, roleTitle: role.title, ...plan });
        await db.update(profilesTable).set({ targetRoleId: role.id }).where(eq(profilesTable.id, p.id));
      }
    }
    logger.info({ organization: acct.organization, members: members.length }, "Demo members seeded");
  }
}
