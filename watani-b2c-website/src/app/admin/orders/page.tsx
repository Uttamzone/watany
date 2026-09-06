"use client";

import {useEffect, useState, useMemo} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {BadgeCheck, Eye, Play, RotateCcw, Search, Trash2, AlertCircle} from "lucide-react";
import * as adminApi from "@/lib/admin/api";
import type {OrderResponse, OrderSortField, OrderStatus, SortDirection} from "@/lib/admin/types";
import {AdminTable, type AdminTableColumn} from "@/components/admin/admin-table";
import {StatusBadge} from "@/components/admin/status-badge";
import {ConfirmDialog} from "@/components/admin/confirm-dialog";
import {type RowAction, RowActions} from "@/components/admin/row-actions";
import {ApiError} from "@/lib/api";
import {useNotifications} from "@/components/notifications/notification-store";

const PAGE_SIZE = 15;

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
    STRIPE: "Card",
    E_TRANSFER: "E-Transfer",
    CHEQUE: "Cheque",
};

type FilterTab = "ALL" | "REFUND_REQUIRED" | "UNPAID" | "AWAITING_FULFILLMENT" | "COMPLETED";

export default function AdminOrdersPage() {
    const notifications = useNotifications();
    const [page, setPage] = useState(0);
    const [sortKey, setSortKey] = useState<OrderSortField>("createdAt");
    const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
    const [items, setItems] = useState<OrderResponse[]>([]);
    const [totalElements, setTotalElements] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filterTab, setFilterTab] = useState<FilterTab>("ALL");
    const [searchQuery, setSearchQuery] = useState("");
    const [deletingOrder, setDeletingOrder] = useState<OrderResponse | null>(null);
    const [markingPaidOrder, setMarkingPaidOrder] = useState<OrderResponse | null>(null);
    const [refundingOrder, setRefundingOrder] = useState<OrderResponse | null>(null);
    const router = useRouter();

    function reload() {
        adminApi
            .listOrders(page, PAGE_SIZE, sortKey, sortDirection)
            .then((result: any) => {
                const list = Array.isArray(result?.content) ? result.content : (Array.isArray(result) ? result : []);
                setItems(list);
                setTotalElements(result?.totalElements ?? list.length);
                setTotalPages(result?.totalPages ?? Math.max(1, Math.ceil(list.length / PAGE_SIZE)));
            })
            .catch((err) => {
                const message = err instanceof ApiError ? err.message : "Failed to load orders.";
                setError(message);
                notifications.error("Failed to load orders", message);
            })
            .finally(() => setLoading(false));
    }

    useEffect(() => {
        setLoading(true);
        reload();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, sortKey, sortDirection]);

    // Re-fetch when user navigates back to this tab or window gains focus
    useEffect(() => {
        function handleVisibilityOrFocus() {
            if (document.visibilityState === "visible") {
                reload();
            }
        }
        document.addEventListener("visibilitychange", handleVisibilityOrFocus);
        window.addEventListener("focus", handleVisibilityOrFocus);
        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
            window.removeEventListener("focus", handleVisibilityOrFocus);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, sortKey, sortDirection]);

    function handleSort(key: string) {
        setLoading(true);
        if (key === sortKey) {
            setSortDirection((direction) => (direction === "asc" ? "desc" : "asc"));
        } else {
            setSortKey(key as OrderSortField);
            setSortDirection("asc");
        }
        setPage(0);
    }

    function handlePageChange(nextPage: number) {
        setLoading(true);
        setPage(nextPage);
    }

    async function handleDeleteOrder() {
        if (!deletingOrder) return;
        const targetNumber = deletingOrder.orderNumber;
        try {
            await adminApi.deleteOrder(targetNumber);
            notifications.success("Order deleted", `Order ${targetNumber} has been removed.`);
            setItems((prev) => prev.filter((o) => o.orderNumber !== targetNumber));
            setTotalElements((prev) => Math.max(0, prev - 1));
            reload();
        } catch (err) {
            const message = err instanceof ApiError ? err.message : "Failed to delete order.";
            notifications.error("Failed to delete order", message);
        } finally {
            setDeletingOrder(null);
        }
    }

    async function handleQuickMarkPaid() {
        if (!markingPaidOrder) return;
        const targetNumber = markingPaidOrder.orderNumber;
        try {
            const updated = await adminApi.markOrderPaid(targetNumber, {});
            notifications.success("Marked as Paid", `Order ${targetNumber} payment verified.`);
            setItems((prev) => prev.map((o) => (o.orderNumber === targetNumber ? updated : o)));
            reload();
        } catch (err) {
            notifications.error("Mark as paid failed", err instanceof ApiError ? err.message : "Failed to mark as paid.");
        } finally {
            setMarkingPaidOrder(null);
        }
    }

    async function handleQuickRefund() {
        if (!refundingOrder) return;
        const targetNumber = refundingOrder.orderNumber;
        try {
            const updated = await adminApi.refundOrder(targetNumber, {});
            notifications.success("Order Refunded", `Order ${targetNumber} has been refunded.`);
            setItems((prev) => prev.map((o) => (o.orderNumber === targetNumber ? updated : o)));
            reload();
        } catch (err) {
            notifications.error("Refund failed", err instanceof ApiError ? err.message : "Failed to process refund.");
        } finally {
            setRefundingOrder(null);
        }
    }

    async function handleQuickTransition(orderNumber: string, status: OrderStatus) {
        try {
            const updated = await adminApi.transitionOrder(orderNumber, { status });
            notifications.success("Status updated", `Order ${orderNumber} is now ${status.replace(/_/g, " ").toLowerCase()}.`);
            setItems((prev) => prev.map((o) => (o.orderNumber === orderNumber ? updated : o)));
            reload();
        } catch (err) {
            notifications.error("Status update failed", err instanceof ApiError ? err.message : "Failed to update status.");
        }
    }

    const filteredItems = useMemo(() => {
        return items.filter((order) => {
            const matchesSearch =
                !searchQuery.trim() ||
                (order.orderNumber || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                (order.email || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                (order.shippingAddress?.fullName || "").toLowerCase().includes(searchQuery.toLowerCase());

            if (!matchesSearch) return false;

            const isPaid = order.paymentStatus === "PAID" || order.paymentStatus === "CAPTURED";
            const isRefundReq = order.paymentStatus === "REFUND_REQUIRED" || (order.status === "CANCELLED" && isPaid);

            if (filterTab === "REFUND_REQUIRED") {
                return isRefundReq;
            }
            if (filterTab === "UNPAID") {
                return !isPaid && order.status !== "CANCELLED" && order.paymentStatus !== "REFUNDED";
            }
            if (filterTab === "AWAITING_FULFILLMENT") {
                return order.status === "PLACED" || order.status === "PROCESSING" || order.status === "PACKED";
            }
            if (filterTab === "COMPLETED") {
                return order.status === "DELIVERED";
            }
            return true;
        });
    }, [items, searchQuery, filterTab]);

    const counts = useMemo(() => {
        let refundReqCount = 0;
        let unpaidCount = 0;
        let awaitingCount = 0;
        for (const o of items) {
            const isPaid = o.paymentStatus === "PAID" || o.paymentStatus === "CAPTURED";
            if (o.paymentStatus === "REFUND_REQUIRED" || (o.status === "CANCELLED" && isPaid)) {
                refundReqCount++;
            } else if (!isPaid && o.status !== "CANCELLED" && o.paymentStatus !== "REFUNDED") {
                unpaidCount++;
            }
            if (o.status === "PLACED" || o.status === "PROCESSING" || o.status === "PACKED") {
                awaitingCount++;
            }
        }
        return { refundReqCount, unpaidCount, awaitingCount };
    }, [items]);

    const columns: AdminTableColumn<OrderResponse>[] = [
        {
            key: "orderNumber",
            header: "Order",
            sortKey: "orderNumber",
            render: (row) => (
                <div className="flex flex-col">
                    <Link href={`/admin/orders/${row.orderNumber}`} className="font-bold text-teal-950 hover:underline">
                        {row.orderNumber}
                    </Link>
                    <span className="text-[11px] text-muted">
                        {row.items?.length || 0} item{(row.items?.length || 0) === 1 ? "" : "s"}
                    </span>
                </div>
            ),
        },
        {
            key: "email",
            header: "Customer",
            sortKey: "email",
            render: (row) => (
                <div className="flex flex-col">
                    <span className="font-medium text-teal-950 truncate max-w-[160px]">{row.shippingAddress?.fullName || row.email}</span>
                    <span className="text-[11px] text-muted truncate max-w-[160px]">{row.email}</span>
                </div>
            ),
        },
        {
            key: "category",
            header: "Category",
            render: (row) => (
                <span className="inline-flex items-center rounded-full bg-soft-control px-2.5 py-0.5 text-[11px] font-semibold text-teal-950">
                    {CUSTOMER_CATEGORY_LABEL[row.pricingGroup] ?? row.pricingGroup}
                </span>
            ),
        },
        {
            key: "status",
            header: "Status",
            sortKey: "status",
            render: (row) => <StatusBadge status={row.status} />,
        },
        {
            key: "payment",
            header: "Payment",
            sortKey: "paymentStatus",
            render: (row) => {
                const isPaid = row.paymentStatus === "PAID" || row.paymentStatus === "CAPTURED";
                const isRefunded = row.paymentStatus === "REFUNDED" || row.paymentStatus === "PARTIALLY_REFUNDED";
                const isRefundRequired = row.paymentStatus === "REFUND_REQUIRED" || (row.status === "CANCELLED" && isPaid);

                if (isRefundRequired) {
                    return (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/15 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-rose-700 border border-rose-500/30">
                            <span className="size-1.5 rounded-full bg-rose-600 animate-ping" />
                            REFUND REQUIRED
                        </span>
                    );
                }
                if (isPaid) {
                    return (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-emerald-800 border border-emerald-500/25">
                            <span className="size-1.5 rounded-full bg-emerald-600" />
                            PAID
                        </span>
                    );
                }
                if (isRefunded) {
                    return (
                        <span className="inline-flex items-center gap-1 rounded-full bg-navy/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-navy">
                            REFUNDED
                        </span>
                    );
                }
                return (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-amber-800 border border-amber-500/25">
                        <span className="size-1.5 rounded-full bg-amber-600 animate-pulse" />
                        UNPAID
                    </span>
                );
            },
        },
        {
            key: "method",
            header: "Method",
            render: (row) => (
                <span className="text-[12px] font-medium text-muted">
                    {PAYMENT_METHOD_LABEL[row.paymentMethod] ?? row.paymentMethod}
                </span>
            ),
        },
        {
            key: "total",
            header: "Total",
            sortKey: "grandTotal",
            render: (row) => (
                <span className="font-bold text-teal-950">{money(row.grandTotal, row.currency)}</span>
            ),
        },
        {
            key: "placedAt",
            header: "Placed",
            sortKey: "createdAt",
            render: (row) => <span className="text-muted text-[12px]">{new Date(row.placedAt).toLocaleDateString()}</span>,
        },
        {
            key: "actions",
            header: "",
            className: "text-right",
            render: (row) => {
                const isPaid = row.paymentStatus === "PAID" || row.paymentStatus === "CAPTURED";
                const isRefundRequired = row.paymentStatus === "REFUND_REQUIRED" || (row.status === "CANCELLED" && isPaid);
                const actions: RowAction[] = [
                    {label: "View order", icon: Eye, onSelect: () => router.push(`/admin/orders/${row.orderNumber}`)},
                ];

                if (isRefundRequired) {
                    actions.unshift({
                        label: `Process Refund (${money(row.grandTotal, row.currency)})`,
                        icon: RotateCcw,
                        tone: "danger",
                        onSelect: () => setRefundingOrder(row),
                    });
                } else if (!isPaid && row.status !== "CANCELLED") {
                    actions.push({
                        label: "Mark as paid",
                        icon: BadgeCheck,
                        onSelect: () => setMarkingPaidOrder(row),
                    });
                }

                if (row.status === "PLACED" || (isPaid && row.status === "PAID")) {
                    actions.push({
                        label: "Mark as processing",
                        icon: Play,
                        onSelect: () => handleQuickTransition(row.orderNumber, "PROCESSING"),
                    });
                }

                actions.push({
                    label: "Delete order",
                    icon: Trash2,
                    tone: "danger",
                    onSelect: () => setDeletingOrder(row),
                });

                return (
                    <div className="flex items-center justify-end gap-2">
                        {isRefundRequired && (
                            <button
                                type="button"
                                onClick={() => setRefundingOrder(row)}
                                className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-xs transition-colors hover:bg-rose-700"
                            >
                                <RotateCcw className="size-3" />
                                Refund
                            </button>
                        )}
                        <RowActions actions={actions} label={`Actions for order ${row.orderNumber}`}/>
                    </div>
                );
            },
        },
    ];

    return (
        <div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-[26px] font-extrabold text-teal-950">Orders</h1>
                    <p className="mt-1 text-[13px] text-muted">Track fulfilment, customer cancellations, and refunds.</p>
                </div>
                {counts.refundReqCount > 0 && (
                    <div className="flex items-center gap-2 rounded-2xl bg-rose-50 border border-rose-200 px-4 py-2.5 text-rose-900">
                        <AlertCircle className="size-5 text-rose-600 shrink-0" />
                        <div>
                            <p className="text-[13px] font-bold">
                                {counts.refundReqCount} order{counts.refundReqCount === 1 ? "" : "s"} require{counts.refundReqCount === 1 ? "s" : ""} a refund
                            </p>
                            <p className="text-[11px] text-rose-700">Customer cancelled after payment was captured.</p>
                        </div>
                    </div>
                )}
            </div>

            {error && (
                <p className="mt-4 rounded-xl bg-coral/10 px-4 py-3 text-[14px] font-medium text-coral">{error}</p>
            )}

            {/* Filter Tabs & Search Bar */}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-b border-black/5 pb-4">
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setFilterTab("ALL")}
                        className={`rounded-full px-3.5 py-1.5 text-[13px] font-bold transition-colors ${
                            filterTab === "ALL" ? "bg-teal-950 text-white" : "bg-white text-teal-950 hover:bg-soft-control border border-black/10"
                        }`}
                    >
                        All ({items.length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setFilterTab("REFUND_REQUIRED")}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-bold transition-colors ${
                            filterTab === "REFUND_REQUIRED"
                                ? "bg-rose-600 text-white"
                                : counts.refundReqCount > 0
                                ? "bg-rose-50 text-rose-700 border border-rose-300 hover:bg-rose-100"
                                : "bg-white text-teal-950 hover:bg-soft-control border border-black/10"
                        }`}
                    >
                        Needs Refund
                        {counts.refundReqCount > 0 && (
                            <span className="rounded-full bg-rose-600 px-1.5 py-0.2 text-[10px] text-white">
                                {counts.refundReqCount}
                            </span>
                        )}
                    </button>
                    <button
                        type="button"
                        onClick={() => setFilterTab("UNPAID")}
                        className={`rounded-full px-3.5 py-1.5 text-[13px] font-bold transition-colors ${
                            filterTab === "UNPAID" ? "bg-teal-950 text-white" : "bg-white text-teal-950 hover:bg-soft-control border border-black/10"
                        }`}
                    >
                        Unpaid ({counts.unpaidCount})
                    </button>
                    <button
                        type="button"
                        onClick={() => setFilterTab("AWAITING_FULFILLMENT")}
                        className={`rounded-full px-3.5 py-1.5 text-[13px] font-bold transition-colors ${
                            filterTab === "AWAITING_FULFILLMENT" ? "bg-teal-950 text-white" : "bg-white text-teal-950 hover:bg-soft-control border border-black/10"
                        }`}
                    >
                        Awaiting Fulfillment ({counts.awaitingCount})
                    </button>
                    <button
                        type="button"
                        onClick={() => setFilterTab("COMPLETED")}
                        className={`rounded-full px-3.5 py-1.5 text-[13px] font-bold transition-colors ${
                            filterTab === "COMPLETED" ? "bg-teal-950 text-white" : "bg-white text-teal-950 hover:bg-soft-control border border-black/10"
                        }`}
                    >
                        Completed
                    </button>
                </div>

                <div className="relative w-full max-w-xs sm:w-64">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
                    <input
                        type="text"
                        placeholder="Search order or customer…"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-10 w-full rounded-full border border-black/10 bg-white pl-9 pr-3 text-[13px] text-teal-950 placeholder:text-muted focus:border-teal-950 focus:outline-none"
                    />
                </div>
            </div>

            <div className="mt-4">
                <AdminTable
                    columns={columns}
                    rows={filteredItems}
                    rowKey={(row) => row.orderNumber || String(row.id)}
                    loading={loading}
                    emptyMessage="No matching orders found."
                    sorting={{sortKey, direction: sortDirection, onSort: handleSort}}
                    pagination={{page, totalPages, totalElements, onPageChange: handlePageChange}}
                />
            </div>

            <ConfirmDialog
                open={deletingOrder !== null}
                title={`Delete order ${deletingOrder?.orderNumber}?`}
                description="Are you sure you want to delete this order? All items, packaging, and records associated with this order will be permanently removed. This action cannot be undone."
                confirmLabel="Delete Order"
                danger
                onCancel={() => setDeletingOrder(null)}
                onConfirm={handleDeleteOrder}
            />

            <ConfirmDialog
                open={markingPaidOrder !== null}
                title={`Mark order ${markingPaidOrder?.orderNumber} as paid?`}
                description={`Confirm payment verification for ${money(markingPaidOrder?.grandTotal ?? 0, markingPaidOrder?.currency ?? "CAD")}.`}
                confirmLabel="Mark as Paid"
                onCancel={() => setMarkingPaidOrder(null)}
                onConfirm={handleQuickMarkPaid}
            />

            <ConfirmDialog
                open={refundingOrder !== null}
                title={`Process refund for order ${refundingOrder?.orderNumber}?`}
                description={`Customer cancelled this order after payment. Confirming this will issue a full refund of ${money(refundingOrder?.grandTotal ?? 0, refundingOrder?.currency ?? "CAD")} and mark the order as fully refunded.`}
                confirmLabel="Process Refund"
                danger
                onCancel={() => setRefundingOrder(null)}
                onConfirm={handleQuickRefund}
            />
        </div>
    );
}
