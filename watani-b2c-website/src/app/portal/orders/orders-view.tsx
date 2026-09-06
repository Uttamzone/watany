"use client";

import {useEffect, useState} from "react";
import Link from "next/link";
import {ChevronRight, CreditCard} from "lucide-react";
import * as portalApi from "@/lib/portal/api";
import type {OrderResponse} from "@/lib/admin/types";
import {StatusBadge} from "@/components/admin/status-badge";
import {useNotifications} from "@/components/notifications/notification-store";
import {productImageSrc} from "@/lib/products";
import {safeFormatPrice} from "@/lib/types";

function money(value: number, currency: string) {
    return new Intl.NumberFormat("en-CA", {style: "currency", currency}).format(value);
}

export function OrdersView() {
    const notifications = useNotifications();
    const [orders, setOrders] = useState<OrderResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [payingOrderNumber, setPayingOrderNumber] = useState<string | null>(null);

    useEffect(() => {
        portalApi
            .listMyOrders()
            .then((data) => {
                setOrders(Array.isArray(data) ? data : []);
            })
            .catch(() => {
                setOrders([]);
            })
            .finally(() => setLoading(false));
    }, []);

    async function handlePayNow(e: React.MouseEvent, orderNumber: string) {
        e.preventDefault();
        e.stopPropagation();
        try {
            setPayingOrderNumber(orderNumber);
            const res = await portalApi.payPendingOrder(orderNumber);
            if (res.alreadyPaid) {
                notifications.success("Order Paid", "This order has already been paid.");
                portalApi.listMyOrders().then(setOrders);
                return;
            }
            if (res.redirectUrl) {
                window.location.href = res.redirectUrl;
            } else {
                notifications.error("Payment error", "Could not start payment session. Please try again.");
            }
        } catch (err: any) {
            notifications.error("Payment Error", err?.message || "Failed to initiate payment. Please try again.");
        } finally {
            setPayingOrderNumber(null);
        }
    }

    return (
        <div>
            <div>
                <h1 className="text-[26px] font-extrabold text-teal-950">My Orders</h1>
                <p className="mt-1 text-[13px] text-muted">Track the status of every order you&apos;ve placed with
                    us.</p>
            </div>

            {error && (
                <p className="mt-4 rounded-xl bg-coral/10 px-4 py-3 text-[14px] font-medium text-coral">{error}</p>
            )}

            {loading ? (
                <div className="mt-5 h-64 rounded-2xl bg-white shadow-card"/>
            ) : orders.length === 0 ? (
                <div className="mt-5 rounded-2xl bg-white p-10 text-center shadow-card">
                    <p className="text-[15px] font-semibold text-teal-950">You haven&apos;t placed any orders yet.</p>
                    <Link
                        href="/"
                        className="mt-4 inline-flex h-11 items-center rounded-full bg-teal-950 px-6 text-[14px] font-bold text-white transition-colors hover:bg-teal-900"
                    >
                        Start shopping
                    </Link>
                </div>
            ) : (
                <div className="mt-5 space-y-3">
                    {orders.map((order) => {
                        const isPending = order.status === "PENDING_PAYMENT" || order.paymentStatus === "PENDING";
                        return (
                            <Link
                                key={order.id}
                                href={`/portal/orders/${order.orderNumber}`}
                                className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-card transition-colors hover:bg-soft-control"
                            >
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div className="flex items-center gap-4">
                                        <div className="relative size-12 shrink-0 overflow-hidden rounded-xl bg-canvas border border-black/5">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={productImageSrc(order.items?.[0]?.image || (order.items?.[0] as any)?.productImage || (order.items?.[0] as any)?.imageUrl)}
                                                alt={order.items?.[0]?.productName ?? "Order"}
                                                className="size-full object-cover"
                                                onError={(e) => {
                                                    (e.currentTarget as HTMLImageElement).src = "/images/placeholder.png";
                                                }}
                                            />
                                        </div>
                                        <div>
                                            <p className="font-bold text-teal-950">{order.orderNumber}</p>
                                            <p className="mt-0.5 text-[13px] text-muted">
                                                Placed {new Date(order.placedAt).toLocaleDateString()} ·{" "}
                                                {(order.items?.length ?? 0)} item{(order.items?.length ?? 0) === 1 ? "" : "s"}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {isPending && (
                                            <button
                                                type="button"
                                                disabled={payingOrderNumber === order.orderNumber}
                                                onClick={(e) => handlePayNow(e, order.orderNumber)}
                                                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3.5 py-1.5 text-[12px] font-bold text-white shadow-xs transition-all hover:bg-emerald-700 disabled:opacity-60"
                                            >
                                                <CreditCard className="size-3.5" aria-hidden />
                                                {payingOrderNumber === order.orderNumber ? "Connecting…" : "Complete Payment"}
                                            </button>
                                        )}
                                        <StatusBadge status={order.status}/>
                                        <span
                                            className="font-semibold text-teal-950">{money(order.grandTotal, order.currency)}</span>
                                        <ChevronRight className="size-4 text-muted" aria-hidden/>
                                    </div>
                                </div>

                                {order.items && order.items.length > 0 && (
                                    <div className="mt-1 border-t border-black/5 pt-3">
                                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                            {order.items.slice(0, 3).map((item, idx) => {
                                                const uPrice = typeof item.unitPrice === "number" ? item.unitPrice : parseFloat(String(item.unitPrice || "0"));
                                                const retPrice = item.retailPrice ?? (item.appliedGroup === "WHOLESALE" || item.appliedGroup === "DISTRIBUTOR" ? Math.round((uPrice / 0.8) * 100) / 100 : uPrice);
                                                const wsPrice = item.wholesalePrice ?? (item.appliedGroup === "WHOLESALE" || item.appliedGroup === "DISTRIBUTOR" ? uPrice : Math.round(uPrice * 0.8 * 100) / 100);

                                                return (
                                                    <div key={item.id ?? idx} className="rounded-xl border border-teal-950/10 bg-teal-950/[0.02] p-2.5 text-xs text-teal-950">
                                                        <p className="font-bold truncate text-teal-950 mb-1">{item.productName}</p>
                                                        <div className="space-y-0.5 text-[11px] font-semibold text-teal-950">
                                                            <div>Moq {item.quantity || 1}</div>
                                                            <div>Unit {item.unit || "unit"}</div>
                                                            <div>Price ( retail) :${safeFormatPrice(retPrice)}</div>
                                                            <div>Price (wholesale) :${safeFormatPrice(wsPrice)}</div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        {order.items.length > 3 && (
                                            <p className="mt-1.5 text-[11px] text-muted">+{order.items.length - 3} more item{order.items.length - 3 === 1 ? "" : "s"}</p>
                                        )}
                                    </div>
                                )}
                            </Link>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
