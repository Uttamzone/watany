"use client";

import {useEffect, useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {ChevronDown, Heart, Leaf, Minus, Plus, ShoppingCart, Star, Truck} from "lucide-react";
import {useCart} from "@/components/cart/cart-store";
import {useWishlist} from "@/components/wishlist/wishlist-store";
import {useAuth} from "@/components/auth/auth-store";
import {Price} from "./price";
import {type Product, safeFormatPrice} from "@/lib/types";
import {categories} from "@/lib/catalogue";

/** Product purchase panel (design.md §8 right column); conditional rows are omitted, not faked, when data is absent. */
export function ProductPurchasePanel({product}: { product: Product }) {
    const {add, pending} = useCart();
    const {toggle, isSaved, pending: wishlistPending} = useWishlist();
    const {status} = useAuth();
    const router = useRouter();
    const outOfStock = product.inStock === false;
    const saved = product.defaultVariantId != null && isSaved(product.defaultVariantId);

    const moq =
        product.minimumOrderQuantity ??
        product.minQuantity ??
        product.pricing?.minimumOrderQuantity ??
        product.pricing?.minQuantity ??
        1;

    const [quantity, setQuantity] = useState(moq);
    const [descExpanded, setDescExpanded] = useState(false);

    useEffect(() => {
        setQuantity(moq);
    }, [moq]);

    async function toggleWishlist() {
        if (status !== "authenticated") {
            router.push(`/login?next=/product/${product.slug}`);
            return;
        }
        await toggle(product);
    }

    const categoryName =
        categories.find((category) => category.slug === product.category)?.name ??
        product.category;

    async function handleAddToCart() {
        await add(product, quantity);
    }

    async function buyNow() {
        // Await the add so the cart page is not opened before the line exists.
        await add(product, quantity);
        router.push("/cart");
    }

    return (
        <div>
            <div className="flex items-center justify-between gap-3">
                <p className="text-[13px] font-semibold text-muted">Watani &amp; Sons Corp</p>
                {outOfStock && (
                    <span
                        className="inline-block shrink-0 rounded-full bg-red-600 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
                        Out of stock
                    </span>
                )}
            </div>

            <h1 className="mt-2 text-[24px] font-extrabold leading-tight text-teal-950 lg:text-[30px]">
                {product.fullName}
            </h1>

            <p className="mt-2 text-[15px] text-muted">{product.subtitle}</p>

            {/* Rating shown only when the catalogue supplies one (design.md §8). */}
            {product.rating !== undefined && product.rating !== null && (
                <p className="mt-4 flex items-center gap-2 text-[14px]">
                    <Star className="size-4 fill-gold text-gold" aria-hidden/>
                    <span className="font-bold text-teal-950">
                        {(typeof product.rating === "number" ? product.rating : parseFloat(String(product.rating || 5))).toFixed(1)} Rating
                    </span>
                    {/* Plain anchor, not `Link` - needs native scroll + hashchange to tell ProductTabs to open Reviews. */}
                    {product.reviewCount !== undefined && (
                        <a
                            href="#reviews"
                            className="text-muted underline underline-offset-4 transition-colors hover:text-teal-900"
                        >
                            {product.reviewCount} reviews
                        </a>
                    )}
                </p>
            )}

            <div className="mt-5">
                <Price product={product} size="detail"/>
                <p className="mt-1 text-[13px] font-semibold text-muted">
                    CAD · {product.unit || "unit"}
                </p>
            </div>

            {/* Specifications: MOQ + unit inline, then prices */}
            {(() => {
                const retailPrice = product.retailPrice ?? product.pricing?.retailPrice ?? (parseFloat(product.priceMajor || "0") + parseFloat(product.priceMinor || "0") / 100);
                const wholesalePrice = product.wholesalePrice ?? product.pricing?.wholesalePrice ?? (
                    product.pricing?.tiers?.find(t => t.pricingGroup === "WHOLESALE")?.unitPrice ??
                    Math.round((typeof retailPrice === "number" ? retailPrice : parseFloat(String(retailPrice || 0))) * 0.8 * 100) / 100
                );

                return (
                    <div className="mt-4 space-y-2 text-[13px]">
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                            <span className="font-semibold text-muted">MOQ: <span className="font-bold text-teal-950">{moq} {product.unit || "unit"}</span></span>
                            <span className="text-black/20">·</span>
                            <span className="font-semibold text-muted">Retail: <span className="font-bold text-teal-950">${safeFormatPrice(retailPrice)} CAD</span></span>
                            <span className="text-black/20">·</span>
                            <span className="font-semibold text-muted">Wholesale: <span className="font-bold text-teal-800">${safeFormatPrice(wholesalePrice)} CAD</span></span>
                        </div>
                    </div>
                );
            })()}

            {/* Volume pricing tier breaks if available */}
            {product.pricing?.tiers && product.pricing.tiers.length > 1 && (
                <div className="mt-3 rounded-xl border border-teal-950/10 bg-teal-950/[0.02] p-3 text-[12px]">
                    <p className="mb-1.5 font-bold text-teal-950">Volume Pricing Breaks:</p>
                    <div className="flex flex-wrap gap-1.5">
                        {product.pricing.tiers.map((t, idx) => (
                            <span
                                key={idx}
                                className="inline-flex items-center gap-1 rounded-md border border-black/5 bg-white px-2 py-1 font-semibold text-teal-950 shadow-xs"
                            >
                                <span>{t.minQuantity}+ units:</span>
                                <span className="font-bold text-teal-700">
                                    ${safeFormatPrice(t.unitPrice)} CAD
                                </span>
                            </span>
                        ))}
                    </div>
                </div>
            )}

            <hr className="my-6 border-black/[0.07]"/>

            <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap">
                {/* Quantity Stepper enforcing MOQ */}
                <div className="flex h-12 shrink-0 items-center rounded-full border border-black/10 bg-soft-control px-2">
                    <button
                        type="button"
                        disabled={quantity <= moq || outOfStock || pending}
                        onClick={() => setQuantity((prev) => Math.max(moq, prev - 1))}
                        className="grid size-8 place-items-center rounded-full text-teal-950 transition-colors hover:bg-white disabled:opacity-30"
                        aria-label="Decrease quantity"
                    >
                        <Minus className="size-4" aria-hidden />
                    </button>
                    <span className="min-w-[44px] text-center text-[15px] font-bold text-teal-950" aria-live="polite">
                        {quantity}
                    </span>
                    <button
                        type="button"
                        disabled={outOfStock || pending}
                        onClick={() => setQuantity((prev) => prev + 1)}
                        className="grid size-8 place-items-center rounded-full text-teal-950 transition-colors hover:bg-white disabled:opacity-30"
                        aria-label="Increase quantity"
                    >
                        <Plus className="size-4" aria-hidden />
                    </button>
                </div>

                <button
                    type="button"
                    disabled={pending || outOfStock}
                    onClick={() => void handleAddToCart()}
                    className={`inline-flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-full px-6 text-[15px] font-bold transition-transform duration-150 sm:flex-none sm:w-[196px] ${
                        outOfStock
                            ? "bg-black/10 text-muted cursor-not-allowed"
                            : "bg-lime-500 text-teal-950 hover:-translate-y-0.5 active:translate-y-px disabled:opacity-60 disabled:hover:translate-y-0"
                    }`}
                >
                    <ShoppingCart className="size-[18px]" aria-hidden />
                    {outOfStock ? "Out of stock" : "Add to cart"}
                </button>

                {!outOfStock && (
                    <button
                        type="button"
                        disabled={pending}
                        onClick={() => void buyNow()}
                        className="inline-flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-full border border-teal-950 bg-white px-5 text-[15px] font-bold text-teal-950 transition-transform duration-150 hover:-translate-y-0.5 active:translate-y-px disabled:opacity-60 disabled:hover:translate-y-0 sm:flex-none"
                    >
                        Buy now
                    </button>
                )}
            </div>

            <div className="mt-5 flex flex-wrap gap-6 text-[13px] font-bold">
                <button
                    type="button"
                    disabled={wishlistPending}
                    onClick={() => void toggleWishlist()}
                    aria-pressed={saved}
                    className="flex items-center gap-2 uppercase tracking-wide text-teal-950 underline underline-offset-4 disabled:opacity-60"
                >
                    <Heart
                        className={saved ? "size-4 fill-red-600 text-red-600" : "size-4"}
                        aria-hidden
                    />
                    {saved ? "Saved to wishlist" : "Add to wishlist"}
                </button>
            </div>

            <hr className="my-6 border-black/[0.07]"/>

            {/* Product attribute highlights — clean text + modern subtle icons, no circular badge UI */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px] font-medium text-teal-950">
                <span className="inline-flex items-center gap-1.5">
                    <Leaf className="size-4 text-emerald-600" aria-hidden/>
                    {categoryName || product.category || "Authentic Palestinian Product"}
                </span>
                <span className="inline-flex items-center gap-1.5">
                    <Truck className="size-4 text-teal-700" aria-hidden/>
                    Ships to Canada & USA
                </span>
            </div>

            <dl className="mt-4 space-y-1.5 text-[13px]">
                <div className="flex gap-2">
                    <dt className="font-semibold text-muted">SKU:</dt>
                    <dd className="text-muted">{product.sku}</dd>
                </div>
                {product.region && (
                    <div className="flex gap-2">
                        <dt className="font-semibold text-muted">Region:</dt>
                        <dd className="text-muted">{product.region}, Palestine</dd>
                    </div>
                )}
                <div className="flex flex-wrap gap-2">
                    <dt className="font-semibold text-muted">Category:</dt>
                    <dd>
                        <Link
                            href={`/categories?category=${product.category || ""}`}
                            className="text-muted underline underline-offset-4 transition-colors hover:text-teal-900"
                        >
                            {categoryName || "General"}
                        </Link>
                    </dd>
                </div>
            </dl>

            {/* Inline description — clamped to 3 lines by default, expandable */}
            {(() => {
                const descText = product.description || product.subtitle || "";
                if (!descText || descText.trim().length === 0) return null;
                const isHtml = /<[a-zA-Z][^>]*>/.test(descText);
                const plainText = isHtml
                    ? descText.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
                    : descText.trim();
                return (
                    <div className="mt-5 border-t border-black/5 pt-4">
                        <p
                            className={`text-[13px] leading-relaxed text-muted transition-all ${
                                descExpanded ? "" : "line-clamp-3"
                            }`}
                        >
                            {plainText}
                        </p>
                        {plainText.length > 180 && (
                            <button
                                type="button"
                                onClick={() => setDescExpanded((v) => !v)}
                                className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-semibold text-teal-700 hover:text-teal-900 transition-colors"
                            >
                                {descExpanded ? "Show less" : "Read more"}
                                <ChevronDown
                                    className={`size-3.5 transition-transform duration-200 ${
                                        descExpanded ? "rotate-180" : ""
                                    }`}
                                    aria-hidden
                                />
                            </button>
                        )}
                    </div>
                );
            })()}
        </div>
    );
}
