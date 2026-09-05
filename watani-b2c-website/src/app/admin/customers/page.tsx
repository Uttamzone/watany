"use client";

import {useEffect, useState} from "react";
import {Ban, CheckCircle2, ChevronLeft, ChevronRight, Layers, Search, ShieldCheck} from "lucide-react";
import * as adminApi from "@/lib/admin/api";
import type {
    ApprovalStatus,
    CustomerResponse,
    CustomerSortField,
    PricingGroup,
    SortDirection,
} from "@/lib/admin/types";
import {AdminTable, type AdminTableColumn} from "@/components/admin/admin-table";
import {StatusBadge} from "@/components/admin/status-badge";
import {ConfirmDialog} from "@/components/admin/confirm-dialog";
import {type RowAction, RowActions} from "@/components/admin/row-actions";
import {ApiError} from "@/lib/api";
import {useNotifications} from "@/components/notifications/notification-store";

const PAGE_SIZE = 10;

const GROUP_OPTIONS: PricingGroup[] = ["RETAIL", "WHOLESALE", "DISTRIBUTOR"];
const GROUP_LABELS: Record<PricingGroup, string> = {
    RETAIL: "Retail",
    WHOLESALE: "Wholesale",
    DISTRIBUTOR: "Distributor",
    ADMIN: "Admin",
};

const APPROVAL_STATUS_OPTIONS: ApprovalStatus[] = ["PENDING", "APPROVED", "REJECTED"];
const APPROVAL_STATUS_LABELS: Record<ApprovalStatus, string> = {
    NOT_REQUESTED: "Not requested",
    PENDING: "Pending",
    APPROVED: "Approved",
    REJECTED: "Rejected",
};

export default function AdminCustomersPage() {
    const notifications = useNotifications();
    const [email, setEmail] = useState("");
    const [appliedEmail, setAppliedEmail] = useState("");
    const [page, setPage] = useState(0);
    const [sortKey, setSortKey] = useState<CustomerSortField>("firstName");
    const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
    const [items, setItems] = useState<CustomerResponse[]>([]);
    const [totalElements, setTotalElements] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [confirmTarget, setConfirmTarget] = useState<{ customer: CustomerResponse; enable: boolean } | null>(null);

    function reload() {
        setLoading(true);
        adminApi
            .listCustomers(appliedEmail, page, PAGE_SIZE, sortKey, sortDirection)
            .then((result) => {
                setItems(result.content);
                setTotalElements(result.totalElements);
                setTotalPages(result.totalPages);
            })
            .catch((err) => {
                const message = err instanceof ApiError ? err.message : "Failed to load customers.";
                setError(message);
                notifications.error("Failed to load customers", message);
            })
            .finally(() => setLoading(false));
    }

    useEffect(() => {
        adminApi
            .listCustomers(appliedEmail, page, PAGE_SIZE, sortKey, sortDirection)
            .then((result) => {
                setItems(result.content);
                setTotalElements(result.totalElements);
                setTotalPages(result.totalPages);
            })
            .catch((err) => {
                const message = err instanceof ApiError ? err.message : "Failed to load customers.";
                setError(message);
                notifications.error("Failed to load customers", message);
            })
            .finally(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [appliedEmail, page, sortKey, sortDirection]);

    function handleSearch(event: React.FormEvent) {
        event.preventDefault();
        setLoading(true);
        setPage(0);
        setAppliedEmail(email);
    }

    function handleSort(key: string) {
        setLoading(true);
        if (key === sortKey) {
            setSortDirection((direction) => (direction === "asc" ? "desc" : "asc"));
        } else {
            setSortKey(key as CustomerSortField);
            setSortDirection("asc");
        }
        setPage(0);
    }

    function handlePageChange(nextPage: number) {
        setLoading(true);
        setPage(nextPage);
    }

    async function runAction(action: () => Promise<CustomerResponse>) {
        try {
            await action();
            reload();
        } catch (err) {
            notifications.error("Action failed", err instanceof ApiError ? err.message : "Action failed.");
        }
    }

    function buildActions(row: CustomerResponse): RowAction[] {
        const actions: RowAction[] = [
            {
                label: "Pricing group",
                icon: Layers,
                items: GROUP_OPTIONS.map((group) => ({
                    label: GROUP_LABELS[group],
                    current: group === row.pricingGroup,
                    disabled: group === row.pricingGroup,
                    onSelect: () => runAction(() => adminApi.assignPricingGroup(row.id, {pricingGroup: group})),
                })),
            },
        ];

        if (row.requestedGroup && row.approvalStatus === "PENDING") {
            actions.push({
                label: "Approval",
                icon: ShieldCheck,
                items: [
                    {
                        label: `Approve ${GROUP_LABELS[row.requestedGroup]} request`,
                        onSelect: () => runAction(() => adminApi.decideApproval(row.id, {approve: true})),
                    },
                    {
                        label: "Reject request",
                        onSelect: () => runAction(() => adminApi.decideApproval(row.id, {approve: false})),
                    },
                ],
            });
        }

        if (row.pricingGroup !== "RETAIL") {
            actions.push({
                label: "Approval status",
                icon: ShieldCheck,
                items: APPROVAL_STATUS_OPTIONS.map((status) => ({
                    label: APPROVAL_STATUS_LABELS[status],
                    current: status === row.approvalStatus,
                    disabled: status === row.approvalStatus,
                    onSelect: () => runAction(() => adminApi.setApprovalStatus(row.id, {approvalStatus: status})),
                })),
            });
        }

        actions.push({
            label: row.enabled ? "Suspend account" : "Reactivate account",
            icon: row.enabled ? Ban : CheckCircle2,
            tone: row.enabled ? "danger" : "default",
            onSelect: () => setConfirmTarget({customer: row, enable: !row.enabled}),
        });

        return actions;
    }

    const columns: AdminTableColumn<CustomerResponse>[] = [
        {
            key: "name",
            header: "Customer",
            sortKey: "firstName",
            render: (row) => (
                <div>
                    <p className="font-semibold text-teal-950">
                        {`${row.firstName ?? ""} ${row.lastName ?? ""}`.trim() || row.email}
                    </p>
                    <p className="text-[12px] text-muted">{row.email}</p>
                </div>
            ),
        },
        {
            key: "phone",
            header: "Phone",
            render: (row) => <span className="text-muted">{row.phone ?? "-"}</span>,
        },
        {
            key: "address",
            header: "Default address",
            render: (row) => {
                const address = row.defaultAddress;
                if (!address) return <span className="text-muted">-</span>;
                return (
                    <div className="max-w-[220px] text-[12px] text-muted">
                        <p className="truncate text-teal-950">{address.line1}{address.line2 ? `, ${address.line2}` : ""}</p>
                        <p className="truncate">{address.city}, {address.region} {address.postalCode}</p>
                    </div>
                );
            },
        },
        {
            key: "group",
            header: "Pricing group",
            render: (row) => (
                <span
                    className="inline-flex items-center rounded-full bg-soft-control px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-teal-900">
          {GROUP_LABELS[row.pricingGroup]}
        </span>
            ),
        },
        {
            key: "approval",
            header: "Approval",
            render: (row) => <StatusBadge status={row.approvalStatus}/>,
        },
        {
            key: "enabled",
            header: "Status",
            render: (row) => (
                <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
                        row.enabled ? "bg-lime-500/25 text-teal-950" : "bg-coral/15 text-coral"
                    }`}
                >
          <span className={`size-1.5 rounded-full ${row.enabled ? "bg-teal-800" : "bg-coral"}`} aria-hidden/>
                    {row.enabled ? "Active" : "Suspended"}
        </span>
            ),
        },
        {
            key: "actions",
            header: "",
            className: "text-right",
            render: (row) => <RowActions actions={buildActions(row)} label={`Actions for ${row.email}`}/>,
        },
    ];

    return (
        <div>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-[22px] font-extrabold text-teal-950 sm:text-[26px]">Customers</h1>
                    <p className="mt-1 text-[13px] text-muted">Manage accounts, pricing groups, and approvals.</p>
                </div>
            </div>

            <form onSubmit={handleSearch} className="mt-5 flex items-center gap-2 sm:max-w-sm">
                <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted"
                            aria-hidden/>
                    <input
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="Search by email"
                        className="h-11 w-full rounded-xl border border-black/10 bg-white pl-10 pr-4 text-[14px] outline-none transition-colors focus:border-teal-800 sm:h-10"
                    />
                </div>
                <button
                    type="submit"
                    className="h-11 shrink-0 rounded-xl bg-teal-950 px-4 text-[13px] font-bold text-white transition-opacity hover:opacity-90 sm:h-10"
                >
                    Search
                </button>
            </form>

            {error && (
                <p className="mt-4 rounded-xl bg-coral/10 px-4 py-3 text-[14px] font-medium text-coral">{error}</p>
            )}

            <div className="mt-4 hidden sm:block">
                <AdminTable
                    columns={columns}
                    rows={items}
                    rowKey={(row) => row.id}
                    loading={loading}
                    emptyMessage="No customers found."
                    sorting={{sortKey, direction: sortDirection, onSort: handleSort}}
                    pagination={{page, totalPages, totalElements, onPageChange: handlePageChange}}
                />
            </div>

            <div className="mt-4 sm:hidden">
                <CustomerCardList
                    rows={items}
                    loading={loading}
                    emptyMessage="No customers found."
                    buildActions={buildActions}
                />

                {totalPages > 1 && (
                    <div className="mt-3 flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-card">
                        <p className="text-[12px] font-medium text-muted">
                            Page {page + 1} of {Math.max(totalPages, 1)} · {totalElements} total
                        </p>
                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={() => handlePageChange(page - 1)}
                                disabled={loading || page <= 0}
                                aria-label="Previous page"
                                className="grid size-8 place-items-center rounded-lg text-teal-950 transition-colors hover:bg-soft-control disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                <ChevronLeft className="size-4" aria-hidden/>
                            </button>
                            <button
                                type="button"
                                onClick={() => handlePageChange(page + 1)}
                                disabled={loading || page + 1 >= totalPages}
                                aria-label="Next page"
                                className="grid size-8 place-items-center rounded-lg text-teal-950 transition-colors hover:bg-soft-control disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                <ChevronRight className="size-4" aria-hidden/>
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <ConfirmDialog
                open={confirmTarget !== null}
                title={confirmTarget?.enable ? "Reactivate account?" : "Suspend account?"}
                description={confirmTarget ? `This applies to ${confirmTarget.customer.email}.` : undefined}
                confirmLabel={confirmTarget?.enable ? "Reactivate" : "Suspend"}
                danger={!confirmTarget?.enable}
                onCancel={() => setConfirmTarget(null)}
                onConfirm={() => {
                    if (!confirmTarget) return;
                    const {customer, enable} = confirmTarget;
                    setConfirmTarget(null);
                    runAction(() => adminApi.setCustomerEnabled(customer.id, enable));
                }}
            />
        </div>
    );
}

function CustomerCardList({
                               rows,
                               loading,
                               emptyMessage,
                               buildActions,
                           }: {
    rows: CustomerResponse[];
    loading: boolean;
    emptyMessage: string;
    buildActions: (row: CustomerResponse) => RowAction[];
}) {
    if (loading) {
        return (
            <div className="space-y-2.5">
                {Array.from({length: 4}).map((_, index) => (
                    <div key={index} className="h-28 animate-pulse rounded-2xl bg-soft-control" aria-hidden/>
                ))}
            </div>
        );
    }

    if (rows.length === 0) {
        return (
            <p className="rounded-2xl bg-white px-5 py-10 text-center text-[14px] text-muted shadow-card">
                {emptyMessage}
            </p>
        );
    }

    return (
        <div className="space-y-2.5">
            {rows.map((row) => (
                <div key={row.id} className="rounded-2xl bg-white p-4 shadow-card">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <p className="truncate font-bold text-teal-950">
                                {`${row.firstName ?? ""} ${row.lastName ?? ""}`.trim() || row.email}
                            </p>
                            <p className="truncate text-[12px] text-muted">{row.email}</p>
                            {row.phone && <p className="truncate text-[12px] text-muted">{row.phone}</p>}
                        </div>
                        <RowActions actions={buildActions(row)} label={`Actions for ${row.email}`}/>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-black/5 pt-3">
                        <span className="inline-flex items-center rounded-full bg-soft-control px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-teal-900">
                            {GROUP_LABELS[row.pricingGroup]}
                        </span>
                        <StatusBadge status={row.approvalStatus}/>
                        <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
                                row.enabled ? "bg-lime-500/25 text-teal-950" : "bg-coral/15 text-coral"
                            }`}
                        >
                            <span className={`size-1.5 rounded-full ${row.enabled ? "bg-teal-800" : "bg-coral"}`} aria-hidden/>
                            {row.enabled ? "Active" : "Suspended"}
                        </span>
                    </div>
                </div>
            ))}
        </div>
    );
}
