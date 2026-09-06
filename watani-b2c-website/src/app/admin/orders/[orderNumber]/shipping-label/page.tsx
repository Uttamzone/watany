"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import * as adminApi from "@/lib/admin/api";
import type { OrderResponse, OrderBoxResponse } from "@/lib/admin/types";
import { ShippingLabelView } from "@/components/admin/shipping-label-view";
import { useSearchParams } from "next/navigation";

export default function AdminShippingLabelPage({
    params,
}: {
    params: Promise<{ orderNumber: string }>;
}) {
    const { orderNumber } = use(params);
    const searchParams = useSearchParams();
    const typeParam = searchParams.get("type")?.toUpperCase();

    const [order, setOrder] = useState<OrderResponse | null>(null);
    const [boxes, setBoxes] = useState<OrderBoxResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        Promise.all([
            adminApi.getOrder(orderNumber),
            adminApi.getOrderBoxes(orderNumber).catch(() => []),
        ])
            .then(([detail, boxList]) => {
                setOrder(detail.order);
                setBoxes(boxList || []);
            })
            .catch((err) => {
                setError(err?.message || "Failed to load order for label printing.");
            })
            .finally(() => {
                setLoading(false);
            });
    }, [orderNumber]);

    if (loading) {
        return (
            <div className="flex h-64 items-center justify-center text-muted">
                Loading shipping document data…
            </div>
        );
    }

    if (error || !order) {
        return (
            <div className="space-y-4 p-6">
                <Link
                    href={`/admin/orders/${orderNumber}`}
                    className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted hover:text-teal-950"
                >
                    <ArrowLeft className="size-3.5" /> Back to Order #{orderNumber}
                </Link>
                <div className="rounded-2xl border border-coral/20 bg-coral/10 p-6 text-coral">
                    <h2 className="text-[16px] font-bold">Document Error</h2>
                    <p className="mt-1 text-[13px]">{error || "Order not found."}</p>
                </div>
            </div>
        );
    }

    const defaultDocType =
        typeParam === "PALLET" || typeParam === "BOL" || typeParam === "PARCEL"
            ? (typeParam as "PARCEL" | "PALLET" | "BOL")
            : undefined;

    return (
        <div className="py-2">
            <div className="mb-3 print:hidden">
                <Link
                    href={`/admin/orders/${orderNumber}`}
                    className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted hover:text-teal-950"
                >
                    <ArrowLeft className="size-3.5" /> Back to Order #{orderNumber}
                </Link>
            </div>
            <ShippingLabelView
                order={order}
                initialBoxes={boxes}
                defaultDocType={defaultDocType}
            />
        </div>
    );
}
