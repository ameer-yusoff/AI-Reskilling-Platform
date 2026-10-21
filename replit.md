# Skilytics (formerly ReskillAI Malaysia)

AI reskilling/upskilling workbench for Malaysia: CV + RIASEC profiling, explainable role matching, Gantt reskilling plans (free / low-cost / HRD Corp), SDG mapping, and market intelligence on AI usage by occupation.

## Run & Operate

- Replit starts the `artifacts/reskill-ai: web` and `artifacts/api-server: API Server` workflows for preview; their artifact configuration supplies `PORT` and the preview paths.
- Replit provides PostgreSQL and `DATABASE_URL` automatically. Do not paste a database URL into the project.
- `pnpm --filter @workspace/db run push` — apply the Drizzle schema to the development database when setting up a fresh workspace (not production).
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec

## Stack

- pnpm workspaces, Node.js 20, TypeScript 5.9
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

- GPU for evidence-validated structured CV extraction, narratives (6 agents) and on-demand predictions, cached by content/input hash. Questionnaire scoring and role matching remain deterministic.
- RunPod Serverless vLLM (OpenAI-compatible). Env: `RUNPOD_API_KEY`, `RUNPOD_LLM_ENDPOINT_ID`, optional `RUNPOD_LIGHT_ENDPOINT_ID`, `RUNPOD_LLM_MODEL`, `RUNPOD_LIGHT_MODEL`. Endpoint vars accept a bare ID or a pasted `https://api.runpod.ai/v2/<id>/run` URL. Missing config returns 503 `ai_not_connected`, never a fake answer. Cold start can take 3-5 min (server timeout 290 s -> `ai_timeout`).
- Auth: own demo-grade login (scrypt hashes, HMAC-signed bearer token with `SESSION_SECRET`, stored in localStorage). Header-based, not cookies, because the preview runs in an iframe. Roles: individual / hr / tvet. HR and TVET only see profiles in their own organisation (forced server-side). Demo accounts `hr@skilytics.demo` and `tvet@skilytics.demo` (password `Demo@2026`) plus labelled "(Demo)" members are seeded at startup.
- Guests: browser sends `X-Guest-Token` (random, localStorage). Guest profiles/predictions are tied to it, moved into the account on register/login, and purged after 7 days if unclaimed.
- Language: EN (default) / BM / 中文 toggle. AI agents and predictions receive `lang` and answer in it; language is part of the cache hash. API errors are codes (e.g. `cv_required`) translated in the frontend.
- Data Sources (`/sources`): trilingual source documentation and status for DOSM, AEI, O*NET, unavailable course verification, RunPod, user/demo data and deterministic methods. Health probes do not generate text but may wake workers.
- Market data: DOSM `lfs_month` (data.gov.my API) + Anthropic Economic Index (HF; latest `release_*` auto-detected, filtered to MYS/GLOBAL SOC rows; `labor_market_impacts/job_exposure.csv`). Ingested at startup if missing, re-checked every 6h, manual refresh endpoint. Never labelled real-time.
- Match score weights: skills 40, transferable 15, interest 20, preferences 10, feasibility 15. Malaysian demand is null and MyCOL is explicitly unverified; AI exposure is not a demand proxy. No verified course means no fabricated course-duration estimate.
- Public course feeds and new pathway creation are unavailable until provider prices, durations and HRD Corp attributes can be verified. Existing plans stay in the database, but unverified prices/items are withheld. Sample course rows are not public facts.
- `/onboarding/:step?` is the standalone individual flow: status → CV → review → Holland → results → save. Legacy `/me?new=worker|graduate` routes redirect here. Draft input is session-scoped; saved answers, extraction evidence and progress belong to the scoped profile. Signup/login claims the same profile rows transactionally.
- CV files (PDF/DOCX/TXT, 8 MB) are discarded. With explicit consent, extracted text is sent to RunPod and retained with quoted evidence for the profile; unclaimed guest work expires after seven days. CV retrieval is request/profile-local, never a shared user document index.
- O*NET 31.0 supplies actual skill importance and occupation interests. The six-digit application SOC → `.00` crosswalk is exact, US-only and not a MASCO/MyCOL equivalence. Unmatched roles are withheld rather than using editorial seed weights. Original English reference titles and excerpts remain attributed.
- Public organisation portal labels are **Employee** (`hr`) and **Educators** (`tvet`); internal role values and legacy URLs are preserved. Organisation scoping also checks the owning account's role, so a personal CV employer name cannot grant organisation access.
- Repeatable individual demo signup uses fresh `@example.invalid` identities via the signup button and in-app walkthrough. No email is sent. Built-in organisation demo accounts retain their legacy email addresses and password for compatibility.

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
