"use client";

import {use, useEffect, useState} from "react";
import Link from "next/link";
import Image from "next/image";
import {ArrowLeft, ClipboardList, Clock, CreditCard, FileText, MapPin, Star, XCircle} from "lucide-react";
import * as portalApi from "@/lib/portal/api";
import type {OrderResponse} from "@/lib/admin/types";
import {StatusBadge} from "@/components/admin/status-badge";
import {ApiError} from "@/lib/api";
import {useNotifications} from "@/components/notifications/notification-store";
import {OrderTimeline} from "@/components/admin/order-timeline";
import {productImageSrc} from "@/lib/products";

function money(value: number, currency: string) {
    return new Intl.NumberFormat("en-CA", {style: "currency", currency}).format(value);
}

function toPrice(val: any): string {
    const num = typeof val === "number" ? val : parseFloat(String(val || 0));
    if (isNaN(num)) return "0";
    return num % 1 === 0 ? String(num) : num.toFixed(2);
}

export default function PortalOrderDetailPage({
                                                  params,
                                              }: {
    params: Promise<{ orderNumber: string }>;
}) {
    const {orderNumber} = use(params);
    const notifications = useNotifications();
    const [order, setOrder] = useState<OrderResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [downloadingInvoice, setDownloadingInvoice] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const [showCancelConfirm, setShowCancelConfirm] = useState(false);
    const [completingPayment, setCompletingPayment] = useState(false);

    function loadOrder(silent = false) {
        portalApi
            .getMyOrder(orderNumber)
            .then(setOrder)
            .catch((err) => {
                if (!silent) {
                    const message = err instanceof ApiError ? err.message : "Failed to load order.";
                    setError(message);
                    notifications.error("Failed to load order", message);
                }
            });
    }

    useEffect(() => {
        loadOrder();

        function handleRefresh() {
            if (document.visibilityState === "visible") {
                loadOrder(true);
            }
        }

        function handleStorage(e: StorageEvent) {
            if (e.key === "watani.adminOrders.v1" || e.key === "watani_user_orders") {
                loadOrder(true);
            }
        }

        document.addEventListener("visibilitychange", handleRefresh);
        window.addEventListener("focus", handleRefresh);
        window.addEventListener("storage", handleStorage);

        return () => {
            document.removeEventListener("visibilitychange", handleRefresh);
            window.removeEventListener("focus", handleRefresh);
            window.removeEventListener("storage", handleStorage);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [orderNumber]);

    async function handleCompletePayment() {
        if (!order) return;
        setCompletingPayment(true);
        try {
            const res = await portalApi.payPendingOrder(order.orderNumber);
            if (res.alreadyPaid) {
                notifications.success("Order Paid", "This order has already been paid.");
                portalApi.getMyOrder(order.orderNumber).then(setOrder);
                return;
            }
            if (res.redirectUrl) {
                window.location.href = res.redirectUrl;
            } else {
                notifications.error("Payment error", "Could not start payment session. Please try again.");
            }
        } catch (err: any) {
            notifications.error("Payment Error", err?.message || "Failed to start payment. Please try again.");
        } finally {
            setCompletingPayment(false);
        }
    }

    async function handleDownloadInvoice() {
        if (!order) return;
        setDownloadingInvoice(true);
        try {
            const blob = await portalApi.getMyOrderInvoice(order.orderNumber, order);
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `invoice-${order.orderNumber}.pdf`;
            link.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            notifications.error(
                "Couldn't download invoice",
                err instanceof ApiError ? err.message : "Please try again.",
            );
        } finally {
            setDownloadingInvoice(false);
        }
    }

    async function handleCancelOrder() {
        if (!order) return;
        setCancelling(true);
        try {
            const updated = await portalApi.cancelMyOrder(order.orderNumber);
            setOrder(updated);
            notifications.success("Order Cancelled", `Order #${order.orderNumber} has been successfully cancelled.`);
            setShowCancelConfirm(false);
        } catch {
            notifications.error("Cancellation Failed", "Failed to cancel order. Please try again.");
        } finally {
            setCancelling(false);
        }
    }

    if (!order) {
        return error ? (
            <p className="rounded-xl bg-coral/10 px-4 py-3 text-[14px] font-medium text-coral">{error}</p>
        ) : (
            <p className="text-muted">Loading…</p>
        );
    }

    const isPendingPayment = order.status === "PENDING_PAYMENT" || order.paymentStatus === "PENDING";

    return (
        <div>
            <Link
                href="/portal/orders"
                className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted transition-colors hover:text-teal-950"
            >
                <ArrowLeft className="size-3.5" aria-hidden/>
                My Orders
            </Link>

            <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2.5">
                        <h1 className="text-[22px] font-extrabold text-teal-950 sm:text-[26px]">{order.orderNumber}</h1>
                        <StatusBadge status={order.status}/>
                    </div>
                    <p className="mt-1 text-[13px] text-muted">Placed on {new Date(order.placedAt).toLocaleString()}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={order.paymentStatus}/>
                    {isPendingPayment && (
                        <button
                            type="button"
                            onClick={handleCompletePayment}
                            disabled={completingPayment}
                            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-[13px] font-bold text-white shadow-xs transition-all hover:bg-emerald-700 disabled:opacity-60"
                        >
                            <CreditCard className="size-3.5" aria-hidden />
                            {completingPayment ? "Connecting…" : "Complete Payment"}
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={handleDownloadInvoice}
                        disabled={downloadingInvoice}
                        className="inline-flex items-center gap-1.5 rounded-full bg-teal-950 px-4 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                    >
                        <FileText className="size-3.5" aria-hidden/>
                        {downloadingInvoice ? "Preparing…" : "View Invoice"}
                    </button>
                    {portalApi.canCancelOrder(order) && (
                        <button
                            type="button"
                            onClick={() => setShowCancelConfirm(true)}
                            className="inline-flex items-center gap-1.5 rounded-full border border-coral/30 bg-coral/10 px-4 py-2 text-[13px] font-semibold text-coral transition-colors hover:bg-coral/20"
                        >
                            <XCircle className="size-3.5" aria-hidden/>
                            Cancel Order
                        </button>
                    )}
                </div>
            </div>

            {isPendingPayment && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-950">
                    <div className="flex items-center gap-3">
                        <Clock className="size-5 shrink-0 text-amber-700" />
                        <div>
                            <p className="font-bold text-[14px]">Payment is pending for this order</p>
                            <p className="text-[12px] text-amber-900/80">Please complete payment within 2 hours to confirm your order.</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleCompletePayment}
                        disabled={completingPayment}
                        className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-5 py-2 text-[13px] font-bold text-white shadow-xs transition-all hover:bg-emerald-700 disabled:opacity-60"
                    >
                        <CreditCard className="size-4" aria-hidden />
                        {completingPayment ? "Redirecting to Stripe…" : "Complete Payment Now"}
                    </button>
                </div>
            )}

            {order.reviewToken && (
                <Link
                    href={`/review/${encodeURIComponent(order.orderNumber)}?token=${encodeURIComponent(order.reviewToken)}`}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-lime-500 px-4 py-2 text-[13px] font-semibold text-teal-950 transition-opacity hover:opacity-90"
                >
                    <Star className="size-3.5" aria-hidden/>
                    Rate your items
                </Link>
            )}

            {error && (
                <p className="mt-4 rounded-xl bg-coral/10 px-4 py-3 text-[14px] font-medium text-coral">{error}</p>
            )}

            <div className="mt-6 grid gap-6 lg:grid-cols-3">
                <div className="space-y-6 lg:col-span-2">
                    <div className="rounded-2xl bg-white p-4 shadow-card sm:p-5">
                        <h2 className="text-[15px] font-bold text-teal-950">Items ({order.items?.length ?? 0})</h2>
                        <ul className="mt-3 divide-y divide-black/5">
                            {(order.items ?? []).map((line, idx) => {
                                const retailPrice = line.retailPrice ?? (line.unitPrice || 0);
                                const wholesalePrice = line.wholesalePrice ?? (Math.round(retailPrice * 0.8 * 100) / 100);
                                return (
                                    <li key={line.id ? `${line.id}-${idx}` : `${line.sku || "item"}-${idx}`} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                                        <div className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-canvas border border-black/5">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={productImageSrc(line.image || (line as any).productImage || (line as any).imageUrl)}
                                                alt={line.productName}
                                                className="size-full object-cover"
                                                onError={(e) => {
                                                    (e.currentTarget as HTMLImageElement).src = "/images/placeholder.png";
                                                }}
                                            />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="font-semibold text-teal-950 sm:truncate">{line.productName}</p>
                                            <div className="mt-1 space-y-0.5 text-[12px] text-muted">
                                                <p>Moq <strong className="text-teal-950">{line.quantity || 1}</strong></p>
                                                <p>Unit <strong className="text-teal-950">{line.unit || "unit"}</strong></p>
                                                <p>Price ( retail) :<strong className="text-teal-950">${toPrice(retailPrice)}</strong></p>
                                                <p>Price (wholesale) :<strong className="text-teal-800">${toPrice(wholesalePrice)}</strong></p>
                                            </div>
                                        </div>
                                        <p className="hidden shrink-0 text-[13px] text-muted sm:block">×{line.quantity}</p>
                                        <p className="hidden w-24 shrink-0 text-right font-semibold text-teal-950 sm:block">
                                            {money(line.lineTotal, order.currency)}
                                        </p>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>

                    <div className="rounded-2xl bg-white p-4 shadow-card sm:p-5">
                        <div className="flex items-center gap-2">
                            <ClipboardList className="size-4 text-teal-950" aria-hidden/>
                            <h2 className="text-[15px] font-bold text-teal-950">Order Timeline</h2>
                        </div>
                        <div className="mt-4">
                            <OrderTimeline events={order.timeline}/>
                        </div>
                    </div>

                </div>

                <div className="space-y-6">
                    <div className="rounded-2xl bg-white p-4 shadow-card sm:p-5">
                        <div className="flex items-center gap-2">
                            <ClipboardList className="size-4 text-teal-950" aria-hidden/>
                            <h2 className="text-[15px] font-bold text-teal-950">Order Summary</h2>
                        </div>
                        <dl className="mt-3 space-y-1.5 text-[13px]">
                            <div className="flex justify-between">
                                <dt className="text-muted">Total products</dt>
                                <dd>{money(order.subtotal, order.currency)}</dd>
                            </div>
                            {order.discountTotal > 0 && (
                                <div className="flex justify-between text-coral">
                                    <dt>Discount{order.couponCode ? ` (${order.couponCode})` : ""}</dt>
                                    <dd>-{money(order.discountTotal, order.currency)}</dd>
                                </div>
                            )}
                            <div className="flex justify-between">
                                <dt className="text-muted">Shipping</dt>
                                <dd>{money(order.shippingTotal, order.currency)}</dd>
                            </div>
                            <div className="flex justify-between">
                                <dt className="text-muted">Total taxes</dt>
                                <dd>{money(order.taxTotal, order.currency)}</dd>
                            </div>
                            <div
                                className="mt-1.5 flex justify-between border-t border-black/10 pt-1.5 font-bold text-teal-950">
                                <dt>Total</dt>
                                <dd>{money(order.grandTotal, order.currency)}</dd>
                            </div>
                            {order.refundedTotal > 0 && (
                                <div className="flex justify-between font-semibold text-coral">
                                    <dt>Refunded</dt>
                                    <dd>{money(order.refundedTotal, order.currency)}</dd>
                                </div>
                            )}
                        </dl>
                    </div>

                    <div className="rounded-2xl bg-white p-4 shadow-card sm:p-5">
                        <div className="flex items-center gap-2">
                            <MapPin className="size-4 text-teal-950" aria-hidden/>
                            <h2 className="text-[15px] font-bold text-teal-950">Shipping Address</h2>
                        </div>
                        <p className="mt-2 text-[13px] leading-relaxed text-teal-950">
                            {order.shippingAddress?.fullName}<br/>
                            {order.shippingAddress?.line1}
                            {order.shippingAddress?.line2 && <>, {order.shippingAddress.line2}</>}<br/>
                            {order.shippingAddress?.city}, {order.shippingAddress?.region} {order.shippingAddress?.postalCode}<br/>
                            {order.shippingAddress?.country ?? "Canada"}
                        </p>
                    </div>

                    {(order.carrierName || order.trackingNumber || order.shippingMethod) && (
                        <div className="rounded-2xl bg-white p-4 shadow-card sm:p-5">
                            <h2 className="text-[15px] font-bold text-teal-950">Shipping</h2>
                            <dl className="mt-3 space-y-1.5 text-[13px]">
                                {order.carrierName && (
                                    <div className="flex justify-between gap-3">
                                        <dt className="shrink-0 text-muted">Carrier</dt>
                                        <dd className="min-w-0 text-right">{order.carrierName}</dd>
                                    </div>
                                )}
                                {order.shippingMethod && (
                                    <div className="flex justify-between gap-3">
                                        <dt className="shrink-0 text-muted">Method</dt>
                                        <dd className="min-w-0 text-right">{order.shippingMethod}</dd>
                                    </div>
                                )}
                                {order.trackingNumber && (
                                    <div className="flex justify-between gap-3">
                                        <dt className="shrink-0 text-muted">Tracking</dt>
                                        <dd className="min-w-0 break-all text-right">
                                            {order.trackingUrl ? (
                                                <a href={order.trackingUrl} target="_blank" rel="noreferrer"
                                                   className="font-semibold text-teal-950 hover:underline">
                                                    {order.trackingNumber}
                                                </a>
                                            ) : (
                                                order.trackingNumber
                                            )}
                                        </dd>
                                    </div>
                                )}
                            </dl>
                        </div>
                    )}
                </div>
            </div>

            {showCancelConfirm && (
                <div className="fixed inset-0 z-50 grid place-items-center bg-teal-950/40 p-4 backdrop-blur-xs">
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-card space-y-4">
                        <h3 className="text-[18px] font-extrabold text-teal-950">Cancel Order #{order.orderNumber}?</h3>
                        <p className="text-[13px] text-muted leading-relaxed">
                            Are you sure you want to cancel this order? This action is permanent and cannot be undone. Orders can only be cancelled at least 2 days prior to the estimated delivery date.
                        </p>
                        <div className="flex items-center justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowCancelConfirm(false)}
                                disabled={cancelling}
                                className="h-10 px-4 rounded-xl border border-black/10 text-teal-950 font-bold text-[13px]"
                            >
                                Keep Order
                            </button>
                            <button
                                type="button"
                                onClick={handleCancelOrder}
                                disabled={cancelling}
                                className="h-10 px-5 rounded-xl bg-coral text-white font-bold text-[13px] hover:bg-coral/90 disabled:opacity-60"
                            >
                                {cancelling ? "Cancelling…" : "Yes, Cancel Order"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
