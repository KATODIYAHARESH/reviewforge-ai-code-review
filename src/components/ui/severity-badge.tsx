import type { Finding } from "@/schemas/review";

const STYLES: Record<Finding["severity"], string> = {
  critical: "border-sev-critical/40 bg-sev-critical/10 text-sev-critical",
  high: "border-sev-high/40 bg-sev-high/10 text-sev-high",
  medium: "border-sev-medium/40 bg-sev-medium/10 text-sev-medium",
  low: "border-sev-low/40 bg-sev-low/10 text-sev-low",
  info: "border-sev-info/40 bg-sev-info/10 text-sev-info",
};

export function SeverityBadge({ severity }: { severity: Finding["severity"] }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wider ${STYLES[severity]}`}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {severity}
    </span>
  );
}

export const SEVERITY_LABEL: Record<Finding["severity"], string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  info: "Info",
};
