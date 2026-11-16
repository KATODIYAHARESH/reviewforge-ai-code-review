/** Extracts a best-effort client IP for rate limiting. */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

function allowedOrigins(): string[] {
  return (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}

/**
 * Origin policy:
 * - Same-origin requests (Origin host equals Host header) are allowed.
 * - Additional origins must be listed in ALLOWED_ORIGINS.
 * - Requests with no Origin header (server-to-server, curl) are allowed; they
 *   still pass through rate limiting and validation.
 */
export function resolveCorsOrigin(req: Request): { allowed: boolean; origin: string | null } {
  const origin = req.headers.get("origin");
  if (!origin) return { allowed: true, origin: null };

  const host = req.headers.get("host");
  try {
    const parsed = new URL(origin);
    if (host && parsed.host === host) return { allowed: true, origin };
  } catch {
    return { allowed: false, origin: null };
  }
  if (allowedOrigins().includes(origin)) return { allowed: true, origin };
  return { allowed: false, origin: null };
}

export function corsHeaders(origin: string | null): Record<string, string> {
  if (!origin) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}
