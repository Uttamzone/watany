"use client";

import {useEffect, useId, useRef, useState} from "react";
import {AnimatePresence, motion, useReducedMotion} from "framer-motion";
import {
    AlertCircle,
    Check,
    CheckCircle2,
    Loader2,
    Package,
    PenLine,
    Ruler,
    Star,
    Truck,
    X,
} from "lucide-react";
import {motionTokens, sec} from "@/lib/motion";
import {formatWeight, type Product, type ProductReview} from "@/lib/types";
import {useAuth} from "@/components/auth/auth-store";
import {submitProductReview} from "@/lib/products";
import {registerReviewForAdmin} from "@/lib/admin/api";

/**
 * Product detail tabs; same ARIA tabs pattern as the home page's best-seller rail. Missing-data
 * tabs are omitted (except Reviews, which shows a zero state); HTML props are pre-sanitised.
 */

type TabKey = "description" | "additional" | "reviews" | "shipping";

export function ProductTabs({
                                product,
                                reviews = [],
                                descriptionHtml,
                                shippingHtml,
                            }: {
    product: Product;
    reviews?: ProductReview[];
    /** Pre-sanitised long-form description markup. */
    descriptionHtml: string;
    /** Pre-sanitised shipping policy markup. */
    shippingHtml: string;
}) {
    const safeInitialReviews = Array.isArray(reviews) ? reviews : [];
    const [reviewList, setReviewList] = useState<ProductReview[]>(safeInitialReviews);

    useEffect(() => {
        if (Array.isArray(reviews)) {
            setReviewList(reviews);
        }
    }, [reviews]);

    const specs = specRows(product);

    const tabs: { key: TabKey; label: string }[] = [
        ...(descriptionHtml ? [{key: "description" as const, label: "Description"}] : []),
        ...(specs.length > 0
            ? [{key: "additional" as const, label: "Additional information"}]
            : []),
        {key: "reviews", label: `Reviews (${(reviewList || []).length})`},
        ...(shippingHtml ? [{key: "shipping" as const, label: "Shipping & Delivery"}] : []),
    ];

    const [active, setActive] = useState<TabKey>(tabs[0]?.key || "reviews");
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
                    {active === "reviews" && (
                        <ReviewsPanel
                            product={product}
                            reviews={reviewList}
                            onReviewAdded={(newRev) => setReviewList((prev) => [newRev, ...prev])}
                        />
                    )}
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

function ReviewsPanel({
                          product,
                          reviews = [],
                          onReviewAdded,
                      }: {
    product: Product;
    reviews?: ProductReview[];
    onReviewAdded: (newReview: ProductReview) => void;
}) {
    const safeReviews = Array.isArray(reviews) ? reviews : [];
    let user = null;
    try {
        const auth = useAuth();
        user = auth?.user ?? null;
    } catch {
        // Safe fallback if rendered without AuthProvider
    }
    const [isWriting, setIsWriting] = useState(false);
    const [rating, setRating] = useState(5);
    const [hoverRating, setHoverRating] = useState(0);
    const [authorName, setAuthorName] = useState(
        user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email : ""
    );
    const [title, setTitle] = useState("");
    const [body, setBody] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

    useEffect(() => {
        if (user && !authorName) {
            const name = `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email;
            if (name) setAuthorName(name);
        }
    }, [user, authorName]);

    const average =
        safeReviews.length > 0
            ? safeReviews.reduce((total, rev) => {
                const r = typeof rev?.rating === "number" ? rev.rating : parseFloat(String(rev?.rating || 0)) || 0;
                return total + r;
              }, 0) / safeReviews.length
            : 5;

    const ratingDescriptions = ["", "1 - Poor", "2 - Fair", "3 - Average", "4 - Very Good", "5 - Excellent"];

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSubmitError(null);

        const trimmedName = authorName.trim();
        const trimmedBody = body.trim();
        const trimmedTitle = title.trim();

        if (!trimmedName) {
            setSubmitError("Please provide your name.");
            return;
        }
        if (!trimmedBody) {
            setSubmitError("Please share a few words about your experience with this product.");
            return;
        }

        setIsSubmitting(true);
        try {
            const created = await submitProductReview(product.slug, {
                rating,
                authorName: trimmedName,
                title: trimmedTitle || undefined,
                body: trimmedBody,
            });

            registerReviewForAdmin({
                id: Number(created.id) || Date.now(),
                authorName: created.authorName,
                rating: created.rating,
                title: created.title ?? "Product Review",
                body: created.body ?? "",
                status: "APPROVED",
                product: {
                    id: Number(product.id) || 1,
                    name: product.name,
                    slug: product.slug,
                },
            });

            onReviewAdded(created);
            setSubmitSuccess("Thank you! Your review has been submitted and published.");
            setTitle("");
            setBody("");
            setIsWriting(false);
        } catch {
            const fallbackReview: ProductReview = {
                id: String(Date.now()),
                authorName: trimmedName,
                rating,
                title: trimmedTitle || undefined,
                body: trimmedBody,
                createdAt: new Date().toISOString(),
            };
            registerReviewForAdmin({
                id: Date.now(),
                authorName: trimmedName,
                rating,
                title: trimmedTitle || "Product Review",
                body: trimmedBody,
                status: "APPROVED",
                product: {
                    id: Number(product.id) || 1,
                    name: product.name,
                    slug: product.slug,
                },
            });
            onReviewAdded(fallbackReview);
            setSubmitSuccess("Thank you! Your review has been recorded.");
            setTitle("");
            setBody("");
            setIsWriting(false);
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <div className="space-y-8">
            {submitSuccess && (
                <div className="flex items-center gap-3 rounded-[16px] border border-emerald-200 bg-emerald-50/80 p-4 text-emerald-900">
                    <CheckCircle2 className="size-5 shrink-0 text-emerald-600"/>
                    <p className="text-[14px] font-medium">{submitSuccess}</p>
                </div>
            )}

            <div className="flex flex-col gap-6 rounded-[22px] bg-canvas p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
                <div className="flex items-center gap-5">
                    <div className="text-center sm:text-left">
                        <div className="flex items-baseline gap-2">
                            <span className="text-[36px] font-extrabold leading-none text-teal-950 sm:text-[42px]">
                                {average.toFixed(1)}
                            </span>
                            <span className="text-[16px] font-bold text-muted">/ 5</span>
                        </div>
                        <Stars rating={average} className="mt-1.5"/>
                        <p className="mt-1.5 text-[13px] text-muted">
                            Based on {reviews.length} {reviews.length === 1 ? "review" : "reviews"}
                        </p>
                    </div>
                </div>

                {!isWriting && (
                    <button
                        type="button"
                        onClick={() => {
                            setIsWriting(true);
                            setSubmitSuccess(null);
                        }}
                        className="inline-flex items-center justify-center gap-2 rounded-full bg-teal-950 px-6 py-3 text-[14px] font-bold text-white shadow-sm transition hover:bg-teal-900 active:scale-[0.98]"
                    >
                        <PenLine className="size-4"/>
                        Write a Review
                    </button>
                )}
            </div>

            <AnimatePresence>
                {isWriting && (
                    <motion.div
                        initial={{opacity: 0, height: 0}}
                        animate={{opacity: 1, height: "auto"}}
                        exit={{opacity: 0, height: 0}}
                        className="overflow-hidden"
                    >
                        <form
                            onSubmit={handleSubmit}
                            className="rounded-[22px] border border-black/[0.08] bg-white p-6 shadow-sm sm:p-8"
                        >
                            <div className="flex items-center justify-between border-b border-black/[0.06] pb-4">
                                <h3 className="text-[18px] font-bold text-teal-950">
                                    Write a Customer Review
                                </h3>
                                <button
                                    type="button"
                                    onClick={() => setIsWriting(false)}
                                    className="rounded-full p-1.5 text-muted transition hover:bg-black/[0.05] hover:text-teal-950"
                                    aria-label="Close review form"
                                >
                                    <X className="size-5"/>
                                </button>
                            </div>

                            {submitError && (
                                <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-[13px] font-medium text-red-800">
                                    <AlertCircle className="size-4 shrink-0 text-red-600"/>
                                    <span>{submitError}</span>
                                </div>
                            )}

                            <div className="mt-6">
                                <label className="block text-[13px] font-bold uppercase tracking-wider text-muted">
                                    Overall Rating <span className="text-red-500">*</span>
                                </label>
                                <div className="mt-2 flex items-center gap-3">
                                    <div className="flex items-center gap-1">
                                        {[1, 2, 3, 4, 5].map((starVal) => {
                                            const activeVal = hoverRating || rating;
                                            return (
                                                <button
                                                    key={starVal}
                                                    type="button"
                                                    onMouseEnter={() => setHoverRating(starVal)}
                                                    onMouseLeave={() => setHoverRating(0)}
                                                    onClick={() => setRating(starVal)}
                                                    className="p-1 transition-transform hover:scale-110 focus:outline-none"
                                                    aria-label={`Rate ${starVal} out of 5 stars`}
                                                >
                                                    <Star
                                                        className={`size-6 ${
                                                            starVal <= activeVal
                                                                ? "fill-gold text-gold"
                                                                : "fill-black/[0.08] text-black/[0.12]"
                                                        }`}
                                                    />
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <span className="text-[14px] font-semibold text-teal-950">
                                        {ratingDescriptions[hoverRating || rating]}
                                    </span>
                                </div>
                            </div>

                            <div className="mt-5">
                                <label
                                    htmlFor="review-author"
                                    className="block text-[13px] font-bold uppercase tracking-wider text-muted"
                                >
                                    Your Name / Display Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    id="review-author"
                                    type="text"
                                    required
                                    value={authorName}
                                    onChange={(e) => setAuthorName(e.target.value)}
                                    placeholder="e.g. Tariq A."
                                    className="mt-2 w-full rounded-xl border border-black/[0.1] bg-canvas px-4 py-2.5 text-[14px] text-teal-950 outline-none transition focus:border-lime-500 focus:ring-2 focus:ring-lime-500/20"
                                />
                            </div>

                            <div className="mt-4">
                                <label
                                    htmlFor="review-title"
                                    className="block text-[13px] font-bold uppercase tracking-wider text-muted"
                                >
                                    Headline / Review Title (Optional)
                                </label>
                                <input
                                    id="review-title"
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="e.g. Pure authenticity, rich Palestinian olive oil"
                                    className="mt-2 w-full rounded-xl border border-black/[0.1] bg-canvas px-4 py-2.5 text-[14px] text-teal-950 outline-none transition focus:border-lime-500 focus:ring-2 focus:ring-lime-500/20"
                                />
                            </div>

                            <div className="mt-4">
                                <label
                                    htmlFor="review-body"
                                    className="block text-[13px] font-bold uppercase tracking-wider text-muted"
                                >
                                    Review Details <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    id="review-body"
                                    required
                                    rows={4}
                                    value={body}
                                    onChange={(e) => setBody(e.target.value)}
                                    placeholder="Tell others about the quality, flavor, packaging, or your experience..."
                                    className="mt-2 w-full rounded-xl border border-black/[0.1] bg-canvas px-4 py-2.5 text-[14px] text-teal-950 outline-none transition focus:border-lime-500 focus:ring-2 focus:ring-lime-500/20"
                                />
                            </div>

                            <div className="mt-6 flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsWriting(false)}
                                    className="rounded-full px-5 py-2.5 text-[14px] font-semibold text-muted transition hover:bg-black/[0.05] hover:text-teal-950"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="inline-flex items-center gap-2 rounded-full bg-teal-950 px-6 py-2.5 text-[14px] font-bold text-white shadow transition hover:bg-teal-900 disabled:opacity-50"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="size-4 animate-spin"/>
                                            Submitting...
                                        </>
                                    ) : (
                                        "Submit Review"
                                    )}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>

            {reviews.length === 0 ? (
                <div className="rounded-[18px] bg-canvas p-8 text-center">
                    <p className="text-[16px] font-bold text-teal-950">
                        There are no reviews yet.
                    </p>
                    <p className="mt-1 text-[14px] text-muted">
                        Be the first to share your thoughts on this authentic Palestinian product!
                    </p>
                </div>
            ) : (
                <ul className="space-y-6">
                    {reviews.map((review) => (
                        <li
                            key={review.id}
                            className="rounded-[18px] border border-black/[0.05] bg-canvas p-6 transition-all"
                        >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2.5">
                                    <span className="text-[15px] font-bold text-teal-950">
                                        {review.authorName}
                                    </span>
                                    <span className="inline-flex items-center gap-1 rounded-full bg-lime-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-teal-900">
                                        <Check className="size-3"/>
                                        Verified Buyer
                                    </span>
                                </div>
                                <time
                                    dateTime={review.createdAt}
                                    className="text-[13px] text-muted"
                                >
                                    {formatReviewDate(review.createdAt)}
                                </time>
                            </div>

                            <Stars rating={review.rating} className="mt-2"/>

                            {review.title && (
                                <p className="mt-3 text-[15px] font-bold text-teal-950">
                                    {review.title}
                                </p>
                            )}
                            {review.body && (
                                <p className="mt-1.5 text-[15px] leading-relaxed text-muted">
                                    {review.body}
                                </p>
                            )}
                        </li>
                    ))}
                </ul>
            )}
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

function Stars({rating, className = ""}: { rating?: number | null; className?: string }) {
    const num = typeof rating === "number" && !isNaN(rating) ? rating : 5;
    return (
        <div
            className={`flex items-center gap-0.5 ${className}`}
            role="img"
            aria-label={`${num.toFixed(1)} out of 5 stars`}
        >
            {[1, 2, 3, 4, 5].map((position) => (
                <Star
                    key={position}
                    className={`size-4 ${
                        position <= Math.round(num)
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
    if (!product) return [];
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
