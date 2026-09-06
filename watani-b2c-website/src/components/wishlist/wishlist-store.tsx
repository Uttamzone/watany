"use client";

import {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,} from "react";
import type {Wishlist, WishlistItem} from "@/lib/wishlist";
import * as wishlistApi from "@/lib/wishlist";
import type {Product} from "@/lib/types";
import {ApiError} from "@/lib/api";
import {useAuth} from "@/components/auth/auth-store";
import {useNotifications} from "@/components/notifications/notification-store";

/** Wishlist state (F-CAT-8), signed-in only. Mirrors cart-store.tsx's pattern but with no guest state. */

type WishlistContextValue = {
    items: WishlistItem[];
    isSaved: (variantId: number) => boolean;
    add: (product: Product) => Promise<void>;
    remove: (variantId: number) => Promise<void>;
    toggle: (product: Product) => Promise<void>;
    hydrated: boolean;
    pending: boolean;
    error: string | null;
};

const WishlistContext = createContext<WishlistContextValue | null>(null);

const EMPTY: Wishlist = {items: []};

export function WishlistProvider({children}: { children: React.ReactNode }) {
    const {status} = useAuth();
    const [wishlist, setWishlist] = useState<Wishlist>(EMPTY);
    const [hydrated, setHydrated] = useState(false);
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const notifications = useNotifications();

    const mounted = useRef(true);
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);

    // Load once signed in; drop everything on logout so a later signed-in
    // visitor on the same browser never sees a stale wishlist.
    useEffect(() => {
        let cancelled = false;

        async function sync() {
            if (status !== "authenticated") {
                if (!cancelled) {
                    setWishlist(EMPTY);
                    setHydrated(status !== "loading");
                }
                return;
            }

            try {
                const raw = await wishlistApi.getWishlist();
                // Backend may return a plain array instead of {items: [...]}; normalise to the expected shape.
                const loaded: Wishlist = Array.isArray(raw)
                    ? {items: raw as unknown as WishlistItem[]}
                    : (raw && Array.isArray((raw as Wishlist).items) ? raw : {items: []});
                if (!cancelled) setWishlist(loaded);
            } catch {
                // An unreachable backend must never block the storefront.
            } finally {
                if (!cancelled) setHydrated(true);
            }
        }

        void sync();
        return () => {
            cancelled = true;
        };
    }, [status]);

    const run = useCallback(
        async (operation: () => Promise<Wishlist>) => {
            setPending(true);
            setError(null);
            try {
                const next = await operation();
                if (mounted.current) setWishlist(next);
            } catch (cause) {
                // A 409 means the item is already saved (e.g. a second tab already
                // added it) - resync silently rather than surfacing a duplicate error.
                if (cause instanceof ApiError && cause.status === 409) {
                    try {
                        const latest = await wishlistApi.getWishlist();
                        if (mounted.current) setWishlist(latest);
                    } catch {
                        // Best-effort resync; the stale state is no worse than before.
                    }
                    return;
                }

                const message =
                    cause instanceof Error ? cause.message : "Could not update your wishlist";
                if (mounted.current) setError(message);
                notifications.error("Could not update your wishlist", message);
            } finally {
                if (mounted.current) setPending(false);
            }
        },
        [notifications],
    );

    const add = useCallback(
        async (product: Product) => {
            const variantId = product.defaultVariantId;
            if (variantId == null) {
                setError("This product is not available to save right now");
                return;
            }
            if (status !== "authenticated") {
                notifications.error(
                    "Sign in required",
                    "Sign in to save items to your wishlist.",
                );
                return;
            }
            await run(() => wishlistApi.addWishlistItem(variantId));
        },
        [run, status, notifications],
    );

    const remove = useCallback(
        async (variantId: number) => {
            await run(() => wishlistApi.removeWishlistItem(variantId));
        },
        [run],
    );

    const isSaved = useCallback(
        (variantId: number) => (wishlist?.items ?? []).some((item) => item.variantId === variantId),
        [wishlist],
    );

    const toggle = useCallback(
        async (product: Product) => {
            const variantId = product.defaultVariantId;
            if (variantId == null) return;
            if (isSaved(variantId)) {
                await remove(variantId);
            } else {
                await add(product);
            }
        },
        [add, remove, isSaved],
    );

    const value = useMemo<WishlistContextValue>(
        () => ({
            items: wishlist?.items ?? [],
            isSaved,
            add,
            remove,
            toggle,
            hydrated,
            pending,
            error,
        }),
        [wishlist, isSaved, add, remove, toggle, hydrated, pending, error],
    );

    return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist(): WishlistContextValue {
    const context = useContext(WishlistContext);
    if (!context) {
        throw new Error("useWishlist must be used inside a WishlistProvider");
    }
    return context;
}
