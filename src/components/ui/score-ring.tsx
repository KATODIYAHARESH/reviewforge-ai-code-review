import { scoreTone } from "@/lib/review-utils";

const TONE_COLOR = {
  good: "var(--color-accent)",
  warn: "var(--color-sev-medium)",
  bad: "var(--color-sev-critical)",
} as const;

export function ScoreRing({ score, size = 96 }: { score: number | null; size?: number }) {
  const value = score === null ? 0 : Math.max(0, Math.min(100, score));
  const r = size / 2 - 7;
  const c = 2 * Math.PI * r;
  const tone = score === null ? "warn" : scoreTone(value);
  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={score === null ? "Score pending" : `Overall score ${value} out of 100`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#232831" strokeWidth={6} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={TONE_COLOR[tone]}
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (value / 100) * c}
          style={{
            transition: "stroke-dashoffset 700ms cubic-bezier(0.2,0.7,0.2,1), stroke 300ms",
            filter: `drop-shadow(0 0 8px ${TONE_COLOR[tone]}55)`,
          }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center">
          <div className="font-mono text-2xl font-semibold tabular-nums text-zinc-50">
            {score === null ? "–" : value}
          </div>
          <div className="-mt-0.5 font-mono text-[10px] uppercase tracking-widest text-muted">/100</div>
        </div>
      </div>
    </div>
  );
}
