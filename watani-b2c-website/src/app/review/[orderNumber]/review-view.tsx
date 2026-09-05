"use client";

import {useEffect, useState} from "react";
import Link from "next/link";
import {useSearchParams} from "next/navigation";
import {CheckCircle2, Home} from "lucide-react";
import type {OrderReviewSummary, ReviewableItem} from "@/lib/review/api";
import * as reviewApi from "@/lib/review/api";
import {ApiError} from "@/lib/api";
import {useNotifications} from "@/components/notifications/notification-store";
import {ReviewItemCard} from "./review-item-card";

const MISSING_TOKEN_MESSAGE = "This review link is missing its token.";

export function ReviewView({orderNumber}: { orderNumber: string }) {
    const token = useSearchParams().get("token");
    const notifications = useNotifications();

    const [summary, setSummary] = useState<OrderReviewSummary | null>(null);
    const [items, setItems] = useState<ReviewableItem[]>([]);
    const [fetchError, setFetchError] = useState<string | null>(null);

    // A missing token is knowable at render time, so it is derived rather than pushed
    // into state from an effect (react-hooks/set-state-in-effect).
    const error = token ? fetchError : MISSING_TOKEN_MESSAGE;

    // The toast is a side effect, so it does belong in an effect - just not the setState.
    useEffect(() => {
        if (!token) {
            notifications.error("Unable to load review", MISSING_TOKEN_MESSAGE);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    useEffect(() => {
        if (!token) return;
        reviewApi
            .getReviewableItems(orderNumber, token)
            .then((result) => {
                setSummary(result);
                setItems(result.items);
            })
            .catch((err) => {
                const message =
                    err instanceof ApiError && err.status === 404
                        ? "This review link is invalid or has expired."
                        : "Couldn't load this order. Please try again.";
                setFetchError(message);
                notifications.error("Unable to load review", message);
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [orderNumber, token]);

    if (error) {
        return <p className="rounded-xl bg-coral/10 px-4 py-3 text-[14px] font-medium text-coral">{error}</p>;
    }

    if (!summary) {
        return <p className="text-muted">Loading…</p>;
    }

    return (
        <div>
            <h1 className="text-[26px] font-extrabold text-teal-950">Rate your order</h1>
            <p className="mt-1 text-[13px] text-muted">
                Order {summary.orderNumber} - let other customers know what you thought of each item.
            </p>

            <Link
                href="/"
                className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted transition-colors hover:text-teal-950"
            >
                <Home className="size-3.5" aria-hidden/>
                Go to home page
            </Link>

            {items.length > 0 ? (
                <div className="mt-6 space-y-4">
                    {items.map((item) => (
                        <ReviewItemCard
                            key={item.orderItemId}
                            orderNumber={orderNumber}
                            token={token!}
                            item={item}
                            onSubmitted={() =>
                                setItems((current) => current.filter((i) => i.orderItemId !== item.orderItemId))
                            }
                        />
                    ))}
                </div>
            ) : (
                <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl bg-white p-8 text-center shadow-card">
                    <CheckCircle2 className="size-8 text-teal-700" aria-hidden/>
                    <p className="text-[15px] font-bold text-teal-950">Thanks for your reviews!</p>
                    <Link
                        href="/"
                        className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-teal-950 px-5 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
                    >
                        <Home className="size-3.5" aria-hidden/>
                        Go to home page
                    </Link>
                </div>
            )}
        </div>
    );
}
