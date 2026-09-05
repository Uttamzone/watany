const TONE_CLASSES: Record<string, string> = {
    neutral: "bg-soft-control text-teal-900",
    positive: "bg-lime-500/25 text-teal-950",
    warning: "bg-gold/25 text-teal-950",
    negative: "bg-coral/15 text-coral",
    info: "bg-navy/10 text-navy",
};

const STATUS_TONE: Record<string, keyof typeof TONE_CLASSES> = {
    // Order statuses
    PENDING_PAYMENT: "warning",
    AWAITING_PAYMENT_VERIFICATION: "warning",
    PLACED: "info",
    PAID: "positive",
    PROCESSING: "warning",
    PACKED: "warning",
    SHIPPED: "info",
    OUT_FOR_DELIVERY: "info",
    DELIVERED: "positive",
    CANCELLED: "negative",
    REFUNDED: "negative",
    // Approval statuses
    NOT_REQUESTED: "neutral",
    PENDING: "warning",
    APPROVED: "positive",
    REJECTED: "negative",
    // Payment statuses
    AUTHORIZED: "info",
    CAPTURED: "positive",
    FAILED: "negative",
    PARTIALLY_REFUNDED: "warning",
    DISPUTED: "negative",
};

const STATUS_DESCRIPTIONS: Record<string, string> = {
    // Order statuses
    PENDING_PAYMENT: "Waiting for payment to be confirmed.",
    AWAITING_PAYMENT_VERIFICATION: "Customer chose E-Transfer or Cheque; waiting for an admin to verify receipt.",
    PLACED: "Order has been placed and is awaiting processing.",
    PAID: "Payment has been received in full.",
    PROCESSING: "Order is being prepared for shipment.",
    PACKED: "Order has been packed and is ready to ship.",
    SHIPPED: "Order has left the warehouse and is on its way.",
    OUT_FOR_DELIVERY: "Order is out for delivery today.",
    DELIVERED: "Order has been delivered.",
    CANCELLED: "Order has been cancelled.",
    REFUNDED: "Order has been refunded in full.",
    // Approval statuses
    NOT_REQUESTED: "No approval has been requested.",
    PENDING: "Waiting for approval.",
    APPROVED: "Request has been approved.",
    REJECTED: "Request has been rejected.",
    // Payment statuses
    AUTHORIZED: "Payment has been authorized but not yet captured.",
    CAPTURED: "Payment has been captured successfully.",
    FAILED: "Payment attempt failed.",
    PARTIALLY_REFUNDED: "Part of the payment has been refunded.",
    DISPUTED: "Payment is under dispute.",
};

export function StatusBadge({status}: { status: string }) {
    const tone = STATUS_TONE[status] ?? "neutral";
    const description = STATUS_DESCRIPTIONS[status];
    return (
        <span
            title={description}
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${TONE_CLASSES[tone]}`}
        >
      {status.replace(/_/g, " ")}
    </span>
    );
}
