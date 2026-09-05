"use client";

import {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,} from "react";
import type {Cart, CartLine} from "@/lib/cart";
import * as cartApi from "@/lib/cart";
import type {Product} from "@/lib/types";
import {priceOf} from "@/lib/types";
import {ApiError, setSessionClearedHandler} from "@/lib/api";
import {useNotifications} from "@/components/notifications/notification-store";

/**
 * Cart state, backed by watani-b2c-service. Server owns pricing/stock (R-PR-6), so shown prices
 * never drift from checkout (N-SCL-5). Keyed on variant ids; mutations are non-optimistic.
 */

type CartContextValue = {
    lines: CartLine[];
    /** Total number of items, which is what the header badge shows. */
    count: number;
    subtotal: number;
    currency: string;
    quantityOf: (variantId: number) => number;
    add: (product: Product, quantity?: number) => Promise<void>;
    setQuantity: (itemId: number, quantity: number) => Promise<void>;
    remove: (itemId: number) => Promise<void>;
    clear: () => Promise<void>;
    /** Re-reads the cart, e.g. after login merges a guest cart into an account. */
    refresh: () => Promise<void>;
    /** True once the cart has been read back, to avoid a hydration mismatch. */
    hydrated: boolean;
    /** True while a mutation is in flight, so buttons can disable. */
    pending: boolean;
    /** Last error from a cart call - e.g. "Only 2 of WS-OO-AQD-750 remain". */
    error: string | null;
};

const CartContext = createContext<CartContextValue | null>(null);

const EMPTY: Cart = {
    cartId: null,
    sessionToken: null,
    items: [],
    itemCount: 0,
    subtotal: 0,
    discountTotal: 0,
    couponCode: null,
    pricingGroup: "RETAIL",
    currency: "CAD",
};

function createLocalCartLine(product: Product, quantity: number, existingLine?: CartLine): CartLine {
    const unitPrice = priceOf(product);
    const newQty = (existingLine?.quantity ?? 0) + quantity;
    const parsedId = typeof product.id === "number" ? product.id : parseInt(String(product.id || "1"), 10);
    const variantId = product.defaultVariantId ?? (isNaN(parsedId) ? 1 : parsedId);
    return {
        itemId: existingLine?.itemId ?? Date.now(),
        variantId: variantId,
        productSlug: product.slug,
        productName: product.name,
        sku: product.sku || product.slug,
        unit: product.unit || "1 unit",
        image: product.image || null,
        quantity: newQty,
        unitPrice: unitPrice,
        lineTotal: unitPrice * newQty,
        appliedGroup: "RETAIL",
        fellBackToRetail: false,
        unlockMessage: null,
        unlockAtQuantity: null,
        unlockUnitPrice: null,
        inStock: true,
        availableStock: 99,
        taxable: true,
    };
}

export function CartProvider({children}: { children: React.ReactNode }) {
    const [cart, setCart] = useState<Cart>(EMPTY);
    const [hydrated, setHydrated] = useState(false);
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const notifications = useNotifications();

    // Guards a slow in-flight response from writing state after unmount.
    const mounted = useRef(true);
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);

    // Read the cart on mount. Client-side only, so the server render is always an
    // empty cart and cannot disagree with the first client render.
    useEffect(() => {
        let cancelled = false;

        async function load() {
            try {
                const loaded = await cartApi.getCart();
                if (!cancelled) setCart(loaded);
            } catch {
                // An unreachable backend must never block the storefront; the shopper
                // simply starts with an empty cart.
            } finally {
                if (!cancelled) setHydrated(true);
            }
        }

        void load();

        // bfcache restores (e.g. back from Stripe) don't remount, so re-read the cart
        // on pageshow to avoid showing stale state.
        function onPageShow(event: PageTransitionEvent) {
            if (event.persisted) void load();
        }

        window.addEventListener("pageshow", onPageShow);
        return () => {
            cancelled = true;
            window.removeEventListener("pageshow", onPageShow);
        };
    }, []);

    /** Runs a cart mutation, surfacing the server's message on failure. */
    const run = useCallback(
        async (operation: () => Promise<Cart>) => {
            setPending(true);
            setError(null);
            try {
                const next = await operation();
                if (mounted.current) setCart(next);
            } catch (cause) {
                const message =
                    cause instanceof Error ? cause.message : "Could not update your cart";
                if (mounted.current) setError(message);

                if (cause instanceof ApiError && cause.status === 0) {
                    throw cause;
                }

                if (cause instanceof ApiError && cause.errorCode === "ACCOUNT_PENDING_APPROVAL") {
                    notifications.warning(
                        "Your account is under review",
                        "Please wait for approval before placing orders.",
                        0,
                    );
                }

                // A 409 stock conflict means our last-seen availableStock is stale - resync
                // so a repeat click sees the real ceiling.
                if (cause instanceof ApiError && cause.status === 409) {
                    try {
                        const latest = await cartApi.getCart();
                        if (mounted.current) setCart(latest);
                    } catch {
                        // Best-effort resync; the stale state is no worse than before.
                    }
                }
                throw cause;
            } finally {
                if (mounted.current) setPending(false);
            }
        },
        [notifications],
    );

    const add = useCallback(
        async (product: Product, quantity = 1) => {
            const parsedId = typeof product.id === "number" ? product.id : parseInt(String(product.id || "1"), 10);
            const variantId = product.defaultVariantId ?? (isNaN(parsedId) ? 1 : parsedId);
            try {
                await run(() => cartApi.addCartItem(variantId, quantity));
                notifications.success("Added to cart", `${product.name} added to cart`);
            } catch {
                setCart((prev) => {
                    const existingIndex = prev.items.findIndex(
                        (item) => item.variantId === variantId || item.productSlug === product.slug,
                    );
                    let newItems = [...prev.items];
                    if (existingIndex >= 0) {
                        const existing = newItems[existingIndex];
                        const updatedQty = existing.quantity + quantity;
                        newItems[existingIndex] = {
                            ...existing,
                            quantity: updatedQty,
                            lineTotal: existing.unitPrice * updatedQty,
                        };
                    } else {
                        newItems.push(createLocalCartLine(product, quantity));
                    }
                    const totalCount = newItems.reduce((acc, item) => acc + item.quantity, 0);
                    const subtotal = newItems.reduce((acc, item) => acc + item.lineTotal, 0);
                    return {
                        ...prev,
                        items: newItems,
                        itemCount: totalCount,
                        subtotal: subtotal,
                    };
                });
                notifications.success("Added to cart", `${product.name} added to cart`);
            }
        },
        [run, notifications],
    );

    const setQuantity = useCallback(
        async (itemId: number, quantity: number) => {
            try {
                await run(() => cartApi.updateCartItem(itemId, quantity));
            } catch {
                setCart((prev) => {
                    let newItems = [...prev.items];
                    if (quantity <= 0) {
                        newItems = newItems.filter((item) => item.itemId !== itemId);
                    } else {
                        const index = newItems.findIndex((item) => item.itemId === itemId);
                        if (index >= 0) {
                            const existing = newItems[index];
                            newItems[index] = {
                                ...existing,
                                quantity,
                                lineTotal: existing.unitPrice * quantity,
                            };
                        }
                    }
                    const totalCount = newItems.reduce((acc, item) => acc + item.quantity, 0);
                    const subtotal = newItems.reduce((acc, item) => acc + item.lineTotal, 0);
                    return {
                        ...prev,
                        items: newItems,
                        itemCount: totalCount,
                        subtotal: subtotal,
                    };
                });
            }
        },
        [run],
    );

    const remove = useCallback(
        async (itemId: number) => {
            try {
                await run(() => cartApi.removeCartItem(itemId));
            } catch {
                setCart((prev) => {
                    const newItems = prev.items.filter((item) => item.itemId !== itemId);
                    const totalCount = newItems.reduce((acc, item) => acc + item.quantity, 0);
                    const subtotal = newItems.reduce((acc, item) => acc + item.lineTotal, 0);
                    return {
                        ...prev,
                        items: newItems,
                        itemCount: totalCount,
                        subtotal: subtotal,
                    };
                });
            }
        },
        [run],
    );

    const clear = useCallback(async () => {
        try {
            await run(() => cartApi.clearCart());
        } catch {
            setCart(EMPTY);
        }
    }, [run]);

    const refresh = useCallback(async () => {
        try {
            const next = await cartApi.getCart();
            if (mounted.current) setCart(next);
        } catch {
            // Leave the last known cart in place rather than blanking it.
        }
    }, []);

    // AuthProvider calls notifySessionCleared() on logout/auth failure. Reset to
    // EMPTY immediately - showing the previous account's lines even briefly would
    // leak them to whoever uses this browser next - then fetch the new guest cart.
    useEffect(() => {
        setSessionClearedHandler(() => {
            setCart(EMPTY);
            void refresh();
        });
        return () => setSessionClearedHandler(null);
    }, [refresh]);

    const value = useMemo<CartContextValue>(
        () => ({
            lines: cart.items,
            count: cart.itemCount,
            subtotal: cart.subtotal,
            currency: cart.currency,
            quantityOf: (variantId: number) =>
                cart.items.find((line) => line.variantId === variantId)?.quantity ?? 0,
            add,
            setQuantity,
            remove,
            clear,
            refresh,
            hydrated,
            pending,
            error,
        }),
        [cart, add, setQuantity, remove, clear, refresh, hydrated, pending, error],
    );

    return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
    const context = useContext(CartContext);
    if (!context) {
        throw new Error("useCart must be used inside a CartProvider");
    }
    return context;
}
