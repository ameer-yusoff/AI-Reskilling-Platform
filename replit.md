# ReskillAI Malaysia

AI reskilling/upskilling workbench for Malaysia: CV + RIASEC profiling, explainable role matching, Gantt reskilling plans (free / low-cost / HRD Corp), SDG mapping, and market intelligence on AI usage by occupation.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- Frontend: `artifacts/reskill-ai` (React + Vite, routes in `src/App.tsx`, pages in `src/pages`)
- API: `artifacts/api-server/src/routes/*`, logic in `src/lib/*` (scoring, planner, cv, market ingestion, llm, agents)
- Seed catalogue (skills, roles with SOC codes, courses, SDG targets, RIASEC items): `artifacts/api-server/src/data/*`, upserted on every API start
- DB schema: `lib/db/src/schema/*`; API contract: `lib/api-spec/openapi.yaml`

## Architecture decisions

- GPU only for narratives (6 agents) and on-demand predictions; both cached by input hash. Scoring, matching, planning, charts are deterministic and run without GPU.
- RunPod Serverless vLLM (OpenAI-compatible). Env: `RUNPOD_API_KEY`, `RUNPOD_LLM_ENDPOINT_ID`, optional `RUNPOD_LIGHT_ENDPOINT_ID`, `RUNPOD_LLM_MODEL`, `RUNPOD_LIGHT_MODEL`. Missing config returns 503 ("Enjin AI belum disambungkan"), never a fake answer.
- Market data: DOSM `lfs_month` (data.gov.my API) + Anthropic Economic Index (HF; latest `release_*` auto-detected, filtered to MYS/GLOBAL SOC rows; `labor_market_impacts/job_exposure.csv`). Ingested at startup if missing, re-checked every 6h, manual refresh endpoint. Never labelled real-time.
- Match score weights: skills 40, transferable 15, interest 20, preferences 10, feasibility 15 (frontend meters assume these maxima). marketDemand = MyCOL flag + low AI exposure, separate from fit.
- HRD Corp status is never "claimable_verified" unless confirmed; local paid training is "check_with_employer". CV files are not stored, only extracted text. No auth yet (add before real CV use).

## Product

Serves four segments: at-risk workers, graduates/career switchers, HR/employers (cohort view by organization), TVET/university career centres. UI in Bahasa Malaysia.

## User preferences

- User writes in Malay; reply in Malay, no emojis.
- Wants all four target segments covered, accurate up-to-date market data, GPU-saving on-demand predictions.

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
