# Onboarding, ownership and source verification

Checked in the development workspace on 21 October 2026. No production deployment or production-data migration was performed.

## Automated checks

- `pnpm --filter @workspace/api-spec run codegen` — passed; generated clients and validators match the additive profile, evidence, progress, source and nullable-plan contracts.
- `pnpm --filter @workspace/db run push` — passed against the existing development PostgreSQL database.
- `PORT=5000 BASE_PATH=/ pnpm run build` — passed, including workspace-wide TypeScript checks. These variables are supplied by managed artifact workflows; a bare shell build without them fails the existing Vite configuration. Vite still reports a non-fatal large-bundle warning.
- `pnpm --filter @workspace/api-server run test` — 29 passed, none skipped.
- `git diff --check` — passed.

The API tests exercise both individual segments, consent, corrupt/empty files, prerequisite guards, saved answers, deterministic three-letter results, cross-guest denial, registration and existing-login claims, idempotency, dependent insight retention, and Employee/Educators/individual isolation even when organisation names coincide. Test fixtures are removed afterwards.

Answer edits invalidate old RIASEC scores until resubmission. Identical autosaves, including reordered arrays or PostgreSQL JSONB property order, preserve newly computed scores.

Parser tests use actual readable PDF and DOCX documents as well as malformed files, unsupported formats, oversized files and TXT. They caught an incompatible PDF.js runtime requirement; the compatible parser is pinned without changing Node. Retrieval/evidence tests reject unsupported facts and verify document-local retrieval. These unit/integration tests do not claim to test an external model's quality.

## Source audit

An actual refresh successfully ingested:

| Source | Observed version/period | Records | Meaning |
|---|---|---:|---|
| O*NET | 31.0, August 2026 | 30 matched roles | US occupation, interest and skill references; not Malaysian vacancies or MyCOL |
| DOSM LFS | August 2026 | 60 monthly rows | Malaysian labour statistics, with publisher units retained |
| Anthropic Economic Index usage | release 2026-06-26; observation May 2026 | 1,003 rows | Claude conversation use mapped to occupations, not all AI use or hiring demand |
| AEI observed exposure | publisher commit pinned per fetch | 756 rows | Observed task exposure, not a probability of job loss; no unsupported publication period |

These counts describe this verification fetch, not a permanent current-data promise. Three editorial role crosswalks without verified O*NET matches are withheld. The AEI publisher metadata declared MIT; exposure ingestion verifies the licence and pins the publisher revision. O*NET attribution and CC BY 4.0 links are included in Data Sources.

`/sources` contains English, Bahasa Melayu and Simplified Chinese documentation for publishers, safe dataset/API links, geography, units, transformations, SOC mapping limitations, licences, versions, refresh behaviour, successful fetch time, stale/error states and privacy. It separately classifies user input, demo records, static references, external datasets and calculated results.

## Deliberate unavailable states

- There is no verified course-provider feed for prices, durations or HRD Corp attributes. Public courses and new pathway creation are therefore unavailable (`course_catalogue_unavailable`), not replaced with seed courses. Historical plans remain stored, but unverified items/totals are withheld. No missing price is represented as free.
- MyCOL status and Malaysian occupation-demand scores remain unverified/null. A US occupation reference or AI exposure score is not a substitute.
- RunPod health/model checks can wake workers. Healthy metadata alone does not prove generation will succeed. Missing configuration, cold starts, timeout and unusable structured output have explicit retry/error states; no AI fallback profile is manufactured.
- The wizard requires all 30 questionnaire answers. The backwards-compatible API requires at least 18 unique answers and three per dimension. Scores are deterministic means with a fixed tie order, not a diagnosis.

## Live AI smoke check

After initially unavailable endpoints became healthy, one synthetic CV was sent through the real API with consent. Extraction returned HTTP 200 in 5.7 seconds, with all five personal-fact fields supported by validated CV quotations. Repeating the identical upload returned the same extraction key in 0.01 seconds, without another generation request.

The same profile was manually confirmed, answered all 30 Holland items, and received a real Holland explanation for a Bahasa Melayu request (HTTP 200, 39.2 seconds, non-empty content). The temporary profile was deleted successfully (HTTP 204). This is a smoke check with fictional data, not a model-quality benchmark or a guarantee of future provider availability.

## Browser verification

One consolidated browser pass verified the working/student entry points; dummy signup and existing-individual-login claims; preservation of both profiles, evidence and 30 answers; reopening the workspace; both organisation demo logins; `/me` role redirects; cross-organisation/individual 404 denial; EN/BM/Chinese Data Sources; official O*NET linking; and a 402×874 wizard with no horizontal overflow.

That pass found a navigation race after successful Review/Holland saves. The route guard had read the React Query observer's previous-tick snapshot immediately after a synchronous cache write. It now reads the authoritative cache snapshot. A focused follow-up to the same browser test confirmed all three transitions driven only by UI buttons: Review → Holland (29 answers restored), final answer → results (RIA and six scores), and results → Save. No manual routing was used to bypass them.

Downstream browser journeys used explicitly labelled synthetic extraction fixtures because provider health was unavailable when that pass began. The browser's 503 AI-error state was deliberately intercepted; it is not counted as a real provider failure or extraction success. The separate live API check above supplied actual extraction/Holland coverage. All browser-created profiles and dummy accounts were removed; built-in demo accounts were retained.

Remaining browser coverage limits: wizard-wide language/draft cycling and CV-failure URL guards were not completed in that pass. A corrupt-PDF browser attempt was interrupted by development Fast Refresh while files were changing; reload recovered. Parser/API tests cover corrupt files and prerequisite guards, and typed dictionaries cover the three-language keys, but these are not represented as completed browser checks. No production browser check was performed.

## Privacy and repeatable walkthroughs

The original upload is discarded. With explicit consent, extracted text is sent to the existing RunPod provider and retained with profile evidence. Retrieval never searches other users' documents. Successful extraction and insights are reused by scoped hashes; unclaimed guest work expires after seven days.

Use **How this works** in onboarding for the fictional walkthrough. At signup, **Fill dummy details** generates a new `@example.invalid` identity each time, so repeat signup does not collide or send real email. Employee and Educators demo buttons use clearly labelled sample organisations/members and retain legacy internal roles and URLs.

Signing up or logging into an individual account transactionally reassigns the existing guest profile and related records; it does not copy a second profile. Organisation access also checks the owning account's organisation and internal role. The post-merge setup applies additive Drizzle schema changes before normal startup.
