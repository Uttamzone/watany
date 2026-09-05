import {apiFetch} from "@/lib/api";

/**
 * Wishlist access layer (F-CAT-8). Signed-in only - no guest wishlist, no session
 * token unlike cart.ts. Server resolves prices per pricing group, same as cart.
 */

/** Mirrors WishlistDtos.WishlistItemView. */
export type WishlistItem = {
    itemId: number;
    variantId: number;
    productSlug: string;
    productName: string;
    sku: string;
    unit: string;
    image: string | null;
    unitPrice: number;
    inStock: boolean;
    availableStock: number;
    createdAt: string;
};

/** Mirrors WishlistDtos.WishlistResponse. */
export type Wishlist = {
    items: WishlistItem[];
};

export async function getWishlist(): Promise<Wishlist> {
    return apiFetch<Wishlist>("/api/wishlist", {cache: "no-store"});
}

export async function addWishlistItem(variantId: number): Promise<Wishlist> {
    return apiFetch<Wishlist>("/api/wishlist/items", {
        method: "POST",
        body: JSON.stringify({variantId}),
    });
}

export async function removeWishlistItem(variantId: number): Promise<Wishlist> {
    return apiFetch<Wishlist>(`/api/wishlist/items/${variantId}`, {
        method: "DELETE",
    });
}
