"use client";

import {useEffect, useId, useRef, useState} from "react";
import {motion, useReducedMotion} from "framer-motion";
import {Package, Ruler, Star, Truck} from "lucide-react";
import {motionTokens, sec} from "@/lib/motion";
import {formatWeight, type Product, type ProductReview} from "@/lib/types";

/**
 * Product detail tabs; same ARIA tabs pattern as the home page's best-seller rail. Missing-data
 * tabs are omitted (except Reviews, which shows a zero state); HTML props are pre-sanitised.
 */

type TabKey = "description" | "additional" | "reviews" | "shipping";

export function ProductTabs({
                                product,
                                reviews,
                                descriptionHtml,
                                shippingHtml,
                            }: {
    product: Product;
    reviews: ProductReview[];
    /** Pre-sanitised long-form description markup. */
    descriptionHtml: string;
    /** Pre-sanitised shipping policy markup. */
    shippingHtml: string;
}) {
    const specs = specRows(product);

    const tabs: { key: TabKey; label: string }[] = [
        ...(descriptionHtml ? [{key: "description" as const, label: "Description"}] : []),
        ...(specs.length > 0
            ? [{key: "additional" as const, label: "Additional information"}]
            : []),
        {key: "reviews", label: `Reviews (${reviews.length})`},
        ...(shippingHtml ? [{key: "shipping" as const, label: "Shipping & Delivery"}] : []),
    ];

    const [active, setActive] = useState<TabKey>(tabs[0].key);
    const reduceMotion = useReducedMotion();
    const baseId = useId();
    const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

    // Section is anchored `#reviews`; select the Reviews tab on `hashchange` too,
    // since clicking "N reviews" while already on the page doesn't remount this.
    useEffect(() => {
        function syncFromHash() {
            if (window.location.hash === "#reviews") setActive("reviews");
        }

        syncFromHash();
        window.addEventListener("hashchange", syncFromHash);
        return () => window.removeEventListener("hashchange", syncFromHash);
    }, []);

    function onKeyDown(event: React.KeyboardEvent) {
        const index = tabs.findIndex((tab) => tab.key === active);
        let next = index;

        if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
        else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = tabs.length - 1;
        else return;

        event.preventDefault();
        const key = tabs[next].key;
        setActive(key);
        tabRefs.current[key]?.focus();
    }

    return (
        <section
            // Anchored so the "N reviews" link in the purchase panel can jump here.
            id="reviews"
            aria-label="Product details"
            className="mt-8 scroll-mt-28 rounded-[28px] bg-surface p-6 md:p-10 lg:p-12"
        >
            <div
                role="tablist"
                aria-label="Product information"
                onKeyDown={onKeyDown}
                className="rail-scroll -mx-1 flex gap-2 overflow-x-auto border-b border-black/[0.07] px-1 pb-0"
            >
                {tabs.map((tab) => {
                    const selected = tab.key === active;
                    return (
                        <button
                            key={tab.key}
                            ref={(node) => {
                                tabRefs.current[tab.key] = node;
                            }}
                            type="button"
                            role="tab"
                            id={`${baseId}-tab-${tab.key}`}
                            aria-selected={selected}
                            aria-controls={`${baseId}-panel-${tab.key}`}
                            tabIndex={selected ? 0 : -1}
                            onClick={() => setActive(tab.key)}
                            className={`relative shrink-0 whitespace-nowrap px-4 pb-4 pt-1 text-[14px] font-bold transition-colors duration-[180ms] sm:px-5 sm:text-[15px] ${
                                selected ? "text-teal-950" : "text-muted hover:text-teal-900"
                            }`}
                        >
                            {tab.label}
                            {/* Underline slides via shared layoutId, not width animation, to stay aligned when scrolled. */}
                            {selected && (
                                <motion.span
                                    layoutId={`${baseId}-tab-underline`}
                                    transition={
                                        reduceMotion
                                            ? {duration: 0}
                                            : {duration: sec(motionTokens.base), ease: motionTokens.easeOut}
                                    }
                                    className="absolute inset-x-2 -bottom-px h-[3px] rounded-full bg-lime-500"
                                    aria-hidden
                                />
                            )}
                        </button>
                    );
                })}
            </div>

            <div
                role="tabpanel"
                id={`${baseId}-panel-${active}`}
                aria-labelledby={`${baseId}-tab-${active}`}
                tabIndex={0}
                className="pt-8 outline-none focus-visible:ring-2 focus-visible:ring-lime-500 focus-visible:ring-offset-4"
            >
                <motion.div
                    key={active}
                    initial={reduceMotion ? false : {opacity: 0, y: 8}}
                    animate={{opacity: 1, y: 0}}
                    transition={{duration: sec(motionTokens.base), ease: motionTokens.easeOut}}
                >
                    {active === "description" && <DescriptionPanel html={descriptionHtml}/>}
                    {active === "additional" && <AdditionalPanel rows={specs}/>}
                    {active === "reviews" && <ReviewsPanel reviews={reviews}/>}
                    {active === "shipping" && <ShippingPanel html={shippingHtml}/>}
                </motion.div>
            </div>
        </section>
    );
}

/* ------------------------------------------------------------------ */
/* Panels                                                              */

/* ------------------------------------------------------------------ */

function DescriptionPanel({html}: { html: string }) {
    return (
        <div
            className="rich-text max-w-[76ch]"
            // Sanitised server-side by sanitizeRichText before reaching this prop.
            dangerouslySetInnerHTML={{__html: html}}
        />
    );
}

type SpecRow = { label: string; value: string; icon?: typeof Package };

function AdditionalPanel({rows}: { rows: SpecRow[] }) {
    return (
        <dl className="max-w-[720px] divide-y divide-black/[0.06]">
            {rows.map((row) => {
                const Icon = row.icon;
                return (
                    <div
                        key={row.label}
                        className="flex items-center justify-between gap-6 py-4 first:pt-0"
                    >
                        <dt className="flex items-center gap-2.5 text-[14px] font-bold text-teal-950">
                            {Icon && (
                                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-soft-control">
                  <Icon className="size-4" aria-hidden/>
                </span>
                            )}
                            {row.label}
                        </dt>
                        <dd className="text-right text-[14px] text-muted">{row.value}</dd>
                    </div>
                );
            })}
        </dl>
    );
}

function ReviewsPanel({reviews}: { reviews: ProductReview[] }) {
    if (reviews.length === 0) {
        return (
            <div className="rounded-[18px] bg-canvas p-8 text-center">
                <p className="text-[15px] font-semibold text-teal-950">
                    There are no reviews yet.
                </p>
                <p className="mt-1.5 text-[14px] text-muted">
                    Only logged-in customers who have purchased this product may leave a review.
                </p>
            </div>
        );
    }

    const average =
        reviews.reduce((total, review) => total + review.rating, 0) / reviews.length;

    return (
        <div className="grid gap-8 min-[860px]:grid-cols-[220px_1fr] min-[860px]:gap-12">
            <div className="rounded-[18px] bg-canvas p-5 text-center sm:p-6 min-[860px]:self-start">
                <p className="text-[32px] font-extrabold leading-none text-teal-950 sm:text-[40px]">
                    {average.toFixed(1)}
                </p>
                <Stars rating={average} className="mt-2 justify-center"/>
                <p className="mt-2 text-[13px] text-muted">
                    Based on {reviews.length} {reviews.length === 1 ? "review" : "reviews"}
                </p>
            </div>

            <ul className="space-y-6">
                {reviews.map((review) => (
                    <li
                        key={review.id}
                        className="border-b border-black/[0.06] pb-6 last:border-0 last:pb-0"
                    >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-[15px] font-bold text-teal-950">{review.authorName}</p>
                            <time
                                dateTime={review.createdAt}
                                className="text-[13px] text-muted"
                            >
                                {formatReviewDate(review.createdAt)}
                            </time>
                        </div>

                        <Stars rating={review.rating} className="mt-1.5"/>

                        {review.title && (
                            <p className="mt-3 text-[15px] font-bold text-teal-950">{review.title}</p>
                        )}
                        {review.body && (
                            <p className="mt-1.5 text-[15px] leading-relaxed text-muted">
                                {review.body}
                            </p>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );
}

function ShippingPanel({html}: { html: string }) {
    return (
        <div className="grid gap-8 min-[860px]:grid-cols-[auto_1fr] min-[860px]:gap-12">
      <span
          className="grid size-14 place-items-center rounded-full bg-soft-control"
          aria-hidden
      >
        <Truck className="size-6 text-teal-950"/>
      </span>
            <div
                className="rich-text max-w-[76ch]"
                // Sanitised server-side by sanitizeRichText before reaching this prop.
                dangerouslySetInnerHTML={{__html: html}}
            />
        </div>
    );
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */

/* ------------------------------------------------------------------ */

function Stars({rating, className = ""}: { rating: number; className?: string }) {
    return (
        <div
            className={`flex items-center gap-0.5 ${className}`}
            role="img"
            aria-label={`${rating.toFixed(1)} out of 5 stars`}
        >
            {[1, 2, 3, 4, 5].map((position) => (
                <Star
                    key={position}
                    className={`size-4 ${
                        position <= Math.round(rating)
                            ? "fill-gold text-gold"
                            : "fill-black/[0.08] text-black/[0.08]"
                    }`}
                    aria-hidden
                />
            ))}
        </div>
    );
}

/** Builds "Additional information" rows, skipping unknown fields so none show blank. */
function specRows(product: Product): SpecRow[] {
    const specs = product.specifications;
    const rows: SpecRow[] = [];

    const moq = specs?.minimumOrderQuantity ?? specs?.minQuantity ?? product.minimumOrderQuantity ?? product.minQuantity ?? product.pricing?.minimumOrderQuantity ?? product.pricing?.minQuantity ?? 1;
    rows.push({
        label: "Minimum Order Quantity (MOQ)",
        value: `${moq} ${moq === 1 ? (product.unit || "unit") : "units"}`,
        icon: Package,
    });

    if (specs?.weightGrams !== undefined) {
        rows.push({
            label: "Weight",
            value: formatWeight(specs.weightGrams),
            icon: Package,
        });
    }
    if (specs?.dimensions) {
        rows.push({label: "Dimensions", value: specs.dimensions, icon: Ruler});
    }

    const size = specs?.unit ?? product.unit;
    if (size) rows.push({label: "Size", value: size});

    const sku = specs?.sku ?? product.sku;
    if (sku) rows.push({label: "SKU", value: sku});

    const region = specs?.region ?? product.region;
    if (region) rows.push({label: "Region of origin", value: `${region}, Palestine`});

    const material = specs?.material ?? product.material;
    if (material) rows.push({label: "Material", value: material});

    const color = specs?.color ?? product.color;
    if (color) rows.push({label: "Colour", value: color});

    if (specs?.brand) rows.push({label: "Brand", value: specs.brand});

    return rows;
}

/** Fixed locale/UTC so server render and client hydration never mismatch. */
const reviewDateFormat = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
});

function formatReviewDate(iso: string): string {
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? "" : reviewDateFormat.format(date);
}
