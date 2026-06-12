/**
 * Rate limiter — FuelStation OS.
 *
 * Provides a single `checkRateLimit()` function with two implementations
 * selected at runtime based on environment:
 *
 *   development / test
 *     → In-memory fixed-window Map (single-instance, volatile).
 *       Suitable for local dev and deterministic unit tests.
 *       Silent — no warnings emitted.
 *
 *   production / staging
 *     → Upstash Redis sliding-window via @upstash/ratelimit.
 *       Requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.
 *       FAILS CLOSED if env vars are missing: throws RateLimitConfigError
 *       rather than silently degrading to in-memory in production.
 *
 * Default policy: 5 requests per 15-minute sliding window.
 * This matches the M2 in-memory limiter policy.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Unix timestamp (ms) when the current window resets. */
  resetAt: number;
}

export class RateLimitConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateLimitConfigError";
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_REQUESTS = 5;
const WINDOW_SECONDS = 15 * 60; // 15 minutes
const WINDOW_MS = WINDOW_SECONDS * 1000;

// ─── In-memory implementation (dev / test only) ───────────────────────────────

interface MemoryBucket {
  count: number;
  windowStart: number;
}

// Module-level store — reset on process restart.
// Not shared across Node.js instances; acceptable for dev only.
const memoryStore = new Map<string, MemoryBucket>();

function checkRateLimitMemory(identifier: string): RateLimitResult {
  const now = Date.now();
  const bucket = memoryStore.get(identifier);

  if (!bucket || now - bucket.windowStart > WINDOW_MS) {
    // New window
    memoryStore.set(identifier, { count: 1, windowStart: now });
    return {
      allowed: true,
      remaining: MAX_REQUESTS - 1,
      resetAt: now + WINDOW_MS,
    };
  }

  if (bucket.count >= MAX_REQUESTS) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: bucket.windowStart + WINDOW_MS,
    };
  }

  bucket.count += 1;
  return {
    allowed: true,
    remaining: MAX_REQUESTS - bucket.count,
    resetAt: bucket.windowStart + WINDOW_MS,
  };
}

// ─── Upstash implementation (production / staging) ────────────────────────────

// Lazy singleton — only created when first needed in a non-dev environment.
// We use `unknown` here and type-narrow at runtime to avoid importing
// @upstash/ratelimit at the module level (which would fail in test environments
// where the Upstash env vars aren't set).
let _upstashLimiter: unknown = null;
let _upstashInitialised = false;

async function getUpstashLimiter() {
  if (_upstashInitialised) return _upstashLimiter;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new RateLimitConfigError(
      "Rate limiter is not configured. " +
        "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set " +
        "in production/staging environments. " +
        "See .env.local.example for setup instructions."
    );
  }

  // Dynamic import avoids pulling Upstash into the Edge bundle in dev/test
  const { Ratelimit } = await import("@upstash/ratelimit");
  const { Redis } = await import("@upstash/redis");

  _upstashLimiter = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(MAX_REQUESTS, `${WINDOW_SECONDS} s`),
    analytics: false,
    prefix: "fuelstation:rl",
  });
  _upstashInitialised = true;

  return _upstashLimiter;
}

async function checkRateLimitUpstash(identifier: string): Promise<RateLimitResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const limiter = (await getUpstashLimiter()) as any;
  const result = await limiter.limit(identifier);

  return {
    allowed: result.success,
    remaining: result.remaining,
    resetAt: result.reset, // milliseconds epoch from Upstash
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Checks whether the given identifier has exceeded the rate limit.
 *
 * `identifier` should be the IP address for anonymous actions,
 * or `userId:action` for authenticated actions.
 *
 * @throws RateLimitConfigError in production if Upstash env vars are missing.
 */
export async function checkRateLimit(identifier: string): Promise<RateLimitResult> {
  const env = process.env.NODE_ENV;

  if (env === "development" || env === "test") {
    return checkRateLimitMemory(identifier);
  }

  // staging + production: require Upstash (fail closed)
  return checkRateLimitUpstash(identifier);
}

/**
 * Clears the in-memory store.
 * Only available in development/test — used by unit tests to reset state.
 */
export function _resetMemoryStoreForTesting(): void {
  memoryStore.clear();
  _upstashLimiter = null;
  _upstashInitialised = false;
}
