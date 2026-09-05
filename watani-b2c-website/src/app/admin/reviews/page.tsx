"use client";

import {useEffect, useState} from "react";
import {Check, Star, X as XIcon} from "lucide-react";
import * as adminApi from "@/lib/admin/api";
import type {Review} from "@/lib/admin/types";
import {AdminTable, type AdminTableColumn} from "@/components/admin/admin-table";
import {type RowAction, RowActions} from "@/components/admin/row-actions";
import {ApiError} from "@/lib/api";
import {useNotifications} from "@/components/notifications/notification-store";

const PAGE_SIZE = 10;

export default function AdminReviewsPage() {
    const notifications = useNotifications();
    const [page, setPage] = useState(0);
    const [items, setItems] = useState<Review[]>([]);
    const [totalElements, setTotalElements] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    function reload() {
        setLoading(true);
        adminApi
            .pendingReviews(page, PAGE_SIZE)
            .then((result) => {
                setItems(result.content);
                setTotalElements(result.totalElements);
                setTotalPages(result.totalPages);
            })
            .catch((err) => {
                const message = err instanceof ApiError ? err.message : "Failed to load reviews.";
                setError(message);
                notifications.error("Failed to load reviews", message);
            })
            .finally(() => setLoading(false));
    }

    useEffect(() => {
        adminApi
            .pendingReviews(page, PAGE_SIZE)
            .then((result) => {
                setItems(result.content);
                setTotalElements(result.totalElements);
                setTotalPages(result.totalPages);
            })
            .catch((err) => {
                const message = err instanceof ApiError ? err.message : "Failed to load reviews.";
                setError(message);
                notifications.error("Failed to load reviews", message);
            })
            .finally(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page]);

    function handlePageChange(nextPage: number) {
        setLoading(true);
        setPage(nextPage);
    }

    async function moderate(id: number, approve: boolean) {
        try {
            await adminApi.moderateReview(id, approve);
            reload();
        } catch (err) {
            notifications.error("Action failed", err instanceof ApiError ? err.message : "Action failed.");
        }
    }

    const columns: AdminTableColumn<Review>[] = [
        {
            key: "author",
            header: "Author",
            render: (row) => <span className="font-semibold text-teal-950">{row.authorName}</span>
        },
        {
            key: "rating",
            header: "Rating",
            render: (row) => (
                <span className="inline-flex items-center gap-0.5 text-gold">
          {Array.from({length: 5}).map((_, index) => (
              <Star key={index} className="size-3.5" fill={index < row.rating ? "currentColor" : "none"} aria-hidden/>
          ))}
        </span>
            ),
        },
        {
            key: "review",
            header: "Review",
            render: (row) => (
                <div className="max-w-md">
                    {row.title && <p className="font-semibold text-teal-950">{row.title}</p>}
                    <p className="text-[13px] text-muted line-clamp-2">{row.body}</p>
                </div>
            ),
        },
        {
            key: "actions",
            header: "",
            className: "text-right",
            render: (row) => {
                const actions: RowAction[] = [
                    {label: "Approve review", icon: Check, onSelect: () => moderate(row.id, true)},
                    {label: "Reject review", icon: XIcon, tone: "danger", onSelect: () => moderate(row.id, false)},
                ];
                return <RowActions actions={actions} label={`Actions for review by ${row.authorName}`}/>;
            },
        },
    ];

    return (
        <div>
            <h1 className="text-[26px] font-extrabold text-teal-950">Reviews</h1>
            <p className="mt-1 text-[13px] text-muted">Pending moderation.</p>

            {error && (
                <p className="mt-4 rounded-xl bg-coral/10 px-4 py-3 text-[14px] font-medium text-coral">{error}</p>
            )}

            <div className="mt-5">
                <AdminTable
                    columns={columns}
                    rows={items}
                    rowKey={(row) => row.id}
                    loading={loading}
                    emptyMessage="No reviews pending."
                    pagination={{page, totalPages, totalElements, onPageChange: handlePageChange}}
                />
            </div>
        </div>
    );
}
