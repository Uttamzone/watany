"use client";

import {useCallback, useEffect, useMemo, useState} from "react";
import Image from "next/image";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {Loader2, Lock, MapPin} from "lucide-react";
import {useCart} from "@/components/cart/cart-store";
import {useAuth} from "@/components/auth/auth-store";
import {useNotifications} from "@/components/notifications/notification-store";
import {productImageSrc} from "@/lib/products";
import {
    type Address,
    clearCheckoutDraft,
    clearIdempotencyKey,
    COUNTRIES,
    currentIdempotencyKey,
    getShippingQuotes,
    hasRegionList,
    type PaymentMethod,
    PICKUP_SERVICE_CODE,
    placeOrder,
    postalLabelFor,
    readCheckoutDraft,
    regionLabelFor,
    regionsFor,
    saveCheckoutDraft,
    type ShippingOption,
    stashGuestOrderEmail,
    validateAddressField,
} from "@/lib/checkout";
import {listMyAddresses, type SavedAddress} from "@/lib/portal/api";
import {formatCad} from "@/lib/types";
import {useCurrency} from "@/components/currency/currency-store";

/**
 * Checkout (requirement.md §4.2). Two steps - address, then shipping quote + payment - since
 * shipping/tax need a destination first. Guests may check out (OQ-5); payment is on Stripe's hosted page.
 */

type Step = "details" | "shipping";

/** In-house flat-rate code while carrier credentials are pending; shown as a range, not a single ETA. */
const FIX_FIELDS_MESSAGE =
    "Please fix the highlighted fields before continuing.";

const PENDING_SERVICE_CODE = "FC-PENDING";
const PENDING_ETA_RANGE = "7-21";

function formatEta(quote: ShippingOption) {
    if (quote.serviceCode === PICKUP_SERVICE_CODE) {
        return " · ready for pickup at our warehouse";
    }
    if (quote.serviceCode === PENDING_SERVICE_CODE) {
        return ` · about ${PENDING_ETA_RANGE} business days`;
    }
    if (quote.etaDays === null) return "";
    return ` · about ${quote.etaDays} business days`;
}

/**
 * Field-level validation (mirrors OrderDtos.AddressRequest/CheckoutRequest) - UX only,
 * server still validates independently. Errors show only after blur or submit attempt.
 */
type FieldName =
    | "email"
    | "fullName"
    | "line1"
    | "city"
    | "region"
    | "postalCode"
    | "phone";

/** Deliberately permissive: real address validity is the carrier's call. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validateField(
    field: FieldName,
    value: string,
    country: string,
): string | null {
    if (field === "email") {
        const trimmed = value.trim();
        if (!trimmed) return "Email is required.";
        if (!EMAIL_PATTERN.test(trimmed))
            return "Enter a valid email address, e.g. name@example.com.";
        return null;
    }
    return validateAddressField(field, value, country);
}

const EMPTY_ADDRESS: Address = {
    fullName: "",
    line1: "",
    line2: "",
    city: "",
    region: "ON",
    postalCode: "",
    country: "CA",
    phone: "",
};

export function CheckoutView() {
    const {lines, subtotal, hydrated, refresh: refreshCart} = useCart();
    const {user, status} = useAuth();
    const router = useRouter();
    const notifications = useNotifications();
    const {format, currency} = useCurrency();

    const [step, setStep] = useState<Step>("details");
    const [note, setNote] = useState("");

    useEffect(() => {
        window.scrollTo(0, 0);
    }, [step]);

    /**
     * Restores a saved draft once on mount - recovers the form after a reload or a
     * cancelled Stripe redirect. Read in an effect (not a lazy initialiser) so the
     * server and first client render agree; `restored` gates saving so the empty
     * initial state cannot overwrite the stored draft before it is read back.
     */
    const [restored, setRestored] = useState(false);

    // Each field holds "what the shopper typed, or null for untouched", falling back to the
    // account value at render - avoids a copy-in-effect that would fight the user's edits.
    const [emailInput, setEmailInput] = useState<string | null>(null);
    const [addressInput, setAddressInput] = useState<Address | null>(null);

    const email = emailInput ?? user?.email ?? "";
    const address = useMemo<Address>(
        () =>
            addressInput ?? {
                ...EMPTY_ADDRESS,
                fullName: user
                    ? [user.firstName, user.lastName].filter(Boolean).join(" ")
                    : "",
                phone: user?.phone ?? "",
            },
        [addressInput, user],
    );

    const setEmail = setEmailInput;

    // Declared here (above the restore effect) so a saved draft can seed it.
    // Only admin-approved credit accounts may pick E-Transfer/Cheque; backend re-checks this too.
    const [paymentMethodInput, setPaymentMethod] = useState<PaymentMethod>("STRIPE");

    const canUseManualPayment =
        status === "authenticated" && user?.pricingGroup === "DISTRIBUTOR";

    // Derived, not corrected via an effect: an effect let an ineligible account's
    // non-Stripe choice survive one render, during which pay() would have submitted it.
    // Deriving means the ineligible case can never be read at all. The backend re-checks
    // this regardless (N-SEC-3).
    const paymentMethod: PaymentMethod = canUseManualPayment ? paymentMethodInput : "STRIPE";

    const [quotes, setQuotes] = useState<ShippingOption[]>([]);
    const [serviceCode, setServiceCode] = useState<string | null>(null);
    const [quoting, setQuoting] = useState(false);

    // Restore before anything can be typed; runs once.
    //
    // set-state-in-effect is suppressed rather than satisfied here: the rule's usual fix
    // is a lazy useState initialiser, but reading localStorage during render would make
    // the first client render disagree with the server's (which has no storage) and
    // produce a hydration mismatch. Reading in an effect is the correct pattern for
    // browser-only state - see the `restored` doc comment above.
    /* eslint-disable react-hooks/set-state-in-effect */
    useEffect(() => {
        const draft = readCheckoutDraft();
        let targetAddress = address;
        if (draft) {
            // Only adopt a draft email/address - never clobber a signed-in shopper's
            // account email with an empty string from a partially-filled draft.
            if (draft.email) setEmailInput(draft.email);
            setAddressInput(draft.address);
            targetAddress = draft.address;
            setNote(draft.note);
            setPaymentMethod(draft.paymentMethod);
            if (draft.serviceCode) setServiceCode(draft.serviceCode);
        }

        let shouldGoToShipping = false;
        let isCanceled = false;

        if (typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search);
            if (params.get("canceled") === "1") {
                isCanceled = true;
                // Clean the query parameters so canceling payment doesn't permanently leave URL dirty
                const cleanUrl = window.location.pathname;
                window.history.replaceState({}, "", cleanUrl);
            } else if (params.get("step") === "shipping") {
                shouldGoToShipping = true;
            }
        }

        // Only transition to shipping if user explicitly requested it via URL (not canceled) and address exists
        if (shouldGoToShipping && !isCanceled && targetAddress?.line1 && targetAddress?.city) {
            getShippingQuotes(targetAddress)
                .then((options) => {
                    setQuotes(options);
                    const code = draft?.serviceCode && options.some((o) => o.serviceCode === draft.serviceCode)
                        ? draft.serviceCode
                        : (options[0]?.serviceCode ?? null);
                    setServiceCode(code);
                    setStep("shipping");
                })
                .catch(() => {
                    setStep("details");
                });
        } else {
            setStep("details");
            if (isCanceled) {
                notifications.info(
                    "Checkout returned",
                    "Payment was not completed. Your details are saved below; review or update them before proceeding.",
                );
            }
        }

        setRestored(true);
    }, []);
    /* eslint-enable react-hooks/set-state-in-effect */

    // Offered as an opt-in card, never applied silently - the shopper decides whether
    // to fill the form from their saved address (only worth fetching once a draft
    // hasn't already supplied one, and only for a signed-in account).
    const [savedAddress, setSavedAddress] = useState<SavedAddress | null>(null);
    const [savedAddressApplied, setSavedAddressApplied] = useState(false);
    const [savedAddressDismissed, setSavedAddressDismissed] = useState(false);

    useEffect(() => {
        if (status !== "authenticated" || addressInput) return;
        listMyAddresses()
            .then((addresses) => {
                const preferred = addresses.find((a) => a.defaultShipping) ?? addresses[0] ?? null;
                setSavedAddress(preferred);
            })
            .catch(() => {
                // Non-critical: the shopper can still fill the form manually.
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status]);

    function applySavedAddress() {
        if (!savedAddress) return;
        setAddressInput({
            fullName: savedAddress.fullName,
            line1: savedAddress.line1,
            line2: savedAddress.line2 ?? "",
            city: savedAddress.city,
            region: savedAddress.region,
            postalCode: savedAddress.postalCode,
            country: savedAddress.country,
            phone: savedAddress.phone ?? "",
        });
        setSavedAddressApplied(true);
    }

    // Mirror the form to storage on every change, so an unload at any moment - a
    // refresh, or the hand-off to Stripe - loses nothing. Gated on `restored` so
    // the initial empty state cannot overwrite the draft we are about to read.
    useEffect(() => {
        if (!restored) return;
        saveCheckoutDraft({email, address, note, paymentMethod, step, serviceCode});
    }, [restored, email, address, note, paymentMethod, step, serviceCode]);

    // Which fields have been blurred (or forced visible by submit). Errors are
    // recomputed each render rather than stored, to avoid two sources of truth.
    const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({});
    const markTouched = useCallback(
        (field: FieldName) => () =>
            setTouched((current) => ({...current, [field]: true})),
        [],
    );

    const errors = useMemo<Partial<Record<FieldName, string>>>(() => {
        const values: Record<FieldName, string> = {
            email,
            fullName: address.fullName,
            line1: address.line1,
            city: address.city,
            region: address.region,
            postalCode: address.postalCode,
            phone: address.phone ?? "",
        };
        const result: Partial<Record<FieldName, string>> = {};
        for (const key of Object.keys(values) as FieldName[]) {
            // A region picked from a select can never be blank or malformed, so it
            // is exempt rather than reported as an error the shopper cannot fix.
            if (key === "region" && hasRegionList(address.country)) continue;
            const message = validateField(key, values[key], address.country);
            if (message) result[key] = message;
        }
        return result;
    }, [email, address]);

    const detailsValid = Object.keys(errors).length === 0;

    const [placing, setPlacing] = useState(false);
    /** Set once an order exists, so emptying the cart cannot bounce us to /cart. */
    const [placed, setPlaced] = useState(false);

    /**
     * Stable across reloads, not just across this mount (F-CRT-11). A per-mount key made
     * idempotency useless in the case it exists for: if the response to a successful
     * placement is lost, the order is already placed and the cart already emptied, and a
     * reloaded page resubmitting under a fresh key was told "Your cart is empty".
     */
    const [idempotencyKey] = useState(() => currentIdempotencyKey());

    /** Redirect back to /cart when empty, unless we just placed an order (which also empties it). */
    useEffect(() => {
        if (hydrated && lines.length === 0 && !placed) {
            router.replace("/cart");
        }
    }, [hydrated, lines.length, placed, router]);

    const selectedQuote = useMemo(
        () => quotes.find((quote) => quote.serviceCode === serviceCode) ?? null,
        [quotes, serviceCode],
    );

    // Edits promote the derived address into state, from which point it is the
    // shopper's own and no longer tracks the account.
    const update = useCallback(
        (field: keyof Address) => (value: string) =>
            setAddressInput((current) => ({...(current ?? address), [field]: value})),
        [address],
    );

    // Switching country resets region to that country's first option (or empty
    // for free-text countries) so a stale region never gets submitted.
    const updateCountry = useCallback(
        (countryCode: string) =>
            setAddressInput((current) => ({
                ...(current ?? address),
                country: countryCode,
                region: regionsFor(countryCode)[0]?.code ?? "",
            })),
        [address],
    );

    const goToDetails = useCallback(() => {
        setStep("details");
        if (typeof window !== "undefined") {
            const url = new URL(window.location.href);
            url.searchParams.delete("step");
            url.searchParams.delete("canceled");
            window.history.replaceState({}, "", url.pathname + (url.search ? url.search : ""));
        }
    }, []);

    async function goToShipping(event: React.FormEvent) {
        event.preventDefault();

        // Reveal all messages at once - `noValidate` is set, so there's no native bubble.
        if (!detailsValid) {
            setTouched({
                email: true,
                fullName: true,
                line1: true,
                city: true,
                region: true,
                postalCode: true,
                phone: true,
            });
            notifications.warning("Check your details", FIX_FIELDS_MESSAGE);
            return;
        }

        setQuoting(true);
        try {
            const cartItems = lines.map((l) => ({
                variantId: l.variantId,
                quantity: l.quantity,
            }));
            const options = await getShippingQuotes(address, cartItems);
            setQuotes(options);
            setServiceCode(options[0]?.serviceCode ?? null);
            setStep("shipping");
        } catch (cause) {
            const message =
                cause instanceof Error
                    ? cause.message
                    : "We could not work out shipping for that address";
            notifications.error("Shipping unavailable", message);
        } finally {
            setQuoting(false);
        }
    }

    async function pay() {
        if (!serviceCode) return;
        setPlacing(true);

        try {
            const result = await placeOrder({
                email,
                shippingAddress: address,
                shippingServiceCode: serviceCode,
                customerNote: note || undefined,
                idempotencyKey,
                paymentMethod,
                items: lines.map((l) => ({
                    variantId: l.variantId,
                    quantity: l.quantity,
                })),
            });

            if (result.redirectUrl) {
                setPlaced(true);
                // Stripe's success URL carries only the order number, so stash the email
                // to recognise a returning guest without asking them to retype it.
                stashGuestOrderEmail(result.order.orderNumber, email);
                // The key stays until payment settles: a cancelled Stripe payment comes
                // back here to retry, and that retry must replay this same order attempt.
                // Hand off to Stripe's hosted page. A full navigation, not a router
                // push: the destination is outside this app.
                window.location.href = result.redirectUrl;
                return;
            }

            if (!result.order || !result.order.orderNumber) {
                throw new Error(
                    "Payment could not be started. Your order has not been placed.",
                );
            }

            setPlaced(true);
            // Settled without a redirect - the draft has served its purpose. The Stripe
            // path above deliberately keeps it, so a cancelled payment can be retried.
            clearCheckoutDraft();
            // Placement is confirmed, so this basket's key is spent; the next order mints
            // a fresh one rather than replaying this order forever.
            clearIdempotencyKey();
            stashGuestOrderEmail(result.order.orderNumber, email);
            // The server emptied the cart at placement. Re-read it now rather than leaving
            // the header badge showing the pre-order count - the confirmation page only
            // refreshes once it has successfully loaded the order, which never happens for
            // a guest whose order read is refused.
            await refreshCart();
            router.push(
                `/checkout/confirmation?order=${encodeURIComponent(result.order.orderNumber)}`,
            );
        } catch (cause) {
            // Keep this key for retries. If the first response was lost after Stripe
            // created the session, changing it here could create a second payment.
            const message =
                cause instanceof Error
                    ? cause.message
                    : "We could not place your order. Nothing has been charged.";
            notifications.error("We could not place your order", message);
            setPlacing(false);

            // A failure can still have emptied the cart server-side (placement clears it
            // before the response is written). Re-reading keeps what the shopper sees in
            // step with the server instead of showing a stale basket beside the error.
            void refreshCart();
        }
    }

    if (!hydrated) {
        return (
            <p className="mt-8 text-[15px] text-muted" role="status">
                Loading checkout…
            </p>
        );
    }

    if (lines.length === 0) return null;

    const shipping = selectedQuote?.cost ?? 0;
    // Tax is computed server-side per shipping option (F-CRT-8) - taxAmount already
    // covers the taxable goods plus this option's own shipping charge.
    const tax = selectedQuote?.taxAmount ?? 0;

    return (
        <div className="relative z-10 mt-8 grid gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <div className="min-w-0">
                {status === "guest" && (
                    <p className="mb-6 rounded-[14px] bg-white border border-black/10 shadow-xs px-4 py-3 text-[14px] text-muted">
                        Checking out as a guest.{" "}
                        <Link
                            href="/login?next=/checkout"
                            className="font-bold text-teal-950 underline underline-offset-4"
                        >
                            Sign in
                        </Link>{" "}
                        to save this order to your account.
                    </p>
                )}

                {/* Stepper Navigation */}
                <div className="mb-6 flex items-center gap-2 sm:gap-3 rounded-[16px] bg-white border border-black/10 p-2 shadow-xs">
                    <button
                        type="button"
                        onClick={goToDetails}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-[12px] text-[13px] font-bold transition-all ${
                            step === "details"
                                ? "bg-teal-950 text-white shadow-sm"
                                : "text-teal-950/75 hover:text-teal-950 hover:bg-black/5 cursor-pointer"
                        }`}
                    >
                        <span className={`size-5 rounded-full flex items-center justify-center text-[11px] font-extrabold ${step === "details" ? "bg-lime-400 text-teal-950" : "bg-black/10 text-teal-950"}`}>
                            1
                        </span>
                        <span>1. Details &amp; Address</span>
                    </button>

                    <span className="text-black/20 text-xs font-bold select-none">&rarr;</span>

                    <button
                        type="button"
                        onClick={() => {
                            if (address.line1 && address.city) {
                                setStep("shipping");
                            }
                        }}
                        disabled={!address.line1 || !address.city}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-[12px] text-[13px] font-bold transition-all ${
                            step === "shipping"
                                ? "bg-teal-950 text-white shadow-sm"
                                : "text-teal-950/50 hover:text-teal-950 disabled:opacity-40 disabled:cursor-not-allowed"
                        }`}
                    >
                        <span className={`size-5 rounded-full flex items-center justify-center text-[11px] font-extrabold ${step === "shipping" ? "bg-lime-400 text-teal-950" : "bg-black/10 text-teal-950"}`}>
                            2
                        </span>
                        <span>2. Shipping &amp; Payment</span>
                    </button>
                </div>

                {step === "details" ? (
                    <form
                        onSubmit={goToShipping}
                        noValidate
                        className="rounded-[22px] bg-white border border-black/10 shadow-md p-6"
                    >
                        <h2 className="text-[18px] font-extrabold text-teal-950">
                            Contact &amp; delivery
                        </h2>
                        <p className="mt-1 text-[12px] text-muted">
                            Fields marked <span className="font-bold text-coral">*</span> are
                            required.
                        </p>

                        {savedAddress && !savedAddressApplied && !savedAddressDismissed && (
                            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[14px] bg-lime-500/15 px-4 py-3">
                                <div className="flex items-start gap-2.5">
                                    <MapPin className="mt-0.5 size-4 shrink-0 text-teal-950" aria-hidden/>
                                    <p className="text-[13px] text-teal-950">
                                        <span className="font-bold">Use your saved address?</span>{" "}
                                        {savedAddress.line1}, {savedAddress.city}, {savedAddress.region}
                                    </p>
                                </div>
                                <div className="flex shrink-0 gap-2">
                                    <button
                                        type="button"
                                        onClick={applySavedAddress}
                                        className="h-8 rounded-full bg-teal-950 px-4 text-[12px] font-bold text-white"
                                    >
                                        Yes, fill it in
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setSavedAddressDismissed(true)}
                                        className="h-8 rounded-full px-3 text-[12px] font-bold text-teal-950 hover:bg-white/50"
                                    >
                                        No thanks
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="mt-5 grid gap-4">
                            <Field
                                label="Email"
                                type="email"
                                autoComplete="email"
                                value={email}
                                onChange={setEmail}
                                onBlur={markTouched("email")}
                                error={touched.email ? errors.email : undefined}
                                required
                                hint="Your receipt and order updates go here."
                            />
                            <Field
                                label="Full name"
                                autoComplete="name"
                                value={address.fullName}
                                onChange={update("fullName")}
                                onBlur={markTouched("fullName")}
                                error={touched.fullName ? errors.fullName : undefined}
                                required
                            />
                            <Field
                                label="Address"
                                autoComplete="address-line1"
                                value={address.line1}
                                onChange={update("line1")}
                                onBlur={markTouched("line1")}
                                error={touched.line1 ? errors.line1 : undefined}
                                required
                            />
                            <Field
                                label="Apartment, suite (optional)"
                                autoComplete="address-line2"
                                value={address.line2 ?? ""}
                                onChange={update("line2")}
                            />

                            <div className="grid gap-4 sm:grid-cols-2">
                                <label className="block">
                  <span className="text-[13px] font-bold text-teal-950">
                    Country
                    <RequiredMark/>
                  </span>
                                    <select
                                        value={address.country}
                                        autoComplete="country"
                                        onChange={(event) => updateCountry(event.target.value)}
                                        className="mt-1.5 h-12 w-full rounded-[14px] border border-black/10 bg-white px-4 text-[15px] text-teal-950"
                                    >
                                        {COUNTRIES.map((country) => (
                                            <option key={country.code} value={country.code}>
                                                {country.name}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <Field
                                    label="City"
                                    autoComplete="address-level2"
                                    value={address.city}
                                    onChange={update("city")}
                                    onBlur={markTouched("city")}
                                    error={touched.city ? errors.city : undefined}
                                    required
                                />
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                                {/* CA/US pick region from a list (drives tax/carrier rating); everyone else types freely. */}
                                {hasRegionList(address.country) ? (
                                    <label className="block">
                    <span className="text-[13px] font-bold text-teal-950">
                      {regionLabelFor(address.country)}
                        <RequiredMark/>
                    </span>
                                        <select
                                            value={address.region}
                                            autoComplete="address-level1"
                                            onChange={(event) => update("region")(event.target.value)}
                                            className="mt-1.5 h-12 w-full rounded-[14px] border border-black/10 bg-white px-4 text-[15px] text-teal-950"
                                        >
                                            {regionsFor(address.country).map((region) => (
                                                <option key={region.code} value={region.code}>
                                                    {region.name}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                ) : (
                                    <Field
                                        label={regionLabelFor(address.country)}
                                        autoComplete="address-level1"
                                        value={address.region}
                                        onChange={update("region")}
                                        onBlur={markTouched("region")}
                                        error={touched.region ? errors.region : undefined}
                                        required
                                    />
                                )}
                                <Field
                                    label={postalLabelFor(address.country)}
                                    autoComplete="postal-code"
                                    value={address.postalCode}
                                    onChange={update("postalCode")}
                                    onBlur={markTouched("postalCode")}
                                    error={touched.postalCode ? errors.postalCode : undefined}
                                    required
                                />
                            </div>

                            <Field
                                label="Phone (optional)"
                                type="tel"
                                inputMode="tel"
                                autoComplete="tel"
                                value={address.phone ?? ""}
                                onChange={update("phone")}
                                onBlur={markTouched("phone")}
                                error={touched.phone ? errors.phone : undefined}
                                hint="Used by the carrier for delivery."
                            />

                            <label className="block">
                <span className="text-[13px] font-bold text-teal-950">
                  Order note (optional)
                </span>
                                <textarea
                                    value={note}
                                    onChange={(event) => setNote(event.target.value)}
                                    rows={3}
                                    className="mt-1.5 w-full rounded-[14px] border border-black/10 bg-white px-4 py-3 text-[15px] text-teal-950"
                                />
                            </label>
                        </div>

                        <button
                            type="submit"
                            disabled={quoting}
                            className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-lime-500 text-[15px] font-bold text-teal-950 disabled:opacity-60"
                        >
                            {quoting && <Loader2 className="size-4 animate-spin" aria-hidden/>}
                            {quoting ? "Checking shipping…" : "Continue to shipping"}
                        </button>
                    </form>
                ) : (
                    <div className="rounded-[22px] bg-white border border-black/10 shadow-md p-6">
                        <div className="mb-4">
                            <button
                                type="button"
                                onClick={goToDetails}
                                className="inline-flex items-center gap-1.5 text-[13px] font-bold text-teal-800 hover:text-teal-950 hover:underline"
                            >
                                &larr; Back to contact &amp; delivery details
                            </button>
                        </div>

                        <h2 className="text-[18px] font-extrabold text-teal-950">
                            Shipping method
                        </h2>

                        <div className="mt-2 flex items-baseline justify-between gap-4">
                            <p className="text-[14px] text-muted">
                                Delivering to {address.line1}, {address.city}, {address.region}{" "}
                                {address.postalCode}
                            </p>
                            <button
                                type="button"
                                onClick={goToDetails}
                                className="shrink-0 text-[13px] font-bold text-teal-950 underline underline-offset-4"
                            >
                                Edit
                            </button>
                        </div>

                        <ul className="mt-5 max-h-[19rem] space-y-3 overflow-y-auto overscroll-contain pr-1">
                            {quotes.map((quote) => (
                                <li key={quote.serviceCode}>
                                    <label
                                        className="flex cursor-pointer items-center gap-3 rounded-[14px] border border-black/10 bg-white p-4">
                                        <input
                                            type="radio"
                                            name="shipping"
                                            value={quote.serviceCode}
                                            checked={serviceCode === quote.serviceCode}
                                            onChange={() => setServiceCode(quote.serviceCode)}
                                            className="size-4"
                                        />
                                        <span className="flex-1">
                                            <span className="flex flex-wrap items-center gap-2">
                                                <span className="block text-[15px] font-bold text-teal-950">
                                                    {quote.serviceName}
                                                </span>
                                                {quote.packagingType === "PALLET" && (
                                                    <span className="inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-extrabold text-amber-900 uppercase tracking-wide">
                                                        40&quot;&times;48&quot; Pallet Freight
                                                    </span>
                                                )}
                                            </span>
                                            <span className="block text-[13px] text-muted">
                                                {quote.carrierName}
                                                {formatEta(quote)}
                                            </span>
                                            {quote.packagingType === "PALLET" && quote.palletDimensions && (
                                                <span className="mt-1 block text-[12px] font-medium text-teal-900/80">
                                                    Pallet: {quote.palletDimensions} {quote.boxCount ? `\u2022 ${quote.boxCount} boxes` : ""} {quote.totalWeightKg ? `\u2022 ${quote.totalWeightKg} kg` : ""}
                                                </span>
                                            )}
                                        </span>
                                        <span className="text-[15px] font-extrabold text-teal-950">
                                            {quote.cost === 0 ? "Free" : format(quote.cost)}
                                        </span>
                                    </label>
                                </li>
                            ))}
                        </ul>

                        {canUseManualPayment && (
                            <div className="mt-6">
                                <h3 className="text-[15px] font-extrabold text-teal-950">
                                    Distributor Payment Option
                                </h3>
                                <p className="mt-1 text-[13px] text-muted">
                                    Distributors can place orders without immediate card payment. You can select e-Transfer or Cheque, and our team will approve the order upon payment verification.
                                </p>
                                <ul className="mt-3 space-y-3">
                                    {(
                                        [
                                            {value: "STRIPE", label: "Card (Stripe)"},
                                            {value: "E_TRANSFER", label: "E-Transfer"},
                                            {value: "CHEQUE", label: "Pay by Cheque"},
                                        ] as const
                                    ).map((option) => (
                                        <li key={option.value}>
                                            <label
                                                className="flex cursor-pointer items-center gap-3 rounded-[14px] border border-black/10 bg-white p-4">
                                                <input
                                                    type="radio"
                                                    name="paymentMethod"
                                                    value={option.value}
                                                    checked={paymentMethod === option.value}
                                                    onChange={() => setPaymentMethod(option.value)}
                                                    className="size-4"
                                                />
                                                <span className="text-[15px] font-bold text-teal-950">
                                                    {option.label}
                                                </span>
                                            </label>
                                        </li>
                                    ))}
                                </ul>

                                {paymentMethod === "E_TRANSFER" && (
                                    <p className="mt-3 rounded-[14px] bg-white p-4 text-[13px] leading-relaxed text-teal-950">
                                        Send your e-transfer to: <strong>Wattany@yahoo.com</strong>.
                                        Your order will be placed immediately and approved once Watani administration confirms receipt.
                                    </p>
                                )}
                                {paymentMethod === "CHEQUE" && (
                                    <p className="mt-3 rounded-[14px] bg-white p-4 text-[13px] leading-relaxed text-teal-950">
                                        Make the cheque payable to:{" "}
                                        <strong>Watani &amp; Sons Corp</strong>. Your order will be placed immediately and approved once Watani administration confirms receipt.
                                    </p>
                                )}
                            </div>
                        )}

                        <button
                            type="button"
                            onClick={() => void pay()}
                            disabled={placing || !serviceCode}
                            className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-lime-500 text-[15px] font-bold text-teal-950 disabled:opacity-60"
                        >
                            {placing ? (
                                <Loader2 className="size-4 animate-spin" aria-hidden/>
                            ) : (
                                <Lock className="size-4" aria-hidden/>
                            )}
                            {placing
                                ? paymentMethod === "STRIPE"
                                    ? "Taking you to payment…"
                                    : "Placing your order…"
                                : paymentMethod === "STRIPE"
                                    ? "Pay securely"
                                    : "Place order"}
                        </button>

                        <p className="mt-3 text-center text-[12px] leading-relaxed text-muted">
                            {paymentMethod === "STRIPE"
                                ? "You will be taken to Stripe to complete payment. Your card details never reach Watani & Sons."
                                : "No payment is collected now. Follow the instructions above to send your payment."}
                        </p>
                    </div>
                )}
            </div>

            <aside className="h-fit min-w-0 rounded-[22px] bg-white border border-black/10 shadow-md p-5 sm:p-6 lg:sticky lg:top-[110px]">
                <h2 className="text-[18px] font-extrabold text-teal-950">Your order</h2>

                <ul className="mt-5 space-y-4">
                    {lines.map((line) => (
                        <li key={line.itemId} className="flex items-center gap-3">
                            <div className="relative shrink-0 rounded-xl bg-[#f1f3f1] p-1.5">
                                <Image
                                    src={productImageSrc(line.image || (line as any).imageUrl || (line as any).productImage, line.productSlug || line.productName)}
                                    alt={line.productName}
                                    width={200}
                                    height={200}
                                    sizes="56px"
                                    className="size-[48px] object-contain"
                                />
                                <span
                                    className="absolute -right-2 -top-2 grid size-6 place-items-center rounded-full bg-teal-950 text-[11px] font-bold text-white">
                  {line.quantity}
                </span>
                            </div>
                            <div className="min-w-0 flex-1">
                                <p
                                    className="truncate text-[14px] font-bold text-teal-950"
                                    title={line.productName}
                                >
                                    {line.productName}
                                </p>
                                <p className="truncate text-[12px] text-muted">{line.unit}</p>
                            </div>
                            <p className="shrink-0 whitespace-nowrap text-[14px] font-extrabold text-teal-950">
                                {format(line.lineTotal)}
                            </p>
                        </li>
                    ))}
                </ul>

                <hr className="my-5 border-black/[0.07]"/>

                <dl className="space-y-3 text-[15px]">
                    <div className="flex items-baseline justify-between gap-3">
                        <dt className="text-muted">Total products</dt>
                        <dd className="shrink-0 font-bold text-teal-950">{format(subtotal)}</dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-3">
                        <dt className="text-muted">Shipping</dt>
                        <dd
                            className={`shrink-0 text-right ${selectedQuote ? "font-bold text-teal-950" : "text-muted"}`}
                        >
                            {selectedQuote
                                ? shipping === 0
                                    ? "Free"
                                    : format(shipping)
                                : "Calculated next"}
                        </dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-3">
                        <dt className="text-muted">Total taxes</dt>
                        {/* Estimate only (F-CRT-8) - server re-resolves the exact amount at placement. */}
                        <dd
                            className={`shrink-0 text-right ${selectedQuote ? "font-bold text-teal-950" : "text-muted"}`}
                        >
                            {selectedQuote ? format(tax) : "Calculated next"}
                        </dd>
                    </div>
                </dl>

                <hr className="my-5 border-black/[0.07]"/>

                <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[15px] font-bold text-teal-950">Total</span>
                    <span className="shrink-0 text-[22px] font-extrabold text-teal-950 sm:text-[26px]">
            {format(subtotal + shipping + tax)}
          </span>
                </div>
                {currency !== "CAD" ? (
                    <p className="mt-1 text-[12px] text-muted">
                        Charged in CAD: {formatCad(subtotal + shipping + tax)}
                    </p>
                ) : (
                    <p className="mt-1 text-[12px] text-muted">CAD</p>
                )}
            </aside>
        </div>
    );
}

/** Marks a required field's label, paired with the legend above the form. */
function RequiredMark() {
    return (
        <span aria-hidden className="ml-0.5 text-coral">
      *
    </span>
    );
}

function Field({
                   label,
                   value,
                   onChange,
                   onBlur,
                   error,
                   type = "text",
                   required = false,
                   hint,
                   autoComplete,
                   inputMode,
               }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    onBlur?: () => void;
    /** Message to show, or undefined while the field is still untouched/valid. */
    error?: string;
    type?: string;
    required?: boolean;
    hint?: string;
    autoComplete?: string;
    inputMode?: React.ComponentProps<"input">["inputMode"];
}) {
    const id = `field-${label.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase()}`;
    const errorId = `${id}-error`;
    const hintId = `${id}-hint`;
    const invalid = Boolean(error);

    return (
        <div className="block">
            <label htmlFor={id} className="text-[13px] font-bold text-teal-950">
                {label}
                {required && <RequiredMark/>}
            </label>
            <input
                id={id}
                type={type}
                value={value}
                required={required}
                autoComplete={autoComplete}
                inputMode={inputMode}
                aria-invalid={invalid || undefined}
                aria-describedby={
                    [invalid ? errorId : null, hint ? hintId : null]
                        .filter(Boolean)
                        .join(" ") || undefined
                }
                onChange={(event) => onChange(event.target.value)}
                onBlur={onBlur}
                className={`mt-1.5 h-12 w-full rounded-[14px] border bg-white px-4 text-[15px] text-teal-950 outline-none transition-colors ${
                    invalid
                        ? "border-coral focus:border-coral"
                        : "border-black/10 focus:border-teal-950"
                }`}
            />
            {invalid ? (
                <span
                    id={errorId}
                    role="alert"
                    className="mt-1 block text-[12px] font-semibold text-coral"
                >
          {error}
        </span>
            ) : (
                hint && (
                    <span id={hintId} className="mt-1 block text-[12px] text-muted">
            {hint}
          </span>
                )
            )}
        </div>
    );
}
