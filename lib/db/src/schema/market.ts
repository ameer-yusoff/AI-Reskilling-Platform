import {
  pgTable,
  serial,
  text,
  integer,
  real,
  timestamp,
  primaryKey,
} from "drizzle-orm/pg-core";

export const marketSourcesTable = pgTable("market_sources", {
  id: text("id").primaryKey(),
  status: text("status").notNull().default("pending"),
  lastFetchedAt: timestamp("last_fetched_at", { withTimezone: true }),
  dataDate: text("data_date"),
  recordCount: integer("record_count").notNull().default(0),
  error: text("error"),
  version: text("version"),
  detail: text("detail"),
});

export const labourMonthlyTable = pgTable("labour_monthly", {
  date: text("date").primaryKey(),
  unemploymentRate: real("unemployment_rate"),
  participationRate: real("participation_rate"),
  employedThousands: real("employed_thousands"),
  unemployedThousands: real("unemployed_thousands"),
});

export const occupationExposureTable = pgTable("occupation_exposure", {
  socCode: text("soc_code").primaryKey(),
  title: text("title").notNull(),
  exposure: real("exposure").notNull(),
});

export const aiUsageTable = pgTable(
  "ai_usage",
  {
    geo: text("geo").notNull(),
    level: integer("level").notNull(),
    socCode: text("soc_code").notNull(),
    title: text("title").notNull(),
    pct: real("pct").notNull(),
    period: text("period").notNull(),
  },
  (t) => [primaryKey({ columns: [t.geo, t.level, t.socCode] })],
);

export const aiUsageOverallTable = pgTable("ai_usage_overall", {
  id: serial("id").primaryKey(),
  geo: text("geo").notNull().unique(),
  usagePerCapitaIndex: real("usage_per_capita_index"),
  usagePct: real("usage_pct"),
  period: text("period").notNull(),
});
