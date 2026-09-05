"use client";

import {useEffect, useState} from "react";
import Link from "next/link";
import {ChevronRight} from "lucide-react";
import * as portalApi from "@/lib/portal/api";
import type {OrderResponse} from "@/lib/admin/types";
import {StatusBadge} from "@/components/admin/status-badge";
import {ApiError} from "@/lib/api";
import {useNotifications} from "@/components/notifications/notification-store";
import {productImageSrc} from "@/lib/products";

function money(value: number, currency: string) {
    return new Intl.NumberFormat("en-CA", {style: "currency", currency}).format(value);
}

export function OrdersView() {
    const notifications = useNotifications();
    const [orders, setOrders] = useState<OrderResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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
                    {orders.map((order) => (
                        <Link
                            key={order.id}
                            href={`/portal/orders/${order.orderNumber}`}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-5 shadow-card transition-colors hover:bg-soft-control"
                        >
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
                            <div className="flex items-center gap-4">
                                <StatusBadge status={order.status}/>
                                <span
                                    className="font-semibold text-teal-950">{money(order.grandTotal, order.currency)}</span>
                                <ChevronRight className="size-4 text-muted" aria-hidden/>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
