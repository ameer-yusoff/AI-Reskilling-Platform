---
name: RunPod vLLM quirks
description: Served model id casing and cold-start timing for the RunPod endpoints used by the AI agents
---
- Served model id is lowercased by the RunPod vLLM worker; a case mismatch gives an HTML 502, not a clear error.
**Why:** cost a full debugging round (agents failed with 502 while /health looked fine).
**How to apply:** if agents 502 while health is ok, check `/openai/v1/models` first.
- Cold start measured 2026-10-21: light (9B) ~3.5 min, main (27B) ~4.8 min. Warm calls 10-30 s.
- The user's endpoint secrets were pasted as full `/v2/<id>/run` URLs; code tolerates both.
