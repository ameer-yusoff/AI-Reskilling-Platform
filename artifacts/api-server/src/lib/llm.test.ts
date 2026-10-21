import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

const envKeys = [
  "RUNPOD_API_KEY",
  "RUNPOD_LLM_ENDPOINT_ID",
  "RUNPOD_LIGHT_ENDPOINT_ID",
  "RUNPOD_LLM_MODEL",
  "RUNPOD_LIGHT_MODEL",
] as const;

let savedEnv: Partial<Record<(typeof envKeys)[number], string>>;
let savedFetch: typeof globalThis.fetch;
let moduleImport = 0;

beforeEach(() => {
  savedEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
  for (const key of envKeys) delete process.env[key];
  savedFetch = globalThis.fetch;
});

afterEach(() => {
  for (const key of envKeys) {
    const value = savedEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  globalThis.fetch = savedFetch;
});

function configureRunPod(options: {
  mainId?: string;
  lightId?: string;
  mainModel?: string;
  lightModel?: string;
} = {}) {
  process.env["RUNPOD_API_KEY"] = "test-key";
  if (options.mainId) process.env["RUNPOD_LLM_ENDPOINT_ID"] = options.mainId;
  if (options.lightId) process.env["RUNPOD_LIGHT_ENDPOINT_ID"] = options.lightId;
  if (options.mainModel) process.env["RUNPOD_LLM_MODEL"] = options.mainModel;
  if (options.lightModel) process.env["RUNPOD_LIGHT_MODEL"] = options.lightModel;
}

async function loadLlm() {
  return import(`./llm.ts?test=${++moduleImport}`);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function timeoutError() {
  return Object.assign(new Error("probe timed out"), { name: "TimeoutError" });
}

function healthyResponse(url: string): Response {
  if (url.endsWith("/health")) {
    return jsonResponse({ workers: { ready: 1, idle: 1 }, jobs: { inQueue: 0 } });
  }

  const id = url.includes("light-endpoint") ? "qwen/qwen3.5-9b" : "qwen/qwen3.5-27b";
  return jsonResponse({ data: [{ id }] });
}

test("reports missing endpoint configuration without making network requests", async () => {
  const llm = await loadLlm();
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls++;
    throw new Error("unexpected network request");
  };

  assert.deepEqual(await llm.endpointHealth("main"), {
    status: "not_configured",
    detail: null,
    error: null,
  });
  assert.deepEqual(await llm.endpointHealth("light"), {
    status: "not_configured",
    detail: null,
    error: null,
  });
  const status = await llm.aiStatus();
  assert.equal(status.connected, false);
  assert.equal(status.mainConfigured, false);
  assert.equal(status.mainStatus, "not_configured");
  assert.equal(status.lightStatus, "not_configured");
  assert.equal(fetchCalls, 0);
});

test("verifies healthy main and light endpoint models", async () => {
  configureRunPod({
    mainId: "main-endpoint",
    lightId: "light-endpoint",
    mainModel: "Qwen/Qwen3.5-27B",
    lightModel: "Qwen/Qwen3.5-9B",
  });
  const llm = await loadLlm();
  globalThis.fetch = async (input) => healthyResponse(String(input));

  const [main, light] = await Promise.all([
    llm.endpointHealth("main"),
    llm.endpointHealth("light"),
  ]);

  assert.equal(main.status, "ok");
  assert.match(main.detail ?? "", /model=qwen\/qwen3\.5-27b/);
  assert.equal(light.status, "ok");
  assert.match(light.detail ?? "", /model=qwen\/qwen3\.5-9b/);
  const status = await llm.aiStatus();
  assert.equal(status.connected, true);
  assert.equal(status.mainStatus, "ok");
  assert.equal(status.lightStatus, "ok");
});

test("measures a cold endpoint startup separately from its ready-to-response time", async () => {
  configureRunPod({ mainId: "main-endpoint", lightId: "light-endpoint" });
  const llm = await loadLlm();
  let healthCalls = 0;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.endsWith("/openai/v1/models")) {
      return jsonResponse({ data: [{ id: "qwen/qwen3.5-9b" }] });
    }
    if (url.endsWith("/health")) {
      healthCalls++;
      return jsonResponse({ workers: { ready: healthCalls === 1 ? 0 : 1 } });
    }
    if (url.endsWith("/openai/v1/chat/completions")) {
      await new Promise((resolve) => setTimeout(resolve, 1_200));
      return jsonResponse({ choices: [{ message: { content: "CV read" } }] });
    }
    throw new Error(`unexpected request ${url}`);
  };

  const result = await llm.chat("light", "system", "Read this CV.", { measureEndpointStartup: true });

  assert.equal(result.timing.endpointWarmBeforeRequest, false);
  assert.ok(result.timing.endpointStartupMs !== null && result.timing.endpointStartupMs > 0);
  assert.ok(result.timing.endpointRequestMs >= result.timing.endpointStartupMs!);
  assert.ok(result.timing.readyToResponseMs !== null);
  assert.equal(result.timing.endpointTier, "light");
});

test("does not wait for a slow readiness probe before returning a model response", async () => {
  configureRunPod({ mainId: "main-endpoint", lightId: "light-endpoint" });
  const llm = await loadLlm();
  let healthProbeFinished = false;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.endsWith("/openai/v1/models")) {
      return jsonResponse({ data: [{ id: "qwen/qwen3.5-9b" }] });
    }
    if (url.endsWith("/health")) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      healthProbeFinished = true;
      return jsonResponse({ workers: { ready: 1 } });
    }
    if (url.endsWith("/openai/v1/chat/completions")) {
      return jsonResponse({ choices: [{ message: { content: "CV read" } }] });
    }
    throw new Error(`unexpected request ${url}`);
  };

  const result = await llm.chat("light", "system", "Read this CV.", { measureEndpointStartup: true });

  assert.equal(result.content, "CV read");
  assert.equal(healthProbeFinished, false);
});

test("reports a timed-out health probe", async () => {
  configureRunPod({ mainId: "main-endpoint" });
  const llm = await loadLlm();
  globalThis.fetch = async (input) => {
    if (String(input).endsWith("/health")) throw timeoutError();
    return healthyResponse(String(input));
  };

  const result = await llm.endpointHealth("main");
  assert.equal(result.status, "error");
  assert.equal(result.error, "RunPod health probe timed out.");
});

test("reports a timed-out model probe", async () => {
  configureRunPod({ mainId: "main-endpoint" });
  const llm = await loadLlm();
  globalThis.fetch = async (input) => {
    if (String(input).endsWith("/models")) throw timeoutError();
    return healthyResponse(String(input));
  };

  const result = await llm.endpointHealth("main");
  assert.equal(result.status, "error");
  assert.equal(result.error, "RunPod model probe timed out; served model is unverified.");
  assert.match(result.detail ?? "", /workers ready=1/);
});

test("reports an HTTP failure from the health probe", async () => {
  configureRunPod({ mainId: "main-endpoint" });
  const llm = await loadLlm();
  globalThis.fetch = async (input) => {
    if (String(input).endsWith("/health")) return jsonResponse({}, 503);
    return healthyResponse(String(input));
  };

  const result = await llm.endpointHealth("main");
  assert.equal(result.status, "error");
  assert.equal(result.error, "Health probe returned HTTP 503.");
});

test("reports an HTTP failure from the model probe", async () => {
  configureRunPod({ mainId: "main-endpoint" });
  const llm = await loadLlm();
  globalThis.fetch = async (input) => {
    if (String(input).endsWith("/models")) return jsonResponse({}, 502);
    return healthyResponse(String(input));
  };

  const result = await llm.endpointHealth("main");
  assert.equal(result.status, "error");
  assert.equal(result.error, "Model probe returned HTTP 502.");
});

test("rejects a configured model that the endpoint does not serve", async () => {
  configureRunPod({ mainId: "main-endpoint", mainModel: "configured/model" });
  const llm = await loadLlm();
  const calls: string[] = [];
  globalThis.fetch = async (input) => {
    const url = String(input);
    calls.push(url);
    if (url.endsWith("/health")) return jsonResponse({ workers: { ready: 1 } });
    if (url.endsWith("/models")) return jsonResponse({ data: [{ id: "other/model" }] });
    throw new Error("chat request should not be sent");
  };

  const health = await llm.endpointHealth("main");
  assert.equal(health.status, "error");
  assert.equal(health.detail, "served models=other/model");
  assert.match(health.error ?? "", /Configured model "configured\/model"/);
  await assert.rejects(
    llm.chat("main", "system prompt", "user prompt"),
    /Configured model "configured\/model" is not served by the endpoint/,
  );
  assert.equal(calls.some((url) => url.endsWith("/chat/completions")), false);
});

test("accepts the lowercase served model ID and sends it in chat requests", async () => {
  configureRunPod({ mainId: "main-endpoint", mainModel: "Qwen/Qwen3.5-27B" });
  const llm = await loadLlm();
  let chatPayload: { model?: string } | undefined;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith("/models")) {
      return jsonResponse({ data: [{ id: "qwen/qwen3.5-27b" }] });
    }
    if (url.endsWith("/chat/completions")) {
      chatPayload = JSON.parse(String(init?.body)) as { model?: string };
      return jsonResponse({ choices: [{ message: { content: "A useful answer." } }] });
    }
    throw new Error(`unexpected request: ${url}`);
  };

  const result = await llm.chat("main", "system prompt", "user prompt");
  assert.equal(result.content, "A useful answer.");
  assert.equal(result.model, "qwen/qwen3.5-27b");
  assert.equal(chatPayload?.model, "qwen/qwen3.5-27b");
});

for (const dedicatedLight of [false, true]) {
  test(`light chat uses the ${dedicatedLight ? "dedicated light endpoint and model when configured" : "main endpoint and model when no light endpoint is configured"}`, async () => {
    configureRunPod({
      mainId: "main-endpoint",
      lightId: dedicatedLight ? "light-endpoint" : undefined,
      mainModel: "custom/main-model",
      lightModel: "custom/light-model",
    });
    const llm = await loadLlm();
    const endpoint = dedicatedLight ? "light-endpoint" : "main-endpoint";
    const model = dedicatedLight ? "custom/light-model" : "custom/main-model";
    const baseUrl = `https://api.runpod.ai/v2/${endpoint}/openai/v1`;
    const calls: string[] = [];
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      calls.push(url);
      if (url === `${baseUrl}/models`) {
        return jsonResponse({ data: [{ id: model }] });
      }
      if (url === `${baseUrl}/chat/completions`) {
        assert.equal(init?.method, "POST");
        const payload = JSON.parse(String(init?.body));
        assert.equal(payload.model, model);
        assert.deepEqual(payload.messages, [
          { role: "system", content: "system prompt" },
          { role: "user", content: "user prompt" },
        ]);
        return jsonResponse({ choices: [{ message: { content: "A light-tier answer." } }] });
      }
      throw new Error(`unexpected request: ${url}`);
    };

    const result = await llm.chat("light", "system prompt", "user prompt");

    assert.equal(result.content, "A light-tier answer.");
    assert.equal(result.model, model);
    assert.deepEqual(calls, [`${baseUrl}/models`, `${baseUrl}/chat/completions`]);
  });
}

test("sends the actual image to RunPod through the multimodal chat content shape", async () => {
  configureRunPod({ mainId: "main-endpoint", mainModel: "qwen/qwen3.5-27b" });
  const llm = await loadLlm();
  let imagePayload: unknown;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith("/models")) return jsonResponse({ data: [{ id: "qwen/qwen3.5-27b" }] });
    if (url.endsWith("/chat/completions")) {
      const payload = JSON.parse(String(init?.body)) as { messages: { role: string; content: unknown }[] };
      imagePayload = payload.messages[1]?.content;
      return jsonResponse({ choices: [{ message: { content: "Transcribed CV text." } }] });
    }
    throw new Error(`unexpected request: ${url}`);
  };

  const image = { mediaType: "image/png" as const, base64: "aGVsbG8=" };
  await llm.chatWithImage("light", "system prompt", "Read this CV image.", image);
  assert.deepEqual(imagePayload, [
    { type: "text", text: "Read this CV image." },
    { type: "image_url", image_url: { url: "data:image/png;base64,aGVsbG8=" } },
  ]);
});

test("sends multiple scanned PDF pages in one lower-temperature vision request", async () => {
  configureRunPod({ mainId: "main-endpoint", mainModel: "qwen/qwen3.5-27b" });
  const llm = await loadLlm();
  let requestBody: Record<string, any> | undefined;
  let chatCalls = 0;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith("/models")) return jsonResponse({ data: [{ id: "qwen/qwen3.5-27b" }] });
    if (url.endsWith("/chat/completions")) {
      chatCalls++;
      requestBody = JSON.parse(String(init?.body));
      return jsonResponse({ choices: [{ message: { content: '{"imagePages":[],"profile":{}}' } }] });
    }
    throw new Error(`unexpected request: ${url}`);
  };

  await llm.chatWithImages("light", "system prompt", "Read pages 1 and 2.", [
    { mediaType: "image/jpeg", base64: "cGFnZTE=" },
    { mediaType: "image/jpeg", base64: "cGFnZTI=" },
  ]);
  const content = requestBody?.messages[1]?.content as { type: string; image_url?: { url: string } }[];
  assert.equal(chatCalls, 1);
  assert.equal(requestBody?.temperature, 0.1);
  assert.equal(requestBody?.max_tokens, 6000);
  assert.deepEqual(content.filter((part) => part.type === "image_url").map((part) => part.image_url?.url), [
    "data:image/jpeg;base64,cGFnZTE=",
    "data:image/jpeg;base64,cGFnZTI=",
  ]);
});

test("reports a clear error when a RunPod endpoint rejects multimodal image input", async () => {
  configureRunPod({ mainId: "main-endpoint", mainModel: "qwen/qwen3.5-27b" });
  const llm = await loadLlm();
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.endsWith("/models")) return jsonResponse({ data: [{ id: "qwen/qwen3.5-27b" }] });
    if (url.endsWith("/chat/completions")) return jsonResponse({ error: "unsupported image input" }, 422);
    throw new Error(`unexpected request: ${url}`);
  };

  await assert.rejects(
    llm.chatWithImage("light", "system", "Read this CV.", { mediaType: "image/jpeg", base64: "aGVsbG8=" }),
    (error: unknown) => error instanceof Error && error.message === "The configured RunPod model rejected multimodal image input.",
  );
});

test("shares an identical chat request while it is in flight", async () => {
  configureRunPod({ mainId: "main-endpoint" });
  const llm = await loadLlm();
  let chatRequests = 0;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.endsWith("/models")) return jsonResponse({ data: [{ id: "qwen/qwen3.5-27b" }] });
    if (url.endsWith("/chat/completions")) {
      chatRequests++;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return jsonResponse({ choices: [{ message: { content: "One shared answer." } }] });
    }
    throw new Error(`unexpected request: ${url}`);
  };

  const responses = await Promise.all([
    llm.chat("main", "same system prompt", "same user prompt"),
    llm.chat("main", "same system prompt", "same user prompt"),
  ]);

  assert.deepEqual(responses[0], responses[1]);
  assert.equal(chatRequests, 1);
});

for (const tier of ["main", "light"] as const) {
  for (const healthFailure of [false, true]) {
    test(`${tier} chat rejects a changed served model after a cached lookup${healthFailure ? " even when health fails" : ""}`, async () => {
      configureRunPod({
        mainId: "main-endpoint",
        lightId: "light-endpoint",
        mainModel: "configured/model",
        lightModel: "configured/model",
      });
      const llm = await loadLlm();
      let served = "configured/model";
      const sentModels: string[] = [];
      globalThis.fetch = async (input, init) => {
        const url = String(input);
        if (url.endsWith("/health")) return jsonResponse({}, healthFailure ? 503 : 200);
        if (url.endsWith("/models")) return jsonResponse({ data: [{ id: served }] });
        if (url.endsWith("/chat/completions")) {
          sentModels.push(JSON.parse(String(init?.body)).model);
          return jsonResponse({ choices: [{ message: { content: "Answer." } }] });
        }
        throw new Error(`unexpected request: ${url}`);
      };

      await llm.chat(tier, "system", "before redeploy");
      served = "replacement/model";
      assert.equal((await llm.endpointHealth(tier)).status, "error");
      await assert.rejects(
        llm.chat(tier, "system", "after redeploy"),
        /Configured model "configured\/model" is not served by the endpoint/,
      );
      assert.deepEqual(sentModels, ["configured/model"]);
    });
  }
}

test("refreshes the exact served ID after successful verification", async () => {
  configureRunPod({ mainId: "main-endpoint", mainModel: "Configured/Model" });
  const llm = await loadLlm();
  let served = "configured/model";
  let modelProbes = 0;
  const sentModels: string[] = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith("/health")) return jsonResponse({});
    if (url.endsWith("/models")) {
      modelProbes++;
      return jsonResponse({ data: [{ id: served }] });
    }
    if (url.endsWith("/chat/completions")) {
      sentModels.push(JSON.parse(String(init?.body)).model);
      return jsonResponse({ choices: [{ message: { content: "Answer." } }] });
    }
    throw new Error(`unexpected request: ${url}`);
  };

  await llm.chat("main", "system", "before redeploy");
  served = "Configured/Model";
  assert.equal((await llm.endpointHealth("main")).status, "ok");
  await llm.chat("main", "system", "after redeploy");
  assert.deepEqual(sentModels, ["configured/model", "Configured/Model"]);
  assert.equal(modelProbes, 2, "chat should reuse the refreshed verified ID");
});

test("does not reuse the cached model after the configuration changes", async () => {
  configureRunPod({ mainId: "main-endpoint", mainModel: "old/model" });
  const llm = await loadLlm();
  let served = "old/model";
  const sentModels: string[] = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith("/models")) return jsonResponse({ data: [{ id: served }] });
    if (url.endsWith("/chat/completions")) {
      sentModels.push(JSON.parse(String(init?.body)).model);
      return jsonResponse({ choices: [{ message: { content: "Answer." } }] });
    }
    throw new Error(`unexpected request: ${url}`);
  };

  await llm.chat("main", "system", "before redeploy");
  served = "new/model";
  process.env["RUNPOD_LLM_MODEL"] = "New/Model";
  await llm.chat("main", "system", "after redeploy");
  assert.deepEqual(sentModels, ["old/model", "new/model"]);
});

test("does not send the old model when verification finds no served models", async () => {
  configureRunPod({ mainId: "main-endpoint", mainModel: "configured/model" });
  const llm = await loadLlm();
  let ids = ["configured/model"];
  let chatRequests = 0;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.endsWith("/health")) return jsonResponse({});
    if (url.endsWith("/models")) return jsonResponse({ data: ids.map((id) => ({ id })) });
    if (url.endsWith("/chat/completions")) {
      chatRequests++;
      return jsonResponse({ choices: [{ message: { content: "Answer." } }] });
    }
    throw new Error(`unexpected request: ${url}`);
  };

  await llm.chat("main", "system", "before redeploy");
  ids = [];
  assert.equal((await llm.endpointHealth("main")).status, "error");
  await assert.rejects(
    llm.chat("main", "system", "after redeploy"),
    /Configured model "configured\/model" is not served by the endpoint \(served: none\)/,
  );
  assert.equal(chatRequests, 1);
});
