import { db, profilesTable, plansTable, type SkillRow } from "@workspace/db";
import { and, eq, desc, isNull, sql, type SQL } from "drizzle-orm";
import type { Request } from "express";
import { SDG_TARGETS } from "../data/courses";

export type ProfileRow = typeof profilesTable.$inferSelect;
export type PlanRow = typeof plansTable.$inferSelect;

export async function getProfileRow(id: number): Promise<ProfileRow | undefined> {
  const [row] = await db.select().from(profilesTable).where(eq(profilesTable.id, id));
  return row;
}

export async function getLatestPlan(profileId: number): Promise<PlanRow | undefined> {
  const [row] = await db.select().from(plansTable).where(eq(plansTable.profileId, profileId)).orderBy(desc(plansTable.createdAt)).limit(1);
  return row;
}

export function profileToApi(p: ProfileRow, skills: SkillRow[]) {
  const name = new Map(skills.map((s) => [s.id, s.name]));
  return {
    id: p.id,
    name: p.name,
    segment: p.segment,
    currentRole: p.currentRole,
    organization: p.organization,
    goals: p.goals,
    weeklyHours: p.weeklyHours,
    budgetMyr: p.budgetMyr,
    hrdcEligible: p.hrdcEligible,
    cvFileName: p.cvFileName,
    cvUploadedAt: p.cvUploadedAt ? p.cvUploadedAt.toISOString() : null,
    isGuest: p.ownerUserId === null && p.guestToken !== null,
    cvWordCount: p.cvText ? p.cvText.split(/\s+/).filter(Boolean).length : null,
    skills: p.skills
      .filter((s) => name.has(s.skillId))
      .map((s) => ({ skillId: s.skillId, name: name.get(s.skillId)!, status: s.status, evidence: s.evidence })),
    riasecScores: p.riasecScores,
    riasecCode: p.riasecCode,
    targetRoleId: p.targetRoleId,
    createdAt: p.createdAt.toISOString(),
  };
}

type SdgTarget = (typeof SDG_TARGETS)[number];
const sdgByCode = new Map(SDG_TARGETS.map((t) => [t.code, t]));

export function planToApi(p: PlanRow) {
  return {
    id: p.id,
    profileId: p.profileId,
    roleId: p.roleId,
    roleTitle: p.roleTitle,
    totalWeeks: p.totalWeeks,
    totalCostMyr: p.totalCostMyr,
    uncoveredSkills: p.uncoveredSkills,
    items: p.items.map(({ sdgCodes, ...i }) => ({
      ...i,
      sdgTargets: sdgCodes.map((c) => sdgByCode.get(c)).filter((t): t is SdgTarget => !!t),
    })),
    createdAt: p.createdAt.toISOString(),
  };
}


/** SQL condition restricting profiles to what the caller may see. */
export function profileScope(req: Request): SQL {
  const u = req.user;
  if (u && (u.role === "hr" || u.role === "tvet")) {
    return u.organization ? eq(profilesTable.organization, u.organization) : sql`false`;
  }
  const own = u ? eq(profilesTable.ownerUserId, u.id) : undefined;
  const guest = req.guestToken ? and(isNull(profilesTable.ownerUserId), eq(profilesTable.guestToken, req.guestToken)) : undefined;
  if (own && guest) return sql`(${own} OR ${guest})`;
  return own ?? guest ?? sql`false`;
}

export function canAccessProfile(req: Request, p: ProfileRow): boolean {
  const u = req.user;
  if (u && (u.role === "hr" || u.role === "tvet")) return !!u.organization && p.organization === u.organization;
  if (u && p.ownerUserId === u.id) return true;
  return !!req.guestToken && p.ownerUserId === null && p.guestToken === req.guestToken;
}
