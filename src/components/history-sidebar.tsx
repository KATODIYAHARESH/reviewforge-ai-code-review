"use client";

import { useState } from "react";
import type { SavedReview } from "@/schemas/review";
import { languageLabel } from "@/lib/languages";
import { HISTORY_LIMIT } from "@/hooks/use-review-history";

interface HistorySidebarProps {
  items: SavedReview[];
  activeId: string | null;
  onOpen: (review: SavedReview) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
  storageError: string | null;
}

export function HistorySidebar({ items, activeId, onOpen, onRename, onDelete, onClearAll, storageError }: HistorySidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  function startEdit(r: SavedReview) {
    setEditingId(r.id);
    setDraft(r.name);
  }

  function commit(id: string) {
    onRename(id, draft);
    setEditingId(null);
  }

  return (
    <aside aria-labelledby="history-heading" className="glass flex max-h-[70vh] flex-col rounded-3xl lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)]">
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3.5">
        <h2 id="history-heading" className="text-sm font-semibold text-zinc-100">
          History
          <span className="ml-2 font-mono text-[11px] font-normal text-muted">
            {items.length}/{HISTORY_LIMIT}
          </span>
        </h2>
        {items.length > 0 && (
          <button
            type="button"
            onClick={() => {
              if (window.confirm("Delete all saved reviews from this browser?")) onClearAll();
            }}
            className="text-xs text-muted transition hover:text-sev-critical"
          >
            Clear all
          </button>
        )}
      </div>

      {storageError && <p role="alert" className="border-b border-line px-4 py-2 text-xs text-sev-medium">{storageError}</p>}

      {items.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <p className="text-sm text-zinc-400">No reviews yet.</p>
          <p className="mt-1 text-xs text-muted">Your last 20 reviews are kept in this browser only.</p>
        </div>
      ) : (
        <ul className="flex-1 space-y-1 overflow-y-auto p-2" aria-label="Saved reviews">
          {items.map((r) => {
            const active = r.id === activeId;
            const editing = editingId === r.id;
            return (
              <li
                key={r.id}
                className={`group rounded-xl border p-2.5 transition duration-200 ${
                  active ? "border-accent/40 bg-accent/[0.06]" : "border-transparent hover:border-line hover:bg-surface-2/60"
                }`}
              >
                {editing ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      commit(r.id);
                    }}
                    className="flex gap-1.5"
                  >
                    <label className="sr-only" htmlFor={`rename-${r.id}`}>
                      Rename review
                    </label>
                    <input
                      id={`rename-${r.id}`}
                      autoFocus
                      value={draft}
                      maxLength={120}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="field !py-1 !text-xs"
                    />
                    <button type="submit" className="btn-accent !px-2 !py-1 text-xs">
                      Save
                    </button>
                  </form>
                ) : (
                  <div className="flex items-start gap-2">
                    <button
                      type="button"
                      onClick={() => onOpen(r)}
                      aria-current={active ? "true" : undefined}
                      className="min-w-0 flex-1 text-left"
                    >
                      <span className="block truncate text-sm font-medium text-zinc-100">{r.name}</span>
                      <span className="mt-0.5 block font-mono text-[11px] text-muted">
                        {new Date(r.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        {" · "}
                        {languageLabel(r.language)} · {r.result.overallScore}/100
                      </span>
                    </button>
                    <div className="flex shrink-0 gap-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
                      <button type="button" onClick={() => startEdit(r)} aria-label={`Rename ${r.name}`} className="rounded-md p-1 text-muted hover:bg-zinc-800 hover:text-zinc-100">
                        <svg aria-hidden viewBox="0 0 20 20" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.6">
                          <path d="M12.5 4.5l3 3L7 16H4v-3z" strokeLinejoin="round" />
                        </svg>
                      </button>
                      <button type="button" onClick={() => onDelete(r.id)} aria-label={`Delete ${r.name}`} className="rounded-md p-1 text-muted hover:bg-zinc-800 hover:text-sev-critical">
                        <svg aria-hidden viewBox="0 0 20 20" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.6">
                          <path d="M4 6h12M8 6V4h4v2M6 6l1 10h6l1-10" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
