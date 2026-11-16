import { LANGUAGE_IDS, type LanguageId } from "@/schemas/review";

/** File extensions accepted by the upload control, mapped to a language id. */
export const EXTENSION_TO_LANGUAGE: Record<string, LanguageId> = {
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  ts: "typescript",
  tsx: "typescript",
  py: "python",
  java: "java",
  cpp: "cpp",
  cc: "cpp",
  cxx: "cpp",
  hpp: "cpp",
  h: "c",
  c: "c",
  cs: "csharp",
  go: "go",
  rs: "rust",
  rb: "ruby",
  php: "php",
  kt: "kotlin",
  swift: "swift",
  sql: "sql",
  sh: "shell",
  bash: "shell",
};

export const ACCEPTED_FILE_EXTENSIONS = Object.keys(EXTENSION_TO_LANGUAGE);

export const MAX_UPLOAD_BYTES = 512 * 1024;

export function languageFromFilename(name: string): LanguageId | null {
  const dot = name.lastIndexOf(".");
  if (dot < 0) return null;
  const ext = name.slice(dot + 1).toLowerCase();
  return EXTENSION_TO_LANGUAGE[ext] ?? null;
}

export function isSupportedFilename(name: string): boolean {
  return languageFromFilename(name) !== null;
}

/**
 * Lightweight heuristic language detection used for the "Auto-detect" hint.
 * The model also reports the detected language; this only pre-selects the UI.
 * Returns "other" when nothing matches confidently.
 */
export function detectLanguage(code: string): LanguageId {
  const sample = code.slice(0, 4000);
  const rules: Array<[LanguageId, RegExp[]]> = [
    ["typescript", [/:\s*(string|number|boolean|unknown)\b/, /\binterface\s+\w+\s*\{/, /\bas\s+const\b/]],
    ["javascript", [/\bconst\s+\w+\s*=/, /\bfunction\s+\w+\s*\(/, /=>/, /\bconsole\.log\(/, /\brequire\(/]],
    ["python", [/^\s*def\s+\w+\s*\(.*\):/m, /^\s*import\s+\w+/m, /\bprint\(/, /^\s*elif\b/m]],
    ["java", [/\bpublic\s+(static\s+)?(void|class)\b/, /System\.out\.println/]],
    ["cpp", [/#include\s*<\w+>/, /\bstd::/, /\bcout\s*<</]],
    ["c", [/#include\s*<stdio\.h>/, /\bprintf\(/, /\bmalloc\(/]],
    ["csharp", [/\busing\s+System/, /\bConsole\.WriteLine/]],
    ["go", [/^package\s+\w+/m, /\bfunc\s+\w+\(/, /:=/]],
    ["rust", [/\bfn\s+\w+\s*\(/, /\blet\s+mut\b/, /println!\(/]],
    ["ruby", [/^\s*def\s+\w+\s*$/m, /\bend\s*$/m, /puts\s/]],
    ["php", [/<\?php/, /\$\w+\s*=/]],
    ["kotlin", [/\bfun\s+\w+\s*\(/, /\bval\s+\w+\s*[:=]/]],
    ["swift", [/\bfunc\s+\w+\s*\(.*\)\s*->/, /\bguard\s+let\b/]],
    ["sql", [/\b(SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM|CREATE\s+TABLE)\b[\s\S]*\b(FROM|INTO|SET|TABLE|WHERE)\b/i]],
    ["shell", [/^#!\/bin\/(ba)?sh/m, /\becho\s+\$/]],
  ];
  for (const [lang, patterns] of rules) {
    const hits = patterns.filter((p) => p.test(sample)).length;
    // TypeScript-only syntax (type annotations, interfaces) is decisive on its own.
    const threshold = lang === "typescript" || patterns.length === 1 ? 1 : 2;
    if (hits >= threshold) return lang;
  }
  return "other";
}

export function languageLabel(id: string): string {
  const map: Record<string, string> = {
    auto: "Auto-detect",
    javascript: "JavaScript",
    typescript: "TypeScript",
    python: "Python",
    java: "Java",
    cpp: "C++",
    c: "C",
    csharp: "C#",
    go: "Go",
    rust: "Rust",
    ruby: "Ruby",
    php: "PHP",
    kotlin: "Kotlin",
    swift: "Swift",
    sql: "SQL",
    shell: "Shell",
    other: "Other",
  };
  return LANGUAGE_IDS.includes(id as LanguageId) ? (map[id] ?? id) : id;
}
