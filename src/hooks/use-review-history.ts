"use client";

import { useCallback, useEffect, useState } from "react";
import { savedReviewSchema, type SavedReview } from "@/schemas/review";

export const HISTORY_KEY = "reviewforge.history.v1";
export const HISTORY_LIMIT = 20;

function readStorage(): SavedReview[] {
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    // Drop anything that no longer validates instead of crashing the UI.
    return data
      .map((item) => savedReviewSchema.safeParse(item))
      .filter((r) => r.success)
      .map((r) => r.data)
      .slice(0, HISTORY_LIMIT);
  } catch {
    return [];
  }
}

function writeStorage(items: SavedReview[]): boolean {
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, HISTORY_LIMIT)));
    return true;
  } catch {
    // Quota exceeded or storage disabled.
    return false;
  }
}

/** Client-side review history (localStorage, capped at 20 entries). */
export function useReviewHistory() {
  const [items, setItems] = useState<SavedReview[]>([]);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);

  useEffect(() => {
    // Hydrate from localStorage after mount to avoid SSR mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(readStorage());
    setReady(true);
  }, []);

  const persist = useCallback((next: SavedReview[]) => {
    setItems(next);
    if (!writeStorage(next)) {
      setStorageError("Could not save history. Browser storage may be full or disabled.");
    } else {
      setStorageError(null);
    }
  }, []);

  const add = useCallback(
    (review: SavedReview) => {
      setItems((prev) => {
        const next = [review, ...prev.filter((r) => r.id !== review.id)].slice(0, HISTORY_LIMIT);
        writeStorage(next);
        return next;
      });
    },
    [],
  );

  const rename = useCallback(
    (id: string, name: string) => {
      const trimmed = name.trim().slice(0, 120);
      if (!trimmed) return;
      persist(items.map((r) => (r.id === id ? { ...r, name: trimmed } : r)));
    },
    [items, persist],
  );

  const remove = useCallback(
    (id: string) => {
      persist(items.filter((r) => r.id !== id));
    },
    [items, persist],
  );

  const clearAll = useCallback(() => persist([]), [persist]);

  return { items, ready, storageError, add, rename, remove, clearAll };
}
