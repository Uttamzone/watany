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

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

function isAbandonedPending(o: any): boolean {
    if (!o) return false;
    const isPending = o.status === "PENDING_PAYMENT" || o.paymentStatus === "PENDING";
    const method = String(o.paymentMethod || o.payment_method || o.paymentProvider || o.payment_provider || "STRIPE").toUpperCase();
    const isStripe = method === "STRIPE" || method === "";
    if (!isPending || !isStripe) return false;
    const orderTime = new Date(o.placedAt || o.placed_at || o.createdAt || o.created_at || 0).getTime();
    return !isNaN(orderTime) && (Date.now() - orderTime) > TWO_HOURS_MS;
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
                    let localOrders: OrderResponse[] = JSON.parse(stored);
                    // Prune any abandoned Stripe checkout orders older than 2 hours
                    localOrders = localOrders.filter(o => !isAbandonedPending(o));
                    localStorage.setItem("watani_user_orders", JSON.stringify(localOrders));

                    const userLocalOrders = userEmail
                        ? localOrders.filter(o => o.email && o.email.toLowerCase() === userEmail)
                        : [];
                    const localMap = new Map(userLocalOrders.map((o) => [o.orderNumber, o]));
                    let localModified = false;

                    items = items.map(apiItem => {
                        const local = localMap.get(apiItem.orderNumber);
                        if (local) {
                            const finalStatus = apiItem.status || local.status;
                            const finalPaymentStatus = apiItem.paymentStatus || local.paymentStatus;
                            if (local.status !== finalStatus || local.paymentStatus !== finalPaymentStatus) {
                                local.status = finalStatus;
                                local.paymentStatus = finalPaymentStatus;
                                localModified = true;
                            }
                            return {
                                ...apiItem,
                                ...local,
                                // Prefer API items/shippingAddress over local (stale) data
                                items: (apiItem.items && apiItem.items.length > 0) ? apiItem.items : (local.items || []),
                                shippingAddress: apiItem.shippingAddress || local.shippingAddress,
                                status: finalStatus,
                                paymentStatus: finalPaymentStatus,
                            };
                        }
                        return apiItem;
                    });

                    if (localModified) {
                        localStorage.setItem("watani_user_orders", JSON.stringify(localOrders));
                    }

                    const existingNos = new Set(items.map((o) => o.orderNumber));
                    for (const lo of userLocalOrders) {
                        if (!existingNos.has(lo.orderNumber) && !isAbandonedPending(lo)) {
                            items.unshift(lo);
                            existingNos.add(lo.orderNumber);
                        }
                    }
                }
            } catch {}
        }
        return items.filter(o => !isAbandonedPending(o));
    } catch {
        if (typeof window !== "undefined") {
            try {
                const stored = localStorage.getItem("watani_user_orders");
                if (stored && userEmail) {
                    const parsed: OrderResponse[] = JSON.parse(stored);
                    const valid = parsed.filter(o => !isAbandonedPending(o));
                    return valid.filter(o => o.email && o.email.toLowerCase() === userEmail);
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
                    let parsed: OrderResponse[] = JSON.parse(stored);
                    parsed = parsed.filter(o => !isAbandonedPending(o));
                    const local = parsed.find((o) => o.orderNumber === orderNumber && (!userEmail || !o.email || o.email.toLowerCase() === userEmail));
                    if (local) {
                        const finalStatus = apiOrder.status || local.status;
                        const finalPaymentStatus = apiOrder.paymentStatus || local.paymentStatus;
                        local.status = finalStatus;
                        local.paymentStatus = finalPaymentStatus;
                        localStorage.setItem("watani_user_orders", JSON.stringify(parsed));
                        return {
                            ...apiOrder,
                            ...local,
                            // Prefer API items/shippingAddress over stale local data
                            items: (apiOrder.items && apiOrder.items.length > 0) ? apiOrder.items : (local.items || []),
                            shippingAddress: apiOrder.shippingAddress || local.shippingAddress,
                            status: finalStatus,
                            paymentStatus: finalPaymentStatus,
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
                    if (match && !isAbandonedPending(match)) return match;
                }
            } catch {}
        }
        throw error;
    }
}

export async function getMyOrderInvoice(orderNumber: string, orderObject?: OrderResponse): Promise<Blob> {
    // If orderObject is already supplied with details, generate client-side PDF directly
    if (orderObject && (orderObject.items?.length || orderObject.orderNumber)) {
        try {
            const { generateInvoicePdf } = await import("@/lib/invoice-generator");
            return await generateInvoicePdf(orderObject);
        } catch (pdfErr) {
            console.warn("Client invoice PDF generation fallback to API:", pdfErr);
        }
    }

    // Try fetching the full order first to generate the formatted PDF
    try {
        const order = await getMyOrder(orderNumber);
        if (order) {
            const { generateInvoicePdf } = await import("@/lib/invoice-generator");
            return await generateInvoicePdf(order);
        }
    } catch {}

    try {
        return await apiFetchBlob(`/api/orders/${encodeURIComponent(orderNumber)}/invoice`);
    } catch (err) {
        if (orderObject) {
            const { generateInvoicePdf } = await import("@/lib/invoice-generator");
            return await generateInvoicePdf(orderObject);
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

export async function payPendingOrder(orderNumber: string): Promise<{
    redirectUrl?: string;
    alreadyPaid?: boolean;
    message?: string;
    paymentRef?: string;
}> {
    return apiFetch<{
        redirectUrl?: string;
        alreadyPaid?: boolean;
        message?: string;
        paymentRef?: string;
    }>(`/api/orders/${encodeURIComponent(orderNumber)}/pay`, {
        method: "POST",
    });
}

