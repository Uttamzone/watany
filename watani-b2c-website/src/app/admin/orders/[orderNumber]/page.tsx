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
    User,
    Clock,
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

type OrderTab = "items" | "pack" | "ship" | "timeline";

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

    // Active workspace tab
    const [activeTab, setActiveTab] = useState<OrderTab>("items");

    // Shipping Label & BOL dialog
    const [labelDialogOpen, setLabelDialogOpen] = useState(false);
    const [labelDocType, setLabelDocType] = useState<"PARCEL" | "PALLET" | "BOL">("PARCEL");

    function load() {
        adminApi
            .getOrder(orderNumber)
            .then((detail) => {
                setOrder(detail.order);
                setCarrierCost(detail.carrierCost);

                // Auto-route to most relevant tab if not set manually
                if (typeof window !== "undefined" && window.location.hash) {
                    const hash = window.location.hash.replace("#", "").toLowerCase();
                    if (hash === "pack") setActiveTab("pack");
                    else if (hash === "ship") setActiveTab("ship");
                    else if (hash === "timeline") setActiveTab("timeline");
                } else if (detail.order.status === "PACKED") {
                    setActiveTab("ship");
                } else if (detail.order.status === "SHIPPED") {
                    setActiveTab("items");
                }
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
        <div className="space-y-4 pb-8">
            {/* 1. COMPACT TOP HEADER & QUICK ACTION BAR (NO SCROLL NEEDED) */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-3.5 shadow-2xs border border-teal-950/10">
                <div className="flex flex-wrap items-center gap-2.5">
                    <Link
                        href="/admin/orders"
                        className="inline-flex items-center gap-1 rounded-xl border border-black/10 bg-soft-control/60 px-2.5 py-1.5 text-[12px] font-bold text-teal-950 hover:bg-soft-control transition-colors"
                        title="Back to orders list"
                    >
                        <ArrowLeft className="size-3.5" />
                        Orders
                    </Link>

                    <h1 className="text-[20px] sm:text-[22px] font-black text-teal-950 tracking-tight">
                        {order.orderNumber}
                    </h1>

                    <span className="rounded-full bg-navy/10 px-2.5 py-0.5 text-[10px] font-black uppercase text-navy">
                        {CUSTOMER_CATEGORY_LABEL[order.pricingGroup] ?? order.pricingGroup}
                    </span>

                    {isPaid ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-black uppercase text-emerald-800">
                            <span className="size-1.5 rounded-full bg-emerald-600 animate-pulse" />
                            PAID
                        </span>
                    ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 text-[10px] font-black uppercase text-amber-800">
                            <span className="size-1.5 rounded-full bg-amber-600" />
                            UNPAID
                        </span>
                    )}

                    <StatusBadge status={order.status} />
                </div>

                {/* Primary Quick Actions Bar right at the top */}
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={() => {
                            setLabelDocType(isPalletShipment ? "PALLET" : "PARCEL");
                            setLabelDialogOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-teal-950 px-3 py-1.5 text-[12px] font-bold text-white shadow-2xs hover:bg-teal-900 transition-colors"
                    >
                        <Printer className="size-3.5" />
                        Labels &amp; BOL
                    </button>

                    <button
                        type="button"
                        disabled={downloadingInvoice}
                        onClick={handleDownloadInvoice}
                        className="inline-flex items-center gap-1 rounded-xl border border-black/15 bg-white px-2.5 py-1.5 text-[12px] font-bold text-teal-950 hover:bg-soft-control transition-colors disabled:opacity-60"
                        title="Download official commercial invoice PDF"
                    >
                        <Download className="size-3.5 text-muted" />
                        Invoice
                    </button>

                    {/* Quick next status button in top bar if available */}
                    {nextStatuses.length > 0 && (
                        <button
                            type="button"
                            onClick={() => setPendingStatus(nextStatuses[0])}
                            className="inline-flex items-center gap-1 rounded-xl bg-emerald-700 px-3 py-1.5 text-[12px] font-bold text-white hover:bg-emerald-800 transition-colors shadow-2xs"
                        >
                            Mark {nextStatuses[0].replace(/_/g, " ")}
                            <ArrowRight className="size-3" />
                        </button>
                    )}

                    {canMarkPaid && (
                        <button
                            type="button"
                            onClick={() => setMarkPaidOpen(true)}
                            className="inline-flex items-center gap-1 rounded-xl bg-amber-600 px-2.5 py-1.5 text-[12px] font-bold text-white hover:bg-amber-700 transition-colors shadow-2xs"
                        >
                            <BadgeCheck className="size-3.5" /> Mark Paid
                        </button>
                    )}
                </div>
            </div>

            {/* Special Notification Banner if needed */}
            {(order.paymentStatus === "REFUND_REQUIRED" || (order.status === "CANCELLED" && isPaid)) && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-300 bg-rose-50 p-3 text-rose-950 text-[13px]">
                    <div className="flex items-center gap-2 font-semibold">
                        <AlertCircle className="size-4 text-rose-600" />
                        <span>Customer Cancelled Order — Refund Required ({money(order.grandTotal, order.currency)})</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            setRefundAmount(String(order.grandTotal));
                            setRefundOpen(true);
                        }}
                        className="rounded-lg bg-rose-600 px-3 py-1 text-[11px] font-bold text-white hover:bg-rose-700"
                    >
                        Issue Refund
                    </button>
                </div>
            )}

            {/* 2. COMPACT 3-COLUMN SUMMARY STRIP (CUSTOMER, DESTINATION, TOTALS) - ALL VISIBLE WITHOUT SCROLL */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {/* Column 1: Customer Info */}
                <div className="rounded-2xl bg-white p-3.5 shadow-2xs border border-teal-950/10 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted">Customer Account</span>
                            <span className="text-[10px] font-bold text-teal-900">{PAYMENT_METHOD_LABEL[order.paymentMethod] || order.paymentMethod}</span>
                        </div>
                        <p className="font-bold text-teal-950 text-[14px] mt-0.5 truncate">
                            {order.shippingAddress?.fullName || order.email}
                        </p>
                        <div className="flex items-center justify-between text-[12px] mt-1 text-muted">
                            <a href={`mailto:${order.email}`} className="truncate hover:underline text-teal-800">
                                {order.email}
                            </a>
                            <button type="button" onClick={copyCustomerEmail} title="Copy email" className="p-0.5 text-muted hover:text-teal-950">
                                {copiedEmail ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
                            </button>
                        </div>
                    </div>
                    {order.shippingAddress?.phone && (
                        <div className="mt-1 pt-1 border-t border-black/5 text-[11px] text-muted">
                            Tel: <a href={`tel:${order.shippingAddress.phone}`} className="font-semibold text-teal-950">{order.shippingAddress.phone}</a>
                        </div>
                    )}
                </div>

                {/* Column 2: Delivery Destination */}
                <div className="rounded-2xl bg-white p-3.5 shadow-2xs border border-teal-950/10 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted">Shipping Destination</span>
                            <button
                                type="button"
                                onClick={copyShippingAddress}
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-teal-800 hover:underline"
                            >
                                {copiedAddress ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
                                {copiedAddress ? "Copied" : "Copy"}
                            </button>
                        </div>
                        {order.shippingAddress ? (
                            <p className="text-[12px] font-medium text-teal-950 mt-0.5 leading-snug line-clamp-2">
                                {order.shippingAddress.line1}, {order.shippingAddress.city}, {order.shippingAddress.region} {order.shippingAddress.postalCode}
                            </p>
                        ) : (
                            <p className="text-[12px] text-muted italic mt-0.5">No shipping address recorded</p>
                        )}
                    </div>
                    <div className="mt-1 pt-1 border-t border-black/5 flex items-center justify-between text-[11px]">
                        <span className="font-bold text-teal-900 truncate">
                            {isPalletShipment ? "40×48 Pallet Freight" : "Standard Parcel"}
                        </span>
                        <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddressText)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-teal-700 hover:underline inline-flex items-center gap-0.5 font-bold"
                        >
                            <MapPin className="size-3" /> Maps
                        </a>
                    </div>
                </div>

                {/* Column 3: Totals & Financial Verification */}
                <div className="rounded-2xl bg-white p-3.5 shadow-2xs border border-teal-950/10 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted">Grand Total</span>
                            <span className="text-[10px] font-bold text-muted">
                                Items: {money(order.subtotal, order.currency)}
                            </span>
                        </div>
                        <div className="flex items-baseline justify-between mt-0.5">
                            <p className="text-[20px] font-black text-teal-950">
                                {money(order.grandTotal, order.currency)}
                            </p>
                            <span className="text-[11px] font-semibold text-muted">
                                Tax: {money(order.taxTotal, order.currency)} · Ship: {money(order.shippingTotal, order.currency)}
                            </span>
                        </div>
                    </div>
                    <div className="mt-1 pt-1 border-t border-black/5 flex items-center justify-between text-[11px]">
                        <span className="font-medium text-muted">
                            {isPaid ? "Payment Verified" : "Payment Pending"}
                        </span>
                        <div className="flex items-center gap-2">
                            {canMarkUnpaid && (
                                <button
                                    type="button"
                                    onClick={() => setMarkUnpaidOpen(true)}
                                    className="text-amber-800 font-bold hover:underline"
                                >
                                    Revert Unpaid
                                </button>
                            )}
                            {order.grandTotal - order.refundedTotal > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setRefundOpen(true)}
                                    className="text-coral font-bold hover:underline"
                                >
                                    Refund
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. OPERATIONAL WORKSPACE TABS - ZERO SCROLL FATIGUE */}
            <div className="rounded-3xl bg-white p-4 sm:p-5 shadow-card border border-teal-950/10">
                {/* Clean Tab Switcher Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/10 pb-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                        <button
                            type="button"
                            onClick={() => setActiveTab("items")}
                            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[13px] font-bold transition-all ${
                                activeTab === "items"
                                    ? "bg-teal-950 text-white shadow-2xs"
                                    : "bg-soft-control/60 text-teal-950 hover:bg-soft-control"
                            }`}
                        >
                            <Box className="size-4" />
                            Ordered Items ({order.items?.length || 0})
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab("pack")}
                            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[13px] font-bold transition-all ${
                                activeTab === "pack"
                                    ? "bg-teal-950 text-white shadow-2xs"
                                    : "bg-soft-control/60 text-teal-950 hover:bg-soft-control"
                            }`}
                        >
                            <Box className="size-4" />
                            Pack Boxes &amp; Pallets
                            {order.status === "PACKED" || order.status === "SHIPPED" ? (
                                <span className="size-2 rounded-full bg-emerald-500" />
                            ) : null}
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab("ship")}
                            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[13px] font-bold transition-all ${
                                activeTab === "ship"
                                    ? "bg-teal-950 text-white shadow-2xs"
                                    : "bg-soft-control/60 text-teal-950 hover:bg-soft-control"
                            }`}
                        >
                            <Truck className="size-4" />
                            Carrier &amp; Shipping
                            {order.trackingNumber && (
                                <span className="size-2 rounded-full bg-emerald-500" />
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab("timeline")}
                            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[13px] font-bold transition-all ${
                                activeTab === "timeline"
                                    ? "bg-teal-950 text-white shadow-2xs"
                                    : "bg-soft-control/60 text-teal-950 hover:bg-soft-control"
                            }`}
                        >
                            <ClipboardList className="size-4" />
                            Timeline ({order.timeline?.length || 0})
                        </button>
                    </div>

                    {/* Quick helper indicator */}
                    <span className="text-[12px] font-semibold text-muted hidden sm:inline-block">
                        Status: <strong className="text-teal-950">{order.status.replace(/_/g, " ")}</strong>
                    </span>
                </div>

                {/* TAB 1: ORDERED ITEMS */}
                {activeTab === "items" && (
                    <div className="pt-4">
                        <div className="divide-y divide-black/5">
                            {(order.items || []).map((line) => (
                                <div key={line.sku} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                                    <div className="relative size-14 shrink-0 overflow-hidden rounded-2xl bg-canvas border border-black/10">
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
                                        <h3 className="text-[14px] font-bold text-teal-950 truncate">
                                            {line.productName}
                                        </h3>
                                        <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted mt-0.5">
                                            <span className="font-mono">{line.sku}</span>
                                            <span>• Unit: <strong className="text-teal-950">{line.unit}</strong></span>
                                            <span>• Unit Price: <strong className="text-teal-950">{money(line.unitPrice, order.currency)}</strong></span>
                                            {!line.taxable && (
                                                <span className="rounded-full bg-soft-control px-2 text-[10px] font-bold uppercase text-teal-900">
                                                    Tax-Exempt
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <span className="inline-block rounded-lg bg-soft-control px-2.5 py-0.5 text-[12px] font-black text-teal-950">
                                            ×{line.quantity}
                                        </span>
                                        <p className="text-[14px] font-black text-teal-950 mt-0.5">
                                            {money(line.lineTotal, order.currency)}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-4 flex flex-wrap items-center justify-between border-t border-black/5 pt-3 text-[13px]">
                            <span className="text-muted">Need to pack this order?</span>
                            <button
                                type="button"
                                onClick={() => setActiveTab("pack")}
                                className="inline-flex items-center gap-1 font-bold text-teal-950 hover:underline"
                            >
                                Open Pack Boxes Panel <ArrowRight className="size-3.5" />
                            </button>
                        </div>
                    </div>
                )}

                {/* TAB 2: PACK BOXES & PALLETS */}
                {activeTab === "pack" && (
                    <div className="pt-2">
                        <OrderPackPanel
                            order={order}
                            onPacked={(updated) => {
                                setOrder(updated);
                                setActiveTab("ship"); // automatically step forward to shipping upon saving packing!
                            }}
                        />
                    </div>
                )}

                {/* TAB 3: CARRIER BOOKING & SHIPPING */}
                {activeTab === "ship" && (
                    <div className="pt-2">
                        <OrderShipPanel
                            order={order}
                            carrierCost={carrierCost}
                            onBooked={(detail) => {
                                setOrder(detail.order);
                                setCarrierCost(detail.carrierCost);
                            }}
                        />
                    </div>
                )}

                {/* TAB 4: ORDER ACTIVITY TIMELINE */}
                {activeTab === "timeline" && (
                    <div className="pt-4">
                        <OrderTimeline events={order.timeline || []} />
                    </div>
                )}
            </div>

            {/* 4. COMPACT FOOTER ACTIONS (STATUS TRANSITIONS & DANGER ZONE) */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex flex-wrap items-center gap-2">
                    {nextStatuses.map((status) => (
                        <button
                            key={status}
                            type="button"
                            onClick={() => setPendingStatus(status)}
                            className="inline-flex items-center gap-1 rounded-xl border border-black/15 bg-white px-3 py-1.5 text-[12px] font-bold text-teal-950 hover:bg-soft-control transition-colors shadow-2xs"
                        >
                            Mark as {status.replace(/_/g, " ")}
                            <ArrowRight className="size-3 text-muted" />
                        </button>
                    ))}
                </div>

                <button
                    type="button"
                    onClick={() => setDeleteOpen(true)}
                    className="inline-flex items-center gap-1 rounded-xl border border-coral/30 px-3 py-1.5 text-[12px] font-bold text-coral hover:bg-coral/10 transition-colors"
                >
                    <Trash2 className="size-3" />
                    Delete Order
                </button>
            </div>

            {/* DIALOGS */}
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
