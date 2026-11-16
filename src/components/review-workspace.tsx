"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useObject } from "@ai-sdk/react";
import { CodeEditor } from "@/components/code-editor";
import { ReviewOptions } from "@/components/review-options";
import { ResultsPanel, type ReviewPhase } from "@/components/results-panel";
import { HistorySidebar } from "@/components/history-sidebar";
import { ErrorBanner, type ReviewError } from "@/components/error-banner";
import { useReviewHistory } from "@/hooks/use-review-history";
import { SAMPLE_CODE } from "@/lib/sample";
import { detectLanguage, languageLabel } from "@/lib/languages";
import { encodeShare, reviewToMarkdown, slugify } from "@/lib/review-utils";
import {
  MAX_CODE_CHARS,
  reviewOutputSchema,
  type FocusId,
  type LanguageId,
  type ReviewOutput,
  type ReviewRequest,
  type SavedReview,
  type StrictnessId,
} from "@/schemas/review";

/** Captured from the HTTP response so errors can be classified precisely. */
interface HttpFailure {
  status: number;
  code?: string;
  message?: string;
  retryAfter?: number;
}

const DEFAULT_FOCUS: FocusId[] = ["bugs", "security", "performance", "readability", "best-practices"];

function deriveName(code: string, language: string): string {
  const firstLine = code
    .split("\n")
    .map((l) => l.replace(/^[\s/#*-]+/, "").trim())
    .find((l) => l.length > 0);
  const base = firstLine ? firstLine.slice(0, 48) : `${languageLabel(language)} snippet`;
  return base;
}

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function ReviewWorkspace() {
  /* ---------- form state ---------- */
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState<LanguageId | "auto">("auto");
  const [focus, setFocus] = useState<FocusId[]>(DEFAULT_FOCUS);
  const [strictness, setStrictness] = useState<StrictnessId>("standard");
  const [inlineError, setInlineError] = useState<string | null>(null);

  /* ---------- review state ---------- */
  const [activeReview, setActiveReview] = useState<SavedReview | null>(null);
  const [stopped, setStopped] = useState(false);
  const [banner, setBanner] = useState<ReviewError | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const lastInputRef = useRef<ReviewRequest | null>(null);
  const pendingMetaRef = useRef<{ name: string } | null>(null);
  const failureRef = useRef<HttpFailure | null>(null);

  const history = useReviewHistory();

  /* Tracks HTTP status + body so onError can produce precise messages (no secrets, no stacks). */
  const trackingFetch = useCallback(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    failureRef.current = null;
    const res = await fetch(input, init);
    if (!res.ok) {
      const body: unknown = await res
        .clone()
        .json()
        .catch(() => null);
      const err = (body && typeof body === "object" && "error" in body ? (body as { error?: unknown }).error : null) as
        | { code?: unknown; message?: unknown }
        | null;
      failureRef.current = {
        status: res.status,
        code: typeof err?.code === "string" ? err.code : undefined,
        message: typeof err?.message === "string" ? err.message : undefined,
        retryAfter: Number(res.headers.get("retry-after")) || undefined,
      };
    }
    return res;
  }, []);

  const classifyError = useCallback((err: Error): ReviewError => {
    const f = failureRef.current;
    if (f) {
      if (f.status === 429) return { kind: "rate_limit", title: "Rate limit reached", message: f.message ?? "Too many reviews.", retryAfter: f.retryAfter };
      if (f.status === 503 && f.retryAfter) return { kind: "rate_limit", title: "Provider busy", message: f.message ?? "The AI provider is busy.", retryAfter: f.retryAfter };
      if (f.status === 504 || f.code === "provider_timeout") return { kind: "timeout", title: "", message: f.message ?? "The review took too long. Retry or use a smaller snippet." };
      if (f.status === 400) return { kind: "validation", title: "", message: f.message ?? "The request was rejected." };
      if (f.status === 500 || f.code === "not_configured") return { kind: "config", title: "", message: f.message ?? "The review service is not configured." };
      if (f.status === 403 || f.status === 413) return { kind: "validation", title: "", message: f.message ?? "The request was rejected." };
      if (f.status === 502 || f.status === 503) return { kind: "provider", title: "", message: f.message ?? "The AI provider returned an error. Please retry." };
      return { kind: "unknown", title: "", message: f.message ?? "Unexpected server response. Please retry." };
    }
    if (err.name === "TypeError" || /network|fetch|failed to fetch/i.test(err.message)) {
      return { kind: "network", title: "", message: "Network error. Check your connection and retry." };
    }
    if (err.message === "stream_failed") {
      return { kind: "network", title: "", message: "The connection dropped before the review finished. Retry to run it again." };
    }
    return { kind: "provider", title: "", message: "The review response was incomplete or malformed. Please retry." };
  }, []);

  const { object, submit, isLoading, stop, clear } = useObject<typeof reviewOutputSchema, ReviewOutput, ReviewRequest>({
    api: "/api/review",
    schema: reviewOutputSchema,
    fetch: trackingFetch,
    onError: (err) => {
      if (err.name === "AbortError") return;
      setBanner(classifyError(err));
    },
    onFinish: ({ object: result, error: finishError }) => {
      if (finishError || !result) {
        if (!failureRef.current) {
          setBanner({ kind: "provider", title: "", message: "The review finished but the result could not be validated. Please retry." });
        }
        return;
      }
      const input = lastInputRef.current;
      const meta = pendingMetaRef.current;
      if (!input || !meta) return;
      const review: SavedReview = {
        id: newId(),
        name: meta.name,
        createdAt: Date.now(),
        code: input.code,
        language: input.language,
        focus: input.focus,
        strictness: input.strictness,
        result,
      };
      setActiveReview(review);
      history.add(review);
    },
  });

  /* ---------- derived phase ---------- */
  const phase: ReviewPhase = useMemo(() => {
    if (isLoading) return object ? "streaming" : "loading";
    if (stopped) return "stopped";
    if (activeReview) return "done";
    if (banner) return "error";
    if (submitted && object) return "error";
    return "idle";
  }, [isLoading, object, stopped, activeReview, banner, submitted]);

  const busy = phase === "loading" || phase === "streaming";

  /* ---------- actions ---------- */
  const runReview = useCallback(
    (input: ReviewRequest, name: string) => {
      lastInputRef.current = input;
      pendingMetaRef.current = { name };
      failureRef.current = null;
      setActiveReview(null);
      setStopped(false);
      setBanner(null);
      setShareUrl(null);
      setSubmitted(true);
      clear();
      submit(input);
    },
    [clear, submit],
  );

  const handleSubmit = useCallback(() => {
    if (busy) return;
    const trimmed = code;
    if (trimmed.trim().length === 0) {
      setInlineError("Paste some code to review. Input is empty or only whitespace.");
      return;
    }
    if (trimmed.length > MAX_CODE_CHARS) {
      setInlineError(`Code is too long (${trimmed.length.toLocaleString("en-US")} characters). The limit is ${MAX_CODE_CHARS.toLocaleString("en-US")}.`);
      return;
    }
    if (focus.length === 0) {
      setInlineError("Select at least one review focus.");
      return;
    }
    setInlineError(null);
    const resolvedLanguage: LanguageId = language === "auto" ? detectLanguage(trimmed) : language;
    const input: ReviewRequest = { code: trimmed, language, focus, strictness };
    runReview(input, deriveName(trimmed, resolvedLanguage));
  }, [busy, code, focus, language, strictness, runReview]);

  const handleRegenerate = useCallback(() => {
    if (lastInputRef.current) runReview(lastInputRef.current, pendingMetaRef.current?.name ?? "Review");
  }, [runReview]);

  const handleRetry = useCallback(() => {
    if (lastInputRef.current) runReview(lastInputRef.current, pendingMetaRef.current?.name ?? "Review");
    else handleSubmit();
  }, [runReview, handleSubmit]);

  const handleStop = useCallback(() => {
    stop();
    setStopped(true);
  }, [stop]);

  // Global Ctrl/Cmd+Enter (works even when focus is outside the editor).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleSubmit]);

  function openSaved(review: SavedReview) {
    if (busy) stop();
    setCode(review.code);
    setLanguage(review.language);
    setFocus(review.focus);
    setStrictness(review.strictness);
    clear();
    setStopped(false);
    setBanner(null);
    setInlineError(null);
    setSubmitted(true);
    setShareUrl(null);
    lastInputRef.current = {
      code: review.code,
      language: review.language,
      focus: review.focus,
      strictness: review.strictness,
    };
    pendingMetaRef.current = { name: review.name };
    setActiveReview(review);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleFileLoaded(fileName: string, text: string, detected: LanguageId | null) {
    setCode(text);
    setLanguage(detected ?? "auto");
    setInlineError(text.length > MAX_CODE_CHARS ? `${fileName} is ${text.length.toLocaleString("en-US")} characters. The limit is ${MAX_CODE_CHARS.toLocaleString("en-US")}.` : null);
  }

  function handleShare() {
    if (!activeReview) return;
    const url = `${window.location.origin}/share#${encodeShare(activeReview)}`;
    setShareUrl(url);
    void navigator.clipboard?.writeText(url).catch(() => undefined);
  }

  function handleDownload() {
    if (!activeReview) return;
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slugify(activeReview.name)}-review.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const markdown = activeReview ? reviewToMarkdown(activeReview) : "";

  const resultsForPanel = activeReview?.result ?? null;

  return (
    <section id="main" aria-label="Code review tool" className="relative mx-auto max-w-7xl px-4 pb-16 sm:px-6">
      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <HistorySidebar
          items={history.items}
          activeId={activeReview?.id ?? null}
          onOpen={openSaved}
          onRename={history.rename}
          onDelete={history.remove}
          onClearAll={history.clearAll}
          storageError={history.storageError}
        />

        <div className="flex min-w-0 flex-col gap-6">
          {banner && (
            <ErrorBanner
              error={banner}
              onRetry={banner.kind === "validation" || banner.kind === "config" ? undefined : handleRetry}
              retryDisabled={busy}
              onDismiss={() => setBanner(null)}
            />
          )}

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <div className="glass flex flex-col gap-6 rounded-3xl p-5 sm:p-7">
              <CodeEditor
                value={code}
                onChange={(v) => {
                  setCode(v);
                  if (inlineError) setInlineError(null);
                }}
                language={language}
                onLanguageChange={setLanguage}
                error={inlineError}
                onErrorChange={setInlineError}
                onFileLoaded={handleFileLoaded}
                onLoadSample={() => {
                  setCode(SAMPLE_CODE);
                  setLanguage("auto");
                  setInlineError(null);
                }}
                onSubmitShortcut={handleSubmit}
                disabled={busy}
              />

              <ReviewOptions
                focus={focus}
                onFocusChange={(f) => {
                  setFocus(f);
                  if (f.length > 0 && inlineError?.includes("focus")) setInlineError(null);
                }}
                strictness={strictness}
                onStrictnessChange={setStrictness}
                disabled={busy}
              />

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
                <p className="text-xs text-muted">
                  Reviewing as <span className="text-zinc-300">{language === "auto" ? "auto-detected language" : languageLabel(language)}</span>
                  {" · "}Code is not stored server-side.
                </p>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={busy}
                  aria-keyshortcuts="Control+Enter Meta+Enter"
                  aria-busy={busy}
                  className="btn-accent min-w-40 !py-3 shadow-[0_0_30px_-8px_rgba(198,255,61,0.7)]"
                >
                  {busy ? (
                    <>
                      <span aria-hidden className="size-3.5 animate-spin rounded-full border-2 border-accent-ink/30 border-t-accent-ink" />
                      Reviewing…
                    </>
                  ) : (
                    <>
                      Run review
                      <kbd className="hidden rounded border border-accent-ink/25 px-1.5 font-mono text-[10px] font-normal sm:inline">⌘↵</kbd>
                    </>
                  )}
                </button>
              </div>
            </div>

            <ResultsPanel
              phase={phase}
              partial={object}
              final={resultsForPanel}
              onStop={handleStop}
              onRegenerate={handleRegenerate}
              canRegenerate={submitted}
              markdown={markdown}
              onDownload={handleDownload}
              onShare={handleShare}
              shareUrl={shareUrl}
              onExampleClick={() => {
                setCode(SAMPLE_CODE);
                setLanguage("auto");
                setInlineError(null);
                window.requestAnimationFrame(() => document.getElementById("code-input")?.focus());
              }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
