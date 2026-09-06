"use client";

import {useEffect, useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {BadgeCheck, Eye, Play, Trash2} from "lucide-react";
import * as adminApi from "@/lib/admin/api";
import type {OrderResponse, OrderSortField, OrderStatus, SortDirection} from "@/lib/admin/types";
import {AdminTable, type AdminTableColumn} from "@/components/admin/admin-table";
import {StatusBadge} from "@/components/admin/status-badge";
import {ConfirmDialog} from "@/components/admin/confirm-dialog";
import {type RowAction, RowActions} from "@/components/admin/row-actions";
import {ApiError} from "@/lib/api";
import {useNotifications} from "@/components/notifications/notification-store";

const PAGE_SIZE = 10;

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
    const [deletingOrder, setDeletingOrder] = useState<OrderResponse | null>(null);
    const [markingPaidOrder, setMarkingPaidOrder] = useState<OrderResponse | null>(null);
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
            // Optimistic removal then reload for accuracy
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

    const columns: AdminTableColumn<OrderResponse>[] = [
        {
            key: "orderNumber",
            header: "Order",
            sortKey: "orderNumber",
            render: (row) => (
                <Link href={`/admin/orders/${row.orderNumber}`} className="font-bold text-teal-950 hover:underline">
                    {row.orderNumber}
                </Link>
            ),
        },
        {
            key: "email",
            header: "Customer",
            sortKey: "email",
            render: (row) => <span className="text-muted">{row.email}</span>,
        },
        {
            key: "category",
            header: "Category",
            render: (row) => (
                <span className="text-muted">
          {CUSTOMER_CATEGORY_LABEL[row.pricingGroup] ?? row.pricingGroup}
        </span>
            ),
        },
        {
            key: "method",
            header: "Method",
            render: (row) => (
                <span className="text-muted">
          {PAYMENT_METHOD_LABEL[row.paymentMethod] ?? row.paymentMethod}
        </span>
            ),
        },
        {
            key: "payment",
            header: "Payment",
            sortKey: "paymentStatus",
            render: (row) => {
                const isPaid = row.paymentStatus === "PAID" || row.paymentStatus === "CAPTURED";
                const isRefunded = row.paymentStatus === "REFUNDED" || row.paymentStatus === "PARTIALLY_REFUNDED";
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
            key: "total",
            header: "Total",
            sortKey: "grandTotal",
            render: (row) => (
                <span className="font-semibold text-teal-950">{money(row.grandTotal, row.currency)}</span>
            ),
        },
        {
            key: "placedAt",
            header: "Placed",
            sortKey: "createdAt",
            render: (row) => <span className="text-muted">{new Date(row.placedAt).toLocaleString()}</span>,
        },
        {
            key: "actions",
            header: "",
            className: "text-right",
            render: (row) => {
                const isPaid = row.paymentStatus === "PAID" || row.paymentStatus === "CAPTURED";
                const actions: RowAction[] = [
                    {label: "View order", icon: Eye, onSelect: () => router.push(`/admin/orders/${row.orderNumber}`)},
                ];

                if (!isPaid && row.status !== "CANCELLED") {
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

                return <RowActions actions={actions} label={`Actions for order ${row.orderNumber}`}/>;
            },
        },
    ];

    return (
        <div>
            <div>
                <h1 className="text-[26px] font-extrabold text-teal-950">Orders</h1>
                <p className="mt-1 text-[13px] text-muted">Track fulfilment, payment, and refund status.</p>
            </div>

            {error && (
                <p className="mt-4 rounded-xl bg-coral/10 px-4 py-3 text-[14px] font-medium text-coral">{error}</p>
            )}

            <div className="mt-5">
                <AdminTable
                    columns={columns}
                    rows={items}
                    rowKey={(row) => row.orderNumber || String(row.id)}
                    loading={loading}
                    emptyMessage="No orders yet."
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
        </div>
    );
}
