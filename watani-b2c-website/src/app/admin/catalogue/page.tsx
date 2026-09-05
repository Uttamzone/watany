"use client";

import {useEffect, useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {ChevronLeft, ChevronRight, Download, ExternalLink, FileText, Pencil, Plus, Search, Trash2, Upload} from "lucide-react";
import * as adminApi from "@/lib/admin/api";
import type {AdminProductResponse, ProductSortField, SortDirection} from "@/lib/admin/types";
import {AdminTable, type AdminTableColumn} from "@/components/admin/admin-table";
import {type RowAction, RowActions} from "@/components/admin/row-actions";
import {ConfirmDialog} from "@/components/admin/confirm-dialog";
import {BulkUploadModal} from "@/components/admin/bulk-upload-modal";
import {CataloguePdfModal} from "@/components/admin/catalogue-pdf-modal";
import {ApiError} from "@/lib/api";
import {useNotifications} from "@/components/notifications/notification-store";

import {productImageSrc} from "@/lib/products";

const PAGE_SIZE = 10;

function money(value: number) {
    return new Intl.NumberFormat("en-CA", {style: "currency", currency: "CAD"}).format(value);
}

export default function AdminCataloguePage() {
    const notifications = useNotifications();
    const [query, setQuery] = useState("");
    const [appliedQuery, setAppliedQuery] = useState("");
    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(25);
    const [sortKey, setSortKey] = useState<ProductSortField>("name");
    const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
    const [products, setProducts] = useState<AdminProductResponse[]>([]);
    const [totalElements, setTotalElements] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [deleteTarget, setDeleteTarget] = useState<AdminProductResponse | null>(null);
    const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [pdfTarget, setPdfTarget] = useState<"all" | AdminProductResponse | null>(null);
    const [allProductsForPdf, setAllProductsForPdf] = useState<AdminProductResponse[]>([]);
    const [fetchingPdfProducts, setFetchingPdfProducts] = useState(false);
    const router = useRouter();

    async function openPdfExportAll() {
        setFetchingPdfProducts(true);
        try {
            let allProducts: AdminProductResponse[] = [];
            let currentPage = 0;
            let totalPgs = 1;

            do {
                const result = await adminApi.listProducts(appliedQuery, currentPage, 250, sortKey, sortDirection);
                if (!result.content || result.content.length === 0) break;
                allProducts = allProducts.concat(result.content);
                totalPgs = result.totalPages;
                currentPage++;
            } while (currentPage < totalPgs);

            setAllProductsForPdf(allProducts);
            setPdfTarget("all");
        } catch (err) {
            notifications.error("PDF Export error", "Failed to fetch full product catalogue for PDF export.");
        } finally {
            setFetchingPdfProducts(false);
        }
    }

    function reload() {
        setLoading(true);
        adminApi
            .listProducts(appliedQuery, page, pageSize, sortKey, sortDirection)
            .then((result) => {
                setProducts(result.content);
                setTotalElements(result.totalElements);
                setTotalPages(result.totalPages);
            })
            .catch((err) => {
                const message = err instanceof ApiError ? err.message : "Failed to load products.";
                setError(message);
                notifications.error("Failed to load catalogue", message);
            })
            .finally(() => setLoading(false));
    }

    useEffect(() => {
        adminApi
            .listProducts(appliedQuery, page, pageSize, sortKey, sortDirection)
            .then((result) => {
                setProducts(result.content);
                setTotalElements(result.totalElements);
                setTotalPages(result.totalPages);
            })
            .catch((err) => {
                const message = err instanceof ApiError ? err.message : "Failed to load products.";
                setError(message);
                notifications.error("Failed to load catalogue", message);
            })
            .finally(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [appliedQuery, page, pageSize, sortKey, sortDirection]);

    function handleSearch(event: React.FormEvent) {
        event.preventDefault();
        setLoading(true);
        setPage(0);
        setAppliedQuery(query);
    }

    function handleSort(key: string) {
        setLoading(true);
        if (key === sortKey) {
            setSortDirection((direction) => (direction === "asc" ? "desc" : "asc"));
        } else {
            setSortKey(key as ProductSortField);
            setSortDirection("asc");
        }
        setPage(0);
    }

    function handlePageChange(nextPage: number) {
        setLoading(true);
        setPage(nextPage);
    }

    async function exportCatalogue() {
        setExporting(true);
        try {
            await adminApi.exportProducts();
        } catch (err) {
            notifications.error("Export failed", err instanceof ApiError ? err.message : "Could not export the catalogue.");
        } finally {
            setExporting(false);
        }
    }

    async function removeProduct(product: AdminProductResponse) {
        try {
            await adminApi.deleteProduct(product.slug);
            setDeleteTarget(null);
            reload();
        } catch (err) {
            notifications.error("Delete failed", err instanceof ApiError ? err.message : "Delete failed.");
        }
    }

    const columns: AdminTableColumn<AdminProductResponse>[] = [
        {
            key: "name",
            header: "Product",
            sortKey: "name",
            render: (row) => (
                <Link href={`/admin/catalogue/${row.slug}`} className="font-bold text-teal-950 hover:underline">
                    {row.name}
                </Link>
            ),
        },
        {
            key: "image",
            header: "Image",
            render: (row) => {
                const image = row.images?.find((img) => img.isDefault) ?? row.images?.[0];
                const rawUrl = image?.url || (row as any).image || (row.variants?.[0] as any)?.imageUrl || (row.variants?.[0] as any)?.image;
                return (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={productImageSrc(rawUrl)}
                        alt={row.name}
                        className="size-10 rounded-lg object-cover"
                        onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = "/images/placeholder.png";
                        }}
                    />
                );
            },
        },
        {
            key: "category",
            header: "Category",
            sortKey: "categorySlug",
            render: (row) => <span className="text-muted">{row.categorySlug}</span>,
        },
        {
            key: "variants",
            header: "Variants",
            render: (row) => row.variants.length,
        },
        {
            key: "retail",
            header: "Retail price",
            render: (row) => {
                const tier = row.variants[0]?.priceTiers.find((t) => t.pricingGroup === "RETAIL");
                return <span className="font-semibold text-teal-950">{tier ? money(tier.unitPrice) : "-"}</span>;
            },
        },
        {
            key: "active",
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
                    {label: "Edit product", icon: Pencil, onSelect: () => router.push(`/admin/catalogue/${row.slug}`)},
                    {
                        label: "View on site",
                        icon: ExternalLink,
                        onSelect: () => window.open(`/product/${row.slug}`, "_blank")
                    },
                    {label: "Download as PDF", icon: FileText, onSelect: () => setPdfTarget(row)},
                    {label: "Delete product", icon: Trash2, tone: "danger", onSelect: () => setDeleteTarget(row)},
                ];
                return <RowActions actions={actions} label={`Actions for ${row.name}`}/>;
            },
        },
    ];

    return (
        <div>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-[22px] font-extrabold text-teal-950 sm:text-[26px]">Catalogue</h1>
                    <p className="mt-1 text-[13px] text-muted">Manage products, pricing, and availability.</p>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0 sm:items-center">
                    <button
                        type="button"
                        onClick={exportCatalogue}
                        disabled={exporting}
                        className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-black/10 px-4 text-[13px] font-bold text-teal-950 transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50 sm:h-10"
                    >
                        <Download className="size-4 shrink-0" aria-hidden/>
                        {exporting ? "Exporting..." : "Export"}
                    </button>
                    <button
                        type="button"
                        onClick={() => setBulkUploadOpen(true)}
                        className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-black/10 px-4 text-[13px] font-bold text-teal-950 transition-opacity hover:opacity-80 sm:h-10"
                    >
                        <Upload className="size-4 shrink-0" aria-hidden/>
                        Bulk upload
                    </button>
                    <button
                        type="button"
                        onClick={openPdfExportAll}
                        disabled={fetchingPdfProducts || products.length === 0}
                        className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-black/10 px-4 text-[13px] font-bold text-teal-950 transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50 sm:h-10"
                    >
                        <FileText className="size-4 shrink-0" aria-hidden/>
                        {fetchingPdfProducts ? "Loading..." : "Download as PDF"}
                    </button>
                    <Link
                        href="/admin/catalogue/new"
                        className="col-span-2 flex h-11 items-center justify-center gap-1.5 rounded-xl bg-lime-500 px-4 text-[13px] font-bold text-teal-950 transition-opacity hover:opacity-90 sm:col-span-1 sm:h-10"
                    >
                        <Plus className="size-4 shrink-0" aria-hidden/>
                        New product
                    </Link>
                </div>
            </div>

            <form onSubmit={handleSearch} className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-1 items-center gap-2 sm:max-w-md">
                    <div className="relative flex-1">
                        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted"
                                aria-hidden/>
                        <input
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Search products"
                            className="h-11 w-full rounded-xl border border-black/10 bg-white pl-10 pr-4 text-[14px] outline-none transition-colors focus:border-teal-800 sm:h-10"
                        />
                    </div>
                    <button
                        type="submit"
                        className="h-11 shrink-0 rounded-xl bg-teal-950 px-4 text-[13px] font-bold text-white transition-opacity hover:opacity-90 sm:h-10"
                    >
                        Search
                    </button>
                </div>
                <div className="flex items-center gap-2 text-[13px] font-medium text-muted">
                    <span>Show per page:</span>
                    <select
                        value={pageSize}
                        onChange={(e) => {
                            setPageSize(Number(e.target.value));
                            setPage(0);
                        }}
                        className="h-10 rounded-xl border border-black/10 bg-white px-3 text-[13px] font-bold text-teal-950 outline-none"
                    >
                        <option value={10}>10 items</option>
                        <option value={25}>25 items</option>
                        <option value={50}>50 items</option>
                        <option value={100}>100 items</option>
                        <option value={250}>250 items (All)</option>
                    </select>
                </div>
            </form>

            {error && (
                <p className="mt-4 rounded-xl bg-coral/10 px-4 py-3 text-[14px] font-medium text-coral">{error}</p>
            )}

            <div className="mt-4 hidden sm:block">
                <AdminTable
                    columns={columns}
                    rows={products}
                    rowKey={(row) => row.id}
                    loading={loading}
                    emptyMessage="No products found."
                    sorting={{sortKey, direction: sortDirection, onSort: handleSort}}
                    pagination={{page, totalPages, totalElements, onPageChange: handlePageChange}}
                />
            </div>

            <div className="mt-4 sm:hidden">
                <ProductCardList
                    rows={products}
                    loading={loading}
                    emptyMessage="No products found."
                    onEdit={(row) => router.push(`/admin/catalogue/${row.slug}`)}
                    onViewOnSite={(row) => window.open(`/product/${row.slug}`, "_blank")}
                    onDownloadPdf={(row) => setPdfTarget(row)}
                    onDelete={(row) => setDeleteTarget(row)}
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
                open={deleteTarget !== null}
                title="Delete product?"
                description={deleteTarget ? `"${deleteTarget.name}" will be permanently removed from the catalogue.` : undefined}
                confirmLabel="Delete"
                danger
                onCancel={() => setDeleteTarget(null)}
                onConfirm={() => deleteTarget && removeProduct(deleteTarget)}
            />

            <BulkUploadModal
                open={bulkUploadOpen}
                onClose={() => setBulkUploadOpen(false)}
                onUploaded={reload}
            />

            <CataloguePdfModal
                open={pdfTarget !== null}
                onClose={() => setPdfTarget(null)}
                products={pdfTarget === "all" ? allProductsForPdf : pdfTarget ? [pdfTarget] : []}
                title={pdfTarget === "all" ? "Catalogue" : pdfTarget?.name}
            />
        </div>
    );
}

function ProductCardList({
                              rows,
                              loading,
                              emptyMessage,
                              onEdit,
                              onViewOnSite,
                              onDownloadPdf,
                              onDelete,
                          }: {
    rows: AdminProductResponse[];
    loading: boolean;
    emptyMessage: string;
    onEdit: (row: AdminProductResponse) => void;
    onViewOnSite: (row: AdminProductResponse) => void;
    onDownloadPdf: (row: AdminProductResponse) => void;
    onDelete: (row: AdminProductResponse) => void;
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
            {rows.map((row) => {
                const image = row.images.find((img) => img.isDefault) ?? row.images[0];
                const tier = row.variants[0]?.priceTiers.find((t) => t.pricingGroup === "RETAIL");
                const actions: RowAction[] = [
                    {label: "Edit product", icon: Pencil, onSelect: () => onEdit(row)},
                    {label: "View on site", icon: ExternalLink, onSelect: () => onViewOnSite(row)},
                    {label: "Download as PDF", icon: FileText, onSelect: () => onDownloadPdf(row)},
                    {label: "Delete product", icon: Trash2, tone: "danger", onSelect: () => onDelete(row)},
                ];

                return (
                    <div key={row.id} className="rounded-2xl bg-white p-4 shadow-card">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-start gap-3">
                                {image ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={image.url}
                                        alt={image.altText ?? row.name}
                                        className="size-12 shrink-0 rounded-lg object-cover"
                                    />
                                ) : (
                                    <div className="size-12 shrink-0 rounded-lg bg-soft-control" aria-hidden/>
                                )}
                                <div className="min-w-0">
                                    <Link
                                        href={`/admin/catalogue/${row.slug}`}
                                        className="font-bold text-teal-950 hover:underline"
                                    >
                                        {row.name}
                                    </Link>
                                    <p className="mt-0.5 text-[12px] text-muted">
                                        {row.categorySlug} · {row.variants.length} variant{row.variants.length === 1 ? "" : "s"}
                                    </p>
                                </div>
                            </div>
                            <RowActions actions={actions} label={`Actions for ${row.name}`}/>
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-3 border-t border-black/5 pt-3">
                            <div>
                                <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
                                    Retail price
                                </p>
                                <p className="mt-0.5 text-[16px] font-extrabold text-teal-950">
                                    {tier ? money(tier.unitPrice) : "-"}
                                </p>
                            </div>
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
