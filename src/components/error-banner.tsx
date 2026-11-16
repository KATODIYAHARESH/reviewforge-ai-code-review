"use client";

export type ReviewErrorKind = "network" | "rate_limit" | "provider" | "timeout" | "validation" | "config" | "unknown";

export interface ReviewError {
  kind: ReviewErrorKind;
  title: string;
  message: string;
  retryAfter?: number;
}

const TITLES: Record<ReviewErrorKind, string> = {
  network: "Connection problem",
  rate_limit: "Slow down a little",
  provider: "The AI provider failed",
  timeout: "The review timed out",
  validation: "Check your input",
  config: "Service unavailable",
  unknown: "Something went wrong",
};

export function ErrorBanner({
  error,
  onRetry,
  onDismiss,
  retryDisabled,
}: {
  error: ReviewError;
  onRetry?: () => void;
  onDismiss: () => void;
  retryDisabled?: boolean;
}) {
  return (
    <div
      role="alert"
      className="animate-fade-up flex flex-col gap-3 rounded-2xl border border-sev-critical/35 bg-sev-critical/[0.07] p-4 sm:flex-row sm:items-center"
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span aria-hidden className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-sev-critical/15 font-bold text-sev-critical">
          !
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-100">{error.title || TITLES[error.kind]}</p>
          <p className="mt-0.5 text-sm text-zinc-300">
            {error.message}
            {error.kind === "rate_limit" && error.retryAfter ? ` Try again in ${error.retryAfter}s.` : ""}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        {onRetry && (
          <button type="button" onClick={onRetry} disabled={retryDisabled} className="btn-ghost !border-sev-critical/40 !py-1.5 text-xs">
            Retry
          </button>
        )}
        <button type="button" onClick={onDismiss} className="btn-ghost !py-1.5 text-xs" aria-label="Dismiss error">
          Dismiss
        </button>
      </div>
    </div>
  );
}
