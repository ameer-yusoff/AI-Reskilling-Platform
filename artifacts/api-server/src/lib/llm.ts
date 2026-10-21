// RunPod Serverless vLLM client (OpenAI-compatible). Only called on demand.
import { createHash } from "node:crypto";

export class AiNotConnectedError extends Error {}
export class AiTimeoutError extends Error {}
export class AiVisionUnsupportedError extends Error {}

type Tier = "main" | "light";
export type ChatImage = { mediaType: "image/png" | "image/jpeg" | "image/webp"; base64: string };

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

export async function aiStatus() {
  const c = cfg();
  const mainConfigured = !!(c.apiKey && c.mainId);
  const lightConfigured = !!(c.apiKey && c.lightId);
  const [mainHealth, lightHealth] = await Promise.all([
    mainConfigured ? endpointHealth("main") : Promise.resolve({ status: "not_configured" as const, detail: null, error: null }),
    lightConfigured ? endpointHealth("light") : Promise.resolve({ status: "not_configured" as const, detail: null, error: null }),
  ]);
  return {
    connected: mainHealth.status === "ok",
    provider: "RunPod Serverless (vLLM)",
    mainModel: mainConfigured ? c.mainModel : null,
    lightModel: lightConfigured ? c.lightModel : null,
    mainConfigured,
    lightConfigured,
    mainStatus: mainHealth.status,
    mainDetail: mainHealth.detail,
    mainError: mainHealth.error,
    lightStatus: lightHealth.status,
    lightDetail: lightHealth.detail,
    lightError: lightHealth.error,
    message: !mainConfigured
      ? "AI engine not connected. Set RUNPOD_API_KEY and RUNPOD_LLM_ENDPOINT_ID."
      : mainHealth.status !== "ok"
        ? `Main AI endpoint is unavailable or its served model does not match the configuration: ${mainHealth.error ?? "health check failed"}`
        : lightConfigured && lightHealth.status !== "ok"
          ? `Main AI endpoint is ready, but the light endpoint is unavailable or its served model does not match the configuration: ${lightHealth.error ?? "health check failed"}`
          : lightConfigured
            ? "AI engine ready. Main and light endpoint models are verified."
            : "AI engine ready on the main model. No light endpoint set, so every agent uses the main model.",
  };
}

const servedModel = new Map<string, string>();

/**
 * RunPod may lowercase the served model id. Only use an advertised model that
 * matches the configured model; silently selecting a different model masks bad configuration.
 */
async function resolveModel(endpoint: string, configured: string, apiKey: string): Promise<string> {
  const known = servedModel.get(endpoint);
  if (known?.toLowerCase() === configured.toLowerCase()) return known;
  servedModel.delete(endpoint);
  try {
    const res = await fetch(`https://api.runpod.ai/v2/${endpoint}/openai/v1/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(8_000),
    });
    if (res.ok) {
      const j = (await res.json()) as { data?: { id: string }[] };
      const ids = j.data?.map((d) => d.id) ?? [];
      const match = ids.find((id) => id.toLowerCase() === configured.toLowerCase());
      if (match) {
        servedModel.set(endpoint, match);
        return match;
      }
      throw new Error(`Configured model "${configured}" is not served by the endpoint (served: ${ids.join(", ") || "none"}).`);
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Configured model ")) throw err;
    // Endpoint cold; use the configured name for now.
  }
  return configured;
}

export async function chat(tier: Tier, system: string, user: string): Promise<{ content: string; model: string }> {
  return chatRequest(tier, system, user);
}

export async function chatWithImage(tier: Tier, system: string, user: string, image: ChatImage): Promise<{ content: string; model: string }> {
  return chatWithImages(tier, system, user, [image]);
}

export async function chatWithImages(tier: Tier, system: string, user: string, images: ChatImage[]): Promise<{ content: string; model: string }> {
  if (!images.length) throw new Error("At least one image is required.");
  return chatRequest(tier, system, user, images);
}

async function chatRequest(tier: Tier, system: string, user: string, images?: ChatImage[]): Promise<{ content: string; model: string }> {
  const requestKey = createHash("sha256")
    .update(tier).update("\0").update(system).update("\0").update(user).update("\0")
    .update(images?.map((image) => `${image.mediaType}\0${createHash("sha256").update(image.base64).digest("hex")}`).join("\0") ?? "")
    .digest("hex");
  const inFlight = pendingChats.get(requestKey);
  if (inFlight) return inFlight;

  const request = generateChat(tier, system, user, images);
  pendingChats.set(requestKey, request);
  try {
    return await request;
  } finally {
    if (pendingChats.get(requestKey) === request) pendingChats.delete(requestKey);
  }
}

const pendingChats = new Map<string, Promise<{ content: string; model: string }>>();

async function generateChat(tier: Tier, system: string, user: string, images?: ChatImage[]): Promise<{ content: string; model: string }> {
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
      temperature: images ? 0.1 : 0.3,
      max_tokens: images ? 6000 : 1800,
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: images
            ? [
                { type: "text", text: user },
                ...images.map((image) => ({
                  type: "image_url" as const,
                  image_url: { url: `data:${image.mediaType};base64,${image.base64}` },
                })),
              ]
            : user,
        },
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
    if (images && [400, 415, 422].includes(res.status)) {
      throw new AiVisionUnsupportedError("The configured RunPod model rejected multimodal image input.");
    }
    throw new Error(`RunPod request failed with HTTP ${res.status}.`);
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

/** RunPod readiness and model verification probes (no generation, no GPU generation cost). */
export async function endpointHealth(tier: Tier): Promise<EndpointHealth> {
  const c = cfg();
  const id = tier === "main" ? c.mainId : c.lightId;
  if (!c.apiKey || !id) return { status: "not_configured", detail: null, error: null };
  const expectedModel = tier === "main" ? c.mainModel : c.lightModel;
  try {
    const headers = { Authorization: `Bearer ${c.apiKey}` };
    const [healthResult, modelsResult] = await Promise.allSettled([
      fetch(`https://api.runpod.ai/v2/${id}/health`, { headers, signal: AbortSignal.timeout(15_000) }),
      fetch(`https://api.runpod.ai/v2/${id}/openai/v1/models`, { headers, signal: AbortSignal.timeout(15_000) }),
    ]);
    // Every verification replaces the previous observation, including failed
    // probes. Early health errors must not leave a pre-redeploy model cached.
    servedModel.delete(id);
    if (healthResult.status === "rejected") {
      const timedOut = healthResult.reason instanceof Error && (healthResult.reason.name === "TimeoutError" || healthResult.reason.name === "AbortError");
      return { status: "error", detail: null, error: `RunPod health probe ${timedOut ? "timed out" : "failed"}.` };
    }
    const healthRes = healthResult.value;
    if (!healthRes.ok) return { status: "error", detail: null, error: `Health probe returned HTTP ${healthRes.status}.` };
    const j = (await healthRes.json()) as { workers?: Record<string, number>; jobs?: Record<string, number> };
    const w = j.workers ?? {};
    const workerDetail = `workers ready=${w["ready"] ?? 0}, running=${w["running"] ?? 0}, idle=${w["idle"] ?? 0}, initializing=${w["initializing"] ?? 0}; jobs queued=${j.jobs?.["inQueue"] ?? 0}`;
    if (modelsResult.status === "rejected") {
      const timedOut = modelsResult.reason instanceof Error && (modelsResult.reason.name === "TimeoutError" || modelsResult.reason.name === "AbortError");
      return { status: "error", detail: workerDetail, error: `RunPod model probe ${timedOut ? "timed out" : "failed"}; served model is unverified.` };
    }
    const modelsRes = modelsResult.value;
    if (!modelsRes.ok) return { status: "error", detail: workerDetail, error: `Model probe returned HTTP ${modelsRes.status}.` };
    const models = (await modelsRes.json()) as { data?: { id: string }[] };
    const servedModels = models.data?.map((model) => model.id) ?? [];
    const modelId = servedModels.find((model) => model.toLowerCase() === expectedModel.toLowerCase());
    if (!modelId) {
      servedModel.delete(id);
      return {
        status: "error",
        detail: servedModels.length ? `served models=${servedModels.join(", ")}` : null,
        error: servedModels.length
          ? `Configured model "${expectedModel}" does not match any served model.`
          : "The endpoint did not advertise a served model.",
      };
    }
    servedModel.set(id, modelId);
    const detail = `model=${modelId}; ${workerDetail}`;
    return { status: "ok", detail, error: null };
  } catch (err) {
    const error = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")
      ? "RunPod health or model response timed out."
      : "RunPod health or model response failed.";
    return { status: "error", detail: null, error };
  }
}
