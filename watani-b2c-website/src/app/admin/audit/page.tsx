"use client";

import {useEffect, useState} from "react";
import {ChevronDown, ChevronUp} from "lucide-react";
import * as adminApi from "@/lib/admin/api";
import type {AuditLog} from "@/lib/admin/types";
import {AdminTable, type AdminTableColumn} from "@/components/admin/admin-table";
import {ApiError} from "@/lib/api";
import {useNotifications} from "@/components/notifications/notification-store";

const PAGE_SIZE = 10;

export default function AdminAuditPage() {
    const notifications = useNotifications();
    const [page, setPage] = useState(0);
    const [items, setItems] = useState<AuditLog[]>([]);
    const [totalElements, setTotalElements] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expanded, setExpanded] = useState<number | null>(null);

    useEffect(() => {
        adminApi
            .auditLog(page, PAGE_SIZE)
            .then((result) => {
                setItems(result.content);
                setTotalElements(result.totalElements);
                setTotalPages(result.totalPages);
            })
            .catch((err) => {
                const message = err instanceof ApiError ? err.message : "Failed to load audit log.";
                setError(message);
                notifications.error("Failed to load audit log", message);
            })
            .finally(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page]);

    function handlePageChange(nextPage: number) {
        setLoading(true);
        setExpanded(null);
        setPage(nextPage);
    }

    const columns: AdminTableColumn<AuditLog>[] = [
        {key: "createdAt", header: "When", render: (row) => new Date(row.createdAt).toLocaleString()},
        {key: "actor", header: "Actor", render: (row) => row.actor},
        {key: "action", header: "Action", render: (row) => row.action},
        {key: "entity", header: "Entity", render: (row) => `${row.entityType} #${row.entityId}`},
        {
            key: "detail",
            header: "",
            className: "text-right",
            render: (row) => {
                const isOpen = expanded === row.id;
                return (
                    <button
                        type="button"
                        onClick={() => setExpanded(isOpen ? null : row.id)}
                        aria-expanded={isOpen}
                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12px] font-bold text-teal-800 transition-colors hover:bg-soft-control"
                    >
                        {isOpen ? "Hide" : "Details"}
                        {isOpen ? <ChevronUp className="size-3.5" aria-hidden/> :
                            <ChevronDown className="size-3.5" aria-hidden/>}
                    </button>
                );
            },
        },
    ];

    const activeRow = items.find((row) => row.id === expanded);

    return (
        <div>
            <div>
                <h1 className="text-[26px] font-extrabold text-teal-950">Audit log</h1>
                <p className="mt-1 text-[13px] text-muted">Track every change made across the admin portal.</p>
            </div>

            {error && (
                <p className="mt-4 rounded-xl bg-coral/10 px-4 py-3 text-[14px] font-medium text-coral">{error}</p>
            )}

            <div className="mt-5">
                <AdminTable
                    columns={columns}
                    rows={items}
                    rowKey={(row) => row.id}
                    loading={loading}
                    emptyMessage="No audit entries yet."
                    pagination={{page, totalPages, totalElements, onPageChange: handlePageChange}}
                />
            </div>

            {activeRow && (
                <div className="mt-4 rounded-2xl bg-white p-5 shadow-card">
                    <p className="text-[12px] font-bold uppercase tracking-wide text-muted">
                        {activeRow.action} - {activeRow.entityType} #{activeRow.entityId}
                    </p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <div>
                            <p className="text-[11px] font-bold text-muted">Previous value</p>
                            <pre className="mt-1 whitespace-pre-wrap rounded-lg bg-soft-control p-3 text-[11px]">
                {activeRow.previousValue ?? "-"}
              </pre>
                        </div>
                        <div>
                            <p className="text-[11px] font-bold text-muted">New value</p>
                            <pre className="mt-1 whitespace-pre-wrap rounded-lg bg-soft-control p-3 text-[11px]">
                {activeRow.newValue ?? "-"}
              </pre>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
