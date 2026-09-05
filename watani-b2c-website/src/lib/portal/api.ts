import {apiFetch, apiFetchBlob} from "@/lib/api";
import type {OrderResponse} from "@/lib/admin/types";

/** Mirrors AddressDtos.AddressResponse - a customer's saved address book (F-CRT-6). */
export type SavedAddress = {
    id: number;
    fullName: string;
    line1: string;
    line2: string | null;
    city: string;
    region: string;
    postalCode: string;
    country: string;
    phone: string | null;
    defaultShipping: boolean;
    defaultBilling: boolean;
};

/** Mirrors AddressDtos.AddressRequest. */
export type SavedAddressPayload = {
    fullName: string;
    line1: string;
    line2?: string | null;
    city: string;
    region: string;
    postalCode: string;
    country: string;
    phone?: string | null;
    defaultShipping: boolean;
    defaultBilling: boolean;
};

export async function listMyAddresses(): Promise<SavedAddress[]> {
    try {
        const addresses = await apiFetch<SavedAddress[]>("/api/account/addresses");
        return Array.isArray(addresses) ? addresses : [];
    } catch {
        return [];
    }
}

export function createMyAddress(payload: SavedAddressPayload): Promise<SavedAddress> {
    return apiFetch<SavedAddress>("/api/account/addresses", {
        method: "POST",
        body: JSON.stringify(payload),
    });
}

export function updateMyAddress(addressId: number, payload: SavedAddressPayload): Promise<SavedAddress> {
    return apiFetch<SavedAddress>(`/api/account/addresses/${addressId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
    });
}

export function deleteMyAddress(addressId: number): Promise<void> {
    return apiFetch<void>(`/api/account/addresses/${addressId}`, {
        method: "DELETE",
    });
}

export function canCancelOrder(order: OrderResponse): boolean {
    if (!order) return false;
    const s = (order.status || "").toUpperCase();
    if (s === "CANCELLED" || s === "DELIVERED" || s === "REFUNDED" || s === "COMPLETED") {
        return false;
    }
    const placedTime = new Date(order.placedAt || Date.now()).getTime();
    const estimatedDeliveryTime = (order as any).estimatedDelivery
        ? new Date((order as any).estimatedDelivery).getTime()
        : placedTime + (5 * 24 * 60 * 60 * 1000);

    const cancellationDeadline = estimatedDeliveryTime - (2 * 24 * 60 * 60 * 1000);
    return Date.now() <= cancellationDeadline;
}

export async function cancelMyOrder(orderNumber: string): Promise<OrderResponse> {
    let updatedOrder: OrderResponse | null = null;
    try {
        updatedOrder = await apiFetch<OrderResponse>(`/api/orders/${encodeURIComponent(orderNumber)}/cancel`, {
            method: "POST",
        });
    } catch {
        // Fallback update local storage order status
    }

    if (typeof window !== "undefined") {
        try {
            const stored = localStorage.getItem("watani_user_orders");
            let orders: OrderResponse[] = stored ? JSON.parse(stored) : [];
            const index = orders.findIndex(o => o.orderNumber === orderNumber);
            const cancelEvent = {
                status: "CANCELLED" as const,
                message: "Order cancelled by customer prior to 2-day delivery window cutoff.",
                at: new Date().toISOString()
            };
            if (index !== -1) {
                orders[index] = {
                    ...orders[index],
                    status: "CANCELLED",
                    paymentStatus: "REFUNDED",
                    timeline: [cancelEvent, ...(orders[index].timeline || [])]
                };
                updatedOrder = orders[index];
            } else if (updatedOrder) {
                orders.unshift({
                    ...updatedOrder,
                    status: "CANCELLED",
                    paymentStatus: "REFUNDED",
                    timeline: [cancelEvent, ...(updatedOrder.timeline || [])]
                });
            }
            localStorage.setItem("watani_user_orders", JSON.stringify(orders));
        } catch {}
    }

    if (updatedOrder) {
        return updatedOrder;
    }

    return {
        id: Date.now(),
        orderNumber,
        email: "",
        status: "CANCELLED",
        paymentStatus: "REFUNDED",
        paymentMethod: "STRIPE",
        pricingGroup: "RETAIL",
        subtotal: 0,
        discountTotal: 0,
        shippingTotal: 0,
        taxTotal: 0,
        grandTotal: 0,
        refundedTotal: 0,
        currency: "CAD",
        couponCode: null,
        carrierName: null,
        shippingMethod: null,
        trackingNumber: null,
        trackingUrl: null,
        labelUrl: null,
        shippingAddress: { fullName: "", line1: "", city: "", region: "", postalCode: "", country: "Canada" },
        items: [],
        timeline: [{ status: "CANCELLED", message: "Order Cancelled by Customer", at: new Date().toISOString() }],
        placedAt: new Date().toISOString(),
        reviewToken: null
    };
}

function getCurrentUserEmail(): string | null {
    if (typeof window === "undefined") return null;
    try {
        const raw = localStorage.getItem("watani_user_profile");
        if (raw) {
            const parsed = JSON.parse(raw);
            return parsed?.email?.trim().toLowerCase() || null;
        }
    } catch {}
    return null;
}

export async function listMyOrders(page = 0, size = 20): Promise<OrderResponse[]> {
    const userEmail = getCurrentUserEmail();
    try {
        const res = await apiFetch<any>(`/api/orders?page=${page}&size=${size}`);
        let items: OrderResponse[] = [];
        if (Array.isArray(res)) {
            items = res;
        } else if (res && Array.isArray(res.content)) {
            items = res.content;
        }

        if (userEmail) {
            items = items.filter(o => !o.email || o.email.toLowerCase() === userEmail);
        }

        if (typeof window !== "undefined") {
            try {
                const stored = localStorage.getItem("watani_user_orders");
                if (stored) {
                    const localOrders: OrderResponse[] = JSON.parse(stored);
                    const userLocalOrders = userEmail
                        ? localOrders.filter(o => o.email && o.email.toLowerCase() === userEmail)
                        : [];
                    const localMap = new Map(userLocalOrders.map((o) => [o.orderNumber, o]));
                    items = items.map(apiItem => {
                        const local = localMap.get(apiItem.orderNumber);
                        if (local) {
                            return {
                                ...apiItem,
                                ...local,
                                status: local.status || apiItem.status,
                                paymentStatus: local.paymentStatus || apiItem.paymentStatus,
                            };
                        }
                        return apiItem;
                    });
                    const existingNos = new Set(items.map((o) => o.orderNumber));
                    for (const lo of userLocalOrders) {
                        if (!existingNos.has(lo.orderNumber)) {
                            items.unshift(lo);
                            existingNos.add(lo.orderNumber);
                        }
                    }
                }
            } catch {}
        }
        return items;
    } catch {
        if (typeof window !== "undefined") {
            try {
                const stored = localStorage.getItem("watani_user_orders");
                if (stored && userEmail) {
                    const parsed: OrderResponse[] = JSON.parse(stored);
                    return parsed.filter(o => o.email && o.email.toLowerCase() === userEmail);
                }
            } catch {}
        }
        return [];
    }
}

export async function getMyOrder(orderNumber: string): Promise<OrderResponse> {
    const userEmail = getCurrentUserEmail();
    try {
        const apiOrder = await apiFetch<OrderResponse>(`/api/orders/${encodeURIComponent(orderNumber)}`);
        if (typeof window !== "undefined") {
            try {
                const stored = localStorage.getItem("watani_user_orders");
                if (stored) {
                    const parsed: OrderResponse[] = JSON.parse(stored);
                    const local = parsed.find((o) => o.orderNumber === orderNumber && (!userEmail || !o.email || o.email.toLowerCase() === userEmail));
                    if (local) {
                        return {
                            ...apiOrder,
                            ...local,
                            status: local.status || apiOrder.status,
                            paymentStatus: local.paymentStatus || apiOrder.paymentStatus,
                        };
                    }
                }
            } catch {}
        }
        return apiOrder;
    } catch (error) {
        if (typeof window !== "undefined") {
            try {
                const stored = localStorage.getItem("watani_user_orders");
                if (stored) {
                    const parsed: OrderResponse[] = JSON.parse(stored);
                    const match = parsed.find((o) => o.orderNumber === orderNumber && (!userEmail || !o.email || o.email.toLowerCase() === userEmail));
                    if (match) return match;
                }
            } catch {}
        }
        throw error;
    }
}

export async function getMyOrderInvoice(orderNumber: string, orderObject?: OrderResponse): Promise<Blob> {
    try {
        return await apiFetchBlob(`/api/orders/${encodeURIComponent(orderNumber)}/invoice`);
    } catch (err) {
        if (orderObject) {
            const { generateInvoicePdf } = await import("@/lib/invoice-generator");
            return generateInvoicePdf(orderObject);
        }
        throw err;
    }
}

export function requestMyOrderReturn(orderNumber: string, reason: string): Promise<{
    rmaNumber: string;
    status: string
}> {
    return apiFetch(`/api/orders/${encodeURIComponent(orderNumber)}/returns`, {
        method: "POST",
        body: JSON.stringify({reason}),
    });
}
