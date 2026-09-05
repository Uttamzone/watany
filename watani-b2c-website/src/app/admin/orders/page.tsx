"use client";

import {useEffect, useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {Eye} from "lucide-react";
import * as adminApi from "@/lib/admin/api";
import type {OrderResponse, OrderSortField, SortDirection} from "@/lib/admin/types";
import {AdminTable, type AdminTableColumn} from "@/components/admin/admin-table";
import {StatusBadge} from "@/components/admin/status-badge";
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
    const router = useRouter();

    useEffect(() => {
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
        {key: "status", header: "Status", sortKey: "status", render: (row) => <StatusBadge status={row.status}/>},
        {key: "payment", header: "Payment", render: (row) => <StatusBadge status={row.paymentStatus}/>},
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
                const actions: RowAction[] = [
                    {label: "View order", icon: Eye, onSelect: () => router.push(`/admin/orders/${row.orderNumber}`)},
                ];
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
        </div>
    );
}
