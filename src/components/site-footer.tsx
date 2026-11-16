const STEPS = [
  {
    n: "01",
    title: "Paste or upload",
    body: "Drop in up to 12,000 characters or a source file. Language is auto-detected and overridable.",
  },
  {
    n: "02",
    title: "Pick your lens",
    body: "Choose focus areas (bugs, security, performance, readability, best practices) and how ruthless to be.",
  },
  {
    n: "03",
    title: "Watch it stream",
    body: "Each finding arrives as a card with severity, the exact line, the reason, and a copy-ready fix.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" aria-labelledby="how-heading" className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
      <div className="mb-10 max-w-2xl">
        <p className="font-mono text-xs uppercase tracking-widest text-accent">How it works</p>
        <h2 id="how-heading" className="mt-3 text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
          From pasted snippet to merge-ready notes in one pass.
        </h2>
      </div>
      <ol className="grid gap-4 md:grid-cols-3">
        {STEPS.map((s) => (
          <li key={s.n} className="glass rounded-2xl p-6 transition duration-300 hover:-translate-y-0.5 hover:border-zinc-600">
            <span className="font-mono text-xs text-accent">{s.n}</span>
            <h3 className="mt-3 text-lg font-semibold text-zinc-50">{s.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">{s.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 text-sm text-zinc-500 sm:px-6 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <p className="font-semibold text-zinc-200">
            Review<span className="text-accent">Forge</span>
          </p>
          <p className="max-w-sm text-xs leading-relaxed">
            Privacy: your code is sent to the configured AI provider to produce the review. ReviewForge does not store code on its servers. History and shared links live in your browser or in the URL fragment.
          </p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
          <a href="#main" className="transition hover:text-zinc-200">Tool</a>
          <a href="#how" className="transition hover:text-zinc-200">How it works</a>
          <a href="/share" className="transition hover:text-zinc-200">Shared review</a>
        </nav>
        <p className="font-mono text-[11px] text-zinc-600">© {new Date().getFullYear()} ReviewForge</p>
      </div>
    </footer>
  );
}
