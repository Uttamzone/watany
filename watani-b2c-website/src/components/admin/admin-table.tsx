"use client";

import type {ReactNode} from "react";
import {ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight} from "lucide-react";

export type AdminTableColumn<T> = {
    key: string;
    header: string;
    render: (row: T) => ReactNode;
    className?: string;
    /** Set to make this column's header clickable and sortable - value passed to onSort. */
    sortKey?: string;
};

type Pagination = {
    page: number;
    totalPages: number;
    totalElements: number;
    onPageChange: (page: number) => void;
};

type Sorting = {
    sortKey: string;
    direction: "asc" | "desc";
    onSort: (sortKey: string) => void;
};

type AdminTableProps<T> = {
    columns: AdminTableColumn<T>[];
    rows: T[];
    rowKey: (row: T) => string | number;
    loading?: boolean;
    emptyMessage?: string;
    pagination?: Pagination;
    sorting?: Sorting;
};

/** Generic column-defined table with backend page-N pagination and optional column sorting. */
export function AdminTable<T>({
                                  columns,
                                  rows,
                                  rowKey,
                                  loading,
                                  emptyMessage = "No records found.",
                                  pagination,
                                  sorting,
                              }: AdminTableProps<T>) {
    return (
        <div className="overflow-hidden rounded-2xl bg-white shadow-card">
            <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-[14px]">
                    <thead>
                    <tr className="border-b border-black/5 text-[12px] font-bold uppercase tracking-wide text-muted">
                        {columns.map((column) => {
                            const isSorted = sorting && column.sortKey === sorting.sortKey;
                            if (column.sortKey && sorting) {
                                return (
                                    <th key={column.key} className={`px-5 py-3 ${column.className ?? ""}`}>
                                        <button
                                            type="button"
                                            onClick={() => sorting.onSort(column.sortKey!)}
                                            className="inline-flex items-center gap-1 transition-colors hover:text-teal-950"
                                        >
                                            {column.header}
                                            {isSorted ? (
                                                sorting.direction === "asc" ? (
                                                    <ArrowUp className="size-3.5" aria-hidden/>
                                                ) : (
                                                    <ArrowDown className="size-3.5" aria-hidden/>
                                                )
                                            ) : (
                                                <ArrowUpDown className="size-3.5 opacity-40" aria-hidden/>
                                            )}
                                        </button>
                                    </th>
                                );
                            }
                            return (
                                <th key={column.key} className={`px-5 py-3 ${column.className ?? ""}`}>
                                    {column.header}
                                </th>
                            );
                        })}
                    </tr>
                    </thead>
                    <tbody>
                    {rows.map((row) => (
                        <tr key={rowKey(row)}
                            className="border-b border-black/5 last:border-0 hover:bg-soft-control/50">
                            {columns.map((column) => (
                                <td key={column.key} className={`px-5 py-3.5 align-middle ${column.className ?? ""}`}>
                                    {column.render(row)}
                                </td>
                            ))}
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>

            {!loading && rows.length === 0 && (
                <p className="px-5 py-10 text-center text-[14px] text-muted">{emptyMessage}</p>
            )}

            {pagination && (rows.length > 0 || loading) && (
                <div className="flex items-center justify-between border-t border-black/5 px-5 py-3.5">
                    <p className="text-[12px] font-medium text-muted">
                        {pagination.totalElements === 0
                            ? "0 results"
                            : `Page ${pagination.page + 1} of ${Math.max(pagination.totalPages, 1)} · ${pagination.totalElements} total`}
                    </p>
                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={() => pagination.onPageChange(pagination.page - 1)}
                            disabled={loading || pagination.page <= 0}
                            aria-label="Previous page"
                            className="grid size-8 place-items-center rounded-lg text-teal-950 transition-colors hover:bg-soft-control disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            <ChevronLeft className="size-4" aria-hidden/>
                        </button>
                        <button
                            type="button"
                            onClick={() => pagination.onPageChange(pagination.page + 1)}
                            disabled={loading || pagination.page + 1 >= pagination.totalPages}
                            aria-label="Next page"
                            className="grid size-8 place-items-center rounded-lg text-teal-950 transition-colors hover:bg-soft-control disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            <ChevronRight className="size-4" aria-hidden/>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
