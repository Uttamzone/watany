"use client";

import {useState, useEffect} from "react";
import {Check, Copy, ExternalLink, FileText, PackageCheck, Pencil, Printer, Trash2, Truck} from "lucide-react";
import * as adminApi from "@/lib/admin/api";
import type {AdminOrderDetail, OrderResponse, ShippingRateOption} from "@/lib/admin/types";
import {ApiError} from "@/lib/api";
import {useNotifications} from "@/components/notifications/notification-store";
import {ConfirmDialog} from "@/components/admin/confirm-dialog";
import {ShippingLabelDialog} from "@/components/admin/shipping-label-dialog";

function money(value: number, currency: string) {
    return new Intl.NumberFormat("en-CA", {style: "currency", currency}).format(value);
}

const CARRIER_PRESETS = [
    { label: "Canada Post (via Freightcom)", name: "Canada Post via Freightcom" },
    { label: "Purolator (via Freightcom)", name: "Purolator via Freightcom" },
    { label: "UPS (via Freightcom)", name: "UPS via Freightcom" },
    { label: "FedEx (via Freightcom)", name: "FedEx via Freightcom" },
    { label: "Day & Ross LTL (via Freightcom)", name: "Day & Ross LTL" },
    { label: "Freightcom Skid / Pallet", name: "Freightcom Pallet Delivery" },
    { label: "Other / Custom Carrier", name: "Other" },
];

function buildTrackingUrl(carrier: string, tracking: string): string {
    const trk = tracking.trim();
    if (!trk) return "";
    const cUpper = carrier.toUpperCase();
    const enc = encodeURIComponent(trk);
    if (cUpper.includes("PUROLATOR")) return `https://www.purolator.com/en/shipping/tracker?pins=${enc}`;
    if (cUpper.includes("UPS")) return `https://www.ups.com/track?tracknum=${enc}`;
    if (cUpper.includes("FEDEX")) return `https://www.fedex.com/fedextrack/?trknbr=${enc}`;
    if (cUpper.includes("DAY") || cUpper.includes("ROSS")) return `https://dayross.com/tracking?proNumber=${enc}`;
    if (cUpper.includes("POST") || cUpper.includes("CANADA")) return `https://www.canadapost-postescanada.ca/track-reperage/en#/details/${enc}`;
    if (cUpper.includes("FREIGHTCOM")) return `https://track.freightcom.com/track/${enc}`;
    return `https://www.canadapost-postescanada.ca/track-reperage/en#/details/${enc}`;
}

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

    // Custom Tracking Entry state
    const [carrierPreset, setCarrierPreset] = useState<string>("Canada Post (via Freightcom)");
    const [customCarrier, setCustomCarrier] = useState<string>("");
    const [trackingNumber, setTrackingNumber] = useState<string>(order.trackingNumber || "");
    const [customTrackingUrl, setCustomTrackingUrl] = useState<string>(order.trackingUrl || "");
    const [isEditingTracking, setIsEditingTracking] = useState(false);
    const [copied, setCopied] = useState(false);

    // Shipping Label & BOL dialog state
    const [labelDialogOpen, setLabelDialogOpen] = useState(false);
    const [labelDocType, setLabelDocType] = useState<"PARCEL" | "PALLET" | "BOL">("PARCEL");

    const isPalletShipment =
        order.shippingMethod?.toLowerCase().includes("pallet") ||
        order.shippingMethod?.toLowerCase().includes("skid") ||
        order.carrierName?.toLowerCase().includes("day") ||
        order.carrierName?.toLowerCase().includes("ross") ||
        order.carrierName?.toLowerCase().includes("ltl") ||
        order.pricingGroup === "DISTRIBUTOR" ||
        order.shippingTotal >= 140;

    useEffect(() => {
        setTrackingNumber(order.trackingNumber || "");
        setCustomTrackingUrl(order.trackingUrl || "");
    }, [order.trackingNumber, order.trackingUrl]);

    if (order.status !== "PACKED" && !order.trackingNumber) {
        return (
            <div id="ship" className="rounded-2xl bg-white p-5 shadow-card border border-dashed border-black/15 scroll-mt-20">
                <div className="flex items-center gap-2">
                    <Truck className="size-4 text-muted" aria-hidden/>
                    <h2 className="text-[15px] font-bold text-teal-950">Shipping &amp; carrier booking</h2>
                </div>
                <p className="mt-2 text-[12px] text-muted leading-relaxed">
                    Once you save packing in the <strong>Pack order &amp; merge boxes</strong> panel, this section unlocks to record carrier tracking numbers and book the shipment.
                </p>
            </div>
        );
    }

    function copyShippingInfo() {
        const addr = order.shippingAddress;
        const lines = [
            `Recipient: ${addr?.fullName || order.email}`,
            `Address: ${addr?.line1 || ""}`,
            `City: ${addr?.city || ""}, ${addr?.region || ""} ${addr?.postalCode || ""}`,
            `Country: ${addr?.country || "CA"}`,
            `Customer Email: ${order.email || ""}`,
            `Order #: ${order.orderNumber}`
        ];
        navigator.clipboard.writeText(lines.join("\n"));
        setCopied(true);
        notifications.success("Copied to clipboard", "Recipient address ready to paste into Freightcom.");
        setTimeout(() => setCopied(false), 3000);
    }

    async function handleSaveTracking() {
        const trk = trackingNumber.trim();
        if (!trk) {
            notifications.error("Tracking number required", "Please enter the tracking number provided by Freightcom.");
            return;
        }
        setBooking(true);
        try {
            const finalCarrier = carrierPreset === "Other" ? (customCarrier.trim() || "Carrier") : carrierPreset;
            const finalTrackingUrl = customTrackingUrl.trim() || buildTrackingUrl(finalCarrier, trk);

            const updated = await adminApi.bookShipment(order.orderNumber, {
                carrierName: finalCarrier,
                trackingNumber: trk,
                trackingUrl: finalTrackingUrl,
            });
            onBooked(updated);
            setIsEditingTracking(false);
            notifications.success("Shipment Recorded", `Order marked as shipped with tracking (${finalCarrier}).`);
        } catch (err) {
            notifications.error("Saving tracking failed", err instanceof ApiError ? err.message : "Saving tracking failed.");
        } finally {
            setBooking(false);
        }
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

    async function bookWithQuotedRate() {
        if (!selected) return;
        setBooking(true);
        try {
            const selectedRate = rates?.find((rate) => rate.serviceCode === selected);
            const updated = await adminApi.bookShipment(order.orderNumber, {
                serviceCode: selected,
                carrierName: selectedRate?.carrierName,
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
            setTrackingNumber("");
            setCustomTrackingUrl("");
            setIsEditingTracking(false);
            notifications.success("Shipment cancelled", "Shipment voided; the order can be re-quoted or rebooked.");
        } catch (err) {
            notifications.error("Cancelling shipment failed", err instanceof ApiError ? err.message : "Cancelling shipment failed.");
        } finally {
            setCancelling(false);
            setCancelOpen(false);
        }
    }

    return (
        <div id="ship" className="rounded-2xl bg-white p-5 shadow-card scroll-mt-20">
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <Truck className="size-4 text-teal-950" aria-hidden/>
                    <h2 className="text-[15px] font-bold text-teal-950">Shipping &amp; Carrier Fulfillment</h2>
                </div>
                <a
                    href="https://app.freightcom.com"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-full bg-soft-control border border-black/10 px-2.5 py-1 text-[11px] font-bold text-teal-950 hover:bg-black/5"
                >
                    <ExternalLink className="size-3" />
                    Open Freightcom
                </a>
            </div>

            {/* Freightcom Fast-Copy Helper */}
            <div className="mt-3 rounded-xl bg-soft-control/60 border border-black/5 p-3">
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Freightcom Booking Details</span>
                    <button
                        type="button"
                        onClick={copyShippingInfo}
                        className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 text-[11px] font-semibold text-teal-950 shadow-xs hover:bg-soft-control"
                    >
                        {copied ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3 text-muted" />}
                        {copied ? "Copied!" : "Copy Address"}
                    </button>
                </div>
                <p className="mt-1 text-[12px] text-teal-950 font-medium">
                    {order.shippingAddress?.fullName} — {order.shippingAddress?.line1}, {order.shippingAddress?.city}, {order.shippingAddress?.region} {order.shippingAddress?.postalCode}
                </p>
                <p className="mt-0.5 text-[11px] text-muted">
                    Method: <strong className="text-teal-950">{order.shippingMethod || "Standard Shipping"}</strong>
                </p>
            </div>

            {/* Already Shipped view (when not in edit mode) */}
            {order.trackingNumber && !isEditingTracking ? (
                <div className="mt-4">
                    <dl className="space-y-2 text-[13px]">
                        <div className="flex justify-between gap-3 border-b border-black/5 pb-1.5">
                            <dt className="text-muted">Carrier</dt>
                            <dd className="text-right font-semibold text-teal-950">{order.carrierName ?? "Freightcom Carrier"}</dd>
                        </div>
                        <div className="flex justify-between gap-3 border-b border-black/5 pb-1.5">
                            <dt className="text-muted">Tracking Number</dt>
                            <dd className="text-right font-mono font-bold text-teal-950">
                                {order.trackingUrl ? (
                                    <a
                                        href={order.trackingUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1 text-teal-700 underline underline-offset-2 hover:text-teal-900"
                                    >
                                        {order.trackingNumber}
                                        <ExternalLink className="size-3" />
                                    </a>
                                ) : (
                                    order.trackingNumber
                                )}
                            </dd>
                        </div>
                        {carrierCost !== null && (
                            <div className="flex justify-between gap-3 border-b border-black/5 pb-1.5">
                                <dt className="text-muted">Carrier Cost (internal)</dt>
                                <dd className="text-right text-teal-950">{money(carrierCost, order.currency)}</dd>
                            </div>
                        )}
                    </dl>

                    <div className="mt-4 flex items-center gap-2">
                        {order.trackingUrl && (
                            <a
                                href={order.trackingUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-teal-950 text-[13px] font-bold text-white shadow-xs transition-colors hover:bg-teal-900"
                            >
                                <PackageCheck className="size-4" aria-hidden/>
                                Track Shipment
                            </a>
                        )}
                        <button
                            type="button"
                            onClick={() => setIsEditingTracking(true)}
                            className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-black/15 bg-white px-3 text-[13px] font-bold text-teal-950 shadow-xs transition-colors hover:bg-soft-control"
                        >
                            <Pencil className="size-3.5 text-muted" />
                            Edit Tracking
                        </button>
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

                    {/* Official Shipping Documents / Printable Labels Card */}
                    <div className="mt-4 rounded-xl border border-teal-950/15 bg-teal-50/50 p-3.5">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Printer className="size-4 text-teal-950" />
                                <span className="text-[12px] font-extrabold text-teal-950 uppercase tracking-wide">
                                    Shipping Documents &amp; Labels
                                </span>
                            </div>
                            <a
                                href={`/admin/orders/${order.orderNumber}/shipping-label`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] font-bold text-teal-700 hover:text-teal-950 inline-flex items-center gap-1"
                            >
                                Open in new tab <ExternalLink className="size-3" />
                            </a>
                        </div>
                        <div className="mt-2.5 flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setLabelDocType(isPalletShipment ? "PALLET" : "PARCEL");
                                    setLabelDialogOpen(true);
                                }}
                                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-teal-950 px-3 py-2 text-[12px] font-bold text-white shadow-xs hover:bg-teal-900 transition-colors"
                            >
                                <Printer className="size-3.5" />
                                {isPalletShipment ? "Print Pallet Placards" : "Print Shipping Label (4×6)"}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setLabelDocType("BOL");
                                    setLabelDialogOpen(true);
                                }}
                                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-black/15 bg-white px-3.5 py-2 text-[12px] font-bold text-teal-950 shadow-xs hover:bg-soft-control transition-colors"
                            >
                                <FileText className="size-3.5 text-muted" />
                                Bill of Lading (BOL)
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                /* Tracking Entry / Edit Form */
                <div className="mt-4 space-y-3">
                    <p className="text-[12px] text-muted">
                        After booking your shipment on <strong>Freightcom</strong>, enter the carrier and tracking number below to notify the customer and mark the order as shipped:
                    </p>

                    <div>
                        <label className="block text-[12px] font-bold text-teal-950 mb-1">
                            Carrier
                        </label>
                        <select
                            value={carrierPreset}
                            onChange={(e) => {
                                setCarrierPreset(e.target.value);
                                if (trackingNumber.trim()) {
                                    setCustomTrackingUrl(buildTrackingUrl(e.target.value, trackingNumber.trim()));
                                }
                            }}
                            className="h-10 w-full rounded-xl border border-black/15 bg-white px-3 text-[13px] text-teal-950 focus:border-teal-950 focus:outline-none"
                        >
                            {CARRIER_PRESETS.map((cp) => (
                                <option key={cp.label} value={cp.name}>
                                    {cp.label}
                                </option>
                            ))}
                        </select>
                        {carrierPreset === "Other" && (
                            <input
                                type="text"
                                placeholder="Enter custom carrier name"
                                value={customCarrier}
                                onChange={(e) => setCustomCarrier(e.target.value)}
                                className="mt-2 h-10 w-full rounded-xl border border-black/15 bg-white px-3 text-[13px] text-teal-950 focus:border-teal-950 focus:outline-none"
                            />
                        )}
                    </div>

                    <div>
                        <label className="block text-[12px] font-bold text-teal-950 mb-1">
                            Tracking Number / PRO #
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. 123456789012 or PRO-987654"
                            value={trackingNumber}
                            onChange={(e) => {
                                setTrackingNumber(e.target.value);
                                setCustomTrackingUrl(buildTrackingUrl(carrierPreset === "Other" ? customCarrier : carrierPreset, e.target.value));
                            }}
                            className="h-10 w-full rounded-xl border border-black/15 bg-white px-3 font-mono text-[13px] text-teal-950 focus:border-teal-950 focus:outline-none"
                        />
                    </div>

                    <div>
                        <label className="block text-[12px] font-bold text-teal-950 mb-1">
                            Tracking Link (auto-generated)
                        </label>
                        <input
                            type="url"
                            placeholder="https://..."
                            value={customTrackingUrl}
                            onChange={(e) => setCustomTrackingUrl(e.target.value)}
                            className="h-10 w-full rounded-xl border border-black/15 bg-white px-3 text-[12px] text-muted focus:border-teal-950 focus:outline-none"
                        />
                    </div>

                    <div className="pt-1 flex items-center gap-2">
                        <button
                            type="button"
                            disabled={booking || !trackingNumber.trim()}
                            onClick={handleSaveTracking}
                            className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-teal-950 text-[13px] font-bold text-white shadow-xs transition-colors hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            <Truck className="size-4" />
                            {booking ? "Saving…" : order.trackingNumber ? "Update Tracking" : "Mark as Shipped & Save Tracking"}
                        </button>
                        {isEditingTracking && (
                            <button
                                type="button"
                                onClick={() => setIsEditingTracking(false)}
                                className="h-10 rounded-xl border border-black/15 px-3 text-[13px] font-bold text-muted hover:bg-soft-control"
                            >
                                Cancel
                            </button>
                        )}
                    </div>

                    {/* Optional: Live rate estimation fallback */}
                    <div className="mt-4 border-t border-black/5 pt-3">
                        <button
                            type="button"
                            disabled={quoting}
                            onClick={getRates}
                            className="text-[12px] font-semibold text-muted hover:text-teal-950 underline"
                        >
                            {quoting ? "Calculating rates…" : "Optional: Get live estimated carrier rates"}
                        </button>

                        {rates && rates.length > 0 && (
                            <div className="mt-2 space-y-1.5">
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
                                                onChange={() => {
                                                    setSelected(rate.serviceCode);
                                                    setCarrierPreset(rate.carrierName);
                                                }}
                                            />
                                            <span className="font-semibold text-teal-950">
                                                {rate.carrierName} · {rate.serviceName}
                                            </span>
                                        </span>
                                        <span className="font-bold text-teal-950">
                                            {money(rate.carrierCost, order.currency)}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            <ConfirmDialog
                open={cancelOpen}
                title="Cancel/void this shipment?"
                description="Cancels tracking and reverts this order status back to Packed so you can re-enter or book a different shipment."
                confirmLabel={cancelling ? "Cancelling…" : "Cancel shipment"}
                danger
                onCancel={() => setCancelOpen(false)}
                onConfirm={cancelShipment}
            />

            <ShippingLabelDialog
                open={labelDialogOpen}
                order={order}
                defaultDocType={labelDocType}
                onClose={() => setLabelDialogOpen(false)}
            />
        </div>
    );
}
