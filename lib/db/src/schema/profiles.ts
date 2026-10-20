import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  real,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";

export type StoredProfileSkill = {
  skillId: number;
  status: "evidenced" | "self_reported" | "inferred";
  evidence: string | null;
};

export type StoredRiasec = { R: number; I: number; A: number; S: number; E: number; C: number };

export const profilesTable = pgTable("profiles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  segment: text("segment").notNull(),
  currentRole: text("current_role"),
  organization: text("organization"),
  goals: text("goals"),
  weeklyHours: integer("weekly_hours").notNull(),
  budgetMyr: real("budget_myr").notNull(),
  hrdcEligible: boolean("hrdc_eligible").notNull().default(false),
  cvFileName: text("cv_file_name"),
  cvUploadedAt: timestamp("cv_uploaded_at", { withTimezone: true }),
  cvText: text("cv_text"),
  skills: jsonb("skills").$type<StoredProfileSkill[]>().notNull().default([]),
  riasecScores: jsonb("riasec_scores").$type<StoredRiasec | null>(),
  riasecCode: text("riasec_code"),
  targetRoleId: integer("target_role_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PlanItemStored = {
  courseId: number;
  title: string;
  provider: string;
  url: string;
  startWeek: number;
  durationWeeks: number;
  costMyr: number;
  hrdcStatus: string;
  skills: string[];
  sdgCodes: string[];
};

export const plansTable = pgTable("plans", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id")
    .notNull()
    .references(() => profilesTable.id, { onDelete: "cascade" }),
  roleId: integer("role_id").notNull(),
  roleTitle: text("role_title").notNull(),
  totalWeeks: integer("total_weeks").notNull(),
  totalCostMyr: real("total_cost_myr").notNull(),
  uncoveredSkills: jsonb("uncovered_skills").$type<string[]>().notNull(),
  items: jsonb("items").$type<PlanItemStored[]>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SourceRefStored = { label: string; url: string | null; dataDate: string | null };

export const insightsTable = pgTable("agent_insights", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id")
    .notNull()
    .references(() => profilesTable.id, { onDelete: "cascade" }),
  agent: text("agent").notNull(),
  inputHash: text("input_hash").notNull(),
  content: text("content").notNull(),
  sources: jsonb("sources").$type<SourceRefStored[]>().notNull(),
  model: text("model").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const predictionsTable = pgTable("predictions", {
  id: serial("id").primaryKey(),
  roleId: integer("role_id"),
  roleTitle: text("role_title"),
  question: text("question").notNull(),
  horizonYears: integer("horizon_years").notNull(),
  inputHash: text("input_hash").notNull(),
  content: text("content").notNull(),
  sources: jsonb("sources").$type<SourceRefStored[]>().notNull(),
  model: text("model").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
