import Link from "next/link";
import { SeverityBadge } from "@/components/ui/severity-badge";

export function LandingHero() {
  return (
    <header className="relative overflow-hidden">
      {/* Ambient glow (no blue; lime + ember only) */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-accent/[0.08] blur-[120px]" />
        <div className="absolute top-24 right-[-10%] h-[380px] w-[480px] rounded-full bg-accent-hot/[0.07] blur-[110px]" />
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage: "radial-gradient(ellipse at top, black 20%, transparent 70%)",
          }}
        />
      </div>

      <nav aria-label="Primary" className="relative mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6">
        <Link href="/" className="group flex items-center gap-2.5" aria-label="ReviewForge home">
          <span aria-hidden className="grid size-8 place-items-center rounded-lg bg-accent text-accent-ink shadow-[0_0_24px_-4px_rgba(198,255,61,0.8)] transition group-hover:scale-105">
            <svg viewBox="0 0 24 24" className="size-4.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <path d="M5 7l5 5-5 5M12 17h7" />
            </svg>
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-zinc-50">
            Review<span className="text-accent">Forge</span>
          </span>
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <a href="#how" className="hidden text-zinc-400 transition hover:text-zinc-100 sm:inline">
            How it works
          </a>
          <a href="#main" className="btn-ghost !py-1.5 text-xs">
            Open the tool
          </a>
        </div>
      </nav>

      <div className="relative mx-auto grid max-w-7xl gap-12 px-4 pt-10 pb-14 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:pt-16 lg:pb-20">
        <div className="animate-fade-up space-y-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/80 px-3 py-1 text-xs text-zinc-300">
            <span aria-hidden className="size-1.5 rounded-full bg-accent shadow-[0_0_10px_var(--color-accent)]" />
            Structured AI code review · findings stream live
          </span>
          <h1 className="text-[clamp(2.4rem,6vw,4.25rem)] leading-[1.02] font-semibold tracking-[-0.03em] text-zinc-50">
            Review code like a <span className="text-gradient-accent">principal engineer</span> is watching.
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-zinc-400 sm:text-lg">
            Paste a snippet, choose what matters, and get line-accurate findings with severity, a concrete fix, and an honest score in seconds.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <a href="#main" className="btn-accent !px-5 !py-3">
              Start a review
              <span aria-hidden>→</span>
            </a>
            <p className="text-xs text-muted">Free to try · Code is not stored server-side</p>
          </div>
          <dl className="grid max-w-md grid-cols-3 gap-4 pt-4 text-sm">
            <div>
              <dt className="text-xs text-muted">Languages</dt>
              <dd className="font-mono text-zinc-100">16+</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Input limit</dt>
              <dd className="font-mono text-zinc-100">12k chars</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Output</dt>
              <dd className="font-mono text-zinc-100">Typed JSON</dd>
            </div>
          </dl>
        </div>

        {/* Product preview card */}
        <div className="glow-ring glass relative animate-fade-up rounded-3xl p-5 [animation-delay:120ms] sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex gap-1.5" aria-hidden>
              <span className="size-2.5 rounded-full bg-zinc-700" />
              <span className="size-2.5 rounded-full bg-zinc-700" />
              <span className="size-2.5 rounded-full bg-zinc-700" />
            </div>
            <span className="font-mono text-[11px] text-muted">review.stream</span>
          </div>
          <div className="flex items-center gap-4 rounded-2xl border border-line bg-surface/80 p-4">
            <div className="grid size-16 shrink-0 place-items-center rounded-full border-[5px] border-accent/80 font-mono text-xl font-semibold text-zinc-50 shadow-[0_0_30px_-6px_rgba(198,255,61,0.6)]">
              72
            </div>
            <p className="text-sm leading-relaxed text-zinc-300">
              Solid structure, but two injection risks and an off-by-one in the loop need fixing before merge.
            </p>
          </div>
          <ul className="mt-3 space-y-3">
            <li className="rounded-2xl border border-line bg-surface/70 p-4">
              <div className="mb-2 flex items-center gap-2">
                <SeverityBadge severity="critical" />
                <span className="font-mono text-[11px] text-muted">Security · L7</span>
              </div>
              <p className="text-sm font-medium text-zinc-100">SQL built by string concatenation</p>
              <pre className="mt-3 overflow-hidden rounded-lg bg-[#080a0d] p-3 font-mono text-[11.5px] leading-5">
                <div className="bg-sev-critical/[0.08] text-zinc-400">
                  <span className="text-sev-critical">- </span>db.query(&quot;SELECT * FROM users WHERE id = &quot; + id)
                </div>
                <div className="bg-accent/[0.08] text-zinc-100">
                  <span className="text-accent">+ </span>db.query(&quot;SELECT * FROM users WHERE id = $1&quot;, [id])
                </div>
              </pre>
            </li>
            <li className="rounded-2xl border border-line bg-surface/70 p-4 opacity-70">
              <div className="mb-2 flex items-center gap-2">
                <SeverityBadge severity="medium" />
                <span className="font-mono text-[11px] text-muted">Bugs · L13</span>
              </div>
              <div className="skeleton h-3.5 w-3/4 rounded" />
            </li>
          </ul>
        </div>
      </div>
    </header>
  );
}
