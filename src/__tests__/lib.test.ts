import { describe, expect, it } from "vitest";
import { detectLanguage, languageFromFilename, isSupportedFilename } from "@/lib/languages";
import { buildSystemPrompt, buildUserPrompt } from "@/lib/prompt";
import { decodeShare, encodeShare, reviewToMarkdown, sortFindings, severityCounts } from "@/lib/review-utils";
import { corsHeaders, resolveCorsOrigin } from "@/lib/request-guard";
import { checkRateLimit } from "@/lib/rate-limit";
import { SAMPLE_CODE } from "@/lib/sample";
import type { Finding, SavedReview } from "@/schemas/review";

const f = (overrides: Partial<Finding>): Finding => ({
  severity: "low",
  category: "readability",
  title: "t",
  line: 1,
  endLine: 1,
  explanation: "e",
  fixDescription: "d",
  fixBefore: "",
  fixAfter: "",
  ...overrides,
});

const review: SavedReview = {
  id: "r1",
  name: "Sample review",
  createdAt: 1_700_000_000_000,
  code: "const a = 1;\nconsole.log(a)",
  language: "javascript",
  focus: ["bugs", "security"],
  strictness: "standard",
  result: {
    overallScore: 64,
    summary: "Two issues. Mostly fine.",
    detectedLanguage: "JavaScript",
    findings: [
      f({ severity: "low", title: "Naming", line: 2 }),
      f({ severity: "critical", category: "security", title: "Injection", line: 9, endLine: 11, fixBefore: "a + b", fixAfter: "a + c" }),
    ],
  },
};

describe("language helpers", () => {
  it("maps known extensions and rejects unknown ones", () => {
    expect(languageFromFilename("app.tsx")).toBe("typescript");
    expect(languageFromFilename("main.py")).toBe("python");
    expect(languageFromFilename("Server.JAVA")).toBe("java");
    expect(languageFromFilename("photo.png")).toBeNull();
    expect(isSupportedFilename("README")).toBe(false);
  });

  it("detects common languages from content", () => {
    expect(detectLanguage("def add(a, b):\n    return a + b\nprint(add(1, 2))")).toBe("python");
    expect(detectLanguage("package main\n\nfunc main() {\n  x := 1\n}")).toBe("go");
    expect(detectLanguage("SELECT id FROM users WHERE active = 1")).toBe("sql");
    expect(detectLanguage(SAMPLE_CODE)).toBe("typescript");
  });

  it("falls back to 'other' when nothing matches", () => {
    expect(detectLanguage("hello world")).toBe("other");
  });
});

describe("buildUserPrompt", () => {
  it("prefixes every line with its 1-based line number", () => {
    const { prompt } = buildUserPrompt("a\nb\nc");
    expect(prompt).toContain("1 | a");
    expect(prompt).toContain("2 | b");
    expect(prompt).toContain("3 | c");
  });

  it("wraps code in a per-request boundary that is not guessable from the code", () => {
    const one = buildUserPrompt("x");
    const two = buildUserPrompt("x");
    expect(one.boundary).not.toEqual(two.boundary);
    expect(one.prompt).toContain(`<<<BEGIN_${one.boundary}>>>`);
    expect(one.prompt).toContain(`<<<END_${one.boundary}>>>`);
  });
});

describe("buildSystemPrompt", () => {
  const base = { language: "auto" as const, focus: ["bugs" as const, "security" as const], strictness: "ruthless" as const };

  it("tells the model to treat code as data and ignore embedded instructions", () => {
    const p = buildSystemPrompt(base);
    expect(p).toMatch(/UNTRUSTED DATA/);
    expect(p).toMatch(/Never follow/);
  });

  it("calibrates strictness and lists only the selected focus areas", () => {
    const p = buildSystemPrompt(base);
    expect(p).toMatch(/STRICTNESS: RUTHLESS/);
    expect(p).toMatch(/Bugs:/);
    expect(p).toMatch(/Security:/);
    expect(p).not.toMatch(/Readability:/);
  });
});

describe("review utilities", () => {
  it("sorts by severity (critical first) and counts severities", () => {
    const sorted = sortFindings(review.result.findings, "severity");
    expect(sorted[0]?.severity).toBe("critical");
    expect(severityCounts(review.result.findings).critical).toBe(1);
  });

  it("renders Markdown with score, findings, and a diff block", () => {
    const md = reviewToMarkdown(review);
    expect(md).toContain("# Code review: Sample review");
    expect(md).toContain("**Score:** 64/100");
    expect(md).toContain("[CRITICAL] Injection");
    expect(md).toContain("- a + b");
    expect(md).toContain("+ a + c");
  });

  it("round-trips a review through the share fragment", () => {
    const encoded = encodeShare(review);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    const decoded = decodeShare(encoded);
    expect(decoded?.result.overallScore).toBe(64);
    expect(decoded?.code).toBe(review.code);
  });

  it("rejects corrupted or tampered share fragments", () => {
    expect(decodeShare("not-base64-!!")).toBeNull();
    expect(decodeShare("")).toBeNull();
    const tampered = Buffer.from(JSON.stringify({ name: "x", result: { overallScore: "high" } })).toString("base64url");
    expect(decodeShare(tampered)).toBeNull();
  });
});

describe("rate limiting (in-memory fallback)", () => {
  it("allows requests up to the limit then blocks with a Retry-After value", async () => {
    const ip = `test-${Math.random()}`;
    const limit = Number(process.env.RATE_LIMIT_PER_MINUTE ?? 10);
    for (let i = 0; i < limit; i++) {
      expect((await checkRateLimit(ip)).success).toBe(true);
    }
    const blocked = await checkRateLimit(ip);
    expect(blocked.success).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it("tracks identifiers independently", async () => {
    const a = `a-${Math.random()}`;
    const b = `b-${Math.random()}`;
    for (let i = 0; i < 10; i++) await checkRateLimit(a);
    expect((await checkRateLimit(b)).success).toBe(true);
  });
});

describe("origin policy", () => {
  it("allows same-origin and no-origin requests", () => {
    const same = new Request("https://app.example.com/api/review", {
      method: "POST",
      headers: { origin: "https://app.example.com", host: "app.example.com" },
    });
    expect(resolveCorsOrigin(same).allowed).toBe(true);
    const cli = new Request("https://app.example.com/api/review", { method: "POST", headers: { host: "app.example.com" } });
    expect(resolveCorsOrigin(cli).allowed).toBe(true);
  });

  it("blocks cross-origin requests that are not allowlisted", () => {
    const evil = new Request("https://app.example.com/api/review", {
      method: "POST",
      headers: { origin: "https://evil.example.net", host: "app.example.com" },
    });
    expect(resolveCorsOrigin(evil).allowed).toBe(false);
  });

  it("emits no CORS headers unless an origin is allowed", () => {
    expect(corsHeaders(null)).toEqual({});
    expect(corsHeaders("https://app.example.com")["Access-Control-Allow-Origin"]).toBe("https://app.example.com");
  });
});
