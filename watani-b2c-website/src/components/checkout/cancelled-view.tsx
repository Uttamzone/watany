"use client";

import {useEffect} from "react";
import Link from "next/link";
import {useCart} from "@/components/cart/cart-store";

/**
 * Client half of the payment-cancelled page. Returning from Stripe is a fresh
 * document load, so the cart is re-read here before the shopper follows either
 * link - QA saw an empty cart because the page only rendered static links and
 * the basket state was never resynced after the redirect back.
 *
 * The order stays unpaid and its stock reservation is released when the Stripe
 * session expires, so the cart the server returns is the authoritative one.
 */
export function CancelledView({orderNumber}: { orderNumber?: string }) {
    const {refresh, count, hydrated} = useCart();

    useEffect(() => {
        void refresh();
    }, [refresh]);

    return (
        <div className="mt-8 max-w-xl rounded-[22px] bg-surface p-6">
            <p className="text-[16px] font-bold text-teal-950">
                Nothing has been charged.
            </p>
            <p className="mt-2 text-[15px] leading-relaxed text-muted">
                You left the payment page before it completed
                {orderNumber ? `, so order ${orderNumber} was not paid for` : ""}.{" "}
                {hydrated && count > 0
                    ? `Your cart still has ${count} ${count === 1 ? "item" : "items"} - you can try again whenever you are ready.`
                    : "Your cart is exactly as you left it - you can try again whenever you are ready."}
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
                <Link
                    href="/checkout"
                    className="inline-flex h-12 items-center rounded-full bg-lime-500 px-7 text-[15px] font-bold text-teal-950"
                >
                    Try payment again
                </Link>
                <Link
                    href="/cart"
                    className="inline-flex h-12 items-center rounded-full bg-soft-control px-7 text-[15px] font-bold text-teal-950"
                >
                    Back to cart
                </Link>
            </div>
        </div>
    );
}
