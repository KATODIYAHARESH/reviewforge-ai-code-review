import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Constants (allowlists shared by client + server)                    */
/* ------------------------------------------------------------------ */

export const MAX_CODE_CHARS = 12_000;

export const LANGUAGES = [
  { id: "auto", label: "Auto-detect" },
  { id: "javascript", label: "JavaScript" },
  { id: "typescript", label: "TypeScript" },
  { id: "python", label: "Python" },
  { id: "java", label: "Java" },
  { id: "cpp", label: "C++" },
  { id: "c", label: "C" },
  { id: "csharp", label: "C#" },
  { id: "go", label: "Go" },
  { id: "rust", label: "Rust" },
  { id: "ruby", label: "Ruby" },
  { id: "php", label: "PHP" },
  { id: "kotlin", label: "Kotlin" },
  { id: "swift", label: "Swift" },
  { id: "sql", label: "SQL" },
  { id: "shell", label: "Shell" },
  { id: "other", label: "Other" },
] as const;

export const LANGUAGE_IDS = LANGUAGES.map((l) => l.id) as [
  (typeof LANGUAGES)[number]["id"],
  ...(typeof LANGUAGES)[number]["id"][],
];

export const FOCUS_AREAS = [
  { id: "bugs", label: "Bugs" },
  { id: "security", label: "Security" },
  { id: "performance", label: "Performance" },
  { id: "readability", label: "Readability" },
  { id: "best-practices", label: "Best Practices" },
] as const;

export const FOCUS_IDS = FOCUS_AREAS.map((f) => f.id) as [
  (typeof FOCUS_AREAS)[number]["id"],
  ...(typeof FOCUS_AREAS)[number]["id"][],
];

export const STRICTNESS_LEVELS = [
  { id: "chill", label: "Chill", hint: "Only clear, real problems" },
  { id: "standard", label: "Standard", hint: "Balanced, production-minded" },
  { id: "ruthless", label: "Ruthless", hint: "Nitpicks included, no mercy" },
] as const;

export const STRICTNESS_IDS = STRICTNESS_LEVELS.map((s) => s.id) as [
  (typeof STRICTNESS_LEVELS)[number]["id"],
  ...(typeof STRICTNESS_LEVELS)[number]["id"][],
];

export const SEVERITIES = ["critical", "high", "medium", "low", "info"] as const;
export const CATEGORIES = [
  "bug",
  "security",
  "performance",
  "readability",
  "best-practice",
] as const;

export type LanguageId = (typeof LANGUAGE_IDS)[number];
export type FocusId = (typeof FOCUS_IDS)[number];
export type StrictnessId = (typeof STRICTNESS_IDS)[number];
export type Severity = (typeof SEVERITIES)[number];
export type Category = (typeof CATEGORIES)[number];

/* ------------------------------------------------------------------ */
/* Request schema (client -> /api/review)                              */
/* ------------------------------------------------------------------ */

export const reviewRequestSchema = z.object({
  code: z
    .string({ error: "Code is required." })
    .refine((v) => v.trim().length > 0, {
      message: "Paste some code to review. Input is empty or only whitespace.",
    })
    .refine((v) => v.length <= MAX_CODE_CHARS, {
      message: `Code is too long. The limit is ${MAX_CODE_CHARS.toLocaleString("en-US")} characters.`,
    }),
  language: z.enum(LANGUAGE_IDS, {
    error: "Unsupported language selected.",
  }),
  focus: z
    .array(z.enum(FOCUS_IDS, { error: "Unsupported review focus selected." }))
    .min(1, { message: "Select at least one review focus." })
    .max(FOCUS_IDS.length)
    .transform((arr) => Array.from(new Set(arr))),
  strictness: z.enum(STRICTNESS_IDS, {
    error: "Unsupported strictness level selected.",
  }),
});

export type ReviewRequest = z.infer<typeof reviewRequestSchema>;

/* ------------------------------------------------------------------ */
/* Output schema (streamed by the LLM via streamObject)                */
/* ------------------------------------------------------------------ */

export const findingSchema = z.object({
  severity: z.enum(SEVERITIES),
  category: z.enum(CATEGORIES),
  title: z.string().describe("Short headline, max 10 words."),
  line: z
    .number()
    .int()
    .describe("1-based line number where the problem starts, taken from the line-number prefixes."),
  endLine: z
    .number()
    .int()
    .describe("1-based last line of the problem. Equal to line for single-line issues."),
  explanation: z
    .string()
    .describe("Why this is a problem and what can go wrong. 1-3 sentences."),
  fixDescription: z.string().describe("One sentence describing the fix."),
  fixBefore: z
    .string()
    .describe("The exact original snippet (lines from the code, without line-number prefixes)."),
  fixAfter: z.string().describe("The corrected replacement snippet. Empty string if no code change applies."),
});

export const reviewOutputSchema = z.object({
  overallScore: z
    .number()
    .int()
    .describe("0-100. 100 = exemplary production code; lower = more or worse issues."),
  summary: z.string().describe("Exactly two short sentences summarising the review."),
  detectedLanguage: z.string().describe("Language name, e.g. 'TypeScript'."),
  findings: z.array(findingSchema).describe("Empty array when the code has no real issues."),
});

export type Finding = z.infer<typeof findingSchema>;
export type ReviewOutput = z.infer<typeof reviewOutputSchema>;

/* ------------------------------------------------------------------ */
/* Persisted review (history + share links)                            */
/* ------------------------------------------------------------------ */

export const savedReviewSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(120),
  createdAt: z.number().int(),
  code: z.string().max(MAX_CODE_CHARS),
  language: z.enum(LANGUAGE_IDS),
  focus: z.array(z.enum(FOCUS_IDS)).min(1),
  strictness: z.enum(STRICTNESS_IDS),
  result: reviewOutputSchema,
});

export type SavedReview = z.infer<typeof savedReviewSchema>;
