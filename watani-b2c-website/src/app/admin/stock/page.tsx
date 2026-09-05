"use client";

import {useEffect, useMemo, useState} from "react";
import Link from "next/link";
import {Check, ChevronLeft, ChevronRight, Pencil, Plus, Search, X} from "lucide-react";
import * as adminApi from "@/lib/admin/api";
import type {AdminProductResponse, AdminVariantResponse} from "@/lib/admin/types";
import {AdminTable, type AdminTableColumn} from "@/components/admin/admin-table";
import {useNotifications} from "@/components/notifications/notification-store";
import {ApiError} from "@/lib/api";

/**
 * Stock management - one row per variant, since stock is tracked at variant/SKU level (F-ADM-6).
 * Filtering/pagination run client-side over one fetch - no stock-status query param on the backend.
 */

const PAGE_SIZE = 20;

type StockRow = {
    product: AdminProductResponse;
    variant: AdminVariantResponse;
};

type StockFilter = "all" | "in-stock" | "low-stock" | "out-of-stock";

const FILTERS: { value: StockFilter; label: string }[] = [
    {value: "all", label: "All"},
    {value: "in-stock", label: "In stock"},
    {value: "low-stock", label: "Stock ending soon"},
    {value: "out-of-stock", label: "Out of stock"},
];

function statusOf(variant: AdminVariantResponse): Exclude<StockFilter, "all"> {
    if (variant.stockQuantity <= 0) return "out-of-stock";
    if (variant.lowStock) return "low-stock";
    return "in-stock";
}

export default function AdminStockPage() {
    const [rows, setRows] = useState<StockRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState("");
    const [filter, setFilter] = useState<StockFilter>("all");
    const [page, setPage] = useState(0);
    const [editingSku, setEditingSku] = useState<string | null>(null);
    const [editValue, setEditValue] = useState("");
    const [saving, setSaving] = useState(false);
    const [addingSku, setAddingSku] = useState<string | null>(null);
    const [addValue, setAddValue] = useState("");
    const [adding, setAdding] = useState(false);
    const notifications = useNotifications();

    useEffect(() => {
        adminApi
            .listProducts("", 0, 1000, "name", "asc")
            .then((result: any) => {
                const list = Array.isArray(result?.content) ? result.content : (Array.isArray(result) ? result : []);
                const flattened: StockRow[] = list.flatMap((product: any) =>
                    (product?.variants || []).map((variant: any) => ({product, variant})),
                );
                setRows(flattened);
            })
            .catch((err) => {
                const message = err instanceof ApiError ? err.message : "Failed to load stock.";
                setError(message);
                notifications.error("Failed to load stock", message);
            })
            .finally(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const counts = useMemo(() => {
        const result: Record<StockFilter, number> = {
            all: rows.length,
            "in-stock": 0,
            "low-stock": 0,
            "out-of-stock": 0,
        };
        for (const row of rows) result[statusOf(row.variant)] += 1;
        return result;
    }, [rows]);

    const filtered = useMemo(() => {
        const needle = query.trim().toLowerCase();
        return rows.filter(({product, variant}) => {
            if (filter !== "all" && statusOf(variant) !== filter) return false;
            if (!needle) return true;
            return (
                product.name.toLowerCase().includes(needle) ||
                variant.sku.toLowerCase().includes(needle)
            );
        });
    }, [rows, filter, query]);

    const totalPages = Math.max(Math.ceil(filtered.length / PAGE_SIZE), 1);
    const paged = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

    function handleFilterChange(next: StockFilter) {
        setFilter(next);
        setPage(0);
    }

    function handleSearchChange(value: string) {
        setQuery(value);
        setPage(0);
    }

    function startEdit(variant: AdminVariantResponse) {
        setEditingSku(variant.sku);
        setEditValue(String(variant.stockQuantity));
    }

    function cancelEdit() {
        setEditingSku(null);
        setEditValue("");
    }

    function startAdd(variant: AdminVariantResponse) {
        setAddingSku(variant.sku);
        setAddValue("");
    }

    function cancelAdd() {
        setAddingSku(null);
        setAddValue("");
    }

    async function saveAdd(variant: AdminVariantResponse) {
        const parsed = Number(addValue);
        if (!Number.isInteger(parsed) || parsed <= 0) {
            notifications.error("Invalid stock quantity", "Enter a whole number greater than 0.");
            return;
        }

        setAdding(true);
        try {
            const updated = await adminApi.updateStock(variant.sku, {
                stockQuantity: variant.stockQuantity + parsed,
            });
            setRows((current) =>
                current.map((row) =>
                    row.variant.sku === variant.sku ? {...row, variant: updated} : row,
                ),
            );
            notifications.success("Stock updated", `${variant.sku} is now at ${updated.stockQuantity}.`);
            cancelAdd();
        } catch (err) {
            notifications.error(
                "Could not update stock",
                err instanceof ApiError ? err.message : "Something went wrong.",
            );
        } finally {
            setAdding(false);
        }
    }

    async function saveEdit(variant: AdminVariantResponse) {
        const parsed = Number(editValue);
        if (!Number.isInteger(parsed) || parsed < 0) {
            notifications.error("Invalid stock quantity", "Enter a whole number of 0 or more.");
            return;
        }

        setSaving(true);
        try {
            const updated = await adminApi.updateStock(variant.sku, {stockQuantity: parsed});
            setRows((current) =>
                current.map((row) =>
                    row.variant.sku === variant.sku ? {...row, variant: updated} : row,
                ),
            );
            notifications.success("Stock updated", `${variant.sku} is now at ${updated.stockQuantity}.`);
            cancelEdit();
        } catch (err) {
            notifications.error(
                "Could not update stock",
                err instanceof ApiError ? err.message : "Something went wrong.",
            );
        } finally {
            setSaving(false);
        }
    }

    const columns: AdminTableColumn<StockRow>[] = [
        {
            key: "product",
            header: "Product",
            render: ({product, variant}) => (
                <div>
                    <Link
                        href={`/admin/catalogue/${product.slug}`}
                        className="font-bold text-teal-950 hover:underline"
                    >
                        {product.name}
                    </Link>
                    <p className="text-[12px] text-muted">{variant.unit}</p>
                </div>
            ),
        },
        {
            key: "image",
            header: "Image",
            render: ({product}) => {
                const image = product.images.find((img) => img.isDefault) ?? product.images[0];
                return image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={image.url}
                        alt={image.altText ?? product.name}
                        className="size-10 rounded-lg object-cover"
                        onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = "/images/placeholder.png";
                        }}
                    />
                ) : (
                    <div className="size-10 rounded-lg bg-soft-control" aria-hidden/>
                );
            },
        },
        {
            key: "sku",
            header: "SKU",
            render: ({variant}) => <span className="text-muted">{variant.sku}</span>,
        },
        {
            key: "status",
            header: "Status",
            render: ({variant}) => <StatusChip status={statusOf(variant)}/>,
        },
        {
            key: "stock",
            header: "Available stock",
            render: ({variant}) => {
                const isEditing = editingSku === variant.sku;
                if (!isEditing) {
                    return <span className="font-semibold text-teal-950">{variant.stockQuantity}</span>;
                }
                return (
                    <input
                        type="number"
                        min={0}
                        step={1}
                        autoFocus
                        value={editValue}
                        onChange={(event) => setEditValue(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === "Enter") void saveEdit(variant);
                            if (event.key === "Escape") cancelEdit();
                        }}
                        className="h-9 w-24 rounded-lg border border-black/10 px-2.5 text-[14px] outline-none transition-colors focus:border-teal-800"
                    />
                );
            },
        },
        {
            key: "threshold",
            header: "Low-stock at",
            render: ({variant}) => (
                <span className="text-muted">{variant.lowStockThreshold ?? "-"}</span>
            ),
        },
        {
            key: "add-stock",
            header: "Add stock",
            render: ({variant}) => {
                const isAdding = addingSku === variant.sku;
                if (!isAdding) {
                    return (
                        <button
                            type="button"
                            disabled={editingSku !== null}
                            onClick={() => startAdd(variant)}
                            aria-label={`Add stock for ${variant.sku}`}
                            className="grid size-8 place-items-center rounded-lg text-teal-950 transition-colors hover:bg-soft-control disabled:opacity-40"
                        >
                            <Plus className="size-4" aria-hidden/>
                        </button>
                    );
                }
                return (
                    <div className="flex items-center gap-1.5">
                        <input
                            type="number"
                            min={1}
                            step={1}
                            autoFocus
                            value={addValue}
                            placeholder="Qty"
                            onChange={(event) => setAddValue(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === "Enter") void saveAdd(variant);
                                if (event.key === "Escape") cancelAdd();
                            }}
                            className="h-9 w-20 rounded-lg border border-black/10 px-2.5 text-[14px] outline-none transition-colors focus:border-teal-800"
                        />
                        <button
                            type="button"
                            disabled={adding}
                            onClick={() => void saveAdd(variant)}
                            aria-label={`Confirm add stock for ${variant.sku}`}
                            className="grid size-8 place-items-center rounded-lg text-teal-950 transition-colors hover:bg-soft-control disabled:opacity-60"
                        >
                            <Check className="size-4" aria-hidden/>
                        </button>
                        <button
                            type="button"
                            disabled={adding}
                            onClick={cancelAdd}
                            aria-label="Cancel"
                            className="grid size-8 place-items-center rounded-lg text-muted transition-colors hover:bg-soft-control disabled:opacity-60"
                        >
                            <X className="size-4" aria-hidden/>
                        </button>
                    </div>
                );
            },
        },
        {
            key: "actions",
            header: "",
            className: "text-right",
            render: ({variant}) => {
                const isEditing = editingSku === variant.sku;
                if (isEditing) {
                    return (
                        <div className="flex justify-end gap-1.5">
                            <button
                                type="button"
                                disabled={saving}
                                onClick={() => void saveEdit(variant)}
                                aria-label={`Save stock for ${variant.sku}`}
                                className="grid size-8 place-items-center rounded-lg text-teal-950 transition-colors hover:bg-soft-control disabled:opacity-60"
                            >
                                <Check className="size-4" aria-hidden/>
                            </button>
                            <button
                                type="button"
                                disabled={saving}
                                onClick={cancelEdit}
                                aria-label="Cancel"
                                className="grid size-8 place-items-center rounded-lg text-muted transition-colors hover:bg-soft-control disabled:opacity-60"
                            >
                                <X className="size-4" aria-hidden/>
                            </button>
                        </div>
                    );
                }
                return (
                    <div className="flex justify-end">
                        <button
                            type="button"
                            disabled={addingSku !== null}
                            onClick={() => startEdit(variant)}
                            aria-label={`Update stock for ${variant.sku}`}
                            className="grid size-8 place-items-center rounded-lg text-teal-950 transition-colors hover:bg-soft-control disabled:opacity-40"
                        >
                            <Pencil className="size-4" aria-hidden/>
                        </button>
                    </div>
                );
            },
        },
    ];

    return (
        <div>
            <div>
                <h1 className="text-[26px] font-extrabold text-teal-950">Stock</h1>
                <p className="mt-1 text-[13px] text-muted">
                    View and update available stock for every product variant.
                </p>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2">
                {FILTERS.map((item) => {
                    const active = filter === item.value;
                    return (
                        <button
                            key={item.value}
                            type="button"
                            onClick={() => handleFilterChange(item.value)}
                            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                                active
                                    ? "bg-teal-950 text-white"
                                    : "bg-soft-control text-teal-950 hover:bg-black/[0.06]"
                            }`}
                        >
                            {item.label}
                            <span
                                className={`rounded-full px-1.5 text-[11px] font-bold ${
                                    active ? "bg-white/20" : "bg-black/[0.06]"
                                }`}
                            >
                {counts[item.value]}
              </span>
                        </button>
                    );
                })}
            </div>

            <div className="mt-4 flex max-w-sm items-center gap-2">
                <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted"
                            aria-hidden/>
                    <input
                        value={query}
                        onChange={(event) => handleSearchChange(event.target.value)}
                        placeholder="Search by product or SKU"
                        className="h-10 w-full rounded-xl border border-black/10 bg-white pl-10 pr-4 text-[14px] outline-none transition-colors focus:border-teal-800"
                    />
                </div>
            </div>

            {error && (
                <p className="mt-4 rounded-xl bg-coral/10 px-4 py-3 text-[14px] font-medium text-coral">{error}</p>
            )}

            <div className="mt-4 hidden sm:block">
                <AdminTable
                    columns={columns}
                    rows={paged}
                    rowKey={(row) => row.variant.sku}
                    loading={loading}
                    emptyMessage="No variants match this filter."
                    pagination={{
                        page,
                        totalPages,
                        totalElements: filtered.length,
                        onPageChange: setPage,
                    }}
                />
            </div>

            <div className="mt-4 sm:hidden">
                <StockCardList
                    rows={paged}
                    loading={loading}
                    emptyMessage="No variants match this filter."
                    editingSku={editingSku}
                    editValue={editValue}
                    onEditValueChange={setEditValue}
                    onStartEdit={startEdit}
                    onCancelEdit={cancelEdit}
                    onSaveEdit={saveEdit}
                    saving={saving}
                    addingSku={addingSku}
                    addValue={addValue}
                    onAddValueChange={setAddValue}
                    onStartAdd={startAdd}
                    onCancelAdd={cancelAdd}
                    onSaveAdd={saveAdd}
                    adding={adding}
                />

                {totalPages > 1 && (
                    <div className="mt-3 flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-card">
                        <p className="text-[12px] font-medium text-muted">
                            Page {page + 1} of {totalPages} · {filtered.length} total
                        </p>
                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={() => setPage((p) => p - 1)}
                                disabled={loading || page <= 0}
                                aria-label="Previous page"
                                className="grid size-8 place-items-center rounded-lg text-teal-950 transition-colors hover:bg-soft-control disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                <ChevronLeft className="size-4" aria-hidden/>
                            </button>
                            <button
                                type="button"
                                onClick={() => setPage((p) => p + 1)}
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
        </div>
    );
}

function StockCardList({
                            rows,
                            loading,
                            emptyMessage,
                            editingSku,
                            editValue,
                            onEditValueChange,
                            onStartEdit,
                            onCancelEdit,
                            onSaveEdit,
                            saving,
                            addingSku,
                            addValue,
                            onAddValueChange,
                            onStartAdd,
                            onCancelAdd,
                            onSaveAdd,
                            adding,
                        }: {
    rows: StockRow[];
    loading: boolean;
    emptyMessage: string;
    editingSku: string | null;
    editValue: string;
    onEditValueChange: (value: string) => void;
    onStartEdit: (variant: AdminVariantResponse) => void;
    onCancelEdit: () => void;
    onSaveEdit: (variant: AdminVariantResponse) => void;
    saving: boolean;
    addingSku: string | null;
    addValue: string;
    onAddValueChange: (value: string) => void;
    onStartAdd: (variant: AdminVariantResponse) => void;
    onCancelAdd: () => void;
    onSaveAdd: (variant: AdminVariantResponse) => void;
    adding: boolean;
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
            {rows.map(({product, variant}) => {
                const isEditing = editingSku === variant.sku;
                const isAdding = addingSku === variant.sku;

                const image = product.images.find((img) => img.isDefault) ?? product.images[0];

                return (
                    <div key={variant.sku} className="rounded-2xl bg-white p-4 shadow-card">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-start gap-3">
                                {image ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={image.url}
                                        alt={image.altText ?? product.name}
                                        className="size-10 shrink-0 rounded-lg object-cover"
                                        onError={(e) => {
                                            (e.currentTarget as HTMLImageElement).src = "/images/placeholder.png";
                                        }}
                                    />
                                ) : (
                                    <div className="size-10 shrink-0 rounded-lg bg-soft-control" aria-hidden/>
                                )}
                                <div className="min-w-0">
                                    <Link
                                        href={`/admin/catalogue/${product.slug}`}
                                        className="font-bold text-teal-950 hover:underline"
                                    >
                                        {product.name}
                                    </Link>
                                    <p className="mt-0.5 text-[12px] text-muted">
                                        {variant.unit} · {variant.sku}
                                    </p>
                                </div>
                            </div>
                            <StatusChip status={statusOf(variant)}/>
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-3 border-t border-black/5 pt-3">
                            <div>
                                <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
                                    Available stock
                                </p>
                                {isEditing ? (
                                    <input
                                        type="number"
                                        min={0}
                                        step={1}
                                        autoFocus
                                        value={editValue}
                                        onChange={(event) => onEditValueChange(event.target.value)}
                                        onKeyDown={(event) => {
                                            if (event.key === "Enter") onSaveEdit(variant);
                                            if (event.key === "Escape") onCancelEdit();
                                        }}
                                        className="mt-1 h-9 w-24 rounded-lg border border-black/10 px-2.5 text-[14px] outline-none transition-colors focus:border-teal-800"
                                    />
                                ) : (
                                    <p className="mt-0.5 text-[18px] font-extrabold text-teal-950">
                                        {variant.stockQuantity}
                                    </p>
                                )}
                            </div>
                            <div className="text-right">
                                <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
                                    Low-stock at
                                </p>
                                <p className="mt-0.5 text-[14px] font-semibold text-muted">
                                    {variant.lowStockThreshold ?? "-"}
                                </p>
                            </div>
                        </div>

                        {isEditing ? (
                            <div className="mt-3 flex items-center gap-1.5">
                                <button
                                    type="button"
                                    disabled={saving}
                                    onClick={() => onSaveEdit(variant)}
                                    className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-teal-950 text-[13px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                                >
                                    <Check className="size-4" aria-hidden/>
                                    Save
                                </button>
                                <button
                                    type="button"
                                    disabled={saving}
                                    onClick={onCancelEdit}
                                    aria-label="Cancel"
                                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-soft-control disabled:opacity-60"
                                >
                                    <X className="size-4" aria-hidden/>
                                </button>
                            </div>
                        ) : isAdding ? (
                            <div className="mt-3 flex items-center gap-1.5">
                                <input
                                    type="number"
                                    min={1}
                                    step={1}
                                    autoFocus
                                    value={addValue}
                                    placeholder="Qty to add"
                                    onChange={(event) => onAddValueChange(event.target.value)}
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter") onSaveAdd(variant);
                                        if (event.key === "Escape") onCancelAdd();
                                    }}
                                    className="h-9 min-w-0 flex-1 rounded-lg border border-black/10 px-2.5 text-[14px] outline-none transition-colors focus:border-teal-800"
                                />
                                <button
                                    type="button"
                                    disabled={adding}
                                    onClick={() => onSaveAdd(variant)}
                                    aria-label={`Confirm add stock for ${variant.sku}`}
                                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-teal-950 text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                                >
                                    <Check className="size-4" aria-hidden/>
                                </button>
                                <button
                                    type="button"
                                    disabled={adding}
                                    onClick={onCancelAdd}
                                    aria-label="Cancel"
                                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-soft-control disabled:opacity-60"
                                >
                                    <X className="size-4" aria-hidden/>
                                </button>
                            </div>
                        ) : (
                            <div className="mt-3 flex items-center gap-1.5">
                                <button
                                    type="button"
                                    disabled={editingSku !== null}
                                    onClick={() => onStartAdd(variant)}
                                    className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-soft-control text-[13px] font-bold text-teal-950 transition-colors hover:bg-black/[0.06] disabled:opacity-40"
                                >
                                    <Plus className="size-4" aria-hidden/>
                                    Add stock
                                </button>
                                <button
                                    type="button"
                                    disabled={addingSku !== null}
                                    onClick={() => onStartEdit(variant)}
                                    aria-label={`Update stock for ${variant.sku}`}
                                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-teal-950 transition-colors hover:bg-soft-control disabled:opacity-40"
                                >
                                    <Pencil className="size-4" aria-hidden/>
                                </button>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

function StatusChip({status}: { status: Exclude<StockFilter, "all"> }) {
    const config = {
        "in-stock": {label: "In stock", className: "bg-lime-500/25 text-teal-950", dot: "bg-teal-800"},
        "low-stock": {label: "Ending soon", className: "bg-gold/20 text-teal-950", dot: "bg-gold"},
        "out-of-stock": {label: "Out of stock", className: "bg-coral/15 text-coral", dot: "bg-coral"},
    }[status];

    return (
        <span
            className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${config.className}`}
        >
      <span className={`size-1.5 rounded-full ${config.dot}`} aria-hidden/>
            {config.label}
    </span>
    );
}
