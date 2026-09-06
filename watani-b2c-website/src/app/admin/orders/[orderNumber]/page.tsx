"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    ArrowLeft,
    ArrowRight,
    BadgeCheck,
    ClipboardList,
    ReceiptText,
    Trash2,
    RotateCcw,
    AlertCircle,
    CheckCircle2,
    Box,
    Truck,
    ExternalLink,
    Printer,
    FileText,
    Download,
    Copy,
    Check,
    MapPin,
    Mail,
    Phone,
    Calendar,
    CreditCard,
    ChevronRight,
    User,
    PackageCheck,
} from "lucide-react";
import * as adminApi from "@/lib/admin/api";
import type { OrderResponse, OrderStatus } from "@/lib/admin/types";
import { getOrderStatusTransitions } from "@/lib/admin/types";
import { StatusBadge } from "@/components/admin/status-badge";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { ApiError } from "@/lib/api";
import { useNotifications } from "@/components/notifications/notification-store";
import { OrderTimeline } from "@/components/admin/order-timeline";
import { OrderPackPanel } from "@/components/admin/order-pack-panel";
import { OrderShipPanel } from "@/components/admin/order-ship-panel";
import { ShippingLabelDialog } from "@/components/admin/shipping-label-dialog";
import { productImageSrc } from "@/lib/products";

function money(value: number, currency: string) {
    return new Intl.NumberFormat("en-CA", { style: "currency", currency }).format(value);
}

const CUSTOMER_CATEGORY_LABEL: Record<string, string> = {
    RETAIL: "Consumer",
    WHOLESALE: "Wholesale",
    DISTRIBUTOR: "Distributor",
};

const PAYMENT_METHOD_LABEL: Record<string, string> = {
    STRIPE: "Card (Stripe)",
    E_TRANSFER: "E-Transfer",
    CHEQUE: "Pay by Cheque",
};

export default function AdminOrderDetailPage({
    params,
}: {
    params: Promise<{ orderNumber: string }>;
}) {
    const { orderNumber } = use(params);
    const notifications = useNotifications();
    const router = useRouter();
    const [order, setOrder] = useState<OrderResponse | null>(null);
    const [carrierCost, setCarrierCost] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [pendingStatus, setPendingStatus] = useState<OrderStatus | null>(null);
    const [refundOpen, setRefundOpen] = useState(false);
    const [refundAmount, setRefundAmount] = useState("");
    const [markPaidOpen, setMarkPaidOpen] = useState(false);
    const [markPaidReference, setMarkPaidReference] = useState("");
    const [markPaidNote, setMarkPaidNote] = useState("");
    const [markUnpaidOpen, setMarkUnpaidOpen] = useState(false);
    const [markUnpaidNote, setMarkUnpaidNote] = useState("");
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [downloadingInvoice, setDownloadingInvoice] = useState(false);
    const [copiedAddress, setCopiedAddress] = useState(false);
    const [copiedEmail, setCopiedEmail] = useState(false);

    // Shipping Label & BOL dialog
    const [labelDialogOpen, setLabelDialogOpen] = useState(false);
    const [labelDocType, setLabelDocType] = useState<"PARCEL" | "PALLET" | "BOL">("PARCEL");

    function load() {
        adminApi
            .getOrder(orderNumber)
            .then((detail) => {
                setOrder(detail.order);
                setCarrierCost(detail.carrierCost);
            })
            .catch((err) => {
                const message = err instanceof ApiError ? err.message : "Failed to load order.";
                setError(message);
                notifications.error("Failed to load order", message);
            });
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(load, [orderNumber]);

    async function applyTransition(status: OrderStatus) {
        try {
            const updated = await adminApi.transitionOrder(orderNumber, { status });
            setOrder(updated);
        } catch (err) {
            notifications.error(
                "Status transition failed",
                err instanceof ApiError ? err.message : "Status transition failed."
            );
        } finally {
            setPendingStatus(null);
        }
    }

    async function applyMarkPaid() {
        try {
            const updated = await adminApi.markOrderPaid(orderNumber, {
                reference: markPaidReference.trim() || undefined,
                note: markPaidNote.trim() || undefined,
            });
            setOrder(updated);
            notifications.success("Marked as Paid", `Order ${orderNumber} payment verified successfully.`);
        } catch (err) {
            notifications.error(
                "Mark as paid failed",
                err instanceof ApiError ? err.message : "Mark as paid failed."
            );
        } finally {
            setMarkPaidOpen(false);
            setMarkPaidReference("");
            setMarkPaidNote("");
        }
    }

    async function applyMarkUnpaid() {
        try {
            const updated = await adminApi.markOrderUnpaid(orderNumber, markUnpaidNote.trim() || undefined);
            setOrder(updated);
            notifications.success(
                "Marked as Unpaid",
                `Order ${orderNumber} payment status reverted to unpaid (pending).`
            );
        } catch (err) {
            notifications.error(
                "Mark as unpaid failed",
                err instanceof ApiError ? err.message : "Mark as unpaid failed."
            );
        } finally {
            setMarkUnpaidOpen(false);
            setMarkUnpaidNote("");
        }
    }

    async function applyRefund() {
        try {
            const amount = refundAmount.trim() ? Number(refundAmount) : undefined;
            const updated = await adminApi.refundOrder(orderNumber, { amount });
            setOrder(updated);
            notifications.success("Refund Processed", `Refund of ${money(amount || order?.grandTotal || 0, order?.currency || "CAD")} completed.`);
        } catch (err) {
            notifications.error("Refund failed", err instanceof ApiError ? err.message : "Refund failed.");
        } finally {
            setRefundOpen(false);
            setRefundAmount("");
        }
    }

    async function applyDelete() {
        setDeleting(true);
        try {
            await adminApi.deleteOrder(orderNumber);
            notifications.success("Order deleted", `Order ${orderNumber} has been permanently deleted.`);
            router.replace("/admin/orders");
        } catch (err) {
            const message = err instanceof ApiError ? err.message : "Failed to delete order.";
            notifications.error("Delete order failed", message);
            setDeleting(false);
            setDeleteOpen(false);
        }
    }

    async function handleDownloadInvoice() {
        if (!order) return;
        setDownloadingInvoice(true);
        try {
            const { generateInvoicePdf } = await import("@/lib/invoice-generator");
            const blob = await generateInvoicePdf(order);
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `invoice-${order.orderNumber}.pdf`;
            link.click();
            URL.revokeObjectURL(url);
            notifications.success("Invoice Ready", `Downloaded invoice for order ${order.orderNumber}.`);
        } catch (err) {
            notifications.error("Invoice Error", "Could not generate invoice PDF.");
        } finally {
            setDownloadingInvoice(false);
        }
    }

    function copyShippingAddress() {
        if (!order?.shippingAddress) return;
        const addr = order.shippingAddress;
        const lines = [
            addr.fullName || order.email,
            addr.line1,
            addr.line2,
            `${addr.city}, ${addr.region} ${addr.postalCode}`,
            addr.country || "Canada",
            addr.phone ? `Phone: ${addr.phone}` : null,
        ].filter(Boolean);

        navigator.clipboard.writeText(lines.join("\n"));
        setCopiedAddress(true);
        notifications.success("Address Copied", "Shipping address copied to clipboard.");
        setTimeout(() => setCopiedAddress(false), 2500);
    }

    function copyCustomerEmail() {
        if (!order?.email) return;
        navigator.clipboard.writeText(order.email);
        setCopiedEmail(true);
        notifications.success("Email Copied", order.email);
        setTimeout(() => setCopiedEmail(false), 2500);
    }

    if (!order) {
        return error ? (
            <div className="space-y-4 max-w-2xl mx-auto py-8">
                <Link
                    href="/admin/orders"
                    className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted transition-colors hover:text-teal-950"
                >
                    <ArrowLeft className="size-3.5" aria-hidden />
                    Back to Orders
                </Link>
                <div className="rounded-2xl border border-coral/20 bg-coral/10 p-6">
                    <h2 className="text-[16px] font-bold text-coral">Order Unavailable</h2>
                    <p className="mt-1 text-[13px] text-teal-950">
                        {error.includes("404") || error.toLowerCase().includes("not found") || error.toLowerCase().includes("deleted")
                            ? `Order #${orderNumber} was not found or has been deleted.`
                            : error}
                    </p>
                    <Link
                        href="/admin/orders"
                        className="mt-4 inline-flex h-9 items-center rounded-xl bg-teal-950 px-4 text-[13px] font-semibold text-white transition-colors hover:bg-teal-900"
                    >
                        Return to Orders List
                    </Link>
                </div>
            </div>
        ) : (
            <div className="flex h-64 items-center justify-center text-[14px] text-muted font-medium">
                Loading order details…
            </div>
        );
    }

    const isPaid = order.paymentStatus === "PAID" || order.paymentStatus === "CAPTURED";
    const canMarkPaid =
        order.status !== "CANCELLED" &&
        !["CAPTURED", "REFUNDED", "PARTIALLY_REFUNDED"].includes(order.paymentStatus) &&
        order.paymentStatus !== "PAID";
    const canMarkUnpaid = order.status !== "CANCELLED" && isPaid;

    const nextStatuses = getOrderStatusTransitions(order).filter(
        (status) => !(canMarkPaid && status === "PAID")
    );

    const isPalletShipment =
        order.shippingMethod?.toLowerCase().includes("pallet") ||
        order.shippingMethod?.toLowerCase().includes("skid") ||
        order.carrierName?.toLowerCase().includes("day") ||
        order.carrierName?.toLowerCase().includes("ross") ||
        order.carrierName?.toLowerCase().includes("ltl") ||
        order.pricingGroup === "DISTRIBUTOR" ||
        order.shippingTotal >= 140;

    // Stepper logic
    const isPlaced = true;
    const isPaymentDone = isPaid || order.pricingGroup === "DISTRIBUTOR";
    const isPacked = ["PACKED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"].includes(order.status);
    const isShipped = ["SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"].includes(order.status);

    const fullAddressText = [
        order.shippingAddress?.line1,
        order.shippingAddress?.city,
        order.shippingAddress?.region,
        order.shippingAddress?.postalCode,
        order.shippingAddress?.country || "Canada",
    ]
        .filter(Boolean)
        .join(", ");

    return (
        <div className="space-y-6 pb-12">
            {/* Top Navigation & Action Command Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <Link
                    href="/admin/orders"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 bg-white px-3 py-1.5 text-[13px] font-bold text-teal-950 shadow-2xs hover:bg-soft-control transition-colors"
                >
                    <ArrowLeft className="size-4" aria-hidden />
                    All Orders
                </Link>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        disabled={downloadingInvoice}
                        onClick={handleDownloadInvoice}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-black/15 bg-white px-3.5 py-2 text-[13px] font-bold text-teal-950 shadow-2xs hover:bg-soft-control transition-colors disabled:opacity-60"
                    >
                        <Download className="size-4 text-muted" />
                        {downloadingInvoice ? "Generating…" : "Invoice PDF"}
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            setLabelDocType(isPalletShipment ? "PALLET" : "PARCEL");
                            setLabelDialogOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-teal-950 px-4 py-2 text-[13px] font-bold text-white shadow-2xs hover:bg-teal-900 transition-colors"
                    >
                        <Printer className="size-4" />
                        Shipping Labels &amp; BOL
                    </button>
                </div>
            </div>

            {/* Order Header Card */}
            <div className="rounded-3xl bg-white p-6 shadow-card border border-teal-950/10">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <div className="flex flex-wrap items-center gap-3">
                            <h1 className="text-[26px] sm:text-[30px] font-black text-teal-950 tracking-tight">
                                {order.orderNumber}
                            </h1>
                            <span className="inline-flex items-center rounded-full bg-navy/10 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-navy">
                                {CUSTOMER_CATEGORY_LABEL[order.pricingGroup] ?? order.pricingGroup} ACCOUNT
                            </span>
                            {isPaid ? (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-emerald-800 shadow-2xs">
                                    <span className="size-2 rounded-full bg-emerald-600 animate-pulse" />
                                    PAID
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-amber-800 shadow-2xs">
                                    <span className="size-2 rounded-full bg-amber-600" />
                                    UNPAID
                                </span>
                            )}
                            <StatusBadge status={order.status} />
                            <StatusBadge status={order.paymentStatus} />
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted">
                            <span className="inline-flex items-center gap-1">
                                <Calendar className="size-3.5" />
                                Placed {new Date(order.placedAt).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" })}
                            </span>
                            <span>•</span>
                            <span className="inline-flex items-center gap-1">
                                <CreditCard className="size-3.5" />
                                {PAYMENT_METHOD_LABEL[order.paymentMethod] ?? order.paymentMethod}
                            </span>
                            <span>•</span>
                            <span className="font-bold text-teal-950">
                                {order.items?.length || 0} Line Item{(order.items?.length || 0) === 1 ? "" : "s"}
                            </span>
                        </div>
                    </div>

                    <div className="text-right">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Total Amount</span>
                        <p className="text-[28px] font-black text-teal-950">
                            {money(order.grandTotal, order.currency)}
                        </p>
                    </div>
                </div>

                {/* 4-Step Visual Workflow Stepper */}
                <div className="mt-6 border-t border-black/5 pt-6">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {/* Step 1: Placed */}
                        <div className={`rounded-2xl p-3 border transition-all ${
                            isPlaced
                                ? "border-emerald-500/30 bg-emerald-50/50 text-emerald-950"
                                : "border-black/5 bg-soft-control/40 text-muted"
                        }`}>
                            <div className="flex items-center gap-2">
                                <CheckCircle2 className={`size-4 ${isPlaced ? "text-emerald-600" : "text-muted"}`} />
                                <span className="text-[12px] font-extrabold uppercase tracking-wide">1. Placed</span>
                            </div>
                            <p className="text-[11px] mt-1 text-muted">Customer checkout confirmed</p>
                        </div>

                        {/* Step 2: Payment */}
                        <div className={`rounded-2xl p-3 border transition-all ${
                            isPaymentDone
                                ? "border-emerald-500/30 bg-emerald-50/50 text-emerald-950"
                                : "border-amber-500/30 bg-amber-50/60 text-amber-950"
                        }`}>
                            <div className="flex items-center gap-2">
                                {isPaymentDone ? (
                                    <CheckCircle2 className="size-4 text-emerald-600" />
                                ) : (
                                    <span className="size-4 rounded-full bg-amber-500/20 text-amber-800 flex items-center justify-center text-[10px] font-black">2</span>
                                )}
                                <span className="text-[12px] font-extrabold uppercase tracking-wide">2. Payment</span>
                            </div>
                            <p className="text-[11px] mt-1">
                                {isPaid ? "Payment captured" : order.pricingGroup === "DISTRIBUTOR" ? "Pay later (Net terms)" : "Verification pending"}
                            </p>
                        </div>

                        {/* Step 3: Packing */}
                        <div className={`rounded-2xl p-3 border transition-all ${
                            isPacked
                                ? "border-emerald-500/30 bg-emerald-50/50 text-emerald-950"
                                : isPaymentDone
                                    ? "border-teal-950/30 bg-teal-50/60 text-teal-950"
                                    : "border-black/5 bg-soft-control/40 text-muted"
                        }`}>
                            <div className="flex items-center gap-2">
                                {isPacked ? (
                                    <CheckCircle2 className="size-4 text-emerald-600" />
                                ) : (
                                    <span className="size-4 rounded-full bg-teal-950/10 text-teal-950 flex items-center justify-center text-[10px] font-black">3</span>
                                )}
                                <span className="text-[12px] font-extrabold uppercase tracking-wide">3. Packing</span>
                            </div>
                            <p className="text-[11px] mt-1">
                                {isPacked ? "Boxes packed" : "Pack items into boxes"}
                            </p>
                        </div>

                        {/* Step 4: Shipping */}
                        <div className={`rounded-2xl p-3 border transition-all ${
                            isShipped
                                ? "border-emerald-500/30 bg-emerald-50/50 text-emerald-950"
                                : isPacked
                                    ? "border-teal-950/30 bg-teal-50/60 text-teal-950"
                                    : "border-black/5 bg-soft-control/40 text-muted"
                        }`}>
                            <div className="flex items-center gap-2">
                                {isShipped ? (
                                    <CheckCircle2 className="size-4 text-emerald-600" />
                                ) : (
                                    <span className="size-4 rounded-full bg-black/10 text-black flex items-center justify-center text-[10px] font-black">4</span>
                                )}
                                <span className="text-[12px] font-extrabold uppercase tracking-wide">4. Shipped</span>
                            </div>
                            <p className="text-[11px] mt-1">
                                {isShipped ? order.trackingNumber ? "Tracking active" : "Dispatched" : "Awaiting carrier"}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Special Notification Banners */}
            {(order.paymentStatus === "REFUND_REQUIRED" || (order.status === "CANCELLED" && isPaid)) && (
                <div className="flex flex-col gap-3 rounded-2xl border border-rose-300 bg-rose-50 p-4 text-rose-950 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                        <AlertCircle className="size-6 shrink-0 text-rose-600" aria-hidden />
                        <div>
                            <p className="text-[14px] font-bold text-rose-900">
                                Customer Cancelled Order — Refund Required ({money(order.grandTotal, order.currency)})
                            </p>
                            <p className="text-[12px] text-rose-700">
                                This order was cancelled by the customer after payment was captured. Please process a refund.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            setRefundAmount(String(order.grandTotal));
                            setRefundOpen(true);
                        }}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-rose-600 px-4 py-2 text-[13px] font-bold text-white shadow-2xs transition-colors hover:bg-rose-700"
                    >
                        <RotateCcw className="size-3.5" />
                        Issue Full Refund
                    </button>
                </div>
            )}

            {order.pricingGroup === "DISTRIBUTOR" && (
                <div className="flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50/80 p-4 text-sky-950">
                    <CheckCircle2 className="size-5 shrink-0 text-sky-600 mt-0.5" aria-hidden />
                    <div className="text-[13px] leading-relaxed">
                        <span className="font-bold">Distributor Account (Pay Later Terms):</span>{" "}
                        Distributors purchase in bulk and pay later via e-transfer or cheque. This order is eligible to be packed and shipped immediately prior to upfront payment verification.
                    </div>
                </div>
            )}

            {order.pricingGroup !== "DISTRIBUTOR" && !isPaid && (
                <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-amber-950">
                    <AlertCircle className="size-5 shrink-0 text-amber-600 mt-0.5" aria-hidden />
                    <div className="text-[13px] leading-relaxed">
                        <span className="font-bold">Payment Required:</span>{" "}
                        This is a consumer/wholesale order. Full payment must be received and marked as paid before shipping can proceed.
                    </div>
                </div>
            )}

            {error && (
                <p className="rounded-xl bg-coral/10 px-4 py-3 text-[14px] font-medium text-coral">{error}</p>
            )}

            {/* Main Content: Two Columns */}
            <div className="grid gap-6 lg:grid-cols-3">
                {/* Left Column (2/3 width): Items, Packing, Timeline */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Items Card */}
                    <div className="rounded-3xl bg-white p-6 shadow-card border border-teal-950/10">
                        <div className="flex items-center justify-between border-b border-black/5 pb-4">
                            <div className="flex items-center gap-2">
                                <Box className="size-5 text-teal-950" />
                                <h2 className="text-[16px] font-extrabold text-teal-950">
                                    Ordered Items ({order.items?.length || 0})
                                </h2>
                            </div>
                            <span className="text-[12px] font-bold text-muted">
                                Subtotal: {money(order.subtotal, order.currency)}
                            </span>
                        </div>

                        <div className="divide-y divide-black/5">
                            {(order.items || []).map((line) => (
                                <div key={line.sku} className="flex items-start gap-4 py-4 first:pt-4 last:pb-0">
                                    {/* Thumbnail */}
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

                                    {/* Details */}
                                    <div className="min-w-0 flex-1">
                                        <h3 className="text-[14px] font-bold text-teal-950 leading-snug">
                                            {line.productName}
                                        </h3>
                                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-muted">
                                            <span className="font-mono text-neutral-600 font-semibold">{line.sku}</span>
                                            <span>•</span>
                                            <span>Unit: <strong className="text-teal-950">{line.unit}</strong></span>
                                            <span>•</span>
                                            <span>Price: <strong className="text-teal-950">{money(line.unitPrice, order.currency)}</strong></span>
                                            {!line.taxable && (
                                                <span className="rounded-full bg-soft-control px-2 py-0.2 text-[10px] font-bold uppercase text-teal-900">
                                                    Tax-exempt
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Quantity & Total */}
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

                    {/* Order Packaging Panel */}
                    <OrderPackPanel order={order} onPacked={setOrder} />

                    {/* Order Activity Timeline */}
                    <div className="rounded-3xl bg-white p-6 shadow-card border border-teal-950/10">
                        <div className="flex items-center gap-2 border-b border-black/5 pb-3">
                            <ClipboardList className="size-4 text-teal-950" aria-hidden />
                            <h2 className="text-[16px] font-extrabold text-teal-950">Order Activity Timeline</h2>
                        </div>
                        <div className="mt-4">
                            <OrderTimeline events={order.timeline || []} />
                        </div>
                    </div>
                </div>

                {/* Right Column (1/3 width): Customer, Totals & Payment, Fulfillment, Status */}
                <div className="space-y-6">
                    {/* Customer & Destination Card */}
                    <div className="rounded-3xl bg-white p-5 shadow-card border border-teal-950/10">
                        <div className="flex items-center justify-between border-b border-black/5 pb-3">
                            <div className="flex items-center gap-2">
                                <User className="size-4 text-teal-950" />
                                <h2 className="text-[15px] font-bold text-teal-950">Customer &amp; Delivery</h2>
                            </div>
                            <span className="rounded-full bg-navy/10 px-2 py-0.5 text-[10px] font-bold uppercase text-navy">
                                {order.pricingGroup}
                            </span>
                        </div>

                        <div className="mt-3 space-y-3 text-[13px]">
                            <div>
                                <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Customer Name</span>
                                <p className="font-bold text-teal-950 mt-0.5 text-[14px]">
                                    {order.shippingAddress?.fullName || order.email}
                                </p>
                            </div>

                            <div>
                                <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Email</span>
                                <div className="flex items-center justify-between mt-0.5">
                                    <a
                                        href={`mailto:${order.email}`}
                                        className="font-semibold text-teal-800 hover:underline truncate"
                                    >
                                        {order.email}
                                    </a>
                                    <button
                                        type="button"
                                        onClick={copyCustomerEmail}
                                        title="Copy email"
                                        className="text-muted hover:text-teal-950 p-1"
                                    >
                                        {copiedEmail ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                                    </button>
                                </div>
                            </div>

                            {order.shippingAddress?.phone && (
                                <div>
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Phone</span>
                                    <p className="mt-0.5">
                                        <a href={`tel:${order.shippingAddress.phone}`} className="font-semibold text-teal-950 hover:underline">
                                            {order.shippingAddress.phone}
                                        </a>
                                    </p>
                                </div>
                            )}

                            <div className="border-t border-black/5 pt-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Shipping Destination</span>
                                    <button
                                        type="button"
                                        onClick={copyShippingAddress}
                                        className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-800 hover:underline"
                                    >
                                        {copiedAddress ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
                                        {copiedAddress ? "Copied" : "Copy"}
                                    </button>
                                </div>

                                {order.shippingAddress ? (
                                    <div className="mt-1 text-teal-950 leading-relaxed font-medium">
                                        <p>{order.shippingAddress.line1}</p>
                                        {order.shippingAddress.line2 && <p>{order.shippingAddress.line2}</p>}
                                        <p className="font-bold">
                                            {[order.shippingAddress.city, order.shippingAddress.region, order.shippingAddress.postalCode]
                                                .filter(Boolean)
                                                .join(", ")}
                                        </p>
                                        <p className="text-neutral-600">{order.shippingAddress.country || "Canada"}</p>

                                        <a
                                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddressText)}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-teal-700 hover:text-teal-950"
                                        >
                                            <MapPin className="size-3" />
                                            View on Google Maps <ExternalLink className="size-2.5" />
                                        </a>
                                    </div>
                                ) : (
                                    <p className="mt-1 text-muted italic">No shipping address recorded</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Totals & Financial Management Card */}
                    <div className="rounded-3xl bg-white p-5 shadow-card border border-teal-950/10">
                        <div className="flex items-center justify-between border-b border-black/5 pb-3">
                            <h2 className="text-[15px] font-bold text-teal-950">Totals &amp; Payment</h2>
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                                isPaid ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"
                            }`}>
                                {isPaid ? "Payment Captured" : "Payment Pending"}
                            </span>
                        </div>

                        <dl className="mt-3 space-y-2 text-[13px]">
                            <div className="flex justify-between">
                                <dt className="text-muted">Products Subtotal</dt>
                                <dd className="font-semibold text-teal-950">{money(order.subtotal, order.currency)}</dd>
                            </div>
                            <div className="flex justify-between">
                                <dt className="text-muted">Shipping</dt>
                                <dd className="font-semibold text-teal-950">{money(order.shippingTotal, order.currency)}</dd>
                            </div>
                            <div className="flex justify-between">
                                <dt className="text-muted">Taxes (GST/HST/PST)</dt>
                                <dd className="font-semibold text-teal-950">{money(order.taxTotal, order.currency)}</dd>
                            </div>
                            <div className="flex justify-between border-t border-black/10 pt-2 text-[15px] font-black text-teal-950">
                                <dt>Grand Total</dt>
                                <dd>{money(order.grandTotal, order.currency)}</dd>
                            </div>
                            {order.refundedTotal > 0 && (
                                <div className="flex justify-between text-coral font-bold pt-1">
                                    <dt>Refunded</dt>
                                    <dd>-{money(order.refundedTotal, order.currency)}</dd>
                                </div>
                            )}
                        </dl>

                        {carrierCost !== null && (
                            <div className="mt-3 border-t border-black/5 pt-2 text-[12px]">
                                <div className="flex justify-between">
                                    <span className="text-muted">Internal Carrier Cost:</span>
                                    <span className="font-bold text-teal-950">{money(carrierCost, order.currency)}</span>
                                </div>
                            </div>
                        )}

                        {/* Payment Verification Inline Controls */}
                        <div className="mt-4 border-t border-black/5 pt-3">
                            {canMarkPaid && (
                                <div className="space-y-2">
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Verify Payment</span>
                                    <p className="text-[11px] text-muted">
                                        {order.paymentMethod === "E_TRANSFER"
                                            ? "Customer e-transfers to info@wataniandsons.com. Record payment reference below."
                                            : "Verify payment received outside of the payment gateway."}
                                    </p>
                                    <input
                                        type="text"
                                        value={markPaidReference}
                                        onChange={(e) => setMarkPaidReference(e.target.value)}
                                        placeholder="Reference (e.g. e-transfer #)"
                                        className="h-9 w-full rounded-xl border border-black/10 px-3 text-[12px] outline-none focus:border-teal-950"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setMarkPaidOpen(true)}
                                        className="w-full rounded-xl bg-teal-950 py-2 text-[12px] font-bold text-white hover:bg-teal-900 transition-colors shadow-2xs"
                                    >
                                        Mark as Paid
                                    </button>
                                </div>
                            )}

                            {canMarkUnpaid && (
                                <div className="pt-1">
                                    <button
                                        type="button"
                                        onClick={() => setMarkUnpaidOpen(true)}
                                        className="w-full rounded-xl border border-amber-500/30 bg-amber-50 py-1.5 text-[12px] font-bold text-amber-900 hover:bg-amber-100 transition-colors"
                                    >
                                        Revert to Unpaid
                                    </button>
                                </div>
                            )}

                            {order.grandTotal - order.refundedTotal > 0 && (
                                <div className="mt-2 pt-2 border-t border-black/5">
                                    <button
                                        type="button"
                                        onClick={() => setRefundOpen(true)}
                                        className="w-full rounded-xl border border-coral/30 py-1.5 text-[12px] font-bold text-coral hover:bg-coral/10 transition-colors"
                                    >
                                        Issue Refund
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Carrier Shipment & Fulfillment Panel */}
                    <OrderShipPanel
                        order={order}
                        carrierCost={carrierCost}
                        onBooked={(detail) => {
                            setOrder(detail.order);
                            setCarrierCost(detail.carrierCost);
                        }}
                    />

                    {/* Order Status Workflow Transitions */}
                    {nextStatuses.length > 0 && (
                        <div className="rounded-3xl bg-white p-5 shadow-card border border-teal-950/10">
                            <h2 className="text-[15px] font-bold text-teal-950">Update Status</h2>
                            <p className="mt-1 text-[12px] text-muted">Currently {order.status.replace(/_/g, " ").toLowerCase()}.</p>
                            <div className="mt-3 space-y-2">
                                {nextStatuses.map((status, index) => (
                                    <button
                                        key={status}
                                        type="button"
                                        onClick={() => setPendingStatus(status)}
                                        className={`flex h-10 w-full items-center justify-between rounded-xl px-4 text-[12px] font-bold transition-colors ${
                                            index === 0
                                                ? "bg-teal-950 text-white hover:bg-teal-900 shadow-2xs"
                                                : "bg-soft-control text-teal-950 hover:bg-black/5"
                                        }`}
                                    >
                                        Mark as {status.replace(/_/g, " ")}
                                        <ArrowRight className="size-3.5" aria-hidden />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Danger Zone: Delete Order */}
                    <div className="rounded-3xl bg-white p-5 shadow-card border border-coral/20">
                        <div className="flex items-center gap-2">
                            <Trash2 className="size-4 text-coral" aria-hidden />
                            <h2 className="text-[14px] font-bold text-coral">Delete Order</h2>
                        </div>
                        <p className="mt-1 text-[11px] text-muted">
                            Permanently remove this order and all associated line records from the store.
                        </p>
                        <button
                            type="button"
                            onClick={() => setDeleteOpen(true)}
                            className="mt-3 flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-coral/10 text-[12px] font-bold text-coral transition-colors hover:bg-coral hover:text-white cursor-pointer"
                        >
                            <Trash2 className="size-3.5" aria-hidden />
                            Delete order
                        </button>
                    </div>
                </div>
            </div>

            {/* Dialogs */}
            <ConfirmDialog
                open={pendingStatus !== null}
                title={`Mark as ${pendingStatus?.replace(/_/g, " ")}?`}
                confirmLabel="Confirm"
                onCancel={() => setPendingStatus(null)}
                onConfirm={() => pendingStatus && applyTransition(pendingStatus)}
            />

            <ConfirmDialog
                open={markPaidOpen}
                title="Mark this order as paid?"
                description={
                    `Marks the full ${money(order.grandTotal, order.currency)} as captured outside the payment ` +
                    "provider. This records manual payment confirmation."
                }
                confirmLabel="Mark as paid"
                onCancel={() => setMarkPaidOpen(false)}
                onConfirm={applyMarkPaid}
            />

            <ConfirmDialog
                open={markUnpaidOpen}
                title="Mark this order as unpaid?"
                description={
                    `Reverts the payment status of order ${order.orderNumber} back to UNPAID (PENDING). ` +
                    "Use this if payment verification was recorded prematurely or in error."
                }
                confirmLabel="Mark as unpaid"
                danger
                onCancel={() => setMarkUnpaidOpen(false)}
                onConfirm={applyMarkUnpaid}
            />

            <ConfirmDialog
                open={refundOpen}
                title="Issue refund"
                description={
                    refundAmount.trim()
                        ? `Refund ${money(Number(refundAmount), order.currency)} to the customer.`
                        : `Refund the full remaining balance (${money(order.grandTotal - order.refundedTotal, order.currency)}).`
                }
                confirmLabel="Refund"
                danger
                onCancel={() => setRefundOpen(false)}
                onConfirm={applyRefund}
            />

            <ConfirmDialog
                open={deleteOpen}
                title={`Delete order ${orderNumber}?`}
                description="Are you sure you want to permanently delete this order? All line items, shipping boxes, and administrative records for this order will be removed immediately. This action cannot be undone."
                confirmLabel={deleting ? "Deleting..." : "Delete Order"}
                danger
                onCancel={() => setDeleteOpen(false)}
                onConfirm={applyDelete}
            />

            <ShippingLabelDialog
                open={labelDialogOpen}
                order={order}
                defaultDocType={labelDocType}
                onClose={() => setLabelDialogOpen(false)}
            />
        </div>
    );
}
