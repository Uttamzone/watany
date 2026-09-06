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

function getAdminOrdersMap(): Map<string, any> {
    const map = new Map<string, any>();
    if (typeof window === "undefined") return map;
    try {
        const raw = localStorage.getItem("watani.adminOrders.v1");
        if (raw) {
            const list = JSON.parse(raw);
            if (Array.isArray(list)) {
                for (const o of list) {
                    if (o && o.orderNumber) {
                        map.set(String(o.orderNumber).trim().toUpperCase(), o);
                    }
                }
            }
        }
    } catch {}
    return map;
}

export async function listMyOrders(page = 0, size = 20): Promise<OrderResponse[]> {
    const userEmail = getCurrentUserEmail();
    const adminMap = getAdminOrdersMap();

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
                let localOrders: OrderResponse[] = stored ? JSON.parse(stored) : [];
                // Prune any abandoned Stripe checkout orders older than 2 hours
                localOrders = localOrders.filter(o => !isAbandonedPending(o));

                // Synchronize localOrders with admin updates
                localOrders = localOrders.map(lo => {
                    const norm = (lo.orderNumber || "").trim().toUpperCase();
                    const adminMatch = adminMap.get(norm);
                    if (adminMatch) {
                        return {
                            ...lo,
                            status: (adminMatch.status && adminMatch.status !== "PENDING_PAYMENT" && adminMatch.status !== "AWAITING_PAYMENT_VERIFICATION")
                                ? adminMatch.status
                                : (lo.status || "PROCESSING"),
                            paymentStatus: (adminMatch.paymentStatus === "PAID" || adminMatch.paymentStatus === "CAPTURED")
                                ? adminMatch.paymentStatus
                                : lo.paymentStatus,
                            timeline: (adminMatch.timeline && adminMatch.timeline.length > (lo.timeline?.length || 0))
                                ? adminMatch.timeline
                                : lo.timeline
                        };
                    }
                    return lo;
                });
                localStorage.setItem("watani_user_orders", JSON.stringify(localOrders));

                const userLocalOrders = userEmail
                    ? localOrders.filter(o => !o.email || o.email.toLowerCase() === userEmail)
                    : localOrders;
                const localMap = new Map(userLocalOrders.map((o) => [(o.orderNumber || "").trim().toUpperCase(), o]));

                items = items.map(apiItem => {
                    const norm = (apiItem.orderNumber || "").trim().toUpperCase();
                    const local = localMap.get(norm);
                    const adminMatch = adminMap.get(norm);

                    let status = apiItem.status;
                    let paymentStatus = apiItem.paymentStatus;

                    if (adminMatch) {
                        if (adminMatch.paymentStatus === "PAID" || adminMatch.paymentStatus === "CAPTURED") {
                            paymentStatus = "PAID";
                        }
                        if (adminMatch.status === "PAID" || status === "PENDING_PAYMENT" || status === "AWAITING_PAYMENT_VERIFICATION") {
                            status = adminMatch.status || "PAID";
                        }
                    } else if (local) {
                        if (local.paymentStatus === "PAID" || local.paymentStatus === "CAPTURED") {
                            paymentStatus = "PAID";
                        }
                        if (local.status === "PAID" || status === "PENDING_PAYMENT" || status === "AWAITING_PAYMENT_VERIFICATION") {
                            status = local.status || status;
                        }
                    }

                    return {
                        ...(local || {}),
                        ...apiItem,
                        // Prefer API items/shippingAddress over local (stale) data
                        items: (apiItem.items && apiItem.items.length > 0) ? apiItem.items : (local?.items || []),
                        shippingAddress: apiItem.shippingAddress || local?.shippingAddress,
                        status,
                        paymentStatus,
                        timeline: (adminMatch?.timeline && adminMatch.timeline.length > (apiItem.timeline?.length || 0))
                            ? adminMatch.timeline
                            : (apiItem.timeline || local?.timeline)
                    };
                });

                const existingNos = new Set(items.map((o) => (o.orderNumber || "").trim().toUpperCase()));
                for (const lo of userLocalOrders) {
                    const norm = (lo.orderNumber || "").trim().toUpperCase();
                    if (norm && !existingNos.has(norm) && !isAbandonedPending(lo)) {
                        items.unshift(lo);
                        existingNos.add(norm);
                    }
                }
            } catch {}
        }

        // Strictly deduplicate returned items
        const seen = new Set<string>();
        return items.filter(o => {
            if (!o || isAbandonedPending(o)) return false;
            const norm = (o.orderNumber || "").trim().toUpperCase();
            if (!norm || seen.has(norm)) return false;
            seen.add(norm);
            return true;
        });
    } catch {
        if (typeof window !== "undefined") {
            try {
                const stored = localStorage.getItem("watani_user_orders");
                let list: OrderResponse[] = stored ? JSON.parse(stored) : [];
                list = list.filter(o => !isAbandonedPending(o));

                if (userEmail) {
                    list = list.filter(o => !o.email || o.email.toLowerCase() === userEmail);
                }

                list = list.map(item => {
                    const norm = (item.orderNumber || "").trim().toUpperCase();
                    const adminMatch = adminMap.get(norm);
                    if (adminMatch) {
                        return {
                            ...item,
                            status: (adminMatch.status && adminMatch.status !== "PENDING_PAYMENT" && adminMatch.status !== "AWAITING_PAYMENT_VERIFICATION")
                                ? adminMatch.status
                                : item.status,
                            paymentStatus: (adminMatch.paymentStatus === "PAID" || adminMatch.paymentStatus === "CAPTURED")
                                ? adminMatch.paymentStatus
                                : item.paymentStatus,
                            timeline: (adminMatch.timeline && adminMatch.timeline.length > (item.timeline?.length || 0))
                                ? adminMatch.timeline
                                : item.timeline
                        };
                    }
                    return item;
                });

                // Check if adminOrders has orders belonging to this user not yet in watani_user_orders
                const existingNos = new Set(list.map(o => (o.orderNumber || "").trim().toUpperCase()));
                for (const [norm, adminOrder] of adminMap.entries()) {
                    if (!existingNos.has(norm) && !isAbandonedPending(adminOrder)) {
                        if (!userEmail || !adminOrder.email || adminOrder.email.toLowerCase() === userEmail) {
                            list.unshift(adminOrder);
                            existingNos.add(norm);
                        }
                    }
                }

                const seen = new Set<string>();
                return list.filter(o => {
                    const norm = (o.orderNumber || "").trim().toUpperCase();
                    if (!norm || seen.has(norm)) return false;
                    seen.add(norm);
                    return true;
                });
            } catch {}
        }
        return [];
    }
}

export async function getMyOrder(orderNumber: string): Promise<OrderResponse> {
    const userEmail = getCurrentUserEmail();
    const adminMap = getAdminOrdersMap();
    const normNum = (orderNumber || "").trim().toUpperCase();
    const adminMatch = adminMap.get(normNum);

    try {
        const apiOrder = await apiFetch<OrderResponse>(`/api/orders/${encodeURIComponent(orderNumber)}`);
        let finalStatus = apiOrder.status;
        let finalPaymentStatus = apiOrder.paymentStatus;

        if (adminMatch) {
            if (adminMatch.paymentStatus === "PAID" || adminMatch.paymentStatus === "CAPTURED") {
                finalPaymentStatus = "PAID";
            }
            if (adminMatch.status === "PAID" || finalStatus === "PENDING_PAYMENT" || finalStatus === "AWAITING_PAYMENT_VERIFICATION") {
                finalStatus = adminMatch.status || "PAID";
            }
        }

        if (typeof window !== "undefined") {
            try {
                const stored = localStorage.getItem("watani_user_orders");
                if (stored) {
                    let parsed: OrderResponse[] = JSON.parse(stored);
                    parsed = parsed.filter(o => !isAbandonedPending(o));
                    const idx = parsed.findIndex(o => (o.orderNumber || "").trim().toUpperCase() === normNum);
                    if (idx !== -1) {
                        parsed[idx] = {
                            ...parsed[idx],
                            ...apiOrder,
                            status: finalStatus,
                            paymentStatus: finalPaymentStatus,
                            timeline: (adminMatch?.timeline && adminMatch.timeline.length > (apiOrder.timeline?.length || 0))
                                ? adminMatch.timeline
                                : (apiOrder.timeline || parsed[idx].timeline)
                        };
                        localStorage.setItem("watani_user_orders", JSON.stringify(parsed));
                    }
                }
            } catch {}
        }

        return {
            ...apiOrder,
            status: finalStatus,
            paymentStatus: finalPaymentStatus,
            timeline: (adminMatch?.timeline && adminMatch.timeline.length > (apiOrder.timeline?.length || 0))
                ? adminMatch.timeline
                : apiOrder.timeline
        };
    } catch (error) {
        if (typeof window !== "undefined") {
            try {
                if (adminMatch && (!userEmail || !adminMatch.email || adminMatch.email.toLowerCase() === userEmail)) {
                    return adminMatch;
                }
                const stored = localStorage.getItem("watani_user_orders");
                if (stored) {
                    const parsed: OrderResponse[] = JSON.parse(stored);
                    const match = parsed.find(o => (o.orderNumber || "").trim().toUpperCase() === normNum && (!userEmail || !o.email || o.email.toLowerCase() === userEmail));
                    if (match && !isAbandonedPending(match)) {
                        if (adminMatch) {
                            return {
                                ...match,
                                status: adminMatch.status || match.status,
                                paymentStatus: adminMatch.paymentStatus || match.paymentStatus,
                                timeline: adminMatch.timeline || match.timeline
                            };
                        }
                        return match;
                    }
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

