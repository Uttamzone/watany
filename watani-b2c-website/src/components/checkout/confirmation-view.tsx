"use client";

import {useCallback, useEffect, useState} from "react";
import Link from "next/link";
import {CheckCircle2, Clock, Download, Loader2} from "lucide-react";
import {useCart} from "@/components/cart/cart-store";
import {useAuth} from "@/components/auth/auth-store";
import {useNotifications} from "@/components/notifications/notification-store";
import {
    clearCheckoutDraft,
    clearGuestOrderEmail,
    downloadInvoice,
    getOrder,
    lookupOrder,
    type Order,
    readGuestOrderEmail,
} from "@/lib/checkout";
import {formatCad} from "@/lib/types";
import {useCurrency} from "@/components/currency/currency-store";

/**
 * Order confirmation page Stripe returns the shopper to; guests authorize by order number + email.
 * Payment is confirmed by Stripe's webhook, not this page, so pending orders poll briefly.
 */

const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 5;

export function ConfirmationView({orderNumber}: { orderNumber: string }) {
    const {status} = useAuth();
    const {refresh} = useCart();
    const notifications = useNotifications();
    const {format, currency} = useCurrency();

    const [order, setOrder] = useState<Order | null>(null);
    const [email, setEmail] = useState("");
    /** Set when reading the order as the signed-in customer did not work. */
    const [ownReadFailed, setOwnReadFailed] = useState(false);
    const [ownReadDone, setOwnReadDone] = useState(false);
    /** Set once the silent lookup using a stashed guest email has run. */
    const [autoLookupDone, setAutoLookupDone] = useState(false);
    const [polls, setPolls] = useState(0);

    // Guests try the stashed checkout email silently first; only prompt if that's
    // missing/fails. Derived from auth status + lookup results, not stored.
    const needsEmail =
        !order && ((status === "guest" && autoLookupDone) || ownReadFailed);
    const loading =
        status === "loading" ||
        (status === "authenticated" && !ownReadDone && !order) ||
        (status === "guest" && !autoLookupDone && !order);

    // The saved checkout draft is spent - it is kept across the Stripe redirect
    // only so a *cancelled* payment can be retried, and reaching here means it
    // succeeded.
    useEffect(() => {
        clearCheckoutDraft();
    }, []);

    // Read the order silently using the email stashed by checkout, rather than
    // asking the shopper to retype what they just entered.
    //
    // set-state-in-effect is suppressed rather than satisfied below: the stash lives in
    // sessionStorage, which does not exist during the server render, so hoisting this
    // read into a lazy useState initialiser would desync hydration. An effect is the
    // correct place to read browser-only state.
    useEffect(() => {
        if (status !== "guest") return;

        const stashed = readGuestOrderEmail(orderNumber);
        if (!stashed) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setAutoLookupDone(true);
            return;
        }

        let cancelled = false;
        lookupOrder(orderNumber, stashed)
            .then((found) => {
                if (!cancelled) {
                    setEmail(stashed);
                    setOrder(found);
                    clearGuestOrderEmail(orderNumber);
                }
            })
            .catch(() => {
                // The stashed email may be stale or wrong; fall back to asking.
            })
            .finally(() => {
                if (!cancelled) setAutoLookupDone(true);
            });

        return () => {
            cancelled = true;
        };
    }, [status, orderNumber]);

    // A signed-in customer can read their own order directly. Guests skip this
    // and are asked for the email the order was placed with.
    useEffect(() => {
        if (status !== "authenticated") return;

        let cancelled = false;
        getOrder(orderNumber)
            .then((found) => {
                if (!cancelled) setOrder(found);
            })
            .catch(() => {
                // The order may have been placed as a guest before signing in, in
                // which case it is not in this account's history.
                if (!cancelled) setOwnReadFailed(true);
            })
            .finally(() => {
                if (!cancelled) setOwnReadDone(true);
            });

        return () => {
            cancelled = true;
        };
    }, [status, orderNumber]);

    /** Only CAPTURED means money moved; AUTHORIZED is a hold, reported as confirmed-not-charged. */
    const captured = order?.paymentStatus === "CAPTURED";
    const authorized = order?.paymentStatus === "AUTHORIZED";
    const paymentSettled = captured || authorized;

    // E-Transfer/Cheque only advance once an admin verifies receipt - nothing to poll for.
    const isManualPayment =
        order?.paymentMethod === "E_TRANSFER" || order?.paymentMethod === "CHEQUE";
    const awaitingVerification = order?.status === "AWAITING_PAYMENT_VERIFICATION";

    // The server empties the cart once the order is definitively placed - for
    // Stripe that's the CAPTURED/AUTHORIZED webhook, for E-Transfer/Cheque it is
    // immediate at placement. Refreshing only here (not on mount) avoids reading
    // the cart before that happens, which left the old line items showing in the
    // header after checkout.
    useEffect(() => {
        if (order && (isManualPayment || paymentSettled)) {
            void refresh();
        }
    }, [order, isManualPayment, paymentSettled, refresh]);

    // Landing here at all means checkout handed off, so re-read the cart once on mount
    // regardless of whether the order itself could be read. The effect above is gated on
    // a successfully loaded order, which never arrives for a guest returning from Stripe
    // whose order lookup is refused - and the header badge then kept the pre-order count
    // indefinitely. Re-reading is safe: the server decides what the cart holds.
    useEffect(() => {
        void refresh();
    }, [refresh]);

    // Stripe's webhook may land a moment after the shopper is redirected back.
    // Poll a few times rather than reporting an unpaid order as final.
    useEffect(() => {
        if (!order || isManualPayment || paymentSettled || polls >= MAX_POLLS) return;

        const timer = setTimeout(async () => {
            try {
                const refreshed =
                    status === "authenticated" && !ownReadFailed
                        ? await getOrder(orderNumber)
                        : await lookupOrder(orderNumber, order.email);
                setOrder(refreshed);
            } catch {
                // Keep the last known state; the next tick may succeed.
            } finally {
                setPolls((count) => count + 1);
            }
        }, POLL_INTERVAL_MS);

        return () => clearTimeout(timer);
    }, [order, isManualPayment, paymentSettled, polls, orderNumber, status, ownReadFailed]);

    const [lookingUp, setLookingUp] = useState(false);
    const [downloadingInvoice, setDownloadingInvoice] = useState(false);

    const handleDownloadInvoice = useCallback(async () => {
        if (!order) return;
        setDownloadingInvoice(true);
        try {
            const blob = await downloadInvoice(
                order.orderNumber,
                status === "authenticated" ? undefined : order.email,
                order,
            );
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `invoice-${order.orderNumber}.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
        } catch {
            const message = "Could not download the invoice. Try again in a moment.";
            notifications.error("Download failed", message);
        } finally {
            setDownloadingInvoice(false);
        }
    }, [order, status, notifications]);

    const lookUp = useCallback(
        async (event: React.FormEvent) => {
            event.preventDefault();
            setLookingUp(true);
            try {
                // Setting the order is what dismisses the email prompt - `needsEmail`
                // is derived from whether an order has been resolved.
                setOrder(await lookupOrder(orderNumber, email));
            } catch {
                const message =
                    "We could not find that order. Check the email you used to order.";
                notifications.error("Order not found", message);
            } finally {
                setLookingUp(false);
            }
        },
        [orderNumber, email, notifications],
    );

    if (loading) {
        return (
            <p className="mt-8 text-[15px] text-muted" role="status">
                Loading your order…
            </p>
        );
    }

    if (needsEmail && !order) {
        return (
            <div className="mt-8 max-w-md mx-auto rounded-[22px] bg-surface p-6">
                <p className="text-[16px] font-bold text-teal-950">
                    Thanks - your order {orderNumber} is placed.
                </p>
                <p className="mt-2 text-[14px] text-muted">
                    Enter the email you ordered with to see the details.
                </p>

                <form onSubmit={lookUp} className="mt-5">
                    <label className="block">
                        <span className="text-[13px] font-bold text-teal-950">Email</span>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            className="mt-1.5 h-12 w-full rounded-[14px] border border-black/10 bg-white px-4 text-[15px] text-teal-950"
                        />
                    </label>

                    <button
                        type="submit"
                        disabled={lookingUp}
                        className="mt-4 h-12 w-full rounded-full bg-lime-500 text-[15px] font-bold text-teal-950 disabled:opacity-60"
                    >
                        {lookingUp ? "Looking up…" : "View order"}
                    </button>
                </form>
            </div>
        );
    }

    if (!order) return null;

    return (
        <div className="mt-8 max-w-2xl mx-auto">
            <div className="rounded-[22px] bg-surface p-6">
                <div className="flex items-start gap-3">
                    {paymentSettled ? (
                        <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-lime-600" aria-hidden/>
                    ) : (
                        <Clock className="mt-0.5 size-6 shrink-0 text-gold" aria-hidden/>
                    )}
                    <div>
                        <h2 className="text-[20px] font-extrabold text-teal-950">
                            {paymentSettled
                                ? "Thank you - your order is confirmed"
                                : isManualPayment && awaitingVerification
                                    ? "Thank you - your order is placed"
                                    : "Thank you - we are confirming your payment"}
                        </h2>
                        <p className="mt-1 text-[14px] text-muted">
                            Order {order.orderNumber} · a receipt is on its way to {order.email}
                        </p>
                        {authorized && (
                            <p className="mt-2 text-[13px] text-muted">
                                Your payment is authorised and will be charged when your order
                                ships.
                            </p>
                        )}
                        {isManualPayment && awaitingVerification && (
                            <div className="mt-2 text-[13px] text-muted">
                                <p>
                                    Payment pending verification. Your order will ship once we
                                    confirm receipt.
                                </p>
                                {order.paymentMethod === "E_TRANSFER" && (
                                    <p className="mt-2">
                                        Send your e-transfer to: <strong>Wattany@yahoo.com</strong>.
                                    </p>
                                )}
                                {order.paymentMethod === "CHEQUE" && (
                                    <p className="mt-2">
                                        Make the cheque payable to:{" "}
                                        <strong>Watani &amp; Sons Corp</strong>.
                                    </p>
                                )}
                            </div>
                        )}
                        {!isManualPayment && !paymentSettled && polls < MAX_POLLS && (
                            <p className="mt-2 flex items-center gap-2 text-[13px] text-muted">
                                <Loader2 className="size-3.5 animate-spin" aria-hidden/>
                                Waiting for your bank to confirm. This page updates itself.
                            </p>
                        )}
                        {!isManualPayment && !paymentSettled && polls >= MAX_POLLS && (
                            <p className="mt-2 text-[13px] text-muted">
                                Confirmation is taking longer than usual. Your order is safe -
                                we will email you as soon as the payment settles.
                            </p>
                        )}
                    </div>
                </div>

                <hr className="my-5 border-black/[0.07]"/>

                <ul className="space-y-3">
                    {order.items.map((line) => (
                        <li key={line.sku} className="flex items-center justify-between gap-4">
              <span className="min-w-0">
                <span className="block truncate text-[14px] font-bold text-teal-950">
                  {line.productName}
                </span>
                <span className="text-[12px] text-muted">
                  {line.unit} · {line.quantity} × {format(line.unitPrice)}
                </span>
              </span>
                            <span className="text-[14px] font-extrabold text-teal-950">
                {format(line.lineTotal)}
              </span>
                        </li>
                    ))}
                </ul>

                <hr className="my-5 border-black/[0.07]"/>

                <dl className="space-y-2 text-[14px]">
                    <Row label="Total products" value={format(order.subtotal)}/>
                    {order.discountTotal > 0 && (
                        <Row label="Discount" value={`−${format(order.discountTotal)}`}/>
                    )}
                    <Row
                        label={`Shipping${order.shippingMethod ? ` · ${order.shippingMethod}` : ""}`}
                        value={order.shippingTotal === 0 ? "Free" : format(order.shippingTotal)}
                    />
                    <Row label="Total taxes" value={format(order.taxTotal)}/>
                </dl>

                <div className="mt-4 flex items-baseline justify-between border-t border-black/[0.07] pt-4">
          <span className="text-[15px] font-bold text-teal-950">
            {captured ? "Total paid" : "Order total"}
          </span>
                    <span className="text-[24px] font-extrabold text-teal-950">
            {format(order.grandTotal)}
          </span>
                </div>
                {currency !== "CAD" && (
                    <p className="mt-1 text-right text-[12px] text-muted">
                        Charged in CAD: {formatCad(order.grandTotal)}
                    </p>
                )}

                {order.shippingAddress && (
                    <p className="mt-5 text-[13px] leading-relaxed text-muted">
                        Shipping to {order.shippingAddress.fullName},{" "}
                        {order.shippingAddress.line1}, {order.shippingAddress.city},{" "}
                        {order.shippingAddress.region} {order.shippingAddress.postalCode}
                    </p>
                )}
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link
                    href="/categories"
                    className="inline-flex h-12 items-center rounded-full bg-lime-500 px-7 text-[15px] font-bold text-teal-950"
                >
                    Continue shopping
                </Link>
                {status === "authenticated" && (
                    <Link
                        href="/portal/orders"
                        className="inline-flex h-12 items-center rounded-full bg-soft-control px-7 text-[15px] font-bold text-teal-950"
                    >
                        View your orders
                    </Link>
                )}
                <button
                    type="button"
                    onClick={handleDownloadInvoice}
                    disabled={downloadingInvoice}
                    className="inline-flex h-12 items-center gap-2 rounded-full bg-soft-control px-7 text-[15px] font-bold text-teal-950 disabled:opacity-60"
                >
                    {downloadingInvoice ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden/>
                    ) : (
                        <Download className="size-4" aria-hidden/>
                    )}
                    {downloadingInvoice ? "Preparing…" : "Download invoice"}
                </button>
            </div>
        </div>
    );
}

function Row({label, value}: { label: string; value: string }) {
    return (
        <div className="flex justify-between">
            <dt className="text-muted">{label}</dt>
            <dd className="font-semibold text-teal-950">{value}</dd>
        </div>
    );
}
