"use client";

import Link from "next/link";
import {useRouter} from "next/navigation";
import {Heart, Leaf, Package, ShoppingCart, Star, Truck} from "lucide-react";
import {useCart} from "@/components/cart/cart-store";
import {useWishlist} from "@/components/wishlist/wishlist-store";
import {useAuth} from "@/components/auth/auth-store";
import {Price} from "./price";
import type {Product} from "@/lib/types";
import {categories} from "@/lib/catalogue";
import {sanitizeRichText} from "@/lib/rich-text";

/** Product purchase panel (design.md §8 right column); conditional rows are omitted, not faked, when data is absent. */
export function ProductPurchasePanel({product}: { product: Product }) {
    const {add, pending} = useCart();
    const {toggle, isSaved, pending: wishlistPending} = useWishlist();
    const {status} = useAuth();
    const router = useRouter();
    const outOfStock = product.inStock === false;
    const saved = product.defaultVariantId != null && isSaved(product.defaultVariantId);

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

    async function buyNow() {
        // Await the add so the cart page is not opened before the line exists.
        await add(product);
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
            {product.rating !== undefined && (
                <p className="mt-4 flex items-center gap-2 text-[14px]">
                    <Star className="size-4 fill-gold text-gold" aria-hidden/>
                    <span className="font-bold text-teal-950">
            {product.rating.toFixed(1)} Rating
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
                    CAD · {product.unit}
                </p>
            </div>

            <hr className="my-6 border-black/[0.07]"/>

      <div className="flex gap-3 sm:flex-wrap">
        <button
          type="button"
          disabled={pending || outOfStock}
          onClick={() => void buyNow()}
          className="inline-flex h-12 min-w-0 flex-1 items-center justify-center sm:w-[196px] sm:flex-none gap-2 rounded-full bg-lime-500 text-[15px] font-bold text-teal-950 transition-transform duration-150 hover:-translate-y-0.5 active:translate-y-px disabled:opacity-60 disabled:hover:translate-y-0"
        >
          <ShoppingCart className="size-[18px]" aria-hidden />
          Add to cart
        </button>
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

            {/* Three attribute icons - design.md §8. */}
            <ul className="flex flex-wrap gap-6">
                {[
                    {icon: Leaf, label: product.category},
                    {icon: Package, label: product.unit},
                    {icon: Truck, label: "Ships to Canada & USA"},
                ].map((attribute) => {
                    const Icon = attribute.icon;
                    return (
                        <li
                            key={attribute.label}
                            className="flex items-center gap-2 text-[13px] font-semibold text-teal-950"
                        >
              <span className="grid size-9 place-items-center rounded-full bg-soft-control">
                <Icon className="size-4" aria-hidden/>
              </span>
                            {attribute.label}
                        </li>
                    );
                })}
            </ul>

            <dl className="mt-6 space-y-2 text-[13px]">
                <div className="flex gap-2">
                    <dt className="font-bold text-teal-950">SKU:</dt>
                    <dd className="text-muted">{product.sku}</dd>
                </div>
                {product.region && (
                    <div className="flex gap-2">
                        <dt className="font-bold text-teal-950">Region:</dt>
                        <dd className="text-muted">{product.region}, Palestine</dd>
                    </div>
                )}
                <div className="flex flex-wrap gap-2">
                    <dt className="font-bold text-teal-950">Category:</dt>
                    <dd>
                        <Link
                            href={`/categories?category=${product.category}`}
                            className="text-muted underline underline-offset-4 transition-colors hover:text-teal-900"
                        >
                            {categoryName}
                        </Link>
                        <span className="text-muted">, </span>
                        <Link
                            href={`/categories?category=${product.category}`}
                            className="text-muted underline underline-offset-4 transition-colors hover:text-teal-900"
                        >
                            {categoryName.toLowerCase()} {product.unit}
                        </Link>
                    </dd>
                </div>
            </dl>

            <div
                className="rich-text mt-6 text-[15px] leading-relaxed text-muted"
                // Short description may be plain text or admin-authored HTML; sanitised the same
                // way as longDescription. Plain text has no tags to strip.
                dangerouslySetInnerHTML={{
                    __html: /<[a-zA-Z][^>]*>/.test(product.description ?? "")
                        ? sanitizeRichText(product.description)
                        : (product.description ?? ""),
                }}
            />
        </div>
    );
}
