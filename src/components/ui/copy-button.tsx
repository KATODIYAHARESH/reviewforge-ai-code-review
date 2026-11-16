"use client";

import { useEffect, useState } from "react";

export function CopyButton({
  text,
  label = "Copy",
  className = "",
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "copied" | "error">("idle");

  useEffect(() => {
    if (state === "idle") return;
    const t = window.setTimeout(() => setState("idle"), 1800);
    return () => window.clearTimeout(t);
  }, [state]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("error");
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={state === "copied" ? "Copied to clipboard" : label}
      className={`btn-ghost !px-2.5 !py-1.5 text-xs ${className}`}
    >
      {state === "copied" ? (
        <>
          <svg aria-hidden viewBox="0 0 20 20" className="size-3.5 text-accent" fill="currentColor">
            <path d="M7.6 13.4 4.2 10l-1.2 1.2 4.6 4.6L16 7.4l-1.2-1.2z" />
          </svg>
          Copied
        </>
      ) : state === "error" ? (
        "Copy failed"
      ) : (
        <>
          <svg aria-hidden viewBox="0 0 20 20" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.6">
            <rect x="6" y="6" width="10" height="10" rx="2" />
            <path d="M4 12V5a1 1 0 0 1 1-1h7" />
          </svg>
          {label}
        </>
      )}
    </button>
  );
}
