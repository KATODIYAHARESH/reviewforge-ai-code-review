import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export interface RateLimitResult {
  success: boolean;
  /** Seconds until the window resets (for Retry-After). */
  retryAfterSeconds: number;
  limit: number;
  remaining: number;
}

const LIMIT = Number(process.env.RATE_LIMIT_PER_MINUTE ?? 10);
const WINDOW_MS = 60_000;

/* ---------- In-memory fallback (sliding window log, per instance) ---------- */

const memoryHits = new Map<string, number[]>();
let lastSweep = 0;

function memoryLimit(identifier: string, now = Date.now()): RateLimitResult {
  if (now - lastSweep > WINDOW_MS) {
    lastSweep = now;
    for (const [key, hits] of memoryHits) {
      const fresh = hits.filter((t) => now - t < WINDOW_MS);
      if (fresh.length === 0) memoryHits.delete(key);
      else memoryHits.set(key, fresh);
    }
  }
  const hits = (memoryHits.get(identifier) ?? []).filter((t) => now - t < WINDOW_MS);
  if (hits.length >= LIMIT) {
    const oldest = hits[0] ?? now;
    memoryHits.set(identifier, hits);
    return {
      success: false,
      retryAfterSeconds: Math.max(1, Math.ceil((oldest + WINDOW_MS - now) / 1000)),
      limit: LIMIT,
      remaining: 0,
    };
  }
  hits.push(now);
  memoryHits.set(identifier, hits);
  return {
    success: true,
    retryAfterSeconds: 0,
    limit: LIMIT,
    remaining: LIMIT - hits.length,
  };
}

/* ---------- Upstash (production, shared across instances) ---------- */

let upstash: Ratelimit | null | undefined;

function getUpstash(): Ratelimit | null {
  if (upstash !== undefined) return upstash;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  upstash =
    url && token
      ? new Ratelimit({
          redis: new Redis({ url, token }),
          limiter: Ratelimit.slidingWindow(LIMIT, "1 m"),
          prefix: "reviewforge:rl",
        })
      : null;
  return upstash;
}

/** Checks the per-IP limit. Falls back to memory if Upstash is unset or errors. */
export async function checkRateLimit(identifier: string): Promise<RateLimitResult> {
  const client = getUpstash();
  if (!client) return memoryLimit(identifier);
  try {
    const res = await client.limit(identifier);
    return {
      success: res.success,
      retryAfterSeconds: Math.max(1, Math.ceil((res.reset - Date.now()) / 1000)),
      limit: res.limit,
      remaining: res.remaining,
    };
  } catch (err) {
    console.error("[rate-limit] Upstash unavailable, using memory fallback", err instanceof Error ? err.message : err);
    return memoryLimit(identifier);
  }
}
