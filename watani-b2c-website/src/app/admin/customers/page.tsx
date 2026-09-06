"use client";

import {Suspense, useEffect, useState} from "react";
import {useSearchParams} from "next/navigation";
import {
    AlertTriangle,
    Ban,
    Building2,
    Check,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Clock,
    FileText,
    Layers,
    Mail,
    MapPin,
    Phone,
    Search,
    ShieldAlert,
    ShieldCheck,
    Sparkles,
    User,
    X,
} from "lucide-react";
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

type CustomerFilterTab = "ALL" | "PENDING" | "WHOLESALE" | "DISTRIBUTOR" | "RETAIL";

function AdminCustomersContent() {
    const notifications = useNotifications();
    const searchParams = useSearchParams();
    const paramTab = searchParams.get("tab") as CustomerFilterTab | null;
    const [email, setEmail] = useState("");
    const [appliedEmail, setAppliedEmail] = useState("");
    const [tab, setTab] = useState<CustomerFilterTab>(
        paramTab && ["ALL", "PENDING", "WHOLESALE", "DISTRIBUTOR", "RETAIL"].includes(paramTab)
            ? paramTab
            : "ALL"
    );
    const [page, setPage] = useState(0);
    const [sortKey, setSortKey] = useState<CustomerSortField>("firstName");
    const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
    const [items, setItems] = useState<CustomerResponse[]>([]);
    const [totalElements, setTotalElements] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [loading, setLoading] = useState(true);
    const [pendingCount, setPendingCount] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [selectedCustomer, setSelectedCustomer] = useState<CustomerResponse | null>(null);
    const [confirmTarget, setConfirmTarget] = useState<{ customer: CustomerResponse; enable: boolean } | null>(null);

    function refreshPendingCount() {
        adminApi.pendingApprovals()
            .then((res) => setPendingCount(res.length))
            .catch(() => {});
    }

    function reload() {
        setLoading(true);
        const status = tab === "PENDING" ? "PENDING" : undefined;
        const group = ["WHOLESALE", "DISTRIBUTOR", "RETAIL"].includes(tab) ? (tab as PricingGroup) : undefined;

        adminApi
            .listCustomers(appliedEmail, page, PAGE_SIZE, sortKey, sortDirection, status, group)
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

        refreshPendingCount();
    }

    useEffect(() => {
        reload();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [appliedEmail, tab, page, sortKey, sortDirection]);

    useEffect(() => {
        const nextTab = searchParams.get("tab") as CustomerFilterTab | null;
        if (nextTab && ["ALL", "PENDING", "WHOLESALE", "DISTRIBUTOR", "RETAIL"].includes(nextTab)) {
            setTab(nextTab);
            setPage(0);
        }
    }, [searchParams]);

    function handleTabChange(nextTab: CustomerFilterTab) {
        setTab(nextTab);
        setPage(0);
    }

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
            const updated = await action();
            if (selectedCustomer && selectedCustomer.id === updated.id) {
                setSelectedCustomer(updated);
            }
            reload();
        } catch (err) {
            notifications.error("Action failed", err instanceof ApiError ? err.message : "Action failed.");
        }
    }

    async function handleApprovalDecision(customerId: number, approve: boolean, targetGroup?: PricingGroup) {
        try {
            const updated = await adminApi.decideApproval(customerId, { approve, targetGroup });
            notifications.success(
                approve ? "Customer Approved" : "Application Rejected",
                approve
                    ? `Account approved as ${GROUP_LABELS[targetGroup || updated.pricingGroup]}.`
                    : "Customer request has been rejected.",
            );
            if (selectedCustomer && selectedCustomer.id === customerId) {
                setSelectedCustomer(updated);
            }
            reload();
        } catch (err) {
            notifications.error(
                "Approval Failed",
                err instanceof ApiError ? err.message : "Failed to update customer approval.",
            );
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
                        label: `Approve as Wholesale`,
                        onSelect: () => handleApprovalDecision(row.id, true, "WHOLESALE"),
                    },
                    {
                        label: `Approve as Distributor`,
                        onSelect: () => handleApprovalDecision(row.id, true, "DISTRIBUTOR"),
                    },
                    {
                        label: "Reject request",
                        onSelect: () => handleApprovalDecision(row.id, false),
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
                <div className="min-w-[190px]">
                    <p className="font-bold text-teal-950">
                        {`${row.firstName ?? ""} ${row.lastName ?? ""}`.trim() || row.email}
                    </p>
                    <p className="text-[12px] text-muted">{row.email}</p>
                    {row.companyName && (
                        <div className="mt-1 flex items-center gap-1 text-[11.5px] font-semibold text-teal-800">
                            <Building2 className="size-3 shrink-0" aria-hidden />
                            <span className="truncate">{row.companyName}</span>
                        </div>
                    )}
                </div>
            ),
        },
        {
            key: "business",
            header: "Business Details",
            render: (row) => {
                if (!row.companyName && !row.taxId && !row.businessLicenceRef) {
                    return <span className="text-muted text-[12px]">—</span>;
                }
                return (
                    <div className="text-[12px] leading-tight space-y-0.5 max-w-[170px]">
                        {row.companyName && (
                            <p className="truncate font-semibold text-teal-950" title={row.companyName}>
                                {row.companyName}
                            </p>
                        )}
                        {row.taxId && (
                            <p className="truncate text-muted" title={row.taxId}>
                                BN: <span className="font-mono text-[11px]">{row.taxId}</span>
                            </p>
                        )}
                        {row.businessLicenceRef && (
                            <p className="truncate text-[11px] text-muted" title={row.businessLicenceRef}>
                                Lic: {row.businessLicenceRef}
                            </p>
                        )}
                    </div>
                );
            },
        },
        {
            key: "phone",
            header: "Phone",
            render: (row) => <span className="text-[13px] text-muted">{row.phone || "—"}</span>,
        },
        {
            key: "group",
            header: "Pricing Group",
            render: (row) => (
                <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
                        row.pricingGroup === "DISTRIBUTOR"
                            ? "bg-teal-950 text-lime-400"
                            : row.pricingGroup === "WHOLESALE"
                            ? "bg-lime-500/25 text-teal-950"
                            : "bg-soft-control text-teal-900"
                    }`}
                >
                    {GROUP_LABELS[row.pricingGroup]}
                </span>
            ),
        },
        {
            key: "approval",
            header: "Approval",
            render: (row) => {
                if (row.approvalStatus === "PENDING") {
                    return (
                        <div className="flex flex-col items-start gap-1">
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-900">
                                <Clock className="size-3 text-amber-700 animate-pulse" aria-hidden />
                                Pending {row.requestedGroup ? GROUP_LABELS[row.requestedGroup] : "B2B"}
                            </span>
                            <button
                                type="button"
                                onClick={() => setSelectedCustomer(row)}
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-900 underline hover:text-amber-950"
                            >
                                Review Request &rarr;
                            </button>
                        </div>
                    );
                }
                return <StatusBadge status={row.approvalStatus}/>;
            },
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
            render: (row) => (
                <div className="flex items-center justify-end gap-1.5">
                    <button
                        type="button"
                        onClick={() => setSelectedCustomer(row)}
                        className="rounded-lg border border-black/10 px-2.5 py-1 text-[12px] font-bold text-teal-950 transition-colors hover:bg-soft-control"
                    >
                        Details
                    </button>
                    <RowActions actions={buildActions(row)} label={`Actions for ${row.email}`}/>
                </div>
            ),
        },
    ];

    return (
        <div>
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-[22px] font-extrabold text-teal-950 sm:text-[26px]">Customers &amp; B2B Approvals</h1>
                    <p className="mt-1 text-[13px] text-muted">
                        Manage customer accounts, B2B wholesale/distributor approvals, and pricing groups.
                    </p>
                </div>
            </div>

            {/* Pending Approvals Alert Banner */}
            {pendingCount > 0 && (
                <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-amber-300 bg-amber-50/90 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-500/20 text-amber-800">
                            <Building2 className="size-5" aria-hidden />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-[14px] font-bold text-amber-950 sm:text-[15px]">
                                    {pendingCount} Business Application{pendingCount > 1 ? "s" : ""} Awaiting Review
                                </h3>
                                <span className="animate-pulse rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white">
                                    Action Required
                                </span>
                            </div>
                            <p className="text-[12.5px] text-amber-900/80 leading-relaxed">
                                Review submitted company names, tax IDs, and business licences to grant Wholesale or Distributor access.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => handleTabChange("PENDING")}
                        className="shrink-0 rounded-xl bg-amber-600 px-4 py-2 text-[13px] font-bold text-white shadow-xs transition-opacity hover:opacity-90"
                    >
                        Review Pending ({pendingCount})
                    </button>
                </div>
            )}

            {/* Filter Tabs & Search */}
            <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                {/* Tabs */}
                <div className="flex flex-wrap items-center gap-1.5 rounded-2xl bg-white p-1.5 shadow-xs border border-black/5">
                    <button
                        type="button"
                        onClick={() => handleTabChange("ALL")}
                        className={`rounded-xl px-3.5 py-1.5 text-[13px] font-bold transition-colors ${
                            tab === "ALL"
                                ? "bg-teal-950 text-white shadow-xs"
                                : "text-muted hover:text-teal-950 hover:bg-soft-control"
                        }`}
                    >
                        All Accounts
                    </button>
                    <button
                        type="button"
                        onClick={() => handleTabChange("PENDING")}
                        className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-[13px] font-bold transition-colors ${
                            tab === "PENDING"
                                ? "bg-amber-600 text-white shadow-xs"
                                : "text-amber-900 hover:bg-amber-50"
                        }`}
                    >
                        Pending Approvals
                        {pendingCount > 0 && (
                            <span
                                className={`rounded-full px-1.5 py-0.2 text-[11px] font-black ${
                                    tab === "PENDING" ? "bg-white text-amber-700" : "bg-amber-500 text-white"
                                }`}
                            >
                                {pendingCount}
                            </span>
                        )}
                    </button>
                    <button
                        type="button"
                        onClick={() => handleTabChange("WHOLESALE")}
                        className={`rounded-xl px-3.5 py-1.5 text-[13px] font-bold transition-colors ${
                            tab === "WHOLESALE"
                                ? "bg-teal-950 text-white shadow-xs"
                                : "text-muted hover:text-teal-950 hover:bg-soft-control"
                        }`}
                    >
                        Wholesale
                    </button>
                    <button
                        type="button"
                        onClick={() => handleTabChange("DISTRIBUTOR")}
                        className={`rounded-xl px-3.5 py-1.5 text-[13px] font-bold transition-colors ${
                            tab === "DISTRIBUTOR"
                                ? "bg-teal-950 text-white shadow-xs"
                                : "text-muted hover:text-teal-950 hover:bg-soft-control"
                        }`}
                    >
                        Distributor
                    </button>
                    <button
                        type="button"
                        onClick={() => handleTabChange("RETAIL")}
                        className={`rounded-xl px-3.5 py-1.5 text-[13px] font-bold transition-colors ${
                            tab === "RETAIL"
                                ? "bg-teal-950 text-white shadow-xs"
                                : "text-muted hover:text-teal-950 hover:bg-soft-control"
                        }`}
                    >
                        Retail
                    </button>
                </div>

                {/* Search Bar */}
                <form onSubmit={handleSearch} className="flex items-center gap-2 sm:max-w-xs">
                    <div className="relative flex-1">
                        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden/>
                        <input
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            placeholder="Search by name, email, company…"
                            className="h-10 w-full rounded-xl border border-black/10 bg-white pl-10 pr-4 text-[13.5px] outline-none transition-colors focus:border-teal-800"
                        />
                    </div>
                    <button
                        type="submit"
                        className="h-10 shrink-0 rounded-xl bg-teal-950 px-3.5 text-[13px] font-bold text-white transition-opacity hover:opacity-90"
                    >
                        Search
                    </button>
                </form>
            </div>

            {error && (
                <p className="mt-4 rounded-xl bg-coral/10 px-4 py-3 text-[14px] font-medium text-coral">{error}</p>
            )}

            {/* Desktop Table */}
            <div className="mt-4 hidden sm:block">
                <AdminTable
                    columns={columns}
                    rows={items}
                    rowKey={(row) => row.id}
                    rowClassName={(row) => row.approvalStatus === "PENDING" ? "bg-amber-500/[0.04] border-l-4 border-l-amber-500" : undefined}
                    loading={loading}
                    emptyMessage={
                        tab === "PENDING"
                            ? "No pending B2B approval requests at this time."
                            : "No customers found."
                    }
                    sorting={{sortKey, direction: sortDirection, onSort: handleSort}}
                    pagination={{page, totalPages, totalElements, onPageChange: handlePageChange}}
                />
            </div>

            {/* Mobile Card View */}
            <div className="mt-4 sm:hidden">
                <CustomerCardList
                    rows={items}
                    loading={loading}
                    emptyMessage={
                        tab === "PENDING"
                            ? "No pending B2B approval requests."
                            : "No customers found."
                    }
                    buildActions={buildActions}
                    onSelectCustomer={(row) => setSelectedCustomer(row)}
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

            {/* Customer Details & Business Verification Review Modal */}
            {selectedCustomer && (
                <CustomerDetailsModal
                    customer={selectedCustomer}
                    onClose={() => setSelectedCustomer(null)}
                    onApprovalDecision={handleApprovalDecision}
                    onAssignGroup={(groupId) => runAction(() => adminApi.assignPricingGroup(selectedCustomer.id, { pricingGroup: groupId }))}
                    onToggleEnabled={(enable) => runAction(() => adminApi.setCustomerEnabled(selectedCustomer.id, enable))}
                />
            )}

            {/* Suspend / Reactivate Confirmation Dialog */}
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
                               onSelectCustomer,
                           }: {
    rows: CustomerResponse[];
    loading: boolean;
    emptyMessage: string;
    buildActions: (row: CustomerResponse) => RowAction[];
    onSelectCustomer: (row: CustomerResponse) => void;
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
                <div
                    key={row.id}
                    className={`rounded-2xl bg-white p-4 shadow-card ${
                        row.approvalStatus === "PENDING" ? "border-2 border-amber-300 bg-amber-50/20" : ""
                    }`}
                >
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <p className="truncate font-bold text-teal-950">
                                {`${row.firstName ?? ""} ${row.lastName ?? ""}`.trim() || row.email}
                            </p>
                            <p className="truncate text-[12px] text-muted">{row.email}</p>
                            {row.companyName && (
                                <p className="truncate text-[12px] font-semibold text-teal-800">
                                    🏢 {row.companyName}
                                </p>
                            )}
                            {row.phone && <p className="truncate text-[12px] text-muted">{row.phone}</p>}
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                onClick={() => onSelectCustomer(row)}
                                className="rounded-lg border border-black/10 px-2 py-1 text-[11px] font-bold text-teal-950"
                            >
                                Details
                            </button>
                            <RowActions actions={buildActions(row)} label={`Actions for ${row.email}`}/>
                        </div>
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

                    {row.approvalStatus === "PENDING" && (
                        <div className="mt-3 flex items-center justify-between rounded-xl bg-amber-100/70 p-2 text-[12px]">
                            <span className="font-semibold text-amber-950">B2B Request Pending</span>
                            <button
                                type="button"
                                onClick={() => onSelectCustomer(row)}
                                className="font-bold text-amber-900 underline"
                            >
                                Review &amp; Approve &rarr;
                            </button>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}

function CustomerDetailsModal({
                                  customer,
                                  onClose,
                                  onApprovalDecision,
                                  onAssignGroup,
                                  onToggleEnabled,
                              }: {
    customer: CustomerResponse;
    onClose: () => void;
    onApprovalDecision: (customerId: number, approve: boolean, targetGroup?: PricingGroup) => void;
    onAssignGroup: (group: PricingGroup) => void;
    onToggleEnabled: (enable: boolean) => void;
}) {
    const isPending = customer.approvalStatus === "PENDING";
    const displayName = `${customer.firstName ?? ""} ${customer.lastName ?? ""}`.trim() || customer.email;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-teal-950/60 backdrop-blur-xs transition-opacity"
                onClick={onClose}
                aria-hidden
            />

            {/* Modal Dialog */}
            <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl transition-all sm:p-8">
                {/* Close Button */}
                <button
                    type="button"
                    onClick={onClose}
                    className="absolute right-5 top-5 grid size-9 place-items-center rounded-full text-muted transition-colors hover:bg-black/5 hover:text-teal-950"
                    aria-label="Close dialog"
                >
                    <X className="size-5" aria-hidden />
                </button>

                {/* Header */}
                <div className="flex items-start gap-4">
                    <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-lime-500/20 text-[18px] font-bold text-teal-950">
                        {displayName.charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-[20px] font-extrabold text-teal-950 sm:text-[22px]">
                                {displayName}
                            </h2>
                            <span
                                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
                                    customer.enabled ? "bg-lime-500/20 text-teal-950" : "bg-coral/15 text-coral"
                                }`}
                            >
                                <span className={`size-1.5 rounded-full ${customer.enabled ? "bg-teal-800" : "bg-coral"}`} aria-hidden/>
                                {customer.enabled ? "Active" : "Suspended"}
                            </span>
                        </div>
                        <p className="text-[13px] text-muted">{customer.email}</p>
                        {customer.createdAt && (
                            <p className="mt-0.5 text-[11px] text-muted">
                                Customer since {new Date(customer.createdAt).toLocaleDateString()}
                            </p>
                        )}
                    </div>
                </div>

                {/* Status Callout if Pending */}
                {isPending && (
                    <div className="mt-5 rounded-2xl border border-amber-300 bg-amber-50 p-4">
                        <div className="flex items-center gap-2 text-[14px] font-bold text-amber-950">
                            <Clock className="size-4.5 text-amber-600 animate-pulse" aria-hidden />
                            B2B Tier Upgrade Request Awaiting Approval
                        </div>
                        <p className="mt-1 text-[12.5px] text-amber-900/90 leading-relaxed">
                            This customer has applied for <strong className="font-bold">{customer.requestedGroup === "DISTRIBUTOR" ? "Distributor" : "Wholesale"}</strong> pricing tier. Review their business details below and approve or reject access.
                        </p>
                    </div>
                )}

                {/* Business Details Section */}
                <div className="mt-5 rounded-2xl border border-black/10 bg-soft-control/60 p-5">
                    <div className="flex items-center gap-2 font-bold text-teal-950">
                        <Building2 className="size-4.5 text-teal-800" aria-hidden />
                        <h3 className="text-[15px]">Business &amp; Verification Details</h3>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2 text-[13px]">
                        <div className="rounded-xl bg-white p-3 border border-black/5">
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                                Company / Business Name
                            </span>
                            <p className="mt-0.5 font-bold text-teal-950">
                                {customer.companyName || <span className="font-normal text-muted">Not provided</span>}
                            </p>
                        </div>

                        <div className="rounded-xl bg-white p-3 border border-black/5">
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                                Tax ID / Business No. (BN)
                            </span>
                            <p className="mt-0.5 font-bold font-mono text-teal-950">
                                {customer.taxId || <span className="font-normal font-sans text-muted">Not provided</span>}
                            </p>
                        </div>

                        <div className="rounded-xl bg-white p-3 border border-black/5">
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                                Business Licence Reference
                            </span>
                            <p className="mt-0.5 font-bold text-teal-950">
                                {customer.businessLicenceRef || <span className="font-normal text-muted">Not provided</span>}
                            </p>
                        </div>

                        <div className="rounded-xl bg-white p-3 border border-black/5">
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                                Business Phone
                            </span>
                            <p className="mt-0.5 font-bold text-teal-950">
                                {customer.phone || <span className="font-normal text-muted">Not provided</span>}
                            </p>
                        </div>
                    </div>

                    {customer.defaultAddress && (
                        <div className="mt-3 rounded-xl bg-white p-3 border border-black/5 text-[12.5px]">
                            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
                                <MapPin className="size-3 text-muted" aria-hidden />
                                Default Address
                            </div>
                            <p className="text-teal-950 font-medium">
                                {customer.defaultAddress.line1}
                                {customer.defaultAddress.line2 ? `, ${customer.defaultAddress.line2}` : ""}
                            </p>
                            <p className="text-muted">
                                {customer.defaultAddress.city}, {customer.defaultAddress.region} {customer.defaultAddress.postalCode} ({customer.defaultAddress.country})
                            </p>
                        </div>
                    )}
                </div>

                {/* Account Tier Info */}
                <div className="mt-4 rounded-2xl border border-black/10 bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">Current Tier:</span>
                            <span className="ml-2 inline-flex items-center rounded-full bg-teal-950 px-2.5 py-0.5 text-[11px] font-bold text-white">
                                {GROUP_LABELS[customer.pricingGroup]}
                            </span>
                        </div>
                        <div>
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">Approval Status:</span>
                            <span className="ml-2">
                                <StatusBadge status={customer.approvalStatus} />
                            </span>
                        </div>
                    </div>

                    {/* Change Tier Selector */}
                    <div className="mt-3 pt-3 border-t border-black/5">
                        <label className="block text-[12px] font-semibold text-teal-950 mb-1.5">
                            Quick Change Pricing Tier:
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {GROUP_OPTIONS.map((g) => (
                                <button
                                    key={g}
                                    type="button"
                                    onClick={() => onAssignGroup(g)}
                                    disabled={customer.pricingGroup === g}
                                    className={`rounded-xl px-3 py-1.5 text-[12px] font-bold transition-all ${
                                        customer.pricingGroup === g
                                            ? "bg-teal-950 text-white cursor-default"
                                            : "border border-black/10 text-teal-950 hover:bg-soft-control"
                                    }`}
                                >
                                    {GROUP_LABELS[g]}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Pending Approval Decisions */}
                {isPending && (
                    <div className="mt-5 rounded-2xl border-2 border-amber-300 bg-amber-50/50 p-4">
                        <h4 className="text-[14px] font-bold text-amber-950">
                            Decide Application Request
                        </h4>
                        <p className="mt-1 text-[12px] text-amber-900/80 leading-relaxed">
                            Approving will update the customer&apos;s account tier immediately. Choosing Distributor also grants offline payment options (Cheque &amp; e-Transfer) at checkout.
                        </p>

                        <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
                            <button
                                type="button"
                                onClick={() => onApprovalDecision(customer.id, true, "WHOLESALE")}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-teal-900 px-4 py-2 text-[13px] font-bold text-white shadow-xs transition-transform hover:-translate-y-0.5"
                            >
                                <Check className="size-4 text-lime-400" aria-hidden />
                                Approve as Wholesale
                            </button>

                            <button
                                type="button"
                                onClick={() => onApprovalDecision(customer.id, true, "DISTRIBUTOR")}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-lime-500 px-4 py-2 text-[13px] font-bold text-teal-950 shadow-xs transition-transform hover:-translate-y-0.5"
                            >
                                <Sparkles className="size-4 text-teal-950" aria-hidden />
                                Approve as Distributor
                            </button>

                            <button
                                type="button"
                                onClick={() => onApprovalDecision(customer.id, false)}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-coral/30 px-3.5 py-2 text-[13px] font-bold text-coral transition-colors hover:bg-coral/10"
                            >
                                <X className="size-4" aria-hidden />
                                Reject
                            </button>
                        </div>
                    </div>
                )}

                {/* Footer Controls */}
                <div className="mt-6 flex items-center justify-between border-t border-black/5 pt-4">
                    <button
                        type="button"
                        onClick={() => onToggleEnabled(!customer.enabled)}
                        className={`inline-flex items-center gap-1.5 text-[12.5px] font-bold ${
                            customer.enabled ? "text-coral hover:underline" : "text-emerald-700 hover:underline"
                        }`}
                    >
                        {customer.enabled ? (
                            <>
                                <Ban className="size-3.5" aria-hidden />
                                Suspend Account
                            </>
                        ) : (
                            <>
                                <CheckCircle2 className="size-3.5" aria-hidden />
                                Reactivate Account
                            </>
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-full border border-black/10 px-5 py-2 text-[13px] font-bold text-teal-950 transition-colors hover:bg-soft-control"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function AdminCustomersPage() {
    return (
        <Suspense fallback={<div className="p-8 text-muted">Loading customers...</div>}>
            <AdminCustomersContent />
        </Suspense>
    );
}
