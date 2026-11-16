import { describe, expect, it } from "vitest";
import { MAX_CODE_CHARS, reviewOutputSchema, reviewRequestSchema } from "@/schemas/review";

const valid = {
  code: "const x = 1;",
  language: "javascript",
  focus: ["bugs"],
  strictness: "standard",
};

function firstMessage(input: unknown): string | undefined {
  const r = reviewRequestSchema.safeParse(input);
  return r.success ? undefined : r.error.issues[0]?.message;
}

describe("reviewRequestSchema", () => {
  it("accepts a valid request", () => {
    expect(reviewRequestSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects empty input with a human-readable message", () => {
    expect(firstMessage({ ...valid, code: "" })).toMatch(/Paste some code/);
  });

  it("rejects whitespace-only input", () => {
    expect(firstMessage({ ...valid, code: "   \n\t  " })).toMatch(/only whitespace/);
  });

  it("accepts exactly the maximum length and rejects one more character", () => {
    expect(reviewRequestSchema.safeParse({ ...valid, code: "a".repeat(MAX_CODE_CHARS) }).success).toBe(true);
    expect(firstMessage({ ...valid, code: "a".repeat(MAX_CODE_CHARS + 1) })).toMatch(/too long/);
  });

  it("rejects languages outside the allowlist", () => {
    expect(firstMessage({ ...valid, language: "brainfuck" })).toMatch(/Unsupported language/);
  });

  it("rejects unknown focus values and empty focus lists", () => {
    expect(firstMessage({ ...valid, focus: ["vibes"] })).toMatch(/Unsupported review focus/);
    expect(firstMessage({ ...valid, focus: [] })).toMatch(/at least one review focus/);
  });

  it("de-duplicates focus values", () => {
    const r = reviewRequestSchema.parse({ ...valid, focus: ["bugs", "bugs", "security"] });
    expect(r.focus).toEqual(["bugs", "security"]);
  });

  it("rejects unknown strictness levels", () => {
    expect(firstMessage({ ...valid, strictness: "brutal" })).toMatch(/Unsupported strictness/);
  });

  it("rejects non-string code", () => {
    expect(reviewRequestSchema.safeParse({ ...valid, code: 42 }).success).toBe(false);
  });
});

describe("reviewOutputSchema", () => {
  const finding = {
    severity: "high",
    category: "security",
    title: "SQL injection",
    line: 7,
    endLine: 7,
    explanation: "User input is concatenated.",
    fixDescription: "Use a parameterised query.",
    fixBefore: "db.query('x' + id)",
    fixAfter: "db.query('x = $1', [id])",
  };

  it("accepts a well-formed review", () => {
    const r = reviewOutputSchema.safeParse({
      overallScore: 72,
      summary: "Solid. Fix the injection.",
      detectedLanguage: "TypeScript",
      findings: [finding],
    });
    expect(r.success).toBe(true);
  });

  it("accepts a clean review with no findings", () => {
    expect(
      reviewOutputSchema.safeParse({ overallScore: 96, summary: "No major issues found.", detectedLanguage: "Go", findings: [] }).success,
    ).toBe(true);
  });

  it("rejects an unknown severity", () => {
    const r = reviewOutputSchema.safeParse({
      overallScore: 50,
      summary: "x",
      detectedLanguage: "Go",
      findings: [{ ...finding, severity: "blocker" }],
    });
    expect(r.success).toBe(false);
  });

  it("rejects non-integer scores", () => {
    expect(
      reviewOutputSchema.safeParse({ overallScore: 72.5, summary: "x", detectedLanguage: "Go", findings: [] }).success,
    ).toBe(false);
  });
});
