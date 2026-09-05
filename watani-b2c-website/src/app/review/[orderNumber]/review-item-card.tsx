"use client";

import {useState} from "react";
import Image from "next/image";
import {StarRatingInput} from "./star-rating-input";
import type {ReviewableItem} from "@/lib/review/api";
import * as reviewApi from "@/lib/review/api";
import {ApiError} from "@/lib/api";
import {useNotifications} from "@/components/notifications/notification-store";
import {productImageSrc} from "@/lib/products";

export function ReviewItemCard({
                                   orderNumber,
                                   token,
                                   item,
                                   onSubmitted,
                               }: {
    orderNumber: string;
    token: string;
    item: ReviewableItem;
    onSubmitted: () => void;
}) {
    const {success, error: notifyError} = useNotifications();
    const [rating, setRating] = useState(item.existingRating ?? 0);
    const [title, setTitle] = useState(item.existingTitle ?? "");
    const [body, setBody] = useState(item.existingBody ?? "");
    const [saving, setSaving] = useState(false);

    async function handleSubmit(event: React.FormEvent) {
        event.preventDefault();
        if (rating < 1) {
            notifyError("Pick a star rating first.");
            return;
        }
        setSaving(true);
        try {
            await reviewApi.submitReview(orderNumber, token, item.orderItemId, {
                rating,
                title: title.trim() || null,
                body: body.trim() || null,
            });
            success("Review saved", `Thanks for rating ${item.productName}.`);
            onSubmitted();
        } catch (err) {
            notifyError(
                "Couldn't save your review",
                err instanceof ApiError ? err.message : "Please try again.",
            );
        } finally {
            setSaving(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="rounded-2xl bg-white p-5 shadow-card">
            <div className="flex items-start gap-3">
                <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-canvas">
                    <Image src={productImageSrc(item.image)} alt="" fill className="object-cover" sizes="64px"/>
                </div>
                <div className="min-w-0 flex-1">
                    <p className="font-semibold text-teal-950">{item.productName}</p>
                    <p className="text-[12px] text-muted">
                        {item.sku} · Qty {item.quantity}
                    </p>
                </div>
            </div>

            <div className="mt-4">
                <StarRatingInput value={rating} onChange={setRating} disabled={saving}/>
            </div>

            <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Give your review a title (optional)"
                maxLength={200}
                disabled={saving}
                className="mt-3 w-full rounded-lg border border-black/10 px-3 py-2 text-[14px] outline-none focus:border-teal-700"
            />

            <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Tell other customers what you thought (optional)"
                maxLength={4000}
                rows={3}
                disabled={saving}
                className="mt-2 w-full resize-none rounded-lg border border-black/10 px-3 py-2 text-[14px] outline-none focus:border-teal-700"
            />

            <button
                type="submit"
                disabled={saving}
                className="mt-3 rounded-full bg-teal-950 px-5 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            >
                {saving ? "Saving…" : item.existingRating != null ? "Update review" : "Submit review"}
            </button>
        </form>
    );
}
