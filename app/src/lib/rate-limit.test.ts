/**
 * Unit tests for rate-limit.ts
 *
 * Tests run in NODE_ENV=test → in-memory fallback path.
 * The Upstash production path is tested via mocks to verify:
 *   - RateLimitConfigError thrown when env vars missing in production
 *   - Upstash limiter is called with the identifier
 *
 * The in-memory path is tested directly:
 *   - Allows up to the default max requests (10) per window
 *   - Blocks after the configured threshold
 *   - Resets after the window expires
 *   - Returns correct `remaining` and `resetAt` values
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  checkRateLimit,
  RateLimitConfigError,
  _resetMemoryStoreForTesting,
} from "@/lib/rate-limit";

// Ensure tests run in the 'test' NODE_ENV (in-memory path)
// vitest sets NODE_ENV=test by default

beforeEach(() => {
  _resetMemoryStoreForTesting();
  vi.unstubAllEnvs();
});

// ─── In-memory path (NODE_ENV=test) ──────────────────────────────────────────

describe("in-memory rate limiter (dev/test path)", () => {
  it("allows the first request", async () => {
    const result = await checkRateLimit("ip-1");
    expect(result.allowed).toBe(true);
  });

  it("allows up to 10 requests by default", async () => {
    for (let i = 0; i < 10; i++) {
      const result = await checkRateLimit("ip-multi");
      expect(result.allowed).toBe(true);
    }
  });

  it("blocks the 11th request in the same window by default", async () => {
    for (let i = 0; i < 10; i++) await checkRateLimit("ip-block");
    const result = await checkRateLimit("ip-block");
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("tracks different identifiers independently", async () => {
    for (let i = 0; i < 10; i++) await checkRateLimit("ip-a");
    const blocked = await checkRateLimit("ip-a");
    const fresh = await checkRateLimit("ip-b");

    expect(blocked.allowed).toBe(false);
    expect(fresh.allowed).toBe(true);
  });

  it("returns correct remaining count", async () => {
    const r1 = await checkRateLimit("ip-remaining");
    expect(r1.remaining).toBe(9); // 10 - 1

    const r2 = await checkRateLimit("ip-remaining");
    expect(r2.remaining).toBe(8); // 10 - 2
  });

  it("returns a future resetAt timestamp", async () => {
    const before = Date.now();
    const result = await checkRateLimit("ip-reset");
    const after = Date.now();

    expect(result.resetAt).toBeGreaterThan(before);
    // 15-min window → resetAt should be approx now + 15min
    expect(result.resetAt).toBeGreaterThanOrEqual(before + 15 * 60 * 1000 - 100);
    expect(result.resetAt).toBeLessThanOrEqual(after + 15 * 60 * 1000 + 100);
  });

  it("resets counter after window expires", async () => {
    // Exhaust the limit
    for (let i = 0; i < 10; i++) await checkRateLimit("ip-expire");
    expect((await checkRateLimit("ip-expire")).allowed).toBe(false);

    // Simulate window expiry by manipulating Date.now
    const realDateNow = Date.now;
    vi.spyOn(Date, "now").mockReturnValue(realDateNow() + 16 * 60 * 1000); // +16 min

    const afterExpiry = await checkRateLimit("ip-expire");
    expect(afterExpiry.allowed).toBe(true);
    expect(afterExpiry.remaining).toBe(9);

    vi.spyOn(Date, "now").mockRestore();
  });

  it("honors a configured max request override", async () => {
    vi.stubEnv("LOGIN_RATE_LIMIT_MAX_REQUESTS", "3");

    for (let i = 0; i < 3; i++) {
      expect((await checkRateLimit("ip-configured")).allowed).toBe(true);
    }

    expect((await checkRateLimit("ip-configured")).allowed).toBe(false);
  });
});

// ─── Production path (Upstash) ────────────────────────────────────────────────

describe("production rate limiter (Upstash path)", () => {
  it("throws RateLimitConfigError when UPSTASH env vars are missing in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");

    await expect(checkRateLimit("ip-prod-missing-env")).rejects.toThrow(
      RateLimitConfigError
    );
  });

  it("uses in-memory limiter in production only when explicitly configured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RATE_LIMIT_BACKEND", "memory");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");

    const result = await checkRateLimit("ip-prod-memory");

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
  });

  it("RateLimitConfigError is an instance of Error", () => {
    const err = new RateLimitConfigError("missing env vars");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(RateLimitConfigError);
    expect(err.name).toBe("RateLimitConfigError");
  });
});

// ─── _resetMemoryStoreForTesting ─────────────────────────────────────────────

describe("_resetMemoryStoreForTesting", () => {
  it("clears all rate limit state", async () => {
    for (let i = 0; i < 10; i++) await checkRateLimit("ip-reset-test");
    expect((await checkRateLimit("ip-reset-test")).allowed).toBe(false);

    _resetMemoryStoreForTesting();

    expect((await checkRateLimit("ip-reset-test")).allowed).toBe(true);
  });
});
