import { APICallError, streamObject, type ObjectStreamPart } from "ai";
import { buildSystemPrompt, buildUserPrompt } from "@/lib/prompt";
import { resolveModel, LlmConfigError } from "@/lib/llm";
import { checkRateLimit } from "@/lib/rate-limit";
import { corsHeaders, getClientIp, resolveCorsOrigin } from "@/lib/request-guard";
import { reviewOutputSchema, reviewRequestSchema } from "@/schemas/review";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Hard server-side budget for one review. Keep below maxDuration. */
const REVIEW_TIMEOUT_MS = 50_000;
/** Reject oversized bodies before parsing (12k chars of code plus JSON overhead). */
const MAX_BODY_BYTES = 64 * 1024;

type ErrorCode =
  | "invalid_request"
  | "payload_too_large"
  | "forbidden_origin"
  | "rate_limited"
  | "not_configured"
  | "provider_error"
  | "provider_timeout"
  | "internal_error";

function errorResponse(
  req: Request,
  status: number,
  code: ErrorCode,
  message: string,
  extra?: { headers?: Record<string, string>; issues?: Record<string, string[]> },
): Response {
  const { origin } = resolveCorsOrigin(req);
  return Response.json(
    { error: { code, message }, ...(extra?.issues ? { issues: extra.issues } : {}) },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        ...corsHeaders(origin),
        ...extra?.headers,
      },
    },
  );
}

function logError(scope: string, err: unknown): void {
  // Server logs only; never forwarded to the client.
  if (err instanceof Error) {
    console.error(`[review:${scope}] ${err.name}: ${err.message}`);
  } else {
    console.error(`[review:${scope}] unknown error`);
  }
}

export async function OPTIONS(req: Request): Promise<Response> {
  const { allowed, origin } = resolveCorsOrigin(req);
  if (!allowed) return new Response(null, { status: 403 });
  return new Response(null, {
    status: 204,
    headers: { ...corsHeaders(origin), "Cache-Control": "no-store" },
  });
}

export async function POST(req: Request): Promise<Response> {
  /* 1. Origin policy */
  const cors = resolveCorsOrigin(req);
  if (!cors.allowed) {
    return errorResponse(req, 403, "forbidden_origin", "This origin is not allowed to call the review API.");
  }

  /* 2. Rate limit per client IP */
  const rl = await checkRateLimit(getClientIp(req));
  if (!rl.success) {
    return errorResponse(
      req,
      429,
      "rate_limited",
      `Too many reviews. Please wait ${rl.retryAfterSeconds} seconds and try again.`,
      { headers: { "Retry-After": String(rl.retryAfterSeconds) } },
    );
  }

  /* 3. Body size + JSON */
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) {
    return errorResponse(req, 413, "payload_too_large", "The request is too large.");
  }
  let raw: unknown;
  try {
    const text = await req.text();
    if (text.length > MAX_BODY_BYTES) {
      return errorResponse(req, 413, "payload_too_large", "The request is too large.");
    }
    raw = JSON.parse(text);
  } catch {
    return errorResponse(req, 400, "invalid_request", "The request body must be valid JSON.");
  }

  /* 4. Schema validation with human-readable messages */
  const parsed = reviewRequestSchema.safeParse(raw);
  if (!parsed.success) {
    const issues: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "request");
      (issues[key] ??= []).push(issue.message);
    }
    const first = parsed.error.issues[0]?.message ?? "Invalid request.";
    return errorResponse(req, 400, "invalid_request", first, { issues });
  }
  const input = parsed.data;

  /* 5. Provider config (server-only secret) */
  let resolved: ReturnType<typeof resolveModel>;
  try {
    resolved = resolveModel();
  } catch (err) {
    if (err instanceof LlmConfigError) {
      logError("config", err);
    }
    return errorResponse(req, 500, "not_configured", "The review service is not configured. Please contact the site owner.");
  }

  /* 6. Start the structured stream with a combined timeout + client-abort signal */
  const timeoutSignal = AbortSignal.timeout(REVIEW_TIMEOUT_MS);
  const signal = AbortSignal.any([req.signal, timeoutSignal]);
  const { prompt } = buildUserPrompt(input.code);

  let parts: AsyncIterator<ObjectStreamPart<unknown>>;
  try {
    const result = streamObject({
      model: resolved.model,
      schema: reviewOutputSchema,
      schemaName: "code_review",
      schemaDescription: "Structured code review findings",
      system: buildSystemPrompt(input),
      prompt,
      temperature: 0.2,
      maxOutputTokens: 4000,
      maxRetries: 1,
      abortSignal: signal,
    });
    // Prevent unhandled rejections if the final object fails validation after streaming.
    result.object.catch(() => undefined);
    // fullStream (not textStream) surfaces provider errors as 'error' parts instead of
    // silently ending the stream.
    parts = result.fullStream[Symbol.asyncIterator]();
  } catch (err) {
    logError("start", err);
    return errorResponse(req, 502, "provider_error", "The AI provider could not start the review. Please retry.");
  }

  /** Returns the next text delta, null when the stream ends, and throws on provider errors. */
  async function nextText(): Promise<string | null> {
    for (;;) {
      const part = await parts.next();
      if (part.done) return null;
      const value = part.value;
      if (value.type === "error") throw value.error;
      if (value.type === "text-delta") return value.textDelta;
    }
  }

  /* 7. Read the first delta before responding so provider failures get a real status code */
  let firstText: string | null;
  try {
    firstText = await nextText();
  } catch (err) {
    return mapProviderError(req, err, timeoutSignal.aborted, signal.aborted);
  }
  if (firstText === null) {
    return errorResponse(req, 502, "provider_error", "The AI provider returned an empty response. Please retry.");
  }

  /* 8. Stream the raw JSON text deltas that useObject consumes */
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(firstText));
      void pump(controller);
    },
    async cancel() {
      await parts.return?.().catch(() => undefined);
    },
  });

  async function pump(controller: ReadableStreamDefaultController<Uint8Array>) {
    try {
      for (;;) {
        const text = await nextText();
        if (text === null) break;
        controller.enqueue(encoder.encode(text));
      }
      controller.close();
    } catch (err) {
      // Mid-stream failure: error the body so the client shows a retry banner.
      // Details stay on the server.
      logError("stream", err);
      controller.error(new Error("stream_failed"));
    }
  }

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Review-Provider": resolved.provider,
      ...corsHeaders(cors.origin),
    },
  });
}

function mapProviderError(req: Request, err: unknown, timedOut: boolean, aborted: boolean): Response {
  if (timedOut || (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError"))) {
    if (timedOut) {
      logError("timeout", err);
      return errorResponse(req, 504, "provider_timeout", "The review took too long. Try a smaller snippet or retry.");
    }
    // Client aborted; nothing useful to send back.
    return new Response(null, { status: 499 });
  }
  if (aborted) return new Response(null, { status: 499 });
  if (APICallError.isInstance(err)) {
    logError(`provider:${err.statusCode ?? "unknown"}`, err);
    if (err.statusCode === 429) {
      return errorResponse(req, 503, "provider_error", "The AI provider is busy right now. Please retry in a moment.", {
        headers: { "Retry-After": "10" },
      });
    }
    return errorResponse(req, 502, "provider_error", "The AI provider returned an error. Please retry.");
  }
  logError("provider", err);
  return errorResponse(req, 502, "provider_error", "The AI provider returned an error. Please retry.");
}
