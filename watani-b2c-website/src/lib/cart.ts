import {apiFetch, whenAuthSettled} from "@/lib/api";
import type {PricingGroup} from "@/lib/auth";

/**
 * Cart access layer. Server owns the cart - prices/tiers/stock all resolve
 * backend-side (requirement.md §3, R-PR-6); nothing here computes a price.
 * Guests are identified by a session token; lines are never persisted client-side.
 */

const CART_TOKEN_KEY = "watani.cartToken.v1";

/** Mirrors CartDtos.CartLine. */
export type CartLine = {
    itemId: number;
    variantId: number;
    productSlug: string;
    productName: string;
    sku: string;
    unit: string;
    image: string | null;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    appliedGroup: PricingGroup;
    fellBackToRetail: boolean;
    /** Tier-unlock hint, e.g. "Add 4 more to unlock wholesale pricing" (R-PR-7). */
    unlockMessage: string | null;
    unlockAtQuantity: number | null;
    unlockUnitPrice: number | null;
    inStock: boolean;
    availableStock: number;
    taxable: boolean;
};

/** Mirrors CartDtos.CartResponse. */
export type Cart = {
    cartId: number | null;
    sessionToken: string | null;
    items: CartLine[];
    itemCount: number;
    subtotal: number;
    discountTotal: number;
    couponCode: string | null;
    pricingGroup: PricingGroup;
    currency: string;
};

export function readCartToken(): string | null {
    if (typeof window === "undefined") return null;
    try {
        return window.localStorage.getItem(CART_TOKEN_KEY);
    } catch {
        // Storage can be unavailable (private mode, quota). The cart still works
        // for the current request; it just won't survive a reload for a guest.
        return null;
    }
}

export function writeCartToken(token: string | null) {
    if (typeof window === "undefined" || !token) return;
    try {
        window.localStorage.setItem(CART_TOKEN_KEY, token);
    } catch {
        // Non-fatal, as above.
    }
}

export function clearCartToken() {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.removeItem(CART_TOKEN_KEY);
    } catch {
        // Non-fatal, as above.
    }
}

/**
 * Guest token on every call (ignored for signed-in callers). `Cache-Control: no-cache`
 * is required - an intermediary not keying on `X-Cart-Token` could replay one guest's
 * cart to another, which is what made reloaded carts appear empty in production.
 */
function cartHeaders(): HeadersInit {
    const token = readCartToken();
    const headers: Record<string, string> = {"Cache-Control": "no-cache"};
    if (token) headers["X-Cart-Token"] = token;
    return headers;
}

/**
 * Persists the session token the service echoes back for a first-time guest.
 *
 * Only ever *adopts* a token, never replaces one we already hold. A response
 * carrying a different token means the server minted a fresh cart for a request
 * that failed to identify us; honouring it would strand the real basket. The
 * token is dropped deliberately (logout, merge), never by an echoed value.
 */
function remember(cart: Cart): Cart {
    if (cart.sessionToken && !readCartToken()) {
        writeCartToken(cart.sessionToken);
    }
    return cart;
}

/**
 * Reads the cart once the auth refresh has settled, so a signed-in shopper's
 * request carries their token instead of being served a new anonymous cart.
 */
export async function getCart(): Promise<Cart> {
    await whenAuthSettled();
    return remember(
        await apiFetch<Cart>("/api/cart", {
            headers: cartHeaders(),
            cache: "no-store",
        }),
    );
}

export async function addCartItem(
    variantId: number,
    quantity = 1,
): Promise<Cart> {
    return remember(
        await apiFetch<Cart>("/api/cart/items", {
            method: "POST",
            headers: cartHeaders(),
            body: JSON.stringify({variantId, quantity}),
        }),
    );
}

/** Sets a line quantity; zero removes the line. */
export async function updateCartItem(
    itemId: number,
    quantity: number,
): Promise<Cart> {
    return remember(
        await apiFetch<Cart>(`/api/cart/items/${itemId}`, {
            method: "PUT",
            headers: cartHeaders(),
            body: JSON.stringify({quantity}),
        }),
    );
}

export async function removeCartItem(itemId: number): Promise<Cart> {
    return remember(
        await apiFetch<Cart>(`/api/cart/items/${itemId}`, {
            method: "DELETE",
            headers: cartHeaders(),
        }),
    );
}

export async function clearCart(): Promise<Cart> {
    return remember(
        await apiFetch<Cart>("/api/cart", {
            method: "DELETE",
            headers: cartHeaders(),
        }),
    );
}

/**
 * Folds a guest cart into the signed-in account's cart after login (F-CRT-1),
 * so items added while browsing anonymously are not lost.
 */
export async function mergeGuestCart(): Promise<Cart> {
    const merged = await apiFetch<Cart>("/api/cart/merge", {
        method: "POST",
        headers: cartHeaders(),
    });
    // The guest cart no longer exists; keeping its token would only risk
    // re-attaching an empty cart on a later request.
    clearCartToken();
    return merged;
}
