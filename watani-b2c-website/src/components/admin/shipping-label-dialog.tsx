"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";
import { ShippingLabelView } from "./shipping-label-view";
import type { OrderResponse, OrderBoxResponse } from "@/lib/admin/types";

interface ShippingLabelDialogProps {
    open: boolean;
    order: OrderResponse;
    boxes?: OrderBoxResponse[];
    defaultDocType?: "PARCEL" | "PALLET" | "BOL";
    onClose: () => void;
}

export function ShippingLabelDialog({
    open,
    order,
    boxes,
    defaultDocType,
    onClose,
}: ShippingLabelDialogProps) {
    useEffect(() => {
        if (!open) return;
        function handleKeyDown(e: KeyboardEvent) {
            if (e.key === "Escape") onClose();
        }
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:p-0">
            {/* Backdrop (hidden on print) */}
            <div
                className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity print:hidden"
                onClick={onClose}
            />

            {/* Modal Box */}
            <div className="relative z-10 flex max-h-[92vh] w-full max-w-5xl flex-col rounded-3xl bg-canvas shadow-2xl overflow-hidden print:max-h-none print:w-full print:rounded-none print:shadow-none print:bg-white">
                {/* Header (hidden on print) */}
                <div className="flex items-center justify-between border-b border-black/10 bg-white px-6 py-4 print:hidden">
                    <div>
                        <h2 className="text-[17px] font-extrabold text-teal-950">
                            Shipping Documents — Order #{order.orderNumber}
                        </h2>
                        <p className="text-[12px] text-muted">
                            Printable Canadian carrier shipping label, pallet skid placards, and Bill of Lading (BOL).
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="grid size-9 place-items-center rounded-xl text-muted hover:bg-soft-control hover:text-teal-950 transition-colors"
                        aria-label="Close"
                    >
                        <X className="size-5" />
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 print:p-0 print:overflow-visible">
                    <ShippingLabelView
                        order={order}
                        initialBoxes={boxes}
                        defaultDocType={defaultDocType}
                        onClose={onClose}
                    />
                </div>
            </div>
        </div>
    );
}
