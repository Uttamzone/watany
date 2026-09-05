"use client";

import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {useRouter} from "next/navigation";
import {motion, useReducedMotion} from "framer-motion";
import {ProductGrid} from "@/components/home/product-section";
import {type DropdownSpec, FilterToolbar, type FilterValue,} from "./filter-toolbar";
import {
    type CatalogueFilters,
    facetValues,
    filterProducts,
    getAllProducts,
    type PriceBand,
    priceBands,
    type SortKey,
    sortOptions,
    sortProducts,
} from "@/lib/products";
import {motionTokens, sec} from "@/lib/motion";
import type {Category, CategorySlug, Product} from "@/lib/types";

/** Products appended per infinite-scroll batch (12 full rows on the 5-column grid). */
const PAGE_SIZE = 60;

/** Multi-select facet value as an array (empty when unset). */
function asArray(value: FilterValue): string[] {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
}

/** Single-select facet value as a plain string (first entry if an array slipped in). */
function single(value: FilterValue): string | undefined {
    return Array.isArray(value) ? value[0] : value;
}

/** All-category browsing experience (design.md §9); filtering/sorting run client-side with a crossfade. */
export function CatalogueBrowser({
                                     products,
                                     categories,
                                     initialCategory,
                                     initialQuery,
                                     initialOffer,
                                 }: {
    products: Product[];
    /** Active categories resolved server-side - never the offline fixtures. */
    categories: Category[];
    initialCategory?: CategorySlug;
    initialQuery?: string;
    initialOffer?: boolean;
}) {
    const router = useRouter();
    const [allProducts, setAllProducts] = useState<Product[]>(products);
    const [searchQuery, setSearchQuery] = useState<string | undefined>(initialQuery);
    const [values, setValues] = useState<Record<string, FilterValue>>({
        // Category is multi-select, so it holds an array.
        category: initialCategory ? [initialCategory] : undefined,
        price: undefined,
        review: undefined,
        color: undefined,
        material: undefined,
        offer: initialOffer ? "yes" : undefined,
    });

    useEffect(() => {
        setSearchQuery(initialQuery);
    }, [initialQuery]);

    useEffect(() => {
        let active = true;
        async function syncLatestProducts() {
            try {
                const latest = await getAllProducts();
                if (active && Array.isArray(latest) && latest.length > 0) {
                    setAllProducts(latest);
                }
            } catch {}
        }
        void syncLatestProducts();
        return () => {
            active = false;
        };
    }, []);
    const [sort, setSort] = useState<SortKey>("featured");
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
    const [filterVisible, setFilterVisible] = useState(true);
    const lastScrollY = useRef(0);
    const reduceMotion = useReducedMotion();
    const sentinelRef = useRef<HTMLDivElement>(null);
    const resultsRef = useRef<HTMLParagraphElement>(null);
    // Only scroll on a user-driven filter/sort change, never on first paint.
    const scrollOnNextResultRef = useRef(false);

    // Scroll hide & unhide effect mirroring navbar SiteHeader behaviour
    useEffect(() => {
        let ticking = false;
        const onScroll = () => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    const currentScrollY = window.scrollY;
                    if (currentScrollY <= 100) {
                        setFilterVisible(true);
                    } else {
                        const diff = currentScrollY - lastScrollY.current;
                        if (diff > 180) {
                            setFilterVisible(false);
                        } else if (diff < -180) {
                            setFilterVisible(true);
                        }
                    }
                    lastScrollY.current = currentScrollY;
                    ticking = false;
                });
                ticking = true;
            }
        };

        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    const facets = useMemo(() => facetValues(allProducts), [allProducts]);

    const dropdowns = useMemo<DropdownSpec[]>(
        () => [
            {
                key: "category",
                label: "All Categories",
                filled: true,
                multi: true,
                list: true,
                // Copy before sorting - `categories` is a prop and must not be mutated.
                options: [...categories]
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((category) => ({
                        value: category.slug,
                        label: category.name,
                    })),
            },
            {key: "price", label: "Price", options: priceBands},
            {
                key: "review",
                label: "Review",
                options: [
                    {value: "5", label: "5 stars"},
                    {value: "4", label: "4 stars & up"},
                    {value: "3", label: "3 stars & up"},
                ],
            },
            {
                key: "color",
                label: "Color",
                options: facets.colors.map((color) => ({value: color, label: color})),
            },
            {
                key: "material",
                label: "Material",
                options: facets.materials.map((material) => ({
                    value: material,
                    label: material,
                })),
            },
            {
                key: "offer",
                label: "Offer",
                options: [{value: "yes", label: "On sale"}],
            },
        ],
        [facets, categories],
    );

    const visible = useMemo(() => {
        const filters: CatalogueFilters = {
            categories: asArray(values.category) as CategorySlug[],
            price: single(values.price) as PriceBand | undefined,
            minRating: values.review ? Number(single(values.review)) : undefined,
            color: single(values.color),
            material: single(values.material),
            onOffer: single(values.offer) === "yes",
            search: searchQuery,
        };
        return sortProducts(filterProducts(allProducts, filters), sort);
    }, [allProducts, values, sort, searchQuery]);

    // Any filter/sort/query change restarts the list from the first batch. Reset
    // during render rather than in an effect - an effect would paint the stale
    // (over-long) list for a frame first.
    const resultKey = `${JSON.stringify(values)}-${sort}-${searchQuery ?? ""}`;
    const [lastResultKey, setLastResultKey] = useState(resultKey);
    if (lastResultKey !== resultKey) {
        setLastResultKey(resultKey);
        setVisibleCount(PAGE_SIZE);
    }

    // Filters/sort can shrink the result set - clamp so we never claim more is loaded
    // than exists.
    const shownCount = Math.min(visibleCount, visible.length);
    const paged = useMemo(
        () => visible.slice(0, shownCount),
        [visible, shownCount],
    );
    const hasMore = shownCount < visible.length;

    const loadMore = useCallback(() => {
        setVisibleCount((current) => current + PAGE_SIZE);
    }, []);

    // Auto-load the next batch when the sentinel below the grid scrolls into view.
    // rootMargin pre-fetches a screenful early so the grid rarely shows a gap.
    useEffect(() => {
        const sentinel = sentinelRef.current;
        if (!sentinel || !hasMore) return;
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) loadMore();
            },
            {rootMargin: "600px 0px"},
        );
        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [hasMore, loadMore]);

    // After a filter/sort change, bring the result count (and the top of the grid)
    // into view - the toolbar is sticky, so scroll to just above the count rather
    // than to the raw element top, which would sit under the toolbar.
    useEffect(() => {
        if (!scrollOnNextResultRef.current) return;
        scrollOnNextResultRef.current = false;
        const anchor = resultsRef.current;
        if (!anchor) return;
        // Sticky toolbar height (top-[92px] header offset + toolbar) plus breathing room.
        const offset = 168;
        const top = anchor.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({
            top: Math.max(top, 0),
            behavior: reduceMotion ? "auto" : "smooth",
        });
    }, [resultKey, reduceMotion]);

    const onChange = useCallback((key: string, value: FilterValue) => {
        scrollOnNextResultRef.current = true;
        setValues((current) => ({...current, [key]: value}));
    }, []);

    const onClear = useCallback(() => {
        scrollOnNextResultRef.current = true;
        setSearchQuery(undefined);
        setValues({
            category: undefined,
            price: undefined,
            review: undefined,
            color: undefined,
            material: undefined,
            offer: undefined,
        });
        setSort("featured");
        if (typeof window !== "undefined") {
            window.history.replaceState({}, "", window.location.pathname);
        }
        router.replace("/categories", { scroll: false });
    }, [router]);

    return (
        <>
            <motion.div
                className="sticky top-[92px] z-20 -mx-1 rounded-2xl bg-canvas/85 px-1 py-3 backdrop-blur"
                initial={reduceMotion ? false : { y: -10, opacity: 0 }}
                animate={{
                    y: filterVisible ? 0 : -220,
                    opacity: filterVisible ? 1 : 0,
                    pointerEvents: filterVisible ? "auto" : "none",
                }}
                transition={{
                    duration: reduceMotion ? 0 : 0.75,
                    ease: [0.16, 1, 0.3, 1],
                }}
            >
                <FilterToolbar
                    dropdowns={dropdowns}
                    values={values}
                    onChange={onChange}
                    onClear={onClear}
                    sortOptions={sortOptions.map((option) => ({
                        value: option.value,
                        label: option.label,
                    }))}
                    sortValue={sort}
                    onSortChange={(value) => {
                        scrollOnNextResultRef.current = true;
                        setSort(value as SortKey);
                    }}
                    resultCount={visible.length}
                />
            </motion.div>

            <p
                ref={resultsRef}
                aria-live="polite"
                className="mt-4 scroll-mt-[168px] text-[14px] text-muted"
            >
                {hasMore ? `Showing ${shownCount} of ${visible.length} products` : null}
                {!hasMore
                    ? `${visible.length} ${visible.length === 1 ? "product" : "products"}`
                    : null}
                {initialQuery ? ` matching “${initialQuery}”` : ""}
            </p>

            {/* Keyed remount instead of AnimatePresence - its exit can leave the old grid mounted if it never completes. */}
            <div className="mt-5">
                <motion.div
                    key={resultKey}
                    initial={reduceMotion ? false : {opacity: 0}}
                    animate={{opacity: 1}}
                    transition={{duration: sec(200), ease: motionTokens.easeOut}}
                >
                    {visible.length > 0 ? (
                        <ProductGrid products={paged}/>
                    ) : (
                        <div className="rounded-[22px] bg-surface p-12 text-center">
                            <p className="text-[17px] font-bold text-teal-950">
                                No products match these filters
                            </p>
                            <p className="mt-2 text-[15px] text-muted">
                                Try clearing a filter to see more of the catalogue.
                            </p>
                            <button
                                type="button"
                                onClick={onClear}
                                className="mt-6 h-11 rounded-full bg-lime-500 px-6 text-[15px] font-bold text-teal-950"
                            >
                                Clear all filters
                            </button>
                        </div>
                    )}
                </motion.div>
            </div>

            {/* Sentinel drives auto-load; the button is the keyboard/no-JS-observer path. */}
            {hasMore && (
                <div ref={sentinelRef} className="mt-10 flex justify-center">
                    <button
                        type="button"
                        onClick={loadMore}
                        className="h-11 rounded-full bg-surface px-6 text-[14px] font-bold text-teal-950 transition-colors hover:bg-white"
                    >
                        Load more products
                    </button>
                </div>
            )}
        </>
    );
}
