"use client";

import Image from "next/image";
import { Clock, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { SEARCH_MIN_CHARS, productImageSrc, searchProducts } from "@/lib/products";
import type { Product } from "@/lib/types";

/** Keystrokes settle for this long before a request goes out. */
const DEBOUNCE_MS = 250;

export type SuggestionsState = {
    items: Product[];
    loading: boolean;
    /** True once a request has resolved for the current query with no matches. */
    empty: boolean;
};

/** Debounced type-ahead lookup; each keystroke aborts the previous fetch to avoid out-of-order results. */
export function useSearchSuggestions(query: string): SuggestionsState {
    // Only the resolved response lives in state, tagged with the query it answers.
    // `loading`/`empty` are derived below, so no effect ever has to reset them.
    const [result, setResult] = useState<{ query: string; items: Product[] } | null>(
        null,
    );
    const controllerRef = useRef<AbortController | null>(null);
    const trimmed = query.trim();

    useEffect(() => {
        const needle = query.trim();

        controllerRef.current?.abort();
        if (needle.length < SEARCH_MIN_CHARS) return;

        const timer = setTimeout(async () => {
            const controller = new AbortController();
            controllerRef.current = controller;
            try {
                const items = await searchProducts(needle, 6, controller.signal);
                setResult({query: needle, items});
            } catch {
                // Aborted by a newer keystroke - that request's effect owns the state.
            }
        }, DEBOUNCE_MS);

        return () => clearTimeout(timer);
    }, [query]);

    // Abort whatever is in flight when the field unmounts.
    useEffect(() => () => controllerRef.current?.abort(), []);

    if (trimmed.length < SEARCH_MIN_CHARS) {
        return {items: [], loading: false, empty: false};
    }

    // A response for an older query is stale - treat it as still loading.
    const fresh = result?.query === trimmed ? result : null;
    if (!fresh) return {items: [], loading: true, empty: false};

    return {items: fresh.items, loading: false, empty: fresh.items.length === 0};
}

/** Suggestion dropdown; implements the ARIA combobox pattern via `aria-activedescendant`. */
export function SearchSuggestions({
                                      id,
                                      state,
                                      query,
                                      activeIndex,
                                      onSelect,
                                  }: {
    id: string;
    state: SuggestionsState;
    query: string;
    activeIndex: number;
    onSelect: (product: Product) => void;
}) {
    const {items, loading, empty} = state;
    const tooShort = query.trim().length < SEARCH_MIN_CHARS;

    if (tooShort) return null;
    if (loading && items.length === 0) {
        return (
            <div className="search-panel" role="status">
                <p className="px-4 py-3 text-[14px] text-muted">Searching…</p>
            </div>
        );
    }
    if (empty && items.length === 0) {
        return (
            <div className="search-panel" role="status">
                <p className="px-4 py-3 text-[14px] text-muted">
                    No products match “{query.trim()}”.
                </p>
            </div>
        );
    }
    if (items.length === 0) return null;

    return (
        <div className="search-panel">
            <ul id={id} role="listbox" aria-label="Product suggestions">
                {items.map((product, index) => (
                    <li
                        key={product.id}
                        id={`${id}-option-${index}`}
                        role="option"
                        aria-selected={index === activeIndex}
                        // Mouse-down fires before the input's blur, so the panel is still
                        // mounted when the selection is handled.
                        onMouseDown={(event) => {
                            event.preventDefault();
                            onSelect(product);
                        }}
                        className={`flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors ${
                            index === activeIndex ? "bg-soft-control" : "hover:bg-soft-control"
                        }`}
                    >
                        <Image
                            src={productImageSrc(product.image)}
                            alt=""
                            width={48}
                            height={48}
                            className="size-12 shrink-0 rounded-lg object-contain"
                        />
                        <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-semibold text-teal-950">
                {product.name}
              </span>
              <span className="block truncate text-[12px] text-muted">
                {product.unit}
              </span>
            </span>
                        <span className="shrink-0 text-[14px] font-bold text-teal-950">
              ${product.priceMajor}.{product.priceMinor}
            </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

/**
 * Recent-keyword panel shown on focus while the field is empty, so a fresh search
 * starts from what the buyer looked for last. Rendered instead of — never
 * alongside — SearchSuggestions, which owns the panel once there is a query.
 */
export function SearchHistoryPanel({
  id,
  terms,
  activeIndex,
  onSelect,
  onRemove,
  onClear,
}: {
  id: string;
  terms: string[];
  activeIndex: number;
  onSelect: (term: string) => void;
  onRemove: (term: string) => void;
  onClear: () => void;
}) {
  if (terms.length === 0) return null;

  return (
    <div className="search-panel">
      <div className="flex items-center justify-between px-4 pb-1 pt-3">
        <span className="text-[12px] font-bold uppercase tracking-wider text-muted">
          Recent searches
        </span>
        <button
          type="button"
          // Mouse-down, not click — the input's blur would unmount the panel first.
          onMouseDown={(event) => {
            event.preventDefault();
            onClear();
          }}
          className="text-[12px] font-semibold text-muted transition-colors hover:text-teal-950"
        >
          Clear all
        </button>
      </div>
      <ul id={id} role="listbox" aria-label="Recent searches" className="pb-1">
        {terms.map((term, index) => (
          <li
            key={term}
            id={`${id}-option-${index}`}
            role="option"
            aria-selected={index === activeIndex}
            onMouseDown={(event) => {
              event.preventDefault();
              onSelect(term);
            }}
            className={`flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors ${
              index === activeIndex ? "bg-soft-control" : "hover:bg-soft-control"
            }`}
          >
            <Clock className="size-4 shrink-0 text-muted" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-[14px] text-teal-950">
              {term}
            </span>
            <button
              type="button"
              aria-label={`Remove “${term}” from recent searches`}
              onMouseDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onRemove(term);
              }}
              className="grid size-6 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-white hover:text-teal-950"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
