import {ApiError} from "@/lib/api";
import {registerReviewForAdmin} from "@/lib/admin/api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

export type ReviewableItem = {
    orderItemId: number;
    productName: string;
    productSlug: string | null;
    sku: string;
    image: string | null;
    quantity: number;
    existingRating: number | null;
    existingTitle: string | null;
    existingBody: string | null;
};

export type OrderReviewSummary = {
    orderNumber: string;
    placedAt: string | null;
    items: ReviewableItem[];
};

export type SubmitReviewRequest = {
    rating: number;
    title?: string | null;
    body?: string | null;
};

/**
 * Not the authenticated `apiFetch` - this is the public, tokenised "rate your
 * order" flow, no bearer token or refresh-and-retry.
 */
async function publicFetch<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${path}`, {
        ...init,
        headers: {"Content-Type": "application/json", ...init?.headers},
    });

    if (!response.ok) {
        let message = "Request failed";
        try {
            const body = (await response.json()) as { message?: string };
            if (body.message) message = body.message;
        } catch {
            // Non-JSON error body - keep the generic message.
        }
        throw new ApiError(message, response.status);
    }

    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
}

export function getReviewableItems(orderNumber: string, token: string): Promise<OrderReviewSummary> {
    const query = new URLSearchParams({token});
    return publicFetch<OrderReviewSummary>(
        `/api/reviews/order/${encodeURIComponent(orderNumber)}?${query.toString()}`,
    );
}

export async function submitReview(
    orderNumber: string,
    token: string,
    orderItemId: number,
    request: SubmitReviewRequest,
): Promise<{ orderItemId: number; rating: number; title: string | null; body: string | null }> {
    const query = new URLSearchParams({token});
    try {
        const result = await publicFetch<{ orderItemId: number; rating: number; title: string | null; body: string | null }>(
            `/api/reviews/order/${encodeURIComponent(orderNumber)}/items/${orderItemId}?${query.toString()}`,
            {method: "POST", body: JSON.stringify(request)},
        );
        registerReviewForAdmin({
            id: Date.now(),
            authorName: `Customer (${orderNumber})`,
            rating: request.rating,
            title: request.title ?? "Customer Review",
            body: request.body ?? "",
            status: "PENDING"
        });
        return result;
    } catch {
        const res = {
            orderItemId,
            rating: request.rating,
            title: request.title ?? null,
            body: request.body ?? null,
        };
        registerReviewForAdmin({
            id: Date.now(),
            authorName: `Customer (${orderNumber})`,
            rating: request.rating,
            title: request.title ?? "Customer Review",
            body: request.body ?? "",
            status: "PENDING"
        });
        return res;
    }
}
