import {Check, RotateCcw, X} from "lucide-react";
import type {OrderEventResponse, OrderStatus} from "@/lib/admin/types";

const FULL_TIMELINE: { status: OrderStatus; label: string; description: string }[] = [
    {status: "PENDING_PAYMENT", label: "Pending Payment", description: "Order placed, awaiting payment confirmation"},
    {status: "PAID", label: "Paid", description: "Payment received successfully"},
    {status: "PROCESSING", label: "Processing", description: "We are preparing your order"},
    {status: "PACKED", label: "Packed", description: "Your order has been packed"},
    {status: "SHIPPED", label: "Shipped", description: "Your order is on the way"},
    {status: "OUT_FOR_DELIVERY", label: "Out for Delivery", description: "Your order is out for delivery"},
    {status: "DELIVERED", label: "Delivered", description: "Your order has been delivered"},
];

const TERMINAL_STEP: Record<string, { label: string; description: string }> = {
    REFUNDED: {label: "Refunded", description: "This order has been refunded"},
    CANCELLED: {label: "Cancelled", description: "This order has been cancelled"},
};

function formatDate(at: string) {
    return new Date(at).toLocaleDateString("en-US", {month: "short", day: "numeric", year: "numeric"});
}

function formatTime(at: string) {
    return new Date(at).toLocaleTimeString("en-US", {hour: "numeric", minute: "2-digit"});
}

/** Vertical stepper of backend timeline events, plus a red terminal step if cancelled/refunded.
 * Shared by admin and portal order-detail pages. */
export function OrderTimeline({events}: { events: OrderEventResponse[] }) {
    const eventByStatus = new Map(events.map((event) => [event.status, event]));
    const terminalEvent = events.find((event) => event.status === "REFUNDED" || event.status === "CANCELLED");

    // Manual-payment checkouts emit AWAITING_PAYMENT_VERIFICATION instead of PENDING_PAYMENT;
    // either satisfies the "order placed" step.
    const placedEvent =
        eventByStatus.get("PENDING_PAYMENT") ?? eventByStatus.get("AWAITING_PAYMENT_VERIFICATION") ?? null;

    const steps = FULL_TIMELINE.map((step) => ({
        ...step,
        event: step.status === "PENDING_PAYMENT" ? placedEvent : eventByStatus.get(step.status) ?? null,
    }));

    const lastReachedIndex = steps.reduce(
        (last, step, index) => (step.event ? index : last),
        -1,
    );

    return (
        <ul>
            {steps.map((step, index) => {
                const reached = !!step.event;
                const isLast = index === steps.length - 1 && !terminalEvent;
                return (
                    <li key={step.status} className="relative flex gap-3 pb-6 last:pb-0">
                        {!isLast && (
                            <span
                                className="absolute left-[11px] top-6 -bottom-0 w-px bg-black/10"
                                aria-hidden
                            />
                        )}
                        <span
                            className={`z-10 grid size-6 shrink-0 place-items-center rounded-full ${
                                reached ? "bg-teal-950 text-white" : "bg-soft-control text-muted"
                            }`}
                        >
              {reached && <Check className="size-3.5" aria-hidden/>}
            </span>
                        <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-x-4 gap-y-0.5">
                            <div className="min-w-0">
                                <p className={`text-[13px] font-bold ${reached ? "text-teal-950" : "text-muted"}`}>
                                    {step.label}
                                </p>
                                <p className="text-[12px] text-muted">{step.description}</p>
                            </div>
                            {step.event && (
                                <div className="text-right text-[12px] text-muted">
                                    <p>{formatDate(step.event.at)}</p>
                                    <p>{formatTime(step.event.at)}</p>
                                </div>
                            )}
                        </div>
                    </li>
                );
            })}

            {terminalEvent && (
                <li className="relative flex gap-3">
          <span className="z-10 grid size-6 shrink-0 place-items-center rounded-full bg-coral/15 text-coral">
            {terminalEvent.status === "CANCELLED" ? (
                <X className="size-3.5" aria-hidden/>
            ) : (
                <RotateCcw className="size-3.5" aria-hidden/>
            )}
          </span>
                    <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-x-4 gap-y-0.5">
                        <div className="min-w-0">
                            <p className="text-[13px] font-bold text-coral">{TERMINAL_STEP[terminalEvent.status].label}</p>
                            <p className="text-[12px] text-muted">{TERMINAL_STEP[terminalEvent.status].description}</p>
                        </div>
                        <div className="text-right text-[12px] text-muted">
                            <p>{formatDate(terminalEvent.at)}</p>
                            <p>{formatTime(terminalEvent.at)}</p>
                        </div>
                    </div>
                </li>
            )}

            {lastReachedIndex === -1 && !terminalEvent && events.length > 0 && (
                // Fallback for statuses outside the known happy path - render raw events.
                <>
                    {events.map((event, index) => (
                        <li key={index} className="flex items-center justify-between py-1 text-[13px]">
                            <span className="font-semibold text-teal-950">{event.status.replace(/_/g, " ")}</span>
                            <span className="text-muted">{formatDate(event.at)} · {formatTime(event.at)}</span>
                        </li>
                    ))}
                </>
            )}
        </ul>
    );
}
