/**
 * Recent search keywords, kept client-side only. These are the buyer's own typed
 * terms — nothing here is priced or resolved, so localStorage is safe (unlike
 * catalogue data, which must always come from the backend per pricing group).
 */

const SEARCH_HISTORY_KEY = "watani.search.history";

/** How many keywords are retained; the oldest fall off the end. */
export const SEARCH_HISTORY_LIMIT = 10;

export function readSearchHistory(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SEARCH_HISTORY_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .slice(0, SEARCH_HISTORY_LIMIT);
  } catch {
    // Storage unavailable or corrupt (private mode, quota, hand-edited value) —
    // history is a convenience, so degrade to "no history" rather than throw.
    return [];
  }
}

/**
 * Moves `term` to the front, de-duplicated case-insensitively so "Zaatar" after
 * "zaatar" refreshes the existing entry instead of adding a near-duplicate.
 * Returns the new list so callers can update state without a second read.
 */
export function pushSearchHistory(term: string): string[] {
  const trimmed = term.trim();
  if (!trimmed) return readSearchHistory();

  const existing = readSearchHistory().filter(
    (entry) => entry.toLowerCase() !== trimmed.toLowerCase(),
  );
  const next = [trimmed, ...existing].slice(0, SEARCH_HISTORY_LIMIT);

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(next));
    } catch {
      // Non-fatal, as above.
    }
  }
  return next;
}

export function clearSearchHistory(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(SEARCH_HISTORY_KEY);
  } catch {
    // Non-fatal, as above.
  }
}

/** Removes a single keyword (the per-row ✕ in the dropdown). */
export function removeSearchHistory(term: string): string[] {
  const next = readSearchHistory().filter(
    (entry) => entry.toLowerCase() !== term.trim().toLowerCase(),
  );
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(next));
    } catch {
      // Non-fatal, as above.
    }
  }
  return next;
}
