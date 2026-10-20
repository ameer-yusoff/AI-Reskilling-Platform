// RunPod Serverless vLLM client (OpenAI-compatible). Only called on demand.
export class AiNotConnectedError extends Error {}

type Tier = "main" | "light";

function cfg() {
  const apiKey = process.env["RUNPOD_API_KEY"];
  const mainId = process.env["RUNPOD_LLM_ENDPOINT_ID"];
  const lightId = process.env["RUNPOD_LIGHT_ENDPOINT_ID"];
  return {
    apiKey,
    mainId,
    lightId,
    mainModel: process.env["RUNPOD_LLM_MODEL"] ?? "Qwen/Qwen3.5-27B",
    lightModel: process.env["RUNPOD_LIGHT_MODEL"] ?? "Qwen/Qwen3.5-9B",
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
        ? "Enjin AI disambungkan. Model ringan digunakan untuk ejen CV, Holland dan SDG."
        : "Enjin AI disambungkan. Endpoint ringan belum ditetapkan, semua ejen menggunakan model utama."
      : "Enjin AI belum disambungkan. Tetapkan RUNPOD_API_KEY dan RUNPOD_LLM_ENDPOINT_ID.",
  };
}

export async function chat(tier: Tier, system: string, user: string): Promise<{ content: string; model: string }> {
  const c = cfg();
  if (!c.apiKey || !c.mainId) throw new AiNotConnectedError("AI engine not connected");
  const useLight = tier === "light" && !!c.lightId;
  const endpoint = useLight ? c.lightId! : c.mainId;
  const model = useLight ? c.lightModel : c.mainModel;
  const res = await fetch(`https://api.runpod.ai/v2/${endpoint}/openai/v1/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${c.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      max_tokens: 1200,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      chat_template_kwargs: { enable_thinking: false },
    }),
    signal: AbortSignal.timeout(240_000),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`RunPod ${res.status}: ${body.slice(0, 300)}`);
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = (json.choices?.[0]?.message?.content ?? "").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  if (!content) throw new Error("RunPod returned an empty response");
  return { content, model };
}
