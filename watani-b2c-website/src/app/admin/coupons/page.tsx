"use client";

import {useEffect, useState} from "react";
import {ChevronLeft, ChevronRight, Pencil, Plus, Trash2} from "lucide-react";
import * as adminApi from "@/lib/admin/api";
import type {Coupon, CouponSortField, DiscountType, PricingGroup, SortDirection} from "@/lib/admin/types";
import {AdminTable, type AdminTableColumn} from "@/components/admin/admin-table";
import {adminFieldClass, adminFieldLabelClass, AdminModal} from "@/components/admin/admin-modal";
import {ConfirmDialog} from "@/components/admin/confirm-dialog";
import {type RowAction, RowActions} from "@/components/admin/row-actions";
import {ApiError} from "@/lib/api";
import {useNotifications} from "@/components/notifications/notification-store";

const PAGE_SIZE = 10;
const DISCOUNT_TYPES: DiscountType[] = ["PERCENTAGE", "FIXED_AMOUNT", "FREE_SHIPPING"];
const GROUPS: PricingGroup[] = ["RETAIL", "WHOLESALE", "DISTRIBUTOR"];

function emptyCoupon(): Coupon {
    return {
        code: "",
        discountType: "PERCENTAGE",
        discountValue: 0,
        active: true,
        applicableGroups: [],
    };
}

export default function AdminCouponsPage() {
    const notifications = useNotifications();
    const [page, setPage] = useState(0);
    const [sortKey, setSortKey] = useState<CouponSortField>("code");
    const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
    const [coupons, setCoupons] = useState<Coupon[]>([]);
    const [totalElements, setTotalElements] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editing, setEditing] = useState<Coupon | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Coupon | null>(null);

    function load() {
        setLoading(true);
        adminApi
            .listCoupons(page, PAGE_SIZE, sortKey, sortDirection)
            .then((result) => {
                setCoupons(result.content);
                setTotalElements(result.totalElements);
                setTotalPages(result.totalPages);
            })
            .catch((err) => {
                const message = err instanceof ApiError ? err.message : "Failed to load coupons.";
                setError(message);
                notifications.error("Failed to load coupons", message);
            })
            .finally(() => setLoading(false));
    }

    useEffect(() => {
        adminApi
            .listCoupons(page, PAGE_SIZE, sortKey, sortDirection)
            .then((result) => {
                setCoupons(result.content);
                setTotalElements(result.totalElements);
                setTotalPages(result.totalPages);
            })
            .catch((err) => {
                const message = err instanceof ApiError ? err.message : "Failed to load coupons.";
                setError(message);
                notifications.error("Failed to load coupons", message);
            })
            .finally(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, sortKey, sortDirection]);

    function handleSort(key: string) {
        setLoading(true);
        if (key === sortKey) {
            setSortDirection((direction) => (direction === "asc" ? "desc" : "asc"));
        } else {
            setSortKey(key as CouponSortField);
            setSortDirection("asc");
        }
        setPage(0);
    }

    function handlePageChange(nextPage: number) {
        setLoading(true);
        setPage(nextPage);
    }

    async function save(coupon: Coupon) {
        try {
            if (coupon.id) {
                await adminApi.updateCoupon(coupon.id, coupon);
            } else {
                await adminApi.createCoupon(coupon);
            }
            setEditing(null);
            load();
        } catch (err) {
            notifications.error("Save failed", err instanceof ApiError ? err.message : "Save failed.");
        }
    }

    async function remove(coupon: Coupon) {
        if (!coupon.id) return;
        try {
            await adminApi.deleteCoupon(coupon.id);
            setDeleteTarget(null);
            load();
        } catch (err) {
            notifications.error("Delete failed", err instanceof ApiError ? err.message : "Delete failed.");
        }
    }

    const columns: AdminTableColumn<Coupon>[] = [
        {
            key: "code",
            header: "Code",
            sortKey: "code",
            render: (row) => <span className="font-mono text-[13px] font-bold text-teal-950">{row.code}</span>,
        },
        {
            key: "discount",
            header: "Discount",
            sortKey: "discountValue",
            render: (row) => (
                <>
                    {row.discountType === "PERCENTAGE" && `${row.discountValue}%`}
                    {row.discountType === "FIXED_AMOUNT" && `$${row.discountValue}`}
                    {row.discountType === "FREE_SHIPPING" && "Free shipping"}
                </>
            ),
        },
        {
            key: "usage",
            header: "Usage",
            render: (row) => (
                <span className="text-muted">
          {row.usageCount ?? 0}
                    {row.usageLimit ? ` / ${row.usageLimit}` : ""}
        </span>
            ),
        },
        {
            key: "status",
            header: "Status",
            sortKey: "active",
            render: (row) => (
                <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
                        row.active ? "bg-lime-500/25 text-teal-950" : "bg-soft-control text-muted"
                    }`}
                >
          <span className={`size-1.5 rounded-full ${row.active ? "bg-teal-800" : "bg-muted"}`} aria-hidden/>
                    {row.active ? "Active" : "Inactive"}
        </span>
            ),
        },
        {
            key: "actions",
            header: "",
            className: "text-right",
            render: (row) => {
                const actions: RowAction[] = [
                    {label: "Edit coupon", icon: Pencil, onSelect: () => setEditing(row)},
                    {label: "Delete coupon", icon: Trash2, tone: "danger", onSelect: () => setDeleteTarget(row)},
                ];
                return <RowActions actions={actions} label={`Actions for coupon ${row.code}`}/>;
            },
        },
    ];

    return (
        <div>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-[22px] font-extrabold text-teal-950 sm:text-[26px]">Coupons</h1>
                    <p className="mt-1 text-[13px] text-muted">Create and manage promotional discount codes.</p>
                </div>
                <button
                    type="button"
                    onClick={() => setEditing(emptyCoupon())}
                    className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-lime-500 px-4 text-[13px] font-bold text-teal-950 transition-opacity hover:opacity-90 sm:h-10 sm:shrink-0"
                >
                    <Plus className="size-4" aria-hidden/>
                    New coupon
                </button>
            </div>

            {error && (
                <p className="mt-4 rounded-xl bg-coral/10 px-4 py-3 text-[14px] font-medium text-coral">{error}</p>
            )}

            <div className="mt-5 hidden sm:block">
                <AdminTable
                    columns={columns}
                    rows={coupons}
                    rowKey={(row) => row.id ?? row.code}
                    loading={loading}
                    emptyMessage="No coupons yet."
                    sorting={{sortKey, direction: sortDirection, onSort: handleSort}}
                    pagination={{page, totalPages, totalElements, onPageChange: handlePageChange}}
                />
            </div>

            <div className="mt-5 sm:hidden">
                <CouponCardList
                    rows={coupons}
                    loading={loading}
                    emptyMessage="No coupons yet."
                    onEdit={setEditing}
                    onDelete={setDeleteTarget}
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

            {editing && (
                <CouponEditor coupon={editing} onCancel={() => setEditing(null)} onSave={save}/>
            )}

            <ConfirmDialog
                open={deleteTarget !== null}
                title="Delete coupon?"
                description={deleteTarget ? `"${deleteTarget.code}" will stop working immediately.` : undefined}
                confirmLabel="Delete"
                danger
                onCancel={() => setDeleteTarget(null)}
                onConfirm={() => deleteTarget && remove(deleteTarget)}
            />
        </div>
    );
}

function CouponCardList({
                             rows,
                             loading,
                             emptyMessage,
                             onEdit,
                             onDelete,
                         }: {
    rows: Coupon[];
    loading: boolean;
    emptyMessage: string;
    onEdit: (row: Coupon) => void;
    onDelete: (row: Coupon) => void;
}) {
    if (loading) {
        return (
            <div className="space-y-2.5">
                {Array.from({length: 4}).map((_, index) => (
                    <div key={index} className="h-24 animate-pulse rounded-2xl bg-soft-control" aria-hidden/>
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
            {rows.map((row) => {
                const actions: RowAction[] = [
                    {label: "Edit coupon", icon: Pencil, onSelect: () => onEdit(row)},
                    {label: "Delete coupon", icon: Trash2, tone: "danger", onSelect: () => onDelete(row)},
                ];

                return (
                    <div key={row.id ?? row.code} className="rounded-2xl bg-white p-4 shadow-card">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="font-mono text-[14px] font-bold text-teal-950">{row.code}</p>
                                <p className="mt-0.5 text-[12px] text-muted">
                                    {row.discountType === "PERCENTAGE" && `${row.discountValue}% off`}
                                    {row.discountType === "FIXED_AMOUNT" && `$${row.discountValue} off`}
                                    {row.discountType === "FREE_SHIPPING" && "Free shipping"}
                                    {" · "}
                                    {row.usageCount ?? 0}{row.usageLimit ? ` / ${row.usageLimit}` : ""} used
                                </p>
                            </div>
                            <RowActions actions={actions} label={`Actions for coupon ${row.code}`}/>
                        </div>

                        <div className="mt-3 border-t border-black/5 pt-3">
                            <span
                                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
                                    row.active ? "bg-lime-500/25 text-teal-950" : "bg-soft-control text-muted"
                                }`}
                            >
                                <span className={`size-1.5 rounded-full ${row.active ? "bg-teal-800" : "bg-muted"}`} aria-hidden/>
                                {row.active ? "Active" : "Inactive"}
                            </span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function CouponEditor({
                          coupon,
                          onCancel,
                          onSave,
                      }: {
    coupon: Coupon;
    onCancel: () => void;
    onSave: (coupon: Coupon) => void;
}) {
    const [draft, setDraft] = useState<Coupon>(coupon);

    function toggleGroup(group: PricingGroup) {
        setDraft((d) => ({
            ...d,
            applicableGroups: d.applicableGroups.includes(group)
                ? d.applicableGroups.filter((g) => g !== group)
                : [...d.applicableGroups, group],
        }));
    }

    return (
        <AdminModal open onClose={onCancel} title={`${coupon.id ? "Edit" : "New"} coupon`}>
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    onSave(draft);
                }}
            >
                <h2 className="text-[18px] font-extrabold text-teal-950">{coupon.id ? "Edit" : "New"} coupon</h2>

                <label className="mt-4 block">
                    <span className={adminFieldLabelClass}>Code</span>
                    <input
                        value={draft.code}
                        onChange={(e) => setDraft((d) => ({...d, code: e.target.value.toUpperCase()}))}
                        className={adminFieldClass}
                        required
                    />
                </label>

                <div className="mt-3 grid grid-cols-2 gap-3">
                    <label className="block">
                        <span className={adminFieldLabelClass}>Type</span>
                        <select
                            value={draft.discountType}
                            onChange={(e) => setDraft((d) => ({...d, discountType: e.target.value as DiscountType}))}
                            className={adminFieldClass}
                        >
                            {DISCOUNT_TYPES.map((type) => (
                                <option key={type} value={type}>
                                    {type.replace(/_/g, " ")}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="block">
                        <span className={adminFieldLabelClass}>Value</span>
                        <input
                            type="number"
                            step="0.01"
                            value={draft.discountValue}
                            onChange={(e) => setDraft((d) => ({...d, discountValue: Number(e.target.value)}))}
                            disabled={draft.discountType === "FREE_SHIPPING"}
                            className={`${adminFieldClass} disabled:bg-soft-control`}
                        />
                    </label>
                </div>

                <fieldset className="mt-3">
                    <legend className="mb-1 text-[12px] font-semibold text-muted">
                        Applicable groups (none = all groups)
                    </legend>
                    <div className="flex flex-wrap gap-x-3 gap-y-2">
                        {GROUPS.map((group) => (
                            <label key={group} className="flex items-center gap-1.5 text-[13px]">
                                <input
                                    type="checkbox"
                                    checked={draft.applicableGroups.includes(group)}
                                    onChange={() => toggleGroup(group)}
                                />
                                {group}
                            </label>
                        ))}
                    </div>
                </fieldset>

                <label className="mt-3 flex items-center gap-2 text-[13px] font-semibold text-teal-950">
                    <input
                        type="checkbox"
                        checked={draft.active}
                        onChange={(e) => setDraft((d) => ({...d, active: e.target.checked}))}
                    />
                    Active
                </label>

                <div className="mt-6 flex justify-end gap-2">
                    <button type="button" onClick={onCancel}
                            className="h-10 rounded-full px-4 text-[13px] font-bold text-teal-950 transition-colors hover:bg-soft-control">
                        Cancel
                    </button>
                    <button type="submit"
                            className="h-10 rounded-full bg-lime-500 px-4 text-[13px] font-bold text-teal-950 transition-opacity hover:opacity-90">
                        Save
                    </button>
                </div>
            </form>
        </AdminModal>
    );
}
