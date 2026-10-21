---
name: RunPod vLLM quirks
description: Served model id casing and cold-start timing for the RunPod endpoints used by the AI agents
---
- Served model id is lowercased by the RunPod vLLM worker; a case mismatch gives an HTML 502, not a clear error.
**Why:** cost a full debugging round (agents failed with 502 while /health looked fine).
**How to apply:** if agents 502 while health is ok, check `/openai/v1/models` first.
- Cold start measured 2026-10-21: light (9B) ~3.5 min, main (27B) ~4.8 min. Warm calls 10-30 s.
- The user's endpoint secrets were pasted as full `/v2/<id>/run` URLs; code tolerates both.
- Treat a successful but empty model listing as authoritative: do not generate with an assumed model. Keep the existing configured-name fallback only for unavailable discovery during cold starts.
**Why:** an empty advertised list can indicate redeployment; assuming the old configured name would hide failed model verification.
**How to apply:** preserve the distinction between a successful listing with no matching model and a probe that could not complete.
- Active RunPod Serverless workers are billed continuously; flex workers bill through startup, execution, and idle timeout. FlashBoot is enabled by default.
**Why:** avoiding cold starts has a direct recurring compute cost, and the exact amount depends on the endpoint's selected GPU.
**How to apply:** check the endpoint GPU and current rate before enabling active workers or extending idle timeout; prefer flex for sporadic traffic.
- Do not assume a preview HTTP request will survive a full RunPod cold start: a CV upload connection was observed disconnecting after roughly 120 seconds.
**Why:** cold-start inference can outlast the browser/proxy connection even when the server allows a longer model request.
**How to apply:** prefer a short job-start request and authenticated status polling for long CV processing; distinguish model progress from an elapsed-time animation.
