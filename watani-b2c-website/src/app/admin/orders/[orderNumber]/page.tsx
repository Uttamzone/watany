"use client";

import {use, useEffect, useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {ArrowLeft, ArrowRight, BadgeCheck, ClipboardList, ReceiptText, Trash2, RotateCcw, AlertCircle, CheckCircle2} from "lucide-react";
import * as adminApi from "@/lib/admin/api";
import type {OrderResponse, OrderStatus} from "@/lib/admin/types";
import {getOrderStatusTransitions} from "@/lib/admin/types";
import {StatusBadge} from "@/components/admin/status-badge";
import {ConfirmDialog} from "@/components/admin/confirm-dialog";
import {ApiError} from "@/lib/api";
import {useNotifications} from "@/components/notifications/notification-store";
import {OrderTimeline} from "@/components/admin/order-timeline";
import {OrderPackPanel} from "@/components/admin/order-pack-panel";
import {OrderShipPanel} from "@/components/admin/order-ship-panel";

function money(value: number, currency: string) {
    return new Intl.NumberFormat("en-CA", {style: "currency", currency}).format(value);
}

/** The client's own vocabulary for pricing groups, as shown to shippers. */
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
    const {orderNumber} = use(params);
    const notifications = useNotifications();
    const router = useRouter();
    const [order, setOrder] = useState<OrderResponse | null>(null);
    /** What Watani paid the carrier for the booked shipment - admin-only, never shown to the customer. */
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
            const updated = await adminApi.transitionOrder(orderNumber, {status});
            setOrder(updated);
        } catch (err) {
            notifications.error("Status transition failed", err instanceof ApiError ? err.message : "Status transition failed.");
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
            notifications.error("Mark as paid failed", err instanceof ApiError ? err.message : "Mark as paid failed.");
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
            notifications.success("Marked as Unpaid", `Order ${orderNumber} payment status reverted to unpaid (pending).`);
        } catch (err) {
            notifications.error("Mark as unpaid failed", err instanceof ApiError ? err.message : "Mark as unpaid failed.");
        } finally {
            setMarkUnpaidOpen(false);
            setMarkUnpaidNote("");
        }
    }

    async function applyRefund() {
        try {
            const amount = refundAmount.trim() ? Number(refundAmount) : undefined;
            const updated = await adminApi.refundOrder(orderNumber, {amount});
            setOrder(updated);
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

    if (!order) {
        return error ? (
            <div className="space-y-4">
                <Link
                    href="/admin/orders"
                    className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted transition-colors hover:text-teal-950"
                >
                    <ArrowLeft className="size-3.5" aria-hidden/>
                    Orders
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
            <p className="text-muted">Loading…</p>
        );
    }

    // Mirrors OrderService.markPaidManually's guard - UX-only, backend is the real gate.
    const canMarkPaid =
        order.status !== "CANCELLED" &&
        !["CAPTURED", "REFUNDED", "PARTIALLY_REFUNDED"].includes(order.paymentStatus) &&
        order.paymentStatus !== "PAID";

    const isPaid = order.paymentStatus === "PAID" || order.paymentStatus === "CAPTURED";
    const canMarkUnpaid = order.status !== "CANCELLED" && isPaid;

    // Drop bare PAID from the generic list - the "Mark as paid" card below is
    // the only route to PAID that records a payment reference/note.
    const nextStatuses = getOrderStatusTransitions(order).filter(
        (status) => !(canMarkPaid && status === "PAID"),
    );

    return (
        <div>
            <Link
                href="/admin/orders"
                className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted transition-colors hover:text-teal-950"
            >
                <ArrowLeft className="size-3.5" aria-hidden/>
                Orders
            </Link>

            <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
                <h1 className="text-[26px] font-extrabold text-teal-950">{order.orderNumber}</h1>
                <div className="flex flex-wrap items-center gap-2">
                    <span
                        className="inline-flex items-center rounded-full bg-navy/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-navy">
                        {CUSTOMER_CATEGORY_LABEL[order.pricingGroup] ?? order.pricingGroup}
                    </span>
                    {order.paymentMethod !== "STRIPE" && (
                        <span
                            className="inline-flex items-center rounded-full bg-soft-control px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-teal-900">
                            {PAYMENT_METHOD_LABEL[order.paymentMethod] ?? order.paymentMethod}
                        </span>
                    )}
                    {isPaid ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-emerald-800 shadow-sm">
                            <span className="size-2 rounded-full bg-emerald-600 animate-pulse" />
                            PAID
                        </span>
                    ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-amber-800 shadow-sm">
                            <span className="size-2 rounded-full bg-amber-600" />
                            UNPAID
                        </span>
                    )}
                    <StatusBadge status={order.status}/>
                    <StatusBadge status={order.paymentStatus}/>
                </div>
            </div>

            {(order.paymentStatus === "REFUND_REQUIRED" || (order.status === "CANCELLED" && isPaid)) && (
                <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-rose-300 bg-rose-50 p-4 text-rose-950 sm:flex-row sm:items-center sm:justify-between">
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
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-rose-600 px-4 py-2 text-[13px] font-bold text-white shadow-xs transition-colors hover:bg-rose-700"
                    >
                        <RotateCcw className="size-3.5" />
                        Issue Full Refund
                    </button>
                </div>
            )}

            {order.pricingGroup === "DISTRIBUTOR" && (
                <div className="mt-4 flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50/80 p-4 text-sky-950">
                    <CheckCircle2 className="size-5 shrink-0 text-sky-600 mt-0.5" aria-hidden />
                    <div className="text-[13px] leading-relaxed">
                        <span className="font-bold">Distributor Account (Pay Later Terms):</span>{" "}
                        Distributors purchase in bulk and pay later via e-transfer or cheque. This order is eligible to be processed, packed, and shipped before upfront payment is verified.
                    </div>
                </div>
            )}

            {order.pricingGroup !== "DISTRIBUTOR" && !isPaid && (
                <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-amber-950">
                    <AlertCircle className="size-5 shrink-0 text-amber-600 mt-0.5" aria-hidden />
                    <div className="text-[13px] leading-relaxed">
                        <span className="font-bold">Payment Required:</span>{" "}
                        This is a consumer/wholesale order. Full payment must be received and marked as paid before shipping can proceed.
                    </div>
                </div>
            )}

            {error && (
                <p className="mt-4 rounded-xl bg-coral/10 px-4 py-3 text-[14px] font-medium text-coral">{error}</p>
            )}

            <div className="mt-6 grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2 space-y-6">
                    <div className="rounded-2xl bg-white p-5 shadow-card">
                        <h2 className="text-[15px] font-bold text-teal-950">Items</h2>
                        <table className="mt-3 w-full text-left text-[14px]">
                            <tbody>
                            {(order.items || []).map((line) => (
                                <tr key={line.sku} className="border-b border-black/5 last:border-0">
                                    <td className="py-2">
                                        <p className="font-semibold text-teal-950">{line.productName}</p>
                                        <p className="text-[12px] text-muted">
                                            {line.sku} · {line.unit}
                                            {!line.taxable && " · tax-exempt"}
                                        </p>
                                    </td>
                                    <td className="py-2 text-right">×{line.quantity}</td>
                                    <td className="py-2 text-right font-semibold text-teal-950">
                                        {money(line.lineTotal, order.currency)}
                                    </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>

                    <OrderPackPanel order={order} onPacked={setOrder}/>

                    <div className="rounded-2xl bg-white p-5 shadow-card">
                        <div className="flex items-center gap-2">
                            <ClipboardList className="size-4 text-teal-950" aria-hidden/>
                            <h2 className="text-[15px] font-bold text-teal-950">Order Timeline</h2>
                        </div>
                        <div className="mt-4">
                            <OrderTimeline events={order.timeline || []}/>
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="rounded-2xl bg-white p-5 shadow-card">
                        <h2 className="text-[15px] font-bold text-teal-950">Totals</h2>
                        <dl className="mt-3 space-y-1.5 text-[13px]">
                            <div className="flex justify-between">
                                <dt className="text-muted">Total products</dt>
                                <dd>{money(order.subtotal, order.currency)}</dd>
                            </div>
                            <div className="flex justify-between">
                                <dt className="text-muted">Shipping</dt>
                                <dd>{money(order.shippingTotal, order.currency)}</dd>
                            </div>
                            <div className="flex justify-between">
                                <dt className="text-muted">Total taxes</dt>
                                <dd>{money(order.taxTotal, order.currency)}</dd>
                            </div>
                            <div className="flex justify-between font-bold text-teal-950">
                                <dt>Total</dt>
                                <dd>{money(order.grandTotal, order.currency)}</dd>
                            </div>
                            {order.refundedTotal > 0 && (
                                <div className="flex justify-between text-coral">
                                    <dt>Refunded</dt>
                                    <dd>{money(order.refundedTotal, order.currency)}</dd>
                                </div>
                            )}
                        </dl>
                        {carrierCost !== null && (
                            <div className="mt-3 border-t border-black/5 pt-3">
                                <div className="flex justify-between text-[13px]">
                                    <dt className="text-muted">Carrier cost (internal)</dt>
                                    <dd className="font-semibold text-teal-950">{money(carrierCost, order.currency)}</dd>
                                </div>
                                <p className="mt-1 text-[11px] text-muted">
                                    What we pay the carrier for this shipment - unrelated to the shipping charge above.
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="rounded-2xl bg-white p-5 shadow-card">
                        <h2 className="text-[15px] font-bold text-teal-950">Shipping address</h2>
                        {order.shippingAddress ? (
                            <p className="mt-2 text-[13px] text-teal-950">
                                {order.shippingAddress.fullName || "—"}<br/>
                                {order.shippingAddress.line1}
                                {order.shippingAddress.line2 && <>, {order.shippingAddress.line2}</>}<br/>
                                {[order.shippingAddress.city, order.shippingAddress.region, order.shippingAddress.postalCode].filter(Boolean).join(", ")}<br/>
                                {order.shippingAddress.country}
                            </p>
                        ) : (
                            <p className="mt-2 text-[13px] text-muted italic">No shipping address recorded</p>
                        )}
                    </div>

                    <OrderShipPanel
                        order={order}
                        carrierCost={carrierCost}
                        onBooked={(detail) => {
                            setOrder(detail.order);
                            setCarrierCost(detail.carrierCost);
                        }}
                    />

                    {canMarkPaid && (
                        <div className="rounded-2xl bg-white p-5 shadow-card">
                            <div className="flex items-center gap-2">
                                <BadgeCheck className="size-4 text-teal-950" aria-hidden/>
                                <h2 className="text-[15px] font-bold text-teal-950">Mark as paid</h2>
                            </div>
                            <p className="mt-1 text-[12px] text-muted">
                                {order.paymentMethod === "E_TRANSFER"
                                    ? "Customer was asked to e-transfer to info@wataniandsons.com. Confirm receipt before marking paid."
                                    : order.paymentMethod === "CHEQUE"
                                        ? "Customer was asked to make the cheque payable to Watani & Sons Corp. Confirm receipt before marking paid."
                                        : "For payments confirmed outside the payment provider (e-transfer, cheque, cash)."}
                            </p>
                            <div className="mt-3 space-y-2">
                                <input
                                    type="text"
                                    value={markPaidReference}
                                    onChange={(e) => setMarkPaidReference(e.target.value)}
                                    placeholder="Reference (e.g. e-transfer id)"
                                    className="h-10 w-full rounded-xl border border-black/10 px-3 text-[13px] outline-none focus:border-teal-950"
                                />
                                <input
                                    type="text"
                                    value={markPaidNote}
                                    onChange={(e) => setMarkPaidNote(e.target.value)}
                                    placeholder="Note (optional)"
                                    className="h-10 w-full rounded-xl border border-black/10 px-3 text-[13px] outline-none focus:border-teal-950"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() => setMarkPaidOpen(true)}
                                className="mt-3 h-10 w-full rounded-xl bg-teal-950 text-[13px] font-bold text-white transition-colors hover:bg-teal-900"
                            >
                                Mark as paid
                            </button>
                        </div>
                    )}

                    {canMarkUnpaid && (
                        <div className="rounded-2xl bg-white p-5 shadow-card border border-amber-500/20">
                            <div className="flex items-center gap-2">
                                <RotateCcw className="size-4 text-amber-600" aria-hidden/>
                                <h2 className="text-[15px] font-bold text-teal-950">Mark as unpaid</h2>
                            </div>
                            <p className="mt-1 text-[12px] text-muted">
                                If this order was mistakenly marked as paid, you can revert its payment status back to unpaid (pending).
                            </p>
                            <div className="mt-3">
                                <input
                                    type="text"
                                    value={markUnpaidNote}
                                    onChange={(e) => setMarkUnpaidNote(e.target.value)}
                                    placeholder="Reason for reverting to unpaid (optional)"
                                    className="h-10 w-full rounded-xl border border-black/10 px-3 text-[13px] outline-none focus:border-amber-600"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() => setMarkUnpaidOpen(true)}
                                className="mt-3 h-10 w-full rounded-xl bg-amber-600 text-[13px] font-bold text-white transition-colors hover:bg-amber-700"
                            >
                                Mark as unpaid
                            </button>
                        </div>
                    )}

                    {nextStatuses.length > 0 && (
                        <div className="rounded-2xl bg-white p-5 shadow-card">
                            <h2 className="text-[15px] font-bold text-teal-950">Update status</h2>
                            <p className="mt-1 text-[12px] text-muted">Currently {order.status.replace(/_/g, " ").toLowerCase()}.</p>
                            <div className="mt-3 space-y-2">
                                {nextStatuses.map((status, index) => (
                                    <button
                                        key={status}
                                        type="button"
                                        onClick={() => setPendingStatus(status)}
                                        className={`flex h-11 w-full items-center justify-between rounded-xl px-4 text-[13px] font-bold transition-colors ${
                                            index === 0
                                                ? "bg-teal-950 text-white hover:bg-teal-900"
                                                : "bg-soft-control text-teal-950 hover:bg-black/5"
                                        }`}
                                    >
                                        Mark as {status.replace(/_/g, " ")}
                                        <ArrowRight className="size-4" aria-hidden/>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="rounded-2xl bg-white p-5 shadow-card">
                        <div className="flex items-center gap-2">
                            <ReceiptText className="size-4 text-coral" aria-hidden/>
                            <h2 className="text-[15px] font-bold text-teal-950">Issue refund</h2>
                        </div>
                        <p className="mt-1 text-[12px] text-muted">
                            Refundable balance: {money(order.grandTotal - order.refundedTotal, order.currency)}
                        </p>
                        <button
                            type="button"
                            disabled={order.grandTotal - order.refundedTotal <= 0}
                            onClick={() => setRefundOpen(true)}
                            className="mt-3 h-10 w-full rounded-xl border border-coral/30 text-[13px] font-bold text-coral transition-colors hover:bg-coral/10 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            Issue refund
                        </button>
                    </div>

                    <div className="rounded-2xl bg-white p-5 shadow-card border border-coral/20">
                        <div className="flex items-center gap-2">
                            <Trash2 className="size-4 text-coral" aria-hidden/>
                            <h2 className="text-[15px] font-bold text-coral">Delete Order</h2>
                        </div>
                        <p className="mt-1 text-[12px] text-muted">
                            Permanently remove this order and all associated items and box records from the store.
                        </p>
                        <button
                            type="button"
                            onClick={() => setDeleteOpen(true)}
                            className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-coral/10 text-[13px] font-bold text-coral transition-colors hover:bg-coral hover:text-white cursor-pointer"
                        >
                            <Trash2 className="size-4" aria-hidden/>
                            Delete order
                        </button>
                    </div>
                </div>
            </div>

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
                    "provider. This cannot be undone from here - use a refund if it turns out to be wrong."
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
        </div>
    );
}
