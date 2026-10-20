import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  real,
  jsonb,
  date,
  primaryKey,
} from "drizzle-orm/pg-core";

export const skillsTable = pgTable("skills", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  category: text("category").notNull(),
  aliases: jsonb("aliases").$type<string[]>().notNull().default([]),
});

export const rolesTable = pgTable("roles", {
  id: serial("id").primaryKey(),
  socCode: text("soc_code").notNull(),
  title: text("title").notNull().unique(),
  titleMs: text("title_ms").notNull(),
  sector: text("sector").notNull(),
  riasecCode: text("riasec_code").notNull(),
  myColCritical: boolean("mycol_critical").notNull().default(false),
  description: text("description"),
});

export const roleSkillsTable = pgTable(
  "role_skills",
  {
    roleId: integer("role_id")
      .notNull()
      .references(() => rolesTable.id, { onDelete: "cascade" }),
    skillId: integer("skill_id")
      .notNull()
      .references(() => skillsTable.id, { onDelete: "cascade" }),
    importance: integer("importance").notNull(),
  },
  (t) => [primaryKey({ columns: [t.roleId, t.skillId] })],
);

export const coursesTable = pgTable("courses", {
  id: serial("id").primaryKey(),
  title: text("title").notNull().unique(),
  provider: text("provider").notNull(),
  url: text("url").notNull(),
  costMyr: real("cost_myr").notNull(),
  costType: text("cost_type").notNull(),
  hrdcStatus: text("hrdc_status").notNull(),
  durationHours: real("duration_hours").notNull(),
  level: text("level").notNull(),
  language: text("language").notNull(),
  certificate: boolean("certificate").notNull().default(true),
  lastVerified: date("last_verified").notNull(),
  sdgCodes: jsonb("sdg_codes").$type<string[]>().notNull().default([]),
});

export const courseSkillsTable = pgTable(
  "course_skills",
  {
    courseId: integer("course_id")
      .notNull()
      .references(() => coursesTable.id, { onDelete: "cascade" }),
    skillId: integer("skill_id")
      .notNull()
      .references(() => skillsTable.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.courseId, t.skillId] })],
);

export type SkillRow = typeof skillsTable.$inferSelect;
export type RoleRow = typeof rolesTable.$inferSelect;
export type CourseRow = typeof coursesTable.$inferSelect;
