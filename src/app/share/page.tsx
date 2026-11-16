"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FindingCard } from "@/components/finding-card";
import { ScoreRing } from "@/components/ui/score-ring";
import { SeverityBadge } from "@/components/ui/severity-badge";
import { CopyButton } from "@/components/ui/copy-button";
import { decodeShare, reviewToMarkdown, sortFindings, severityCounts } from "@/lib/review-utils";
import { languageLabel } from "@/lib/languages";
import type { SavedReview } from "@/schemas/review";

type State = { status: "loading" } | { status: "invalid" } | { status: "ready"; review: SavedReview };

export default function SharePage() {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    // The review lives in the URL fragment, so it never reaches the server.
    const fragment = window.location.hash.replace(/^#/, "");
    const review = fragment ? decodeShare(fragment) : null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(review ? { status: "ready", review } : { status: "invalid" });
  }, []);

  if (state.status === "loading") {
    return (
      <main className="mx-auto max-w-4xl px-4 py-16">
        <div className="skeleton h-40 rounded-3xl" aria-label="Loading shared review" />
      </main>
    );
  }

  if (state.status === "invalid") {
    return (
      <main className="mx-auto max-w-lg px-4 py-24 text-center">
        <h1 className="text-2xl font-semibold text-zinc-50">This share link is invalid</h1>
        <p className="mt-3 text-sm text-zinc-400">The link may be incomplete or corrupted. Ask the sender to copy it again.</p>
        <Link href="/" className="btn-accent mt-8">
          Open ReviewForge
        </Link>
      </main>
    );
  }

  const { review } = state;
  const { result } = review;
  const findings = sortFindings(result.findings, "severity");
  const counts = severityCounts(result.findings);
  const markdown = reviewToMarkdown(review);

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className="text-sm font-semibold text-zinc-200">
          Review<span className="text-accent">Forge</span>
        </Link>
        <span className="rounded-full border border-line px-3 py-1 text-xs text-zinc-400">Read-only shared review</span>
      </div>

      <section className="glass rounded-3xl p-6 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <ScoreRing score={result.overallScore} />
          <div className="min-w-0 flex-1 space-y-3">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">{review.name}</h1>
            <p className="font-mono text-xs text-muted">
              {languageLabel(result.detectedLanguage || review.language)} · {review.strictness} · {review.focus.join(", ")} ·{" "}
              {new Date(review.createdAt).toLocaleString()}
            </p>
            <p className="text-[15px] leading-relaxed text-zinc-200">{result.summary}</p>
            <div className="flex flex-wrap gap-2">
              {(["critical", "high", "medium", "low", "info"] as const).map((s) =>
                counts[s] > 0 ? (
                  <span key={s} className="flex items-center gap-1.5">
                    <SeverityBadge severity={s} />
                    <span className="font-mono text-xs text-zinc-400">{counts[s]}</span>
                  </span>
                ) : null,
              )}
            </div>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-2 border-t border-line pt-4">
          <CopyButton text={markdown} label="Copy as Markdown" />
        </div>
      </section>

      <section aria-label="Findings" className="space-y-3">
        {findings.length === 0 ? (
          <p className="glass rounded-2xl p-6 text-center text-sm text-zinc-300">No major issues found.</p>
        ) : (
          findings.map((f, i) => <FindingCard key={`${f.line}-${i}`} finding={f} index={i} />)
        )}
      </section>

      <details className="glass rounded-2xl p-5">
        <summary className="cursor-pointer text-sm font-medium text-zinc-200">Reviewed code</summary>
        <pre className="mt-4 max-h-[420px] overflow-auto rounded-xl bg-[#060708] p-4 font-mono text-[12.5px] leading-6 text-zinc-300">
          <code>{review.code}</code>
        </pre>
      </details>
    </main>
  );
}
