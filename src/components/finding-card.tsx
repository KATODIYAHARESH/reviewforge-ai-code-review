import type { Finding } from "@/schemas/review";
import { CopyButton } from "@/components/ui/copy-button";
import { SeverityBadge } from "@/components/ui/severity-badge";

export const CATEGORY_LABEL: Record<Finding["category"], string> = {
  bug: "Bug",
  security: "Security",
  performance: "Performance",
  readability: "Readability",
  "best-practice": "Best practice",
};

const SEV_BAR: Record<Finding["severity"], string> = {
  critical: "bg-sev-critical",
  high: "bg-sev-high",
  medium: "bg-sev-medium",
  low: "bg-sev-low",
  info: "bg-sev-info",
};

function plainText(f: Finding): string {
  const range = f.endLine !== f.line ? `${f.line}-${f.endLine}` : `${f.line}`;
  return [
    `[${f.severity.toUpperCase()}] ${f.title} (${CATEGORY_LABEL[f.category]}, line ${range})`,
    f.explanation,
    `Fix: ${f.fixDescription}`,
    f.fixAfter ? `\n${f.fixAfter}` : "",
  ].join("\n");
}

export function FindingCard({ finding, index, streaming = false }: { finding: Finding; index: number; streaming?: boolean }) {
  const range = finding.endLine !== finding.line ? `L${finding.line}–${finding.endLine}` : `L${finding.line}`;
  const beforeLines = finding.fixBefore ? finding.fixBefore.split("\n") : [];
  const afterLines = finding.fixAfter ? finding.fixAfter.split("\n") : [];

  return (
    <article
      aria-label={`Finding ${index + 1}: ${finding.title}, ${finding.severity}`}
      className="glass group relative animate-fade-up overflow-hidden rounded-2xl transition duration-300 hover:border-zinc-600"
    >
      <span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${SEV_BAR[finding.severity]}`} />
      <div className="space-y-4 p-5 pl-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <SeverityBadge severity={finding.severity} />
              <span className="rounded-md border border-line bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-zinc-300">
                {CATEGORY_LABEL[finding.category]}
              </span>
              <span className="font-mono text-[11px] text-muted" title="Line reference">
                <span className="sr-only">Line </span>
                {range}
              </span>
            </div>
            <h3 className="text-[15px] font-semibold leading-snug text-zinc-50">{finding.title}</h3>
          </div>
          <CopyButton text={plainText(finding)} label="Copy finding" />
        </header>

        <p className="text-sm leading-relaxed text-zinc-300">{finding.explanation}</p>

        <div className="space-y-2">
          <p className="text-xs font-medium text-zinc-400">
            <span className="text-accent">Fix:</span> {finding.fixDescription}
          </p>
          {(beforeLines.length > 0 || afterLines.length > 0) && (
            <div className="overflow-hidden rounded-xl border border-line bg-[#080a0d]">
              <div className="flex items-center justify-between border-b border-line px-3 py-1.5">
                <span className="font-mono text-[11px] text-muted">suggested change</span>
                <CopyButton text={finding.fixAfter || finding.fixBefore} label="Copy fix" className="!py-1" />
              </div>
              <pre className="max-h-72 overflow-auto py-2 font-mono text-[12.5px] leading-6">
                {beforeLines.map((l, i) => (
                  <div key={`b${i}`} className="flex bg-sev-critical/[0.07] px-3 text-zinc-300">
                    <span aria-hidden className="w-4 shrink-0 select-none text-sev-critical">-</span>
                    <code className="whitespace-pre">{l || " "}</code>
                  </div>
                ))}
                {afterLines.map((l, i) => (
                  <div key={`a${i}`} className="flex bg-accent/[0.07] px-3 text-zinc-100">
                    <span aria-hidden className="w-4 shrink-0 select-none text-accent">+</span>
                    <code className="whitespace-pre">{l || " "}</code>
                  </div>
                ))}
              </pre>
            </div>
          )}
          {streaming && <span className="sr-only">Still streaming…</span>}
        </div>
      </div>
    </article>
  );
}
