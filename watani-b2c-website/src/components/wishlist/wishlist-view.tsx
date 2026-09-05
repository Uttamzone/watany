"use client";

import Image from "next/image";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {useState} from "react";
import {ShoppingCart, Trash2} from "lucide-react";
import {useWishlist} from "./wishlist-store";
import {useCart} from "@/components/cart/cart-store";
import {useAuth} from "@/components/auth/auth-store";
import {useNotifications} from "@/components/notifications/notification-store";
import * as cartApi from "@/lib/cart";
import {productImageSrc} from "@/lib/products";
import {useCurrency} from "@/components/currency/currency-store";

/** Wishlist shell (F-CAT-8), mirrors cart-view.tsx's layout but with no totals - just "move to cart". */
export function WishlistView() {
    const {status} = useAuth();
    const pathname = usePathname();
    const {items, remove, hydrated, pending} = useWishlist();
    const {refresh: refreshCart} = useCart();
    const notifications = useNotifications();
    const {format} = useCurrency();
    const [movingVariantId, setMovingVariantId] = useState<number | null>(null);

    async function moveToCart(variantId: number) {
        setMovingVariantId(variantId);
        try {
            await cartApi.addCartItem(variantId);
            await refreshCart();
        } catch (cause) {
            const message = cause instanceof Error ? cause.message : "Could not add to cart";
            notifications.error("Could not add to cart", message);
        } finally {
            setMovingVariantId(null);
        }
    }

    if (status === "guest") {
        return (
            <div className="mt-8 rounded-[22px] bg-surface p-12 text-center">
                <p className="text-[18px] font-bold text-teal-950">Sign in to see your wishlist</p>
                <p className="mt-2 text-[15px] text-muted">
                    Saved items are tied to your account.
                </p>
                <Link
                    href={`/login?next=${encodeURIComponent(pathname)}`}
                    className="mt-6 inline-flex h-12 items-center rounded-full bg-lime-500 px-7 text-[15px] font-bold text-teal-950"
                >
                    Log in
                </Link>
            </div>
        );
    }

    if (!hydrated) {
        return (
            <p className="mt-8 text-[15px] text-muted" role="status">
                Loading your wishlist…
            </p>
        );
    }

    if (items.length === 0) {
        return (
            <div className="mt-8 rounded-[22px] bg-surface p-12 text-center">
                <p className="text-[18px] font-bold text-teal-950">Your wishlist is empty</p>
                <p className="mt-2 text-[15px] text-muted">
                    Save products you like using the heart icon on any product page.
                </p>
                <Link
                    href="/categories"
                    className="mt-6 inline-flex h-12 items-center rounded-full bg-lime-500 px-7 text-[15px] font-bold text-teal-950"
                >
                    Shop all products
                </Link>
            </div>
        );
    }

    return (
        <div className="mt-8">
            <ul className="space-y-4">
                {items.map((item) => (
                    <li
                        key={item.itemId}
                        className="flex flex-wrap items-center gap-4 rounded-[18px] bg-surface p-4"
                    >
                        <Link
                            href={`/product/${item.productSlug}`}
                            className="shrink-0 rounded-xl bg-[#f1f3f1] p-2"
                        >
                            <Image
                                src={productImageSrc(item.image)}
                                alt={item.productName}
                                width={400}
                                height={400}
                                sizes="88px"
                                className="size-[76px] object-contain"
                            />
                        </Link>

                        <div className="min-w-[160px] flex-1">
                            <Link
                                href={`/product/${item.productSlug}`}
                                className="text-[15px] font-bold text-teal-950 hover:underline"
                            >
                                {item.productName}
                            </Link>
                            <p className="mt-1 text-[12px] font-semibold uppercase tracking-wide text-muted">
                                {item.unit}
                            </p>
                            <p className="mt-1 text-[14px] font-semibold text-muted">
                                {format(item.unitPrice)}
                            </p>

                            {!item.inStock && (
                                <p className="mt-1 text-[12px] font-bold text-coral">Out of stock</p>
                            )}
                        </div>

                        <button
                            type="button"
                            disabled={movingVariantId === item.variantId || !item.inStock}
                            onClick={() => void moveToCart(item.variantId)}
                            className="inline-flex h-11 items-center gap-2 rounded-full bg-soft-control px-5 text-[14px] font-bold text-teal-950 disabled:opacity-50"
                        >
                            <ShoppingCart className="size-4" aria-hidden/>
                            Add to cart
                        </button>

                        <button
                            type="button"
                            disabled={pending}
                            onClick={() => void remove(item.variantId)}
                            aria-label={`Remove ${item.productName} from wishlist`}
                            className="grid size-10 place-items-center rounded-full text-muted transition-colors hover:bg-canvas hover:text-coral disabled:opacity-50"
                        >
                            <Trash2 className="size-4" aria-hidden/>
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
}
