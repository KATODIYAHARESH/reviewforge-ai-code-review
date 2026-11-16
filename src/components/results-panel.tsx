"use client";

import { useMemo, useState } from "react";
import { FindingCard, CATEGORY_LABEL } from "@/components/finding-card";
import { ScoreRing } from "@/components/ui/score-ring";
import { SEVERITY_LABEL, SeverityBadge } from "@/components/ui/severity-badge";
import { CopyButton } from "@/components/ui/copy-button";
import { severityCounts, sortFindings } from "@/lib/review-utils";
import { CATEGORIES, SEVERITIES, type Category, type Finding, type ReviewOutput, type Severity } from "@/schemas/review";

/** Shape of a partially streamed object (every field may be missing). */
export interface PartialReview {
  overallScore?: number;
  summary?: string;
  detectedLanguage?: string;
  findings?: Array<Partial<Finding> | undefined>;
}

export type ReviewPhase = "idle" | "loading" | "streaming" | "done" | "stopped" | "error";

interface ResultsPanelProps {
  phase: ReviewPhase;
  partial: PartialReview | undefined;
  final: ReviewOutput | null;
  onStop: () => void;
  onRegenerate: () => void;
  canRegenerate: boolean;
  markdown: string | null;
  onDownload: () => void;
  onShare: () => void;
  shareUrl: string | null;
  onExampleClick: () => void;
}

function isComplete(f: Partial<Finding> | undefined): f is Finding {
  return Boolean(
    f &&
      f.severity &&
      f.category &&
      f.title &&
      typeof f.line === "number" &&
      typeof f.endLine === "number" &&
      f.explanation &&
      f.fixDescription &&
      typeof f.fixBefore === "string" &&
      typeof f.fixAfter === "string",
  );
}

const SORTS = [
  { id: "severity", label: "Severity" },
  { id: "line", label: "Line" },
  { id: "category", label: "Category" },
] as const;

export function ResultsPanel(props: ResultsPanelProps) {
  const { phase, partial, final, onStop, onRegenerate, canRegenerate, markdown, onDownload, onShare, shareUrl, onExampleClick } = props;
  const [severityFilter, setSeverityFilter] = useState<Severity | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<Category | "all">("all");
  const [sortBy, setSortBy] = useState<(typeof SORTS)[number]["id"]>("severity");

  const streamingFindings = useMemo(
    () => (partial?.findings ?? []).filter(isComplete),
    [partial],
  );
  const pendingCount = (partial?.findings?.length ?? 0) - streamingFindings.length;

  // Use the final result when done; otherwise render partial findings as they arrive.
  const findings: Finding[] = final ? final.findings : streamingFindings;
  const visible = useMemo(() => {
    const filtered = findings.filter(
      (f) => (severityFilter === "all" || f.severity === severityFilter) && (categoryFilter === "all" || f.category === categoryFilter),
    );
    return sortFindings(filtered, sortBy);
  }, [findings, severityFilter, categoryFilter, sortBy]);

  const counts = severityCounts(findings);
  const score = final?.overallScore ?? partial?.overallScore ?? null;
  const summary = final?.summary ?? partial?.summary ?? "";
  const busy = phase === "loading" || phase === "streaming";

  if (phase === "idle") {
    return (
      <section aria-labelledby="results-heading" className="glass flex h-full min-h-[480px] flex-col rounded-3xl p-6 sm:p-8">
        <h2 id="results-heading" className="sr-only">
          Review results
        </h2>
        <div className="my-auto mx-auto max-w-md text-center">
          <div aria-hidden className="mx-auto mb-5 grid size-14 place-items-center rounded-2xl border border-accent/30 bg-accent/10 text-accent shadow-[0_0_40px_-10px_rgba(198,255,61,0.6)]">
            <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M4 6h10M4 12h16M4 18h8" strokeLinecap="round" />
              <circle cx="18" cy="6" r="2.5" fill="currentColor" stroke="none" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-zinc-50">Your review appears here</h3>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            Findings stream in as cards, each with a severity, the exact line, and a concrete fix you can copy.
          </p>
          <div className="mt-6 rounded-2xl border border-line bg-[#080a0d] p-4 text-left">
            <p className="mb-2 font-mono text-[11px] uppercase tracking-widest text-muted">Example finding</p>
            <div className="flex flex-wrap items-center gap-2">
              <SeverityBadge severity="critical" />
              <span className="text-xs text-zinc-400">Security · L7</span>
            </div>
            <p className="mt-2 text-sm font-medium text-zinc-100">SQL injection via string concatenation</p>
            <p className="mt-1 text-xs text-zinc-500">User input is concatenated into the query, so an attacker can rewrite it.</p>
          </div>
          <button type="button" onClick={onExampleClick} className="btn-accent mt-6">
            Try the sample
          </button>
          <p className="mt-3 text-xs text-muted">Shortcut: Ctrl/Cmd + Enter runs the review.</p>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="results-heading" aria-busy={busy} className="glass flex flex-col gap-5 rounded-3xl p-5 sm:p-7">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 id="results-heading" className="text-lg font-semibold text-zinc-50">
            Review
          </h2>
          {phase === "streaming" && (
            <span role="status" className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">
              <span aria-hidden className="flex gap-0.5">
                <span className="size-1 animate-pulse-dot rounded-full bg-accent" />
                <span className="size-1 animate-pulse-dot rounded-full bg-accent [animation-delay:150ms]" />
                <span className="size-1 animate-pulse-dot rounded-full bg-accent [animation-delay:300ms]" />
              </span>
              Streaming findings…
            </span>
          )}
          {phase === "done" && (
            <span role="status" className="rounded-full border border-line px-2.5 py-1 text-xs text-zinc-400">
              Complete · {findings.length} finding{findings.length === 1 ? "" : "s"}
            </span>
          )}
          {phase === "stopped" && (
            <span role="status" className="rounded-full border border-sev-medium/40 bg-sev-medium/10 px-2.5 py-1 text-xs text-sev-medium">
              Stopped · partial results, not saved to history
            </span>
          )}
          {phase === "error" && (
            <span role="status" className="rounded-full border border-sev-critical/40 bg-sev-critical/10 px-2.5 py-1 text-xs text-sev-critical">
              Review failed · see the banner above
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {busy && (
            <button type="button" onClick={onStop} className="btn-ghost border-sev-critical/40 text-sev-critical hover:border-sev-critical">
              <span aria-hidden className="size-2.5 rounded-[2px] bg-current" />
              Stop generating
            </button>
          )}
          {!busy && canRegenerate && (
            <button type="button" onClick={onRegenerate} className="btn-ghost">
              <svg aria-hidden viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M16 9a6 6 0 1 0-1.8 4.3M16 4v5h-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Regenerate
            </button>
          )}
        </div>
      </header>

      {/* Score + summary */}
      <div className="flex flex-col gap-5 rounded-2xl border border-line bg-surface/70 p-5 sm:flex-row sm:items-center">
        {phase === "loading" && !partial ? (
          <div className="flex w-full items-center gap-5" aria-label="Loading review">
            <div className="skeleton size-24 shrink-0 rounded-full" />
            <div className="w-full space-y-2.5">
              <div className="skeleton h-4 w-3/4 rounded" />
              <div className="skeleton h-4 w-1/2 rounded" />
            </div>
          </div>
        ) : (
          <>
            <ScoreRing score={score} />
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-xs font-medium uppercase tracking-widest text-muted">
                Overall score{partial?.detectedLanguage || final?.detectedLanguage ? ` · ${final?.detectedLanguage ?? partial?.detectedLanguage}` : ""}
              </p>
              {summary ? (
                <p className="text-[15px] leading-relaxed text-zinc-200 animate-fade-up">{summary}</p>
              ) : (
                <div className="space-y-2" aria-hidden>
                  <div className="skeleton h-3.5 w-full rounded" />
                  <div className="skeleton h-3.5 w-2/3 rounded" />
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Filters */}
      {(findings.length > 0 || pendingCount > 0) && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by severity">
            <FilterChip active={severityFilter === "all"} onClick={() => setSeverityFilter("all")} label={`All ${findings.length}`} />
            {SEVERITIES.map((s) =>
              counts[s] > 0 ? (
                <FilterChip
                  key={s}
                  active={severityFilter === s}
                  onClick={() => setSeverityFilter(s)}
                  label={`${SEVERITY_LABEL[s]} ${counts[s]}`}
                  tone={s}
                />
              ) : null,
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-zinc-400">
              Category
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as Category | "all")}
                className="field !w-auto !py-1.5 !text-xs"
              >
                <option value="all">All categories</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABEL[c]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs text-zinc-400">
              Sort by
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as (typeof SORTS)[number]["id"])} className="field !w-auto !py-1.5 !text-xs">
                {SORTS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      )}

      {/* Findings */}
      <div className="space-y-3" aria-live="polite" aria-relevant="additions">
        {phase === "loading" && findings.length === 0 && (
          <div className="space-y-3" aria-hidden>
            {[0, 1, 2].map((i) => (
              <div key={i} className="glass space-y-3 rounded-2xl p-5">
                <div className="flex gap-2">
                  <div className="skeleton h-5 w-16 rounded-md" />
                  <div className="skeleton h-5 w-24 rounded-md" />
                </div>
                <div className="skeleton h-4 w-2/3 rounded" />
                <div className="skeleton h-3 w-full rounded" />
                <div className="skeleton h-16 w-full rounded-xl" />
              </div>
            ))}
          </div>
        )}

        {phase === "done" && final && final.findings.length === 0 && (
          <div className="animate-fade-up rounded-2xl border border-accent/25 bg-accent/[0.05] p-6 text-center">
            <p className="text-base font-semibold text-accent">No major issues found</p>
            <p className="mt-1 text-sm text-zinc-400">Nothing in the selected focus areas needs attention. Nice work.</p>
          </div>
        )}

        {visible.map((f, i) => (
          <FindingCard key={`${f.line}-${f.title}-${i}`} finding={f} index={i} streaming={busy} />
        ))}

        {visible.length === 0 && findings.length > 0 && (
          <p className="rounded-xl border border-line p-4 text-center text-sm text-zinc-400">No findings match these filters.</p>
        )}

        {busy && pendingCount > 0 && (
          <div className="skeleton h-20 rounded-2xl" aria-hidden />
        )}
      </div>

      {/* Export + share */}
      {phase === "done" && final && (
        <footer className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <span className="mr-auto text-xs text-muted">Export</span>
          <CopyButton text={markdown ?? ""} label="Copy as Markdown" />
          <button type="button" onClick={onDownload} className="btn-ghost !px-2.5 !py-1.5 text-xs">
            Download .md
          </button>
          <button type="button" onClick={onShare} className="btn-ghost !px-2.5 !py-1.5 text-xs">
            {shareUrl ? "Link copied" : "Copy share link"}
          </button>
        </footer>
      )}
    </section>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  tone?: Severity;
}) {
  const toneClass = tone
    ? {
        critical: "text-sev-critical",
        high: "text-sev-high",
        medium: "text-sev-medium",
        low: "text-sev-low",
        info: "text-sev-info",
      }[tone]
    : "text-zinc-200";
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-full border px-3 py-1 font-mono text-[11px] font-medium transition duration-200 ${
        active ? `border-current bg-current/10 ${toneClass}` : "border-line text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
      } ${active ? toneClass : ""}`}
    >
      {label}
    </button>
  );
}
