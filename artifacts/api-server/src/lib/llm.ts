// RunPod Serverless vLLM client (OpenAI-compatible). Only called on demand.
export class AiNotConnectedError extends Error {}
export class AiTimeoutError extends Error {}

type Tier = "main" | "light";

/** Accepts a bare endpoint ID or a pasted URL such as https://api.runpod.ai/v2/<id>/run. */
function endpointId(raw: string | undefined): string | undefined {
  const v = raw?.trim();
  if (!v) return undefined;
  const m = v.match(/\/v2\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : v;
}

function cfg() {
  const apiKey = process.env["RUNPOD_API_KEY"]?.trim();
  const mainId = endpointId(process.env["RUNPOD_LLM_ENDPOINT_ID"]);
  const lightId = endpointId(process.env["RUNPOD_LIGHT_ENDPOINT_ID"]);
  return {
    apiKey,
    mainId,
    lightId,
    // RunPod's vLLM worker serves the model under a lowercased id; see resolveModel().
    mainModel: process.env["RUNPOD_LLM_MODEL"]?.trim() || "qwen/qwen3.5-27b",
    lightModel: process.env["RUNPOD_LIGHT_MODEL"]?.trim() || "qwen/qwen3.5-9b",
  };
}

export function aiStatus() {
  const c = cfg();
  const mainConfigured = !!(c.apiKey && c.mainId);
  const lightConfigured = !!(c.apiKey && c.lightId);
  return {
    connected: mainConfigured,
    provider: "RunPod Serverless (vLLM)",
    mainModel: mainConfigured ? c.mainModel : null,
    lightModel: lightConfigured ? c.lightModel : null,
    mainConfigured,
    lightConfigured,
    message: mainConfigured
      ? lightConfigured
        ? "AI engine configured. The light model serves the CV, Holland and SDG agents."
        : "AI engine configured. No light endpoint set, so every agent uses the main model."
      : "AI engine not connected. Set RUNPOD_API_KEY and RUNPOD_LLM_ENDPOINT_ID.",
  };
}

const servedModel = new Map<string, string>();

/**
 * The served model id must match exactly (RunPod lowercases it, e.g. "qwen/qwen3.5-9b";
 * a mismatch returns a bare 502). Ask the endpoint once; fall back to the configured name.
 */
async function resolveModel(endpoint: string, configured: string, apiKey: string): Promise<string> {
  const known = servedModel.get(endpoint);
  if (known) return known;
  try {
    const res = await fetch(`https://api.runpod.ai/v2/${endpoint}/openai/v1/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(8_000),
    });
    if (res.ok) {
      const j = (await res.json()) as { data?: { id: string }[] };
      const ids = j.data?.map((d) => d.id) ?? [];
      const match = ids.find((id) => id.toLowerCase() === configured.toLowerCase()) ?? ids[0];
      if (match) {
        servedModel.set(endpoint, match);
        return match;
      }
    }
  } catch {
    // Endpoint cold; use the configured name for now.
  }
  return configured;
}

export async function chat(tier: Tier, system: string, user: string): Promise<{ content: string; model: string }> {
  const c = cfg();
  if (!c.apiKey || !c.mainId) throw new AiNotConnectedError("AI engine not connected");
  const useLight = tier === "light" && !!c.lightId;
  const endpoint = useLight ? c.lightId! : c.mainId;
  const model = await resolveModel(endpoint, useLight ? c.lightModel : c.mainModel, c.apiKey);
  let res: Response;
  try {
  res = await fetch(`https://api.runpod.ai/v2/${endpoint}/openai/v1/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${c.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      max_tokens: 1800,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      chat_template_kwargs: { enable_thinking: false },
    }),
    signal: AbortSignal.timeout(290_000),
  });
  } catch (err) {
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) throw new AiTimeoutError("RunPod request timed out");
    throw err;
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`RunPod ${res.status}: ${body.slice(0, 300)}`);
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = (json.choices?.[0]?.message?.content ?? "").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  if (!content) throw new Error("RunPod returned an empty response");
  return { content, model };
}


export type EndpointHealth = {
  status: "ok" | "error" | "not_configured";
  detail: string | null;
  error: string | null;
};

/** Lightweight RunPod health probe (no generation, no GPU cost). */
export async function endpointHealth(tier: Tier): Promise<EndpointHealth> {
  const c = cfg();
  const id = tier === "main" ? c.mainId : c.lightId;
  if (!c.apiKey || !id) return { status: "not_configured", detail: null, error: null };
  try {
    const res = await fetch(`https://api.runpod.ai/v2/${id}/health`, {
      headers: { Authorization: `Bearer ${c.apiKey}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return { status: "error", detail: null, error: `HTTP ${res.status}` };
    const j = (await res.json()) as { workers?: Record<string, number>; jobs?: Record<string, number> };
    const w = j.workers ?? {};
    const detail = `model=${tier === "main" ? c.mainModel : c.lightModel}; workers ready=${w["ready"] ?? 0}, running=${w["running"] ?? 0}, idle=${w["idle"] ?? 0}, initializing=${w["initializing"] ?? 0}; jobs queued=${j.jobs?.["inQueue"] ?? 0}`;
    return { status: "ok", detail, error: null };
  } catch (err) {
    return { status: "error", detail: null, error: err instanceof Error ? err.message : String(err) };
  }
}
