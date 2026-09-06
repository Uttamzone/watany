"use client";

import {useState} from "react";
import {PackageCheck, Trash2, Truck} from "lucide-react";
import * as adminApi from "@/lib/admin/api";
import type {AdminOrderDetail, OrderResponse, ShippingRateOption} from "@/lib/admin/types";
import {ApiError} from "@/lib/api";
import {useNotifications} from "@/components/notifications/notification-store";
import {ConfirmDialog} from "@/components/admin/confirm-dialog";

function money(value: number, currency: string) {
    return new Intl.NumberFormat("en-CA", {style: "currency", currency}).format(value);
}

/**
 * Rate-shop and book a shipment from an order's saved fulfillment boxes.
 * Only reachable once the order is PACKED - the backend enforces this too.
 */
export function OrderShipPanel({
                                    order,
                                    carrierCost,
                                    onBooked,
                                }: {
    order: OrderResponse;
    /** Currently recorded carrier cost, if a shipment was already booked - shown for context only. */
    carrierCost: number | null;
    onBooked: (detail: AdminOrderDetail) => void;
}) {
    const notifications = useNotifications();
    const [rates, setRates] = useState<ShippingRateOption[] | null>(null);
    const [quoting, setQuoting] = useState(false);
    const [selected, setSelected] = useState<string | null>(null);
    const [booking, setBooking] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const [cancelOpen, setCancelOpen] = useState(false);

    if (order.status !== "PACKED" && !order.trackingNumber) {
        return (
            <div id="ship" className="rounded-2xl bg-white p-5 shadow-card border border-dashed border-black/15 scroll-mt-20">
                <div className="flex items-center gap-2">
                    <Truck className="size-4 text-muted" aria-hidden/>
                    <h2 className="text-[15px] font-bold text-teal-950">Shipping &amp; carrier booking</h2>
                </div>
                <p className="mt-2 text-[12px] text-muted leading-relaxed">
                    Once you save packing in the <strong>Pack order &amp; merge boxes</strong> panel, this section unlocks to calculate carrier rates and book the shipment with tracking.
                </p>
            </div>
        );
    }

    async function getRates() {
        setQuoting(true);
        setRates(null);
        setSelected(null);
        try {
            const result = await adminApi.quoteShippingRates(order.orderNumber);
            setRates(result);
            if (result.length > 0) setSelected(result[0].serviceCode);
        } catch (err) {
            notifications.error("Getting rates failed", err instanceof ApiError ? err.message : "Getting rates failed.");
        } finally {
            setQuoting(false);
        }
    }

    async function book() {
        if (!selected) return;
        setBooking(true);
        try {
            const selectedRate = rates?.find((rate) => rate.serviceCode === selected);
            const updated = await adminApi.bookShipment(order.orderNumber, {
                serviceCode: selected,
                carrierCost: selectedRate?.carrierCost,
                packagingType: selectedRate?.packagingType,
            });
            onBooked(updated);
            notifications.success("Shipment booked", "Shipment booked and tracking attached.");
        } catch (err) {
            notifications.error("Booking shipment failed", err instanceof ApiError ? err.message : "Booking shipment failed.");
        } finally {
            setBooking(false);
        }
    }

    async function cancelShipment() {
        setCancelling(true);
        try {
            const updated = await adminApi.cancelShipment(order.orderNumber);
            onBooked(updated);
            setRates(null);
            setSelected(null);
            notifications.success("Shipment cancelled", "Shipment voided; the order can be re-quoted and rebooked.");
        } catch (err) {
            notifications.error("Cancelling shipment failed", err instanceof ApiError ? err.message : "Cancelling shipment failed.");
        } finally {
            setCancelling(false);
            setCancelOpen(false);
        }
    }

    return (
        <div id="ship" className="rounded-2xl bg-white p-5 shadow-card scroll-mt-20">
            <div className="flex items-center gap-2">
                <Truck className="size-4 text-teal-950" aria-hidden/>
                <h2 className="text-[15px] font-bold text-teal-950">Shipping & tracking</h2>
            </div>

            {order.trackingNumber ? (
                <dl className="mt-3 space-y-1.5 text-[13px]">
                    <div className="flex justify-between gap-3">
                        <dt className="text-muted">Carrier</dt>
                        <dd className="text-right font-semibold text-teal-950">{order.carrierName ?? "—"}</dd>
                    </div>
                    {order.shippingMethod && (
                        <div className="flex justify-between gap-3">
                            <dt className="text-muted">Service</dt>
                            <dd className="text-right text-teal-950">{order.shippingMethod}</dd>
                        </div>
                    )}
                    <div className="flex justify-between gap-3">
                        <dt className="text-muted">Tracking #</dt>
                        <dd className="text-right font-semibold text-teal-950">
                            {order.trackingUrl ? (
                                <a
                                    href={order.trackingUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="underline decoration-dotted underline-offset-2 hover:text-coral"
                                >
                                    {order.trackingNumber}
                                </a>
                            ) : (
                                order.trackingNumber
                            )}
                        </dd>
                    </div>
                    {carrierCost !== null && (
                        <div className="flex justify-between gap-3">
                            <dt className="text-muted">Carrier cost (internal)</dt>
                            <dd className="text-right text-teal-950">{money(carrierCost, order.currency)}</dd>
                        </div>
                    )}
                </dl>
            ) : (
                <>
                    <p className="mt-2 text-[12px] text-muted">
                        Order is packed. Get a live rate, then book the shipment.
                    </p>

                    <button
                        type="button"
                        disabled={quoting}
                        onClick={getRates}
                        className="mt-3 h-10 w-full rounded-xl bg-soft-control text-[13px] font-bold text-teal-950 transition-colors hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        {quoting ? "Getting rates…" : "Get shipping rates"}
                    </button>

                    {rates && rates.length === 0 && (
                        <p className="mt-2 text-[12px] text-coral">No rates returned. Try again shortly.</p>
                    )}

                    {rates && rates.length > 0 && (
                        <div className="mt-3">
                            {/* Roughly 3 rows visible; the rest scrolls within the panel instead of growing it. */}
                            <div className="max-h-[168px] space-y-1.5 overflow-y-auto pr-1">
                                {rates.map((rate) => (
                                    <label
                                        key={rate.serviceCode}
                                        className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-2 text-[13px] transition-colors ${
                                            selected === rate.serviceCode
                                                ? "border-teal-950 bg-soft-control"
                                                : "border-black/10 hover:bg-soft-control/60"
                                        }`}
                                    >
                                        <span className="flex items-center gap-2">
                                            <input
                                                type="radio"
                                                name="shipping-rate"
                                                checked={selected === rate.serviceCode}
                                                onChange={() => setSelected(rate.serviceCode)}
                                            />
                                            <span>
                                                <span className="flex items-center gap-1.5">
                                                    <span className="font-semibold text-teal-950">
                                                        {rate.carrierName} · {rate.serviceName}
                                                    </span>
                                                    <span
                                                        className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                                                            rate.packagingType === "PALLET"
                                                                ? "bg-amber-100 text-amber-800"
                                                                : "bg-sky-100 text-sky-800"
                                                        }`}
                                                    >
                                                        {rate.packagingType === "PALLET" ? "Pallet" : "Parcel"}
                                                    </span>
                                                </span>
                                                {rate.etaDays != null && (
                                                    <span className="text-[11px] text-muted">~{rate.etaDays} day(s)</span>
                                                )}
                                            </span>
                                        </span>
                                        <span className="shrink-0 text-right">
                                            <span className="block font-bold text-teal-950">
                                                {money(rate.cost, order.currency)}
                                            </span>
                                            <span className="block text-[11px] text-muted">
                                                cost: {money(rate.carrierCost, order.currency)}
                                            </span>
                                        </span>
                                    </label>
                                ))}
                            </div>

                            <button
                                type="button"
                                disabled={booking || !selected}
                                onClick={book}
                                className="mt-2 h-10 w-full rounded-xl bg-teal-950 text-[13px] font-bold text-white transition-colors hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                {booking ? "Booking…" : "Book shipment"}
                            </button>
                        </div>
                    )}
                </>
            )}

            {order.trackingNumber && (
                <div className="mt-3 flex items-center gap-2">
                    {order.labelUrl && (
                        <a
                            href={order.labelUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-soft-control text-[13px] font-bold text-teal-950 transition-colors hover:bg-black/5"
                        >
                            <PackageCheck className="size-4" aria-hidden/>
                            View shipping label
                        </a>
                    )}
                    <button
                        type="button"
                        title="Cancel/void shipment"
                        aria-label="Cancel/void shipment"
                        disabled={cancelling}
                        onClick={() => setCancelOpen(true)}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-coral/30 text-coral transition-colors hover:bg-coral/10 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        <Trash2 className="size-4" aria-hidden/>
                    </button>
                </div>
            )}

            <ConfirmDialog
                open={cancelOpen}
                title="Cancel/void this shipment?"
                description="Cancels the shipment and tracking with the carrier. The order returns to a rebook-ready state so you can get fresh rates and book again."
                confirmLabel={cancelling ? "Cancelling…" : "Cancel shipment"}
                danger
                onCancel={() => setCancelOpen(false)}
                onConfirm={cancelShipment}
            />
        </div>
    );
}
