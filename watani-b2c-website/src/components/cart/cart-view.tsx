"use client";

import Image from "next/image";
import Link from "next/link";
import {Minus, Plus, Trash2} from "lucide-react";
import {useCart} from "./cart-store";
import {productImageSrc} from "@/lib/products";
import {useCurrency} from "@/components/currency/currency-store";

/** Cart shell (design.md §2). Every figure comes from the server (R-PR-6) - nothing computed locally. */
export function CartView() {
    // Cart failures surface as toasts from CartProvider (the universal notification
    // stack), not as a banner inside this card.
    const {lines, subtotal, count, setQuantity, remove, clear, hydrated, pending} =
        useCart();
    const {format} = useCurrency();

    if (!hydrated) {
        return (
            <p className="mt-8 text-[15px] text-muted" role="status">
                Loading your cart…
            </p>
        );
    }

    if (lines.length === 0) {
        return (
            <div className="mt-8 rounded-[22px] bg-surface p-12 text-center">
                <p className="text-[18px] font-bold text-teal-950">Your cart is empty</p>
                <p className="mt-2 text-[15px] text-muted">
                    Browse the catalogue and add a few Palestinian pantry staples.
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
        <div className="mt-8 grid gap-8 lg:grid-cols-[1.6fr_1fr]">
            <div>
                <ul className="space-y-4">
                    {lines.map((line) => (
                        <li
                            key={line.itemId}
                            className="flex flex-wrap items-center gap-4 rounded-[18px] bg-surface p-4"
                        >
                            <Link
                                href={`/product/${line.productSlug}`}
                                className="shrink-0 rounded-xl bg-[#f1f3f1] p-2"
                            >
                                <Image
                                    src={productImageSrc(line.image)}
                                    alt={line.productName}
                                    width={400}
                                    height={400}
                                    sizes="88px"
                                    className="size-[76px] object-contain"
                                />
                            </Link>

                            <div className="min-w-[160px] flex-1">
                                <Link
                                    href={`/product/${line.productSlug}`}
                                    className="text-[15px] font-bold text-teal-950 hover:underline"
                                >
                                    {line.productName}
                                </Link>
                                <p className="mt-1 text-[12px] font-semibold uppercase tracking-wide text-muted">
                                    {line.unit}
                                </p>
                                <p className="mt-1 text-[14px] font-semibold text-muted">
                                    {format(line.unitPrice)} each
                                </p>

                                {/* Tier-unlock hint, e.g. "Add 4 more to unlock wholesale" (R-PR-7). */}
                                {line.unlockMessage && (
                                    <p className="mt-1 text-[12px] font-bold text-teal-900">
                                        {line.unlockMessage}
                                    </p>
                                )}

                                {!line.inStock && (
                                    <p className="mt-1 text-[12px] font-bold text-coral">
                                        Out of stock - remove to check out
                                    </p>
                                )}
                            </div>

                            <div className="flex items-center gap-1 rounded-full bg-soft-control p-1">
                                <button
                                    type="button"
                                    disabled={pending}
                                    onClick={() =>
                                        void (line.quantity <= 1 || !line.inStock
                                            ? remove(line.itemId)
                                            : setQuantity(line.itemId, line.quantity - 1))
                                    }
                                    aria-label={
                                        line.quantity <= 1 || !line.inStock
                                            ? `Remove ${line.productName} from cart`
                                            : `Decrease ${line.productName} quantity`
                                    }
                                    className="grid size-9 place-items-center rounded-full bg-white text-teal-950 disabled:opacity-50"
                                >
                                    <Minus className="size-4" aria-hidden/>
                                </button>
                                <span
                                    aria-live="polite"
                                    className="min-w-8 text-center text-[15px] font-extrabold text-teal-950"
                                >
                  {line.quantity}
                                    <span className="sr-only"> in cart</span>
                </span>
                                <button
                                    type="button"
                                    disabled={pending || line.quantity >= line.availableStock}
                                    onClick={() => void setQuantity(line.itemId, line.quantity + 1)}
                                    aria-label={`Increase ${line.productName} quantity`}
                                    className="grid size-9 place-items-center rounded-full bg-white text-teal-950 disabled:opacity-50"
                                >
                                    <Plus className="size-4" aria-hidden/>
                                </button>
                            </div>

                            <p className="w-24 text-right text-[16px] font-extrabold text-teal-950">
                                {format(line.lineTotal)}
                            </p>

                            <button
                                type="button"
                                disabled={pending}
                                onClick={() => void remove(line.itemId)}
                                aria-label={`Remove ${line.productName} from cart`}
                                className="grid size-10 place-items-center rounded-full text-muted transition-colors hover:bg-canvas hover:text-coral disabled:opacity-50"
                            >
                                <Trash2 className="size-4" aria-hidden/>
                            </button>
                        </li>
                    ))}

                    <li>
                        <button
                            type="button"
                            disabled={pending}
                            onClick={() => void clear()}
                            className="text-[13px] font-bold text-coral underline underline-offset-4 disabled:opacity-50"
                        >
                            Clear cart
                        </button>
                    </li>
                </ul>
            </div>

            <aside className="h-fit rounded-[22px] bg-surface p-6 lg:sticky lg:top-[110px]">
                <h2 className="text-[18px] font-extrabold text-teal-950">Order summary</h2>

                <dl className="mt-5 space-y-3 text-[15px]">
                    <div className="flex justify-between">
                        <dt className="text-muted">
                            Total products ({count} {count === 1 ? "item" : "items"})
                        </dt>
                        <dd className="font-bold text-teal-950">{format(subtotal)}</dd>
                    </div>
                    <div className="flex justify-between">
                        <dt className="text-muted">Shipping</dt>
                        <dd className="text-muted">Calculated at checkout</dd>
                    </div>
                    <div className="flex justify-between">
                        <dt className="text-muted">Total taxes</dt>
                        <dd className="text-muted">Calculated at checkout</dd>
                    </div>
                </dl>

                <hr className="my-5 border-black/[0.07]"/>

                <div className="flex items-baseline justify-between">
                    <span className="text-[15px] font-bold text-teal-950">Total</span>
                    <span className="text-[26px] font-extrabold text-teal-950">
            {format(subtotal)}
          </span>
                </div>
                <p className="mt-1 text-[12px] text-muted">CAD, before shipping and tax</p>

                <Link
                    href="/checkout"
                    className="mt-6 flex h-12 w-full items-center justify-center rounded-full bg-lime-500 text-[15px] font-bold text-teal-950 transition-colors hover:bg-lime-400"
                >
                    Checkout
                </Link>

                <Link
                    href="/categories"
                    className="mt-4 block text-center text-[13px] font-bold text-teal-950 underline underline-offset-4"
                >
                    Continue shopping
                </Link>
            </aside>
        </div>
    );
}
