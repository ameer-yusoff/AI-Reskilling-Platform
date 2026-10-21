export type AiCallerKind = "user" | "guest";

export type AiRateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
};

type RateLimitConfig = {
  windowMs: number;
  userLimit: number;
  guestLimit: number;
};

/** In-memory rolling-window limiter shared by all AI generation routes. */
export class RollingWindowLimiter {
  private readonly requests = new Map<string, number[]>();
  private nextCleanupAt = 0;

  constructor(
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  consume(key: string, limit: number): AiRateLimitResult {
    const now = this.now();
    const cutoff = now - this.windowMs;
    const timestamps = (this.requests.get(key) ?? []).filter((timestamp) => timestamp > cutoff);

    if (now >= this.nextCleanupAt) {
      for (const [storedKey, storedTimestamps] of this.requests) {
        const active = storedTimestamps.filter((timestamp) => timestamp > cutoff);
        if (active.length) this.requests.set(storedKey, active);
        else this.requests.delete(storedKey);
      }
      this.nextCleanupAt = now + Math.min(this.windowMs, 60_000);
    }

    if (timestamps.length >= limit) {
      const retryAfterSeconds = Math.max(1, Math.ceil((timestamps[0]! + this.windowMs - now) / 1000));
      return { allowed: false, limit, remaining: 0, retryAfterSeconds };
    }

    timestamps.push(now);
    this.requests.set(key, timestamps);
    return {
      allowed: true,
      limit,
      remaining: Math.max(0, limit - timestamps.length),
      retryAfterSeconds: 0,
    };
  }
}

function positiveIntegerEnv(name: string, fallback: number): number {
  const value = process.env[name]?.trim();
  if (!value) return fallback;
  if (!/^[1-9]\d*$/.test(value)) {
    throw new Error(`${name} must be a positive whole number.`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error(`${name} must be a safe whole number.`);
  return parsed;
}

function readConfig(): RateLimitConfig {
  const windowSeconds = positiveIntegerEnv("AI_REQUEST_LIMIT_WINDOW_SECONDS", 3_600);
  const windowMs = windowSeconds * 1_000;
  if (!Number.isSafeInteger(windowMs)) {
    throw new Error("AI_REQUEST_LIMIT_WINDOW_SECONDS is too large.");
  }
  return {
    windowMs,
    userLimit: positiveIntegerEnv("AI_REQUEST_LIMIT_USER", 20),
    guestLimit: positiveIntegerEnv("AI_REQUEST_LIMIT_GUEST", 5),
  };
}

let activeLimiter: RollingWindowLimiter | undefined;
let activeConfigKey: string | undefined;

export function consumeAiRequest(kind: AiCallerKind, identity: string): AiRateLimitResult {
  const config = readConfig();
  const configKey = `${config.windowMs}:${config.userLimit}:${config.guestLimit}`;
  if (!activeLimiter || activeConfigKey !== configKey) {
    activeLimiter = new RollingWindowLimiter(config.windowMs);
    activeConfigKey = configKey;
  }
  const limit = kind === "user" ? config.userLimit : config.guestLimit;
  return activeLimiter.consume(`${kind}:${identity}`, limit);
}
