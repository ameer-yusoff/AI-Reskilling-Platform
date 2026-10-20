# Skilytics (formerly ReskillAI Malaysia)

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

- Frontend: `artifacts/reskill-ai` (React + Vite, routes in `src/App.tsx`, pages in `src/pages`, i18n dictionaries in `src/i18n/{en,ms,zh}.ts`, auth context in `src/lib/auth.tsx`)
- API: `artifacts/api-server/src/routes/*`, logic in `src/lib/*` (scoring, planner, cv, market ingestion, llm, agents)
- Seed catalogue (skills, roles with SOC codes, courses, SDG targets, RIASEC items): `artifacts/api-server/src/data/*`, upserted on every API start
- DB schema: `lib/db/src/schema/*`; API contract: `lib/api-spec/openapi.yaml`

## Architecture decisions

- GPU only for narratives (6 agents) and on-demand predictions; both cached by input hash. Scoring, matching, planning, charts are deterministic and run without GPU.
- RunPod Serverless vLLM (OpenAI-compatible). Env: `RUNPOD_API_KEY`, `RUNPOD_LLM_ENDPOINT_ID`, optional `RUNPOD_LIGHT_ENDPOINT_ID`, `RUNPOD_LLM_MODEL`, `RUNPOD_LIGHT_MODEL`. Endpoint vars accept a bare ID or a pasted `https://api.runpod.ai/v2/<id>/run` URL. Missing config returns 503 `ai_not_connected`, never a fake answer. Cold start can take 3-5 min (server timeout 290 s -> `ai_timeout`).
- Auth: own demo-grade login (scrypt hashes, HMAC-signed bearer token with `SESSION_SECRET`, stored in localStorage). Header-based, not cookies, because the preview runs in an iframe. Roles: individual / hr / tvet. HR and TVET only see profiles in their own organisation (forced server-side). Demo accounts `hr@skilytics.demo` and `tvet@skilytics.demo` (password `Demo@2026`) plus labelled "(Demo)" members are seeded at startup.
- Guests: browser sends `X-Guest-Token` (random, localStorage). Guest profiles/predictions are tied to it, moved into the account on register/login, and purged after 7 days if unclaimed.
- Language: EN (default) / BM / 中文 toggle. AI agents and predictions receive `lang` and answer in it; language is part of the cache hash. API errors are codes (e.g. `cv_required`) translated in the frontend.
- Data Sources monitor (`/sources`): DOSM, AEI usage, AEI exposure, course-link check, RunPod main/light health (`/health`, no generation).
- Market data: DOSM `lfs_month` (data.gov.my API) + Anthropic Economic Index (HF; latest `release_*` auto-detected, filtered to MYS/GLOBAL SOC rows; `labor_market_impacts/job_exposure.csv`). Ingested at startup if missing, re-checked every 6h, manual refresh endpoint. Never labelled real-time.
- Match score weights: skills 40, transferable 15, interest 20, preferences 10, feasibility 15 (frontend meters assume these maxima). marketDemand = MyCOL flag + low AI exposure, separate from fit.
- HRD Corp status is never "claimable_verified" unless confirmed; local paid training is "check_with_employer". CV files are not stored, only extracted text.

## Product

Serves four segments: at-risk workers, graduates/career switchers, HR/employers (cohort view by organization), TVET/university career centres. Separate portals: individual (no login needed), HR (`/hr`), TVET/career centre (`/tvet`). Visual system from `attached_assets/skilytics_design_report_*.md` (Inter, UTM maroon #7A1523 / gold #C69214, 256px sidebar on desktop, 4-item bottom nav on mobile); the report's mock numbers are not used.

## User preferences

- User writes in Malay; reply in Malay, no emojis.
- Wants all four target segments covered, accurate up-to-date market data, GPU-saving on-demand predictions.

## Gotchas

- RunPod vLLM serves the model under a lowercased id (e.g. `qwen/qwen3.5-9b`); a wrong-case model name returns a bare HTML 502. `llm.ts` discovers the served id via `/openai/v1/models`.
- Orval: an operation with both a path param and a query param produces a name clash in `@workspace/api-zod` (`<Op>Params`). Avoid query params on path-param operations.
- e-LATiH (`e-latih.hrdcorp.gov.my`) is unreachable from the Replit network, so the link check reports it; this is not necessarily a dead link.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
