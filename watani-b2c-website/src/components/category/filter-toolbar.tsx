"use client";

import {useEffect, useId, useLayoutEffect, useRef, useState} from "react";
import {createPortal} from "react-dom";
import {AnimatePresence, motion, useReducedMotion} from "framer-motion";
import {Check, ChevronDown, SlidersHorizontal, X} from "lucide-react";
import {motionTokens, sec} from "@/lib/motion";

/**
 * Filter toolbar (design.md §9) - dropdown popovers plus an "All Filters" sheet
 * (right on desktop, bottom on mobile). Selected filters show as removable chips.
 */

/** Dropdown rows visible before the popover starts scrolling. */
const MAX_VISIBLE_OPTIONS = 10;

/** Popover never narrower than this, even for a short trigger button. */
const MIN_PANEL_WIDTH = 210;

export type FilterOption = { value: string; label: string };

/**
 * A facet's selection: a single value, or an array when the facet is `multi`.
 * Single-select facets keep the plain-string shape they've always had.
 */
export type FilterValue = string | string[] | undefined;

export type DropdownSpec = {
    key: string;
    label: string;
    options: FilterOption[];
    /** Filled green rather than outlined - used for the leading category control. */
    filled?: boolean;
    /** Selections accumulate instead of replacing; value is a string[]. */
    multi?: boolean;
    /**
     * Render options as a vertical checkbox/radio list rather than wrapped pills.
     * Long facets (categories) are far easier to scan this way.
     */
    list?: boolean;
};

/** Normalise either value shape to an array for uniform membership checks. */
function toArray(value: FilterValue): string[] {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
}

export function FilterToolbar({
                                  dropdowns,
                                  values,
                                  onChange,
                                  onClear,
                                  sortOptions,
                                  sortValue,
                                  onSortChange,
                                  resultCount,
                              }: {
    dropdowns: DropdownSpec[];
    values: Record<string, FilterValue>;
    onChange: (key: string, value: FilterValue) => void;
    onClear: () => void;
    sortOptions: FilterOption[];
    sortValue: string;
    onSortChange: (value: string) => void;
    resultCount: number;
}) {
    const [sheetOpen, setSheetOpen] = useState(false);
    const reduceMotion = useReducedMotion();

    // One chip per FACET, not per value - ten selected categories collapse into a
    // single "All Categories: Bowls, Cheese, …" chip so the row can't stack up.
    const activeChips = dropdowns.flatMap((dropdown) => {
        const labels = toArray(values[dropdown.key])
            .map((entry) => dropdown.options.find((item) => item.value === entry)?.label)
            .filter((label): label is string => Boolean(label));
        if (labels.length === 0) return [];
        return [
            {
                key: dropdown.key,
                label: dropdown.label,
                values: labels.join(", "),
                count: labels.length,
            },
        ];
    });

    /** Total selected values across facets - what the All Filters badge counts. */
    const activeCount = activeChips.reduce((sum, chip) => sum + chip.count, 0);

    return (
        <>
            {/*
        Mobile keeps a single compact row (All Filters + Sort) directly under the
        header search bar - the per-facet quick dropdowns wrapped into four rows
        of chips and pushed the grid off-screen. They return at `md`.
      */}
            <div className="flex flex-nowrap items-center gap-2.5">
                {/*
          `isolate` gives the rail its own stacking context so an overflowing
          pill is clipped at the rail edge instead of painting over the
          neighbouring All Filters button, and pr-1/-mr-1 keeps the last pill's
          rounded border off the clip edge without adding visible space.
        */}
                <div
                    className="rail-scroll -mr-1 isolate hidden min-w-0 flex-nowrap items-center gap-2.5 overflow-x-auto pr-1 md:flex">
                    {dropdowns.map((dropdown) => (
                        <FilterDropdown
                            key={dropdown.key}
                            spec={dropdown}
                            value={values[dropdown.key]}
                            onChange={(value) => onChange(dropdown.key, value)}
                        />
                    ))}
                </div>

                <button
                    type="button"
                    onClick={() => setSheetOpen(true)}
                    aria-haspopup="dialog"
                    aria-expanded={sheetOpen}
                    className="flex h-11 shrink-0 items-center gap-2 rounded-full bg-surface px-5 text-[14px] font-semibold text-teal-950 transition-colors hover:bg-white"
                >
                    <SlidersHorizontal className="size-4 shrink-0" aria-hidden/>
                    All Filters
                    {activeCount > 0 && (
                        <span
                            className="grid size-5 shrink-0 place-items-center rounded-full bg-teal-950 text-[11px] font-bold text-white">
              {activeCount}
            </span>
                    )}
                </button>

                <div className="ml-auto shrink-0">
                    <FilterDropdown
                        spec={{
                            key: "sort",
                            label: "Sort by",
                            options: sortOptions,
                        }}
                        value={sortValue}
                        onChange={(value) => onSortChange(toArray(value)[0] ?? "featured")}
                        outlined
                        alwaysShowLabel
                    />
                </div>
            </div>

            {/*
        Always exactly one row: the chips scroll horizontally and never wrap, and
        "Clear all" is pinned outside the scroller so it stays reachable no matter
        how many facets are active.
      */}
            {activeChips.length > 0 && (
                <div className="mt-4 flex items-center gap-3">
                    <div className="rail-scroll flex min-w-0 flex-1 flex-nowrap items-center gap-2 overflow-x-auto">
                        {activeChips.map((chip) => (
                            <span
                                key={chip.key}
                                // `max-w` + inner truncate gives the "…" for a long value list;
                                // shrink-0 on the chip stops flexbox squashing them all equally.
                                title={`${chip.label}: ${chip.values}`}
                                // m-px keeps each chip's edge off the scroller's clip boundary
                                // so its rounded border always renders complete.
                                className="m-px flex max-w-[70vw] shrink-0 items-center gap-1.5 rounded-full bg-teal-950 py-1.5 pl-3.5 pr-2 text-[13px] font-semibold text-white sm:max-w-[320px]"
                            >
                <span className="min-w-0 truncate">
                  <span className="opacity-70">{chip.label}: </span>
                    {chip.values}
                </span>
                                {chip.count > 1 && (
                                    <span className="shrink-0 rounded-full bg-white/20 px-1.5 text-[11px]">
                    {chip.count}
                  </span>
                                )}
                                <button
                                    type="button"
                                    onClick={() => onChange(chip.key, undefined)}
                                    aria-label={`Remove ${chip.label} filter`}
                                    className="grid size-5 shrink-0 place-items-center rounded-full bg-white/20 transition-colors hover:bg-white/35"
                                >
                  <X className="size-3" aria-hidden/>
                </button>
              </span>
                        ))}
                    </div>
                    <button
                        type="button"
                        onClick={onClear}
                        className="shrink-0 text-[13px] font-bold text-coral underline underline-offset-4"
                    >
                        Clear all
                    </button>
                </div>
            )}

            <AnimatePresence>
                {sheetOpen && (
                    <AllFiltersSheet
                        dropdowns={dropdowns}
                        values={values}
                        onChange={onChange}
                        onClear={onClear}
                        onClose={() => setSheetOpen(false)}
                        resultCount={resultCount}
                        reduceMotion={Boolean(reduceMotion)}
                    />
                )}
            </AnimatePresence>
        </>
    );
}

/** Single dropdown rendered as a button + listbox popover. */
function FilterDropdown({
                            spec,
                            value,
                            onChange,
                            outlined = false,
                            alwaysShowLabel = false,
                        }: {
    spec: DropdownSpec;
    value: FilterValue;
    onChange: (value: FilterValue) => void;
    outlined?: boolean;
    alwaysShowLabel?: boolean;
}) {
    const [open, setOpen] = useState(false);
    /** Viewport-space placement for the portalled panel; null until measured. */
    const [anchor, setAnchor] = useState<{
        top: number;
        left: number;
        width: number;
    } | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLUListElement>(null);
    const listboxId = useId();

    // `createPortal` needs document.body, which doesn't exist during SSR.
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    const selectedValues = toArray(value);
    /** Drives the active ring on the trigger button. */
    const hasSelection = selectedValues.length > 0;

    // The toolbar button always shows the facet NAME only - the selected values
    // are already spelled out in the chip row below, and repeating them here both
    // duplicated the information and made the pills wide enough to overflow the
    // row. A count is kept when several are picked, since that isn't obvious
    // from the chips at a glance.
    const buttonLabel =
        !alwaysShowLabel && selectedValues.length > 1
            ? `${spec.label} (${selectedValues.length})`
            : spec.label;

    /** Toggle for multi facets; replace-and-close for single ones. */
    const pick = (optionValue: string) => {
        if (!spec.multi) {
            onChange(optionValue);
            setOpen(false);
            return;
        }
        const next = selectedValues.includes(optionValue)
            ? selectedValues.filter((item) => item !== optionValue)
            : [...selectedValues, optionValue];
        onChange(next.length > 0 ? next : undefined);
    };

    // Escape closes, and a click outside dismisses the popover. The panel is
    // portalled, so "outside" has to consider it separately from the button.
    useEffect(() => {
        if (!open) return;
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") setOpen(false);
        };
        const onPointerDown = (event: PointerEvent) => {
            const target = event.target as Node;
            if (
                !containerRef.current?.contains(target) &&
                !panelRef.current?.contains(target)
            ) {
                setOpen(false);
            }
        };
        document.addEventListener("keydown", onKey);
        document.addEventListener("pointerdown", onPointerDown);
        return () => {
            document.removeEventListener("keydown", onKey);
            document.removeEventListener("pointerdown", onPointerDown);
        };
    }, [open]);

    /**
     * The toolbar row scrolls horizontally and is sticky, both of which clip an
     * absolutely-positioned child. Measure the button in viewport coordinates and
     * render the panel through a portal on `document.body` instead, re-measuring
     * on scroll/resize so it stays glued to its trigger.
     */
    // Note: the anchor is deliberately NOT cleared on close - doing so unmounts the
    // panel instantly and kills the exit animation. It is re-measured on reopen,
    // before paint, so the panel never flashes at its previous position.
    useLayoutEffect(() => {
        if (!open) return;
        const place = () => {
            // Measure the button, not the wrapper: the toolbar is sticky, so the
            // button stays pinned on screen while the wrapper scrolls away, and
            // anchoring to the wrapper would let the panel drift off its trigger.
            const rect = buttonRef.current?.getBoundingClientRect();
            if (!rect) return;
            const width = Math.max(rect.width, MIN_PANEL_WIDTH);
            // Flip to right-aligned when a left-aligned panel would overflow.
            const left = Math.min(
                Math.max(8, rect.left),
                Math.max(8, window.innerWidth - width - 8),
            );
            const next = {top: rect.bottom + 8, left, width};
            // Bail out when nothing moved - this runs per frame, and a fresh object
            // every time would re-render the panel continuously.
            setAnchor((current) =>
                current &&
                current.top === next.top &&
                current.left === next.left &&
                current.width === next.width
                    ? current
                    : next,
            );
        };
        place();

        // Track the trigger every frame while open. Scroll events are unreliable
        // here - the toolbar is sticky inside a document-level scroller, and a
        // capture-phase window listener still misses cases where the trigger moves
        // without a scroll event (layout shifts, the chip row appearing/growing).
        // rAF only runs while a dropdown is actually open, so the cost is bounded.
        let frame = requestAnimationFrame(function tick() {
            place();
            frame = requestAnimationFrame(tick);
        });
        window.addEventListener("resize", place);
        return () => {
            cancelAnimationFrame(frame);
            window.removeEventListener("resize", place);
        };
    }, [open]);

    // shrink-0 keeps the control at its natural width inside the scrolling row
    // rather than being squeezed once several facets are active.
    const base =
        "m-px flex h-11 shrink-0 max-w-[240px] items-center gap-2 rounded-full px-5 text-[14px] font-semibold transition-colors";
    const tone = spec.filled
        ? "bg-lime-500 text-teal-950 hover:bg-lime-400"
        : outlined
            ? "border border-teal-950/25 text-teal-950 hover:bg-white"
            : "bg-surface text-teal-950 hover:bg-white";

    return (
        <div ref={containerRef} className="relative">
            <button
                ref={buttonRef}
                type="button"
                onClick={() => setOpen((current) => !current)}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-controls={open ? listboxId : undefined}
                className={`${base} ${tone} ${hasSelection && !spec.filled && !alwaysShowLabel ? "ring-1 ring-teal-950/30" : ""}`}
            >
                <span className="min-w-0 truncate">{buttonLabel}</span>
                <ChevronDown
                    className={`size-4 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
                    aria-hidden
                />
            </button>

            {/*
        The portal must wrap AnimatePresence, not the other way round -
        AnimatePresence cannot animate a createPortal() return value, and given
        one it renders nothing at all.
      */}
            {mounted &&
                createPortal(
                    <AnimatePresence>
                        {open && anchor && (
                            <motion.ul
                                key={listboxId}
                                ref={panelRef}
                                id={listboxId}
                                role="listbox"
                                aria-label={spec.label}
                                initial={{opacity: 0, y: -6}}
                                animate={{opacity: 1, y: 0}}
                                exit={{opacity: 0, y: -6}}
                                transition={{duration: sec(motionTokens.fast)}}
                                // Fixed to the measured trigger rect so neither the sticky toolbar
                                // nor its horizontal scroller can clip the panel. Height is capped
                                // at 10 rows (42px each) and also to the space left on screen.
                                style={{
                                    position: "fixed",
                                    top: anchor.top,
                                    left: anchor.left,
                                    minWidth: anchor.width,
                                    maxHeight: Math.min(
                                        MAX_VISIBLE_OPTIONS * 42 + 16,
                                        window.innerHeight - anchor.top - 16,
                                    ),
                                }}
                                className="z-50 overflow-y-auto overscroll-contain rounded-[16px] bg-surface p-2 shadow-[0_16px_40px_rgba(0,48,45,0.14)]"
                            >
                                <li role="none">
                                    <button
                                        type="button"
                                        role="option"
                                        aria-selected={selectedValues.length === 0}
                                        onClick={() => {
                                            onChange(undefined);
                                            setOpen(false);
                                        }}
                                        className="flex w-full items-center justify-between rounded-[10px] px-3 py-2.5 text-left text-[14px] font-medium text-teal-950 transition-colors hover:bg-canvas"
                                    >
                                        Any
                                        {selectedValues.length === 0 && (
                                            <Check className="size-4 text-coral" aria-hidden/>
                                        )}
                                    </button>
                                </li>
                                {spec.options.map((option) => {
                                    const isSelected = selectedValues.includes(option.value);
                                    return (
                                        <li key={option.value} role="none">
                                            <button
                                                type="button"
                                                role="option"
                                                aria-selected={isSelected}
                                                onClick={() => pick(option.value)}
                                                className="flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-left text-[14px] font-medium text-teal-950 transition-colors hover:bg-canvas"
                                            >
                                                {spec.multi && <CheckBox checked={isSelected}/>}
                                                <span className="min-w-0 flex-1">{option.label}</span>
                                                {!spec.multi && isSelected && (
                                                    <Check className="size-4 text-coral" aria-hidden/>
                                                )}
                                            </button>
                                        </li>
                                    );
                                })}
                            </motion.ul>
                        )}
                    </AnimatePresence>,
                    document.body,
                )}
        </div>
    );
}

/** Square tick box for multi-select rows (purely visual; the row is the control). */
function CheckBox({checked}: { checked: boolean }) {
    return (
        <span
            aria-hidden
            className={`grid size-[18px] shrink-0 place-items-center rounded-[5px] border transition-colors ${
                checked
                    ? "border-teal-950 bg-teal-950 text-white"
                    : "border-teal-950/30 bg-white"
            }`}
        >
      {checked && <Check className="size-3" strokeWidth={3}/>}
    </span>
    );
}

/**
 * One collapsible facet inside the All-filters sheet. Collapsed by default (bar
 * the first) with the current selection shown in the header, so a 30-option
 * category list doesn't bury every other facet below the fold.
 */
function FilterSection({
                           spec,
                           value,
                           onChange,
                           defaultOpen,
                       }: {
    spec: DropdownSpec;
    value: FilterValue;
    onChange: (value: FilterValue) => void;
    defaultOpen: boolean;
}) {
    const [open, setOpen] = useState(defaultOpen);
    const panelId = useId();

    const selectedValues = toArray(value);
    const selectedLabels = selectedValues
        .map((entry) => spec.options.find((option) => option.value === entry)?.label)
        .filter((label): label is string => Boolean(label));
    const summary = selectedLabels.length > 0 ? selectedLabels.join(", ") : "Any";

    const toggle = (optionValue: string) => {
        if (!spec.multi) {
            onChange(selectedValues.includes(optionValue) ? undefined : optionValue);
            return;
        }
        const next = selectedValues.includes(optionValue)
            ? selectedValues.filter((item) => item !== optionValue)
            : [...selectedValues, optionValue];
        onChange(next.length > 0 ? next : undefined);
    };

    return (
        <section className="overflow-hidden rounded-[16px] bg-white/60">
            <h3>
                <button
                    type="button"
                    onClick={() => setOpen((current) => !current)}
                    aria-expanded={open}
                    aria-controls={panelId}
                    className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
                >
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted">
              {spec.label}
                {selectedValues.length > 1 && (
                    <span
                        className="grid size-[18px] place-items-center rounded-full bg-teal-950 text-[10px] text-white">
                  {selectedValues.length}
                </span>
                )}
            </span>
            <span className="mt-0.5 block truncate text-[14px] font-semibold text-teal-950">
              {summary}
            </span>
          </span>
                    <ChevronDown
                        className={`size-4 shrink-0 text-teal-950 transition-transform duration-200 ${
                            open ? "rotate-180" : ""
                        }`}
                        aria-hidden
                    />
                </button>
            </h3>

            {open && (
                // Cap the tallest lists and scroll inside the section rather than
                // stretching the sheet past the viewport.
                <div
                    id={panelId}
                    className="max-h-[42vh] overflow-y-auto overscroll-contain px-4 pb-4"
                >
                    {spec.list ? (
                        // Vertical rows - long facets (categories) scan far better as a
                        // list of checkboxes than as wrapped pills.
                        <ul className="flex flex-col">
                            {spec.options.map((option) => {
                                const isSelected = selectedValues.includes(option.value);
                                return (
                                    <li key={option.value}>
                                        <button
                                            type="button"
                                            role={spec.multi ? "checkbox" : undefined}
                                            aria-checked={spec.multi ? isSelected : undefined}
                                            aria-pressed={spec.multi ? undefined : isSelected}
                                            onClick={() => toggle(option.value)}
                                            className="flex w-full items-center gap-3 rounded-[10px] px-2 py-2.5 text-left text-[14px] font-medium text-teal-950 transition-colors hover:bg-white"
                                        >
                                            <CheckBox checked={isSelected}/>
                                            <span className="min-w-0 flex-1">{option.label}</span>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            {spec.options.map((option) => {
                                const isSelected = selectedValues.includes(option.value);
                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        aria-pressed={isSelected}
                                        onClick={() => toggle(option.value)}
                                        className={`rounded-full px-4 py-2 text-[13px] font-semibold transition-colors ${
                                            isSelected
                                                ? "bg-teal-950 text-white"
                                                : "bg-white text-teal-950 hover:bg-canvas"
                                        }`}
                                    >
                                        {option.label}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </section>
    );
}

/** Right-side sheet on desktop, bottom sheet on mobile - design.md §9. */
function AllFiltersSheet({
                             dropdowns,
                             values,
                             onChange,
                             onClear,
                             onClose,
                             resultCount,
                             reduceMotion,
                         }: {
    dropdowns: DropdownSpec[];
    values: Record<string, FilterValue>;
    onChange: (key: string, value: FilterValue) => void;
    onClear: () => void;
    onClose: () => void;
    resultCount: number;
    reduceMotion: boolean;
}) {
    const panelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose();
        };
        document.addEventListener("keydown", onKey);
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        panelRef.current?.focus();
        return () => {
            document.removeEventListener("keydown", onKey);
            document.body.style.overflow = previousOverflow;
        };
    }, [onClose]);

    return createPortal(
        <div className="fixed inset-0 z-50">
            <motion.div
                initial={{opacity: 0}}
                animate={{opacity: 1}}
                exit={{opacity: 0}}
                transition={{duration: sec(motionTokens.fast)}}
                onClick={onClose}
                className="absolute inset-0 bg-teal-950/45"
            />
            <motion.div
                ref={panelRef}
                tabIndex={-1}
                role="dialog"
                aria-modal="true"
                aria-label="All filters"
                initial={reduceMotion ? {opacity: 0} : {y: "100%"}}
                animate={reduceMotion ? {opacity: 1} : {y: 0}}
                exit={reduceMotion ? {opacity: 0} : {y: "100%"}}
                transition={{duration: sec(motionTokens.base), ease: motionTokens.easeOut}}
                className="absolute inset-x-0 bottom-0 flex max-h-[86vh] flex-col rounded-t-[24px] bg-warm-canvas sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[380px] sm:rounded-l-[24px] sm:rounded-tr-none"
            >
                <div className="flex shrink-0 items-center justify-between p-6 pb-0">
                    <h2 className="text-[20px] font-extrabold text-teal-950">All filters</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close filters"
                        className="grid size-10 place-items-center rounded-full bg-white"
                    >
                        <X className="size-5" aria-hidden/>
                    </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-6">
                    <div className="space-y-3">
                        {dropdowns.map((dropdown) => (
                            <FilterSection
                                key={dropdown.key}
                                spec={dropdown}
                                value={values[dropdown.key]}
                                onChange={(value) => onChange(dropdown.key, value)}
                                // Only the first section starts open; a sheet with every group
                                // expanded became an unreadable wall of chips on mobile.
                                defaultOpen={dropdown === dropdowns[0]}
                            />
                        ))}
                    </div>
                </div>

                <div className="flex shrink-0 gap-3 p-6 pt-4">
                    <button
                        type="button"
                        onClick={onClear}
                        className="h-12 flex-1 rounded-full bg-white text-[15px] font-bold text-teal-950"
                    >
                        Clear all
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="h-12 flex-1 rounded-full bg-lime-500 text-[15px] font-bold text-teal-950"
                    >
                        Show {resultCount}
                    </button>
                </div>
            </motion.div>
        </div>,
        document.body,
    );
}
