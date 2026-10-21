import assert from "node:assert/strict";
import { test } from "node:test";
import { RollingWindowLimiter } from "./ai-rate-limit";

test("limits requests in a rolling window and returns retry guidance", () => {
  let now = 10_000;
  const limiter = new RollingWindowLimiter(60_000, () => now);

  assert.deepEqual(limiter.consume("user:1", 2), {
    allowed: true,
    limit: 2,
    remaining: 1,
    retryAfterSeconds: 0,
  });
  limiter.consume("user:1", 2);
  assert.deepEqual(limiter.consume("user:1", 2), {
    allowed: false,
    limit: 2,
    remaining: 0,
    retryAfterSeconds: 60,
  });

  now += 60_000;
  assert.equal(limiter.consume("user:1", 2).allowed, true);
});

test("keeps signed-in and guest identities isolated", () => {
  const limiter = new RollingWindowLimiter(60_000, () => 10_000);

  assert.equal(limiter.consume("user:1", 1).allowed, true);
  assert.equal(limiter.consume("user:2", 1).allowed, true);
  assert.equal(limiter.consume("guest:browser-token", 1).allowed, true);
  assert.equal(limiter.consume("guest:other-browser", 1).allowed, true);
});
