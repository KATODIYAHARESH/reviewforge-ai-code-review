"use client";

import { FOCUS_AREAS, STRICTNESS_LEVELS, type FocusId, type StrictnessId } from "@/schemas/review";

interface ReviewOptionsProps {
  focus: FocusId[];
  onFocusChange: (focus: FocusId[]) => void;
  strictness: StrictnessId;
  onStrictnessChange: (value: StrictnessId) => void;
  disabled?: boolean;
}

export function ReviewOptions({ focus, onFocusChange, strictness, onStrictnessChange, disabled }: ReviewOptionsProps) {
  function toggle(id: FocusId) {
    onFocusChange(focus.includes(id) ? focus.filter((f) => f !== id) : [...focus, id]);
  }

  return (
    <div className="grid gap-5 md:grid-cols-2">
      <fieldset className="space-y-2.5" disabled={disabled}>
        <legend className="mb-2 text-xs font-medium text-zinc-400">Review focus</legend>
        <div className="flex flex-wrap gap-2">
          {FOCUS_AREAS.map((area) => {
            const on = focus.includes(area.id);
            return (
              <button
                key={area.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(area.id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition duration-200 active:scale-[0.97] disabled:opacity-40 ${
                  on
                    ? "border-accent/50 bg-accent/10 text-accent shadow-[0_0_18px_-6px_rgba(198,255,61,0.6)]"
                    : "border-line bg-surface-2 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                }`}
              >
                <span aria-hidden className="mr-1.5 inline-block w-2 text-center">{on ? "✓" : ""}</span>
                {area.label}
              </button>
            );
          })}
        </div>
        {focus.length === 0 && (
          <p role="alert" className="text-xs text-sev-critical">
            Select at least one focus area.
          </p>
        )}
      </fieldset>

      <div className="space-y-2.5">
        <p id="strictness-label" className="mb-2 text-xs font-medium text-zinc-400">
          Strictness
        </p>
        <div
          role="radiogroup"
          aria-labelledby="strictness-label"
          className="grid grid-cols-3 gap-1 rounded-xl border border-line bg-surface-2 p-1"
        >
          {STRICTNESS_LEVELS.map((level) => {
            const on = strictness === level.id;
            return (
              <button
                key={level.id}
                type="button"
                role="radio"
                aria-checked={on}
                aria-describedby={`hint-${level.id}`}
                disabled={disabled}
                onClick={() => onStrictnessChange(level.id)}
                className={`rounded-lg px-2 py-2 text-xs font-semibold transition duration-200 disabled:opacity-40 ${
                  on ? "bg-zinc-100 text-zinc-950 shadow-sm" : "text-zinc-400 hover:text-zinc-100"
                }`}
              >
                {level.label}
                <span id={`hint-${level.id}`} className="sr-only">
                  {level.hint}
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted">{STRICTNESS_LEVELS.find((l) => l.id === strictness)?.hint}</p>
      </div>
    </div>
  );
}
