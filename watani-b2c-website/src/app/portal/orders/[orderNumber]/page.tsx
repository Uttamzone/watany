"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
    ArrowLeft,
    ClipboardList,
    Clock,
    CreditCard,
    FileText,
    MapPin,
    Star,
    XCircle,
    CheckCircle2,
    Truck,
    Package,
    ExternalLink,
    Copy,
    Check,
    HelpCircle,
} from "lucide-react";
import * as portalApi from "@/lib/portal/api";
import type { OrderResponse } from "@/lib/admin/types";
import { StatusBadge } from "@/components/admin/status-badge";
import { ApiError } from "@/lib/api";
import { useNotifications } from "@/components/notifications/notification-store";
import { OrderTimeline } from "@/components/admin/order-timeline";
import { productImageSrc } from "@/lib/products";

function money(value: number, currency: string) {
    return new Intl.NumberFormat("en-CA", { style: "currency", currency }).format(value);
}

export default function PortalOrderDetailPage({
    params,
}: {
    params: Promise<{ orderNumber: string }>;
}) {
    const { orderNumber } = use(params);
    const notifications = useNotifications();
    const [order, setOrder] = useState<OrderResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [downloadingInvoice, setDownloadingInvoice] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const [showCancelConfirm, setShowCancelConfirm] = useState(false);
    const [completingPayment, setCompletingPayment] = useState(false);
    const [copiedTracking, setCopiedTracking] = useState(false);

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
            notifications.success("Invoice Ready", `Downloaded invoice for order #${order.orderNumber}.`);
        } catch (err) {
            notifications.error(
                "Couldn't download invoice",
                err instanceof ApiError ? err.message : "Please try again."
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

    function copyTracking() {
        if (!order?.trackingNumber) return;
        navigator.clipboard.writeText(order.trackingNumber);
        setCopiedTracking(true);
        notifications.success("Tracking Copied", order.trackingNumber);
        setTimeout(() => setCopiedTracking(false), 2500);
    }

    if (!order) {
        return error ? (
            <div className="space-y-4 max-w-2xl mx-auto py-8">
                <Link
                    href="/portal/orders"
                    className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted transition-colors hover:text-teal-950"
                >
                    <ArrowLeft className="size-3.5" aria-hidden />
                    Back to My Orders
                </Link>
                <div className="rounded-2xl border border-coral/20 bg-coral/10 p-6 text-coral">
                    <h2 className="text-[16px] font-bold">Order Not Found</h2>
                    <p className="mt-1 text-[13px] text-teal-950">{error}</p>
                </div>
            </div>
        ) : (
            <div className="flex h-64 items-center justify-center text-[14px] text-muted font-medium">
                Loading order details…
            </div>
        );
    }

    const isPendingPayment = order.status === "PENDING_PAYMENT" || order.paymentStatus === "PENDING";
    const isPaid = order.paymentStatus === "PAID" || order.paymentStatus === "CAPTURED";

    // Progress stepper stages
    const isPlaced = true;
    const isConfirmed = isPaid || order.pricingGroup === "DISTRIBUTOR";
    const isPacked = ["PACKED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"].includes(order.status);
    const isShipped = ["SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"].includes(order.status);
    const isDelivered = order.status === "DELIVERED";

    return (
        <div className="space-y-6 pb-12">
            {/* Top Navigation */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <Link
                    href="/portal/orders"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 bg-white px-3.5 py-2 text-[13px] font-bold text-teal-950 shadow-2xs hover:bg-soft-control transition-colors"
                >
                    <ArrowLeft className="size-4" aria-hidden />
                    Back to My Orders
                </Link>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={handleDownloadInvoice}
                        disabled={downloadingInvoice}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-black/15 bg-white px-4 py-2 text-[13px] font-bold text-teal-950 shadow-2xs hover:bg-soft-control transition-colors disabled:opacity-60"
                    >
                        <FileText className="size-4 text-muted" aria-hidden />
                        {downloadingInvoice ? "Preparing…" : "Download Invoice PDF"}
                    </button>

                    {portalApi.canCancelOrder(order) && (
                        <button
                            type="button"
                            onClick={() => setShowCancelConfirm(true)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-coral/30 bg-coral/10 px-3.5 py-2 text-[13px] font-bold text-coral transition-colors hover:bg-coral/20"
                        >
                            <XCircle className="size-4" aria-hidden />
                            Cancel Order
                        </button>
                    )}
                </div>
            </div>

            {/* Order Header Card */}
            <div className="rounded-3xl bg-white p-6 shadow-card border border-teal-950/10">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <div className="flex flex-wrap items-center gap-3">
                            <h1 className="text-[24px] sm:text-[28px] font-black text-teal-950 tracking-tight">
                                Order #{order.orderNumber}
                            </h1>
                            <StatusBadge status={order.status} />
                            <StatusBadge status={order.paymentStatus} />
                        </div>
                        <p className="mt-1.5 text-[13px] text-muted">
                            Placed on {new Date(order.placedAt).toLocaleString("en-CA", { dateStyle: "long", timeStyle: "short" })}
                        </p>
                    </div>

                    <div className="text-right">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Total Paid</span>
                        <p className="text-[26px] font-black text-teal-950">
                            {money(order.grandTotal, order.currency)}
                        </p>
                    </div>
                </div>

                {/* Visual Order Progress Stepper */}
                <div className="mt-6 border-t border-black/5 pt-6">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {/* Step 1: Placed */}
                        <div className={`rounded-2xl p-3 border transition-all ${
                            isPlaced ? "border-emerald-500/30 bg-emerald-50/50 text-emerald-950" : "border-black/5 bg-soft-control/40 text-muted"
                        }`}>
                            <div className="flex items-center gap-2">
                                <CheckCircle2 className={`size-4 ${isPlaced ? "text-emerald-600" : "text-muted"}`} />
                                <span className="text-[12px] font-bold uppercase tracking-wide">1. Placed</span>
                            </div>
                            <p className="text-[11px] mt-1 text-muted">Order received</p>
                        </div>

                        {/* Step 2: Confirmed */}
                        <div className={`rounded-2xl p-3 border transition-all ${
                            isConfirmed ? "border-emerald-500/30 bg-emerald-50/50 text-emerald-950" : "border-amber-500/30 bg-amber-50/60 text-amber-950"
                        }`}>
                            <div className="flex items-center gap-2">
                                {isConfirmed ? <CheckCircle2 className="size-4 text-emerald-600" /> : <Clock className="size-4 text-amber-600" />}
                                <span className="text-[12px] font-bold uppercase tracking-wide">2. Confirmed</span>
                            </div>
                            <p className="text-[11px] mt-1">
                                {isPaid ? "Payment confirmed" : "Payment processing"}
                            </p>
                        </div>

                        {/* Step 3: Packing */}
                        <div className={`rounded-2xl p-3 border transition-all ${
                            isPacked ? "border-emerald-500/30 bg-emerald-50/50 text-emerald-950" : "border-black/5 bg-soft-control/40 text-muted"
                        }`}>
                            <div className="flex items-center gap-2">
                                {isPacked ? <CheckCircle2 className="size-4 text-emerald-600" /> : <Package className="size-4 text-muted" />}
                                <span className="text-[12px] font-bold uppercase tracking-wide">3. Packed</span>
                            </div>
                            <p className="text-[11px] mt-1 text-muted">
                                {isPacked ? "Ready for dispatch" : "Warehouse fulfillment"}
                            </p>
                        </div>

                        {/* Step 4: Shipped */}
                        <div className={`rounded-2xl p-3 border transition-all ${
                            isShipped ? "border-emerald-500/30 bg-emerald-50/50 text-emerald-950" : "border-black/5 bg-soft-control/40 text-muted"
                        }`}>
                            <div className="flex items-center gap-2">
                                {isDelivered ? (
                                    <CheckCircle2 className="size-4 text-emerald-600" />
                                ) : isShipped ? (
                                    <Truck className="size-4 text-emerald-600 animate-pulse" />
                                ) : (
                                    <Truck className="size-4 text-muted" />
                                )}
                                <span className="text-[12px] font-bold uppercase tracking-wide">
                                    {isDelivered ? "4. Delivered" : "4. Shipped"}
                                </span>
                            </div>
                            <p className="text-[11px] mt-1 text-muted">
                                {isDelivered ? "Package delivered" : isShipped ? "In transit" : "Awaiting carrier"}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Pending Payment Callout */}
            {isPendingPayment && (
                <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-amber-500/30 bg-amber-500/10 p-5 text-amber-950">
                    <div className="flex items-center gap-3">
                        <Clock className="size-6 shrink-0 text-amber-700" />
                        <div>
                            <p className="font-bold text-[15px]">Payment is pending for this order</p>
                            <p className="text-[13px] text-amber-900/80 mt-0.5">
                                Please complete payment to ensure immediate warehouse packing and dispatch.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleCompletePayment}
                        disabled={completingPayment}
                        className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-5 py-2.5 text-[13px] font-bold text-white shadow-2xs transition-all hover:bg-emerald-700 disabled:opacity-60"
                    >
                        <CreditCard className="size-4" aria-hidden />
                        {completingPayment ? "Redirecting to Stripe…" : "Complete Payment Now"}
                    </button>
                </div>
            )}

            {/* Shipped & Active Tracking Banner */}
            {order.trackingNumber && (
                <div className="rounded-3xl border border-emerald-500/30 bg-emerald-50/70 p-5 text-emerald-950">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="grid size-11 place-items-center rounded-2xl bg-emerald-600 text-white">
                                <Truck className="size-6" />
                            </div>
                            <div>
                                <span className="text-[11px] font-extrabold uppercase tracking-wide text-emerald-800">
                                    Your Shipment Is On Its Way
                                </span>
                                <p className="text-[15px] font-bold text-emerald-950">
                                    Carrier: {order.carrierName || "Canada Post / Freightcom"}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className="font-mono text-[13px] font-bold text-emerald-900">
                                        Tracking: {order.trackingNumber}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={copyTracking}
                                        className="text-emerald-700 hover:text-emerald-950 p-0.5"
                                        title="Copy tracking number"
                                    >
                                        {copiedTracking ? <Check className="size-3.5 text-emerald-800" /> : <Copy className="size-3.5" />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {order.trackingUrl && (
                            <a
                                href={order.trackingUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-2xl bg-emerald-700 px-5 py-2.5 text-[13px] font-bold text-white shadow-2xs hover:bg-emerald-800 transition-colors"
                            >
                                Track Package Online <ExternalLink className="size-3.5" />
                            </a>
                        )}
                    </div>
                </div>
            )}

            {/* Rate items banner if token available */}
            {order.reviewToken && (
                <div className="flex items-center justify-between rounded-3xl bg-lime-500/20 border border-lime-500/40 p-4 text-teal-950">
                    <div className="flex items-center gap-3">
                        <Star className="size-5 text-lime-700" />
                        <span className="text-[13px] font-bold">
                            How did you enjoy your items? We’d love to hear your review!
                        </span>
                    </div>
                    <Link
                        href={`/review/${encodeURIComponent(order.orderNumber)}?token=${encodeURIComponent(order.reviewToken)}`}
                        className="inline-flex items-center gap-1.5 rounded-full bg-teal-950 px-4 py-2 text-[12px] font-bold text-white hover:bg-teal-900 transition-colors"
                    >
                        Leave a Review
                    </Link>
                </div>
            )}

            {/* Main Grid Layout */}
            <div className="grid gap-6 lg:grid-cols-3">
                {/* Left Column (Items & Timeline) */}
                <div className="space-y-6 lg:col-span-2">
                    {/* Items Card */}
                    <div className="rounded-3xl bg-white p-6 shadow-card border border-teal-950/10">
                        <h2 className="text-[16px] font-extrabold text-teal-950 border-b border-black/5 pb-3">
                            Items in this Order ({order.items?.length ?? 0})
                        </h2>

                        <div className="divide-y divide-black/5">
                            {(order.items ?? []).map((line, idx) => (
                                <div
                                    key={line.id ? `${line.id}-${idx}` : `${line.sku || "item"}-${idx}`}
                                    className="flex items-start gap-4 py-4 first:pt-4 last:pb-0"
                                >
                                    <div className="relative size-16 shrink-0 overflow-hidden rounded-2xl bg-canvas border border-black/10">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={productImageSrc(line.image, line.productSlug || line.productName)}
                                            alt={line.productName}
                                            className="size-full object-cover"
                                            onError={(e) => {
                                                (e.currentTarget as HTMLImageElement).src = "/images/placeholder.png";
                                            }}
                                        />
                                    </div>

                                    <div className="min-w-0 flex-1">
                                        <h3 className="text-[14px] font-bold text-teal-950 leading-snug">
                                            {line.productName}
                                        </h3>
                                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-muted">
                                            <span className="font-mono text-neutral-600 font-semibold">{line.sku}</span>
                                            {line.unit && <span>• Unit: <strong className="text-teal-950">{line.unit}</strong></span>}
                                            <span>• Price: <strong className="text-teal-950">{money(line.unitPrice, order.currency)}</strong></span>
                                            {line.appliedGroup && line.appliedGroup !== "RETAIL" && (
                                                <span className="rounded-full bg-teal-50 px-2 py-0.2 text-[10px] font-bold uppercase text-teal-800 border border-teal-950/10">
                                                    {line.appliedGroup} Price
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="text-right shrink-0">
                                        <span className="inline-block rounded-lg bg-soft-control px-2.5 py-1 text-[12px] font-black text-teal-950">
                                            ×{line.quantity}
                                        </span>
                                        <p className="mt-1 text-[14px] font-extrabold text-teal-950">
                                            {money(line.lineTotal, order.currency)}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Order Timeline */}
                    <div className="rounded-3xl bg-white p-6 shadow-card border border-teal-950/10">
                        <div className="flex items-center gap-2 border-b border-black/5 pb-3">
                            <ClipboardList className="size-4 text-teal-950" aria-hidden />
                            <h2 className="text-[16px] font-extrabold text-teal-950">Order Updates &amp; Tracking</h2>
                        </div>
                        <div className="mt-4">
                            <OrderTimeline events={order.timeline || []} />
                        </div>
                    </div>
                </div>

                {/* Right Column (Summary & Shipping Info) */}
                <div className="space-y-6">
                    {/* Order Summary Card */}
                    <div className="rounded-3xl bg-white p-6 shadow-card border border-teal-950/10">
                        <h2 className="text-[15px] font-bold text-teal-950 border-b border-black/5 pb-3">
                            Payment Summary
                        </h2>
                        <dl className="mt-4 space-y-2.5 text-[13px]">
                            <div className="flex justify-between">
                                <dt className="text-muted">Items Subtotal</dt>
                                <dd className="font-semibold text-teal-950">{money(order.subtotal, order.currency)}</dd>
                            </div>
                            {order.discountTotal > 0 && (
                                <div className="flex justify-between text-coral font-medium">
                                    <dt>Coupon Discount{order.couponCode ? ` (${order.couponCode})` : ""}</dt>
                                    <dd>-{money(order.discountTotal, order.currency)}</dd>
                                </div>
                            )}
                            <div className="flex justify-between">
                                <dt className="text-muted">Shipping ({order.shippingMethod || "Standard"})</dt>
                                <dd className="font-semibold text-teal-950">{money(order.shippingTotal, order.currency)}</dd>
                            </div>
                            <div className="flex justify-between">
                                <dt className="text-muted">Estimated Taxes (GST/HST/PST)</dt>
                                <dd className="font-semibold text-teal-950">{money(order.taxTotal, order.currency)}</dd>
                            </div>
                            <div className="flex justify-between border-t border-black/10 pt-3 text-[16px] font-black text-teal-950">
                                <dt>Total Amount</dt>
                                <dd>{money(order.grandTotal, order.currency)}</dd>
                            </div>
                            {order.refundedTotal > 0 && (
                                <div className="flex justify-between font-bold text-coral pt-1">
                                    <dt>Refunded</dt>
                                    <dd>-{money(order.refundedTotal, order.currency)}</dd>
                                </div>
                            )}
                        </dl>
                    </div>

                    {/* Shipping Address Card */}
                    <div className="rounded-3xl bg-white p-6 shadow-card border border-teal-950/10">
                        <div className="flex items-center gap-2 border-b border-black/5 pb-3">
                            <MapPin className="size-4 text-teal-950" aria-hidden />
                            <h2 className="text-[15px] font-bold text-teal-950">Delivery Address</h2>
                        </div>
                        {order.shippingAddress ? (
                            <div className="mt-3 text-[13px] leading-relaxed text-teal-950 font-medium">
                                <p className="font-bold text-[14px]">{order.shippingAddress.fullName || "Customer"}</p>
                                <p className="mt-1">{order.shippingAddress.line1}</p>
                                {order.shippingAddress.line2 && <p>{order.shippingAddress.line2}</p>}
                                <p className="font-bold">
                                    {[order.shippingAddress.city, order.shippingAddress.region, order.shippingAddress.postalCode]
                                        .filter(Boolean)
                                        .join(", ")}
                                </p>
                                <p className="text-muted">{order.shippingAddress.country || "Canada"}</p>
                                {order.shippingAddress.phone && (
                                    <p className="mt-2 text-muted text-[12px]">Phone: {order.shippingAddress.phone}</p>
                                )}
                            </div>
                        ) : (
                            <p className="mt-3 text-[13px] text-muted italic">No shipping address provided</p>
                        )}
                    </div>

                    {/* Customer Support Card */}
                    <div className="rounded-3xl bg-soft-control/60 border border-black/5 p-5 text-[12px]">
                        <div className="flex items-center gap-2 font-bold text-teal-950 mb-1">
                            <HelpCircle className="size-4 text-teal-900" />
                            Need Help with this Order?
                        </div>
                        <p className="text-muted leading-relaxed">
                            Our team is here to help with any shipping, packaging, or payment questions.
                        </p>
                        <p className="mt-2 text-teal-950 font-medium">
                            Email: <a href="mailto:Info@wataniandsons.com" className="underline font-bold">Info@wataniandsons.com</a><br />
                            Phone: <a href="tel:+16138547777" className="underline font-bold">+1 (613) 854-7777</a>
                        </p>
                    </div>
                </div>
            </div>

            {/* Cancel Confirmation Modal */}
            {showCancelConfirm && (
                <div className="fixed inset-0 z-50 grid place-items-center bg-teal-950/50 p-4 backdrop-blur-xs">
                    <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl space-y-4">
                        <h3 className="text-[18px] font-extrabold text-teal-950">Cancel Order #{order.orderNumber}?</h3>
                        <p className="text-[13px] text-muted leading-relaxed">
                            Are you sure you want to cancel this order? This action is permanent and cannot be undone. Orders can only be cancelled before they are packed or dispatched.
                        </p>
                        <div className="flex items-center justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowCancelConfirm(false)}
                                disabled={cancelling}
                                className="h-10 px-4 rounded-xl border border-black/10 text-teal-950 font-bold text-[13px] hover:bg-soft-control transition-colors"
                            >
                                Keep Order
                            </button>
                            <button
                                type="button"
                                onClick={handleCancelOrder}
                                disabled={cancelling}
                                className="h-10 px-5 rounded-xl bg-coral text-white font-bold text-[13px] hover:bg-coral/90 transition-colors disabled:opacity-60"
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
