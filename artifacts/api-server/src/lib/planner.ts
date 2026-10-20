import type { PlanItemStored } from "@workspace/db";
import type { CourseView, RoleSkillView } from "./catalog";

// Greedy constraint planner: covers gap skills with the fewest, cheapest,
// shortest courses inside the user's budget and weekly hours. HRD Corp
// "check_with_employer" courses do not consume personal budget when the
// user's employer pays the HRD Corp levy, but stay flagged for confirmation.
export function buildPlan(opts: {
  gaps: RoleSkillView[];
  courses: CourseView[];
  budgetMyr: number;
  weeklyHours: number;
  hrdcEligible: boolean;
  maxCourses?: number;
}) {
  const { courses, weeklyHours, hrdcEligible } = opts;
  const maxCourses = opts.maxCourses ?? 6;
  const remaining = new Map(opts.gaps.map((g) => [g.skillId, g]));
  let budget = opts.budgetMyr;
  const chosen: CourseView[] = [];

  const personalCost = (c: CourseView) => (hrdcEligible && c.hrdcStatus !== "not_claimable" ? 0 : c.costMyr);

  while (remaining.size > 0 && chosen.length < maxCourses) {
    let best: { c: CourseView; value: number } | null = null;
    for (const c of courses) {
      if (chosen.includes(c)) continue;
      if (personalCost(c) > budget) continue;
      const gain = c.skills.reduce((a, s) => a + (remaining.get(s.id)?.importance ?? 0), 0);
      if (gain === 0) continue;
      const value = gain / (1 + c.costMyr / 300 + c.durationHours / 40);
      if (!best || value > best.value) best = { c, value };
    }
    if (!best) break;
    chosen.push(best.c);
    budget -= personalCost(best.c);
    for (const s of best.c.skills) remaining.delete(s.id);
  }

  // Order: core skill courses first, then free before paid.
  const coreIds = new Set(opts.gaps.filter((g) => g.importance >= 3).map((g) => g.skillId));
  chosen.sort((a, b) => {
    const ca = a.skills.some((s) => coreIds.has(s.id)) ? 0 : 1;
    const cb = b.skills.some((s) => coreIds.has(s.id)) ? 0 : 1;
    return ca - cb || a.costMyr - b.costMyr;
  });

  // Schedule: two parallel tracks when weekly hours allow (>= 8h/week),
  // otherwise sequential. Capped at 26 weeks per course for very long tracks.
  const tracks = weeklyHours >= 8 ? 2 : 1;
  const hoursPerTrack = weeklyHours / tracks;
  const trackEnd = Array.from({ length: tracks }, () => 1);
  const gapNames = new Set(opts.gaps.map((g) => g.name));
  const items: PlanItemStored[] = chosen.map((c) => {
    const t = trackEnd.indexOf(Math.min(...trackEnd));
    const durationWeeks = Math.min(26, Math.max(1, Math.ceil(c.durationHours / Math.max(hoursPerTrack, 1))));
    const startWeek = trackEnd[t];
    trackEnd[t] = startWeek + durationWeeks;
    return {
      courseId: c.id,
      title: c.title,
      provider: c.provider,
      url: c.url,
      startWeek,
      durationWeeks,
      costMyr: c.costMyr,
      hrdcStatus: c.hrdcStatus,
      skills: c.skills.map((s) => s.name).filter((n) => gapNames.has(n)),
      sdgCodes: c.sdgCodes,
    };
  });

  const totalWeeks = items.reduce((a, i) => Math.max(a, i.startWeek + i.durationWeeks - 1), 0);
  const totalCostMyr = items.reduce((a, i) => a + i.costMyr, 0);
  return { items, totalWeeks, totalCostMyr, uncoveredSkills: [...remaining.values()].map((g) => g.name) };
}
