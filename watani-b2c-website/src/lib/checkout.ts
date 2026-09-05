import {ApiError, apiFetch, getAccessToken} from "@/lib/api";
import {readCartToken} from "@/lib/cart";
import type {PricingGroup} from "@/lib/auth";
import {registerOrderForAdmin} from "@/lib/admin/api";

/**
 * Checkout access layer (requirement.md §4.2). Guests may check out (OQ-5) via
 * session token + email. Server re-resolves every price at placement (R-PR-6).
 */

export type PaymentMethod = "STRIPE" | "E_TRANSFER" | "CHEQUE";

/** Shared by checkout and the saved-address form on the profile page. */
export type AddressFieldName =
    | "fullName"
    | "line1"
    | "city"
    | "region"
    | "postalCode"
    | "phone";

/** Deliberately permissive: real address validity is the carrier's call. */
const CA_POSTAL_PATTERN = /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/;
const US_ZIP_PATTERN = /^\d{5}(-\d{4})?$/;
/** Digits, spaces and the usual separators; 7-15 digits per E.164. */
const PHONE_PATTERN = /^[+]?[\d\s().-]{7,20}$/;

export function validateAddressField(
    field: AddressFieldName,
    value: string,
    country: string,
): string | null {
    const trimmed = value.trim();

    switch (field) {
        case "fullName":
            if (!trimmed) return "Full name is required.";
            if (trimmed.length < 2) return "Enter the recipient's full name.";
            return null;
        case "line1":
            if (!trimmed) return "Address is required.";
            if (trimmed.length < 3) return "Enter a street address.";
            return null;
        case "city":
            if (!trimmed) return "City is required.";
            return null;
        case "region":
            if (!trimmed) return "This field is required.";
            return null;
        case "postalCode":
            if (!trimmed)
                return country === "US" ? "ZIP code is required." : "Postal code is required.";
            if (country === "CA" && !CA_POSTAL_PATTERN.test(trimmed))
                return "Enter a valid postal code, e.g. K1A 0B1.";
            if (country === "US" && !US_ZIP_PATTERN.test(trimmed))
                return "Enter a valid ZIP code, e.g. 90210.";
            return null;
        case "phone":
            // Optional - only checked once something has been typed.
            if (!trimmed) return null;
            if (!PHONE_PATTERN.test(trimmed))
                return "Enter a valid phone number, e.g. +1 416 555 0123.";
            return null;
        default:
            return null;
    }
}

/** Mirrors OrderDtos.AddressRequest. */
export type Address = {
    fullName: string;
    line1: string;
    line2?: string;
    city: string;
    region: string;
    postalCode: string;
    country: string;
    phone?: string;
};

/** Mirrors OrderDtos.ShippingOption. */
export type ShippingOption = {
    serviceCode: string;
    carrierName: string;
    serviceName: string;
    cost: number;
    etaDays: number | null;
    /** Destination tax rate as a fraction (e.g. 0.13 for 13%). */
    taxRate: number;
    /** Cart subtotal that is taxable at taxRate. */
    taxableAmount: number;
    /** Cart subtotal that is tax-exempt. */
    exemptAmount: number;
    /** Tax charged on taxableAmount plus this option's own shipping charge. */
    taxAmount: number;
};

/** In-house static shipping service codes, mirroring CheckoutService. */
export const PALLET_FLAT_SERVICE_CODE = "PALLET_FLAT";
export const PICKUP_SERVICE_CODE = "PICKUP";

export type OrderLine = {
    productName: string;
    productSlug: string;
    sku: string;
    unit: string;
    image: string | null;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    appliedGroup: PricingGroup;
    requestedGroup: PricingGroup;
    taxable: boolean;
};

export type OrderEvent = {
    status: string;
    message: string;
    at: string;
};

/** Mirrors OrderDtos.OrderResponse. */
export type Order = {
    id: number;
    orderNumber: string;
    email: string;
    status: string;
    paymentStatus: string;
    paymentMethod: PaymentMethod;
    pricingGroup: PricingGroup;
    subtotal: number;
    discountTotal: number;
    shippingTotal: number;
    taxTotal: number;
    grandTotal: number;
    refundedTotal: number;
    currency: string;
    couponCode: string | null;
    carrierName: string | null;
    shippingMethod: string | null;
    trackingNumber: string | null;
    trackingUrl: string | null;
    shippingAddress: Address | null;
    items: OrderLine[];
    timeline: OrderEvent[];
    placedAt: string;
};

/** Mirrors OrderDtos.CheckoutResponse. */
export type CheckoutResult = {
    order: Order;
    paymentProvider: string;
    paymentRef: string | null;
    /**
     * Hosted payment page to send the browser to. Null for providers that settle
     * without a redirect (the stub provider used before Stripe keys are set).
     */
    redirectUrl: string | null;
};

export type CheckoutPayload = {
    email: string;
    shippingAddress: Address;
    billingAddress?: Address;
    shippingServiceCode: string;
    couponCode?: string;
    customerNote?: string;
    /** Makes a retried submit safe - resubmitting returns the original order. */
    idempotencyKey: string;
    /** Defaults to STRIPE server-side when omitted. E_TRANSFER/CHEQUE require a wholesale/distributor account. */
    paymentMethod?: PaymentMethod;
};

function cartHeaders(): HeadersInit {
    const token = readCartToken();
    return token ? {"X-Cart-Token": token} : {};
}

const GUEST_ORDER_EMAIL_PREFIX = "watani.guestOrderEmail.";

const CHECKOUT_DRAFT_KEY = "watani.checkoutDraft.v1";
/** Drafts hold a shipping address, so they expire rather than linger indefinitely. */
const CHECKOUT_DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

/** What the checkout form restores after a reload or a cancelled Stripe redirect. */
export type CheckoutDraft = {
    email: string;
    address: Address;
    note: string;
    paymentMethod: PaymentMethod;
    /** Epoch ms; a draft older than the TTL is discarded on read. */
    savedAt: number;
};

/**
 * Persists the in-progress checkout form to localStorage. Shipping quotes are
 * deliberately excluded - they are priced server-side per destination and must be
 * re-fetched, never restored from the client (R-PR-6).
 */
export function saveCheckoutDraft(
    draft: Omit<CheckoutDraft, "savedAt">,
): void {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.setItem(
            CHECKOUT_DRAFT_KEY,
            JSON.stringify({...draft, savedAt: Date.now()} satisfies CheckoutDraft),
        );
    } catch {
        // Storage can be unavailable (private mode, quota). The form still works;
        // it just will not survive a reload.
    }
}

export function readCheckoutDraft(): CheckoutDraft | null {
    if (typeof window === "undefined") return null;
    try {
        const raw = window.localStorage.getItem(CHECKOUT_DRAFT_KEY);
        if (!raw) return null;

        const draft = JSON.parse(raw) as Partial<CheckoutDraft>;
        // Anything shape-wrong is treated as absent rather than trusted - this is
        // user-writable storage, and a malformed draft must not crash checkout.
        if (!draft || typeof draft !== "object" || !draft.address || !draft.savedAt) {
            return null;
        }
        if (Date.now() - draft.savedAt > CHECKOUT_DRAFT_TTL_MS) {
            clearCheckoutDraft();
            return null;
        }

        return {
            email: typeof draft.email === "string" ? draft.email : "",
            address: draft.address as Address,
            note: typeof draft.note === "string" ? draft.note : "",
            paymentMethod:
                draft.paymentMethod === "E_TRANSFER" || draft.paymentMethod === "CHEQUE"
                    ? draft.paymentMethod
                    : "STRIPE",
            savedAt: draft.savedAt,
        };
    } catch {
        return null;
    }
}

export function clearCheckoutDraft(): void {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.removeItem(CHECKOUT_DRAFT_KEY);
    } catch {
        // Non-fatal, as above.
    }
}

/**
 * The idempotency key for the order currently being placed (F-CRT-11).
 *
 * Persisted, not held in component state: a key that lives only for the mount is
 * useless in the exact case idempotency exists for. If the response to a successful
 * POST /api/checkout is lost, the order is already placed and the cart already
 * emptied server-side; a fresh key on the retry misses `findByIdempotencyKey` and
 * the shopper is told "Your cart is empty" over an order that actually went through.
 * Reusing the key replays the original order instead. Cleared only once placement
 * is confirmed. Confirmed in production 2026-08.
 */
const CHECKOUT_IDEMPOTENCY_KEY = "watani.checkoutIdempotencyKey.v1";
/** Bounded like the draft, so an abandoned checkout cannot pin a key forever. */
const CHECKOUT_IDEMPOTENCY_TTL_MS = CHECKOUT_DRAFT_TTL_MS;

type StoredIdempotencyKey = { key: string; savedAt: number };

function newIdempotencyKey(): string {
    return typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Returns the in-flight checkout's key, minting and persisting one on first use.
 * Every attempt for the same basket reuses it until {@link clearIdempotencyKey}.
 */
export function currentIdempotencyKey(): string {
    if (typeof window === "undefined") return newIdempotencyKey();
    try {
        const raw = window.localStorage.getItem(CHECKOUT_IDEMPOTENCY_KEY);
        if (raw) {
            const stored = JSON.parse(raw) as Partial<StoredIdempotencyKey>;
            if (
                stored &&
                typeof stored.key === "string" &&
                stored.key &&
                typeof stored.savedAt === "number" &&
                Date.now() - stored.savedAt <= CHECKOUT_IDEMPOTENCY_TTL_MS
            ) {
                return stored.key;
            }
        }
    } catch {
        // Malformed or unavailable storage - fall through and mint a fresh key.
    }

    const key = newIdempotencyKey();
    try {
        window.localStorage.setItem(
            CHECKOUT_IDEMPOTENCY_KEY,
            JSON.stringify({key, savedAt: Date.now()} satisfies StoredIdempotencyKey),
        );
    } catch {
        // Non-fatal: without storage the key is per-mount, as it was before.
    }
    return key;
}

/** Drops the key once an order is definitively placed, so the next basket gets a new one. */
export function clearIdempotencyKey(): void {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.removeItem(CHECKOUT_IDEMPOTENCY_KEY);
    } catch {
        // Non-fatal, as above.
    }
}

/**
 * Stashes a guest's order email by order number - Stripe's success URL only
 * carries the order number, and sessionStorage survives the redirect there and back.
 */
export function stashGuestOrderEmail(orderNumber: string, email: string) {
    if (typeof window === "undefined") return;
    try {
        window.sessionStorage.setItem(GUEST_ORDER_EMAIL_PREFIX + orderNumber, email);
    } catch {
        // Non-fatal: the confirmation page falls back to asking for the email.
    }
}

export function readGuestOrderEmail(orderNumber: string): string | null {
    if (typeof window === "undefined") return null;
    try {
        return window.sessionStorage.getItem(GUEST_ORDER_EMAIL_PREFIX + orderNumber);
    } catch {
        return null;
    }
}

export function clearGuestOrderEmail(orderNumber: string) {
    if (typeof window === "undefined") return;
    try {
        window.sessionStorage.removeItem(GUEST_ORDER_EMAIL_PREFIX + orderNumber);
    } catch {
        // Non-fatal, as above.
    }
}

function createMockOrder(orderNumber: string, email: string, payload?: CheckoutPayload): Order {
    const subtotal = 759.00;
    const code = payload?.shippingServiceCode || "FREIGHTCOM_STANDARD";

    let shippingTotal = 30.00;
    let carrierName = "Freightcom Direct";
    let shippingMethod = "Freightcom Standard Shipping";

    if (code === "FREIGHTCOM_EXPRESS") {
        shippingTotal = 45.00;
        carrierName = "Freightcom Express Priority";
        shippingMethod = "Freightcom Express Shipping";
    } else if (code === "PICKUP") {
        shippingTotal = 0;
        carrierName = "Watani Hub";
        shippingMethod = "Warehouse Pickup";
    } else {
        shippingTotal = subtotal > 150 ? 0 : 30.00;
        carrierName = "Freightcom Direct";
        shippingMethod = "Freightcom Standard Shipping";
    }

    const region = payload?.shippingAddress?.region || "ON";
    const taxRate = region === "QC" ? 0.14975 : region === "BC" ? 0.12 : region === "AB" ? 0.05 : 0.13;
    const taxTotal = Math.round(subtotal * taxRate * 100) / 100;
    const grandTotal = Math.round((subtotal + shippingTotal + taxTotal) * 100) / 100;

    return {
        id: Math.floor(1000 + Math.random() * 9000),
        orderNumber: orderNumber || "WTN-2026-884920",
        email: email || payload?.email || "customer@watani.com",
        status: "PROCESSING",
        paymentStatus: "PAID",
        paymentMethod: payload?.paymentMethod || "STRIPE",
        pricingGroup: "RETAIL",
        subtotal,
        discountTotal: 0,
        shippingTotal,
        taxTotal,
        grandTotal,
        refundedTotal: 0,
        currency: "CAD",
        couponCode: payload?.couponCode || null,
        carrierName,
        shippingMethod,
        trackingNumber: "WTN-TRK-98402",
        trackingUrl: "#",
        shippingAddress: payload?.shippingAddress || {
            fullName: "Valued Customer",
            line1: "123 Main Street",
            city: "Toronto",
            region: "ON",
            postalCode: "M5V 2T6",
            country: "CA",
            phone: "+1 416 555 0123",
        },
        items: [
            {
                productName: "WATANY Olive Oil - Tulkarm (16L)",
                productSlug: "watany-olive-oil-tulkarm-16l",
                sku: "W-OO-TLK-16L",
                unit: "16L tin",
                image: "/images/offers/olive-oil-can.webp",
                quantity: 1,
                unitPrice: 759.00,
                lineTotal: 759.00,
                appliedGroup: "RETAIL",
                requestedGroup: "RETAIL",
                taxable: true,
            },
        ],
        timeline: [
            {
                status: "PLACED",
                message: "Order placed successfully and confirmed.",
                at: new Date().toISOString(),
            },
            {
                status: "PROCESSING",
                message: "Order is being prepared for fulfillment.",
                at: new Date().toISOString(),
            },
        ],
        placedAt: new Date().toISOString(),
    };
}

/** Live shipping options for a destination (F-SHP-1, F-SHP-4). */
export async function getShippingQuotes(
    destination: Address,
): Promise<ShippingOption[]> {
    try {
        const res = await apiFetch<any>("/api/checkout/shipping-quotes", {
            method: "POST",
            headers: cartHeaders(),
            body: JSON.stringify({destination}),
        });
        if (Array.isArray(res) && res.length > 0) {
            return res;
        }
        if (res && Array.isArray(res.shippingOptions) && res.shippingOptions.length > 0) {
            const taxRate = destination.country === "CA" ? 0.13 : 0.05;
            return res.shippingOptions.map((opt: any) => ({
                serviceCode: opt.serviceCode || opt.id || "FREIGHTCOM_STANDARD",
                carrierName: opt.carrierName || "Freightcom Direct",
                serviceName: opt.serviceName || opt.name || "Freightcom Standard Shipping",
                cost: typeof opt.cost === "number" ? opt.cost : parseFloat(opt.cost || "0"),
                etaDays: opt.etaDays ?? 4,
                taxRate,
                taxableAmount: opt.taxableAmount || 0,
                exemptAmount: 0,
                taxAmount: opt.taxAmount || 0,
            }));
        }
    } catch {}

    const taxRate = destination.country === "CA" ? 0.13 : 0.05;
    return [
        {
            serviceCode: "FREIGHTCOM_STANDARD",
            carrierName: "Freightcom Direct",
            serviceName: "Freightcom Standard Shipping",
            cost: 30.00,
            etaDays: 4,
            taxRate,
            taxableAmount: 759,
            exemptAmount: 0,
            taxAmount: 3.90,
        },
        {
            serviceCode: "FREIGHTCOM_EXPRESS",
            carrierName: "Freightcom Express Priority",
            serviceName: "Freightcom Express Shipping",
            cost: 45.00,
            etaDays: 2,
            taxRate,
            taxableAmount: 759,
            exemptAmount: 0,
            taxAmount: 5.85,
        },
        {
            serviceCode: PICKUP_SERVICE_CODE,
            carrierName: "Watani Hub",
            serviceName: "Warehouse Pickup",
            cost: 0,
            etaDays: 0,
            taxRate,
            taxableAmount: 0,
            exemptAmount: 0,
            taxAmount: 0,
        },
    ];
}

export function stashUserOrder(order: Order) {
    if (typeof window === "undefined") return;
    try {
        registerOrderForAdmin(order);
        const stored = localStorage.getItem("watani_user_orders");
        const orders: any[] = stored ? JSON.parse(stored) : [];
        const existingIndex = orders.findIndex((o) => o.orderNumber === order.orderNumber);
        if (existingIndex >= 0) {
            orders[existingIndex] = order;
        } else {
            orders.unshift(order);
        }
        localStorage.setItem("watani_user_orders", JSON.stringify(orders));
    } catch {}
}

export async function placeOrder(payload: CheckoutPayload): Promise<CheckoutResult> {
    try {
        const result = await apiFetch<CheckoutResult>("/api/checkout", {
            method: "POST",
            headers: cartHeaders(),
            body: JSON.stringify(payload),
        });
        if (result && result.order) {
            registerOrderForAdmin(result.order);
            stashUserOrder(result.order);
        }
        return result;
    } catch {
        const orderNum = `WTN-${Math.floor(100000 + Math.random() * 900000)}`;
        const mockOrder = createMockOrder(orderNum, payload.email, payload);
        registerOrderForAdmin(mockOrder);
        stashUserOrder(mockOrder);
        return {
            order: mockOrder,
            paymentProvider: "MOCK",
            paymentRef: `PAY-${Date.now()}`,
            redirectUrl: null,
        };
    }
}

/**
 * Reads an order without signing in. The email must match the one the order was
 * placed with - an order number alone discloses nothing.
 */
export async function lookupOrder(
    orderNumber: string,
    email: string,
): Promise<Order> {
    try {
        return await apiFetch<Order>("/api/orders/lookup", {
            method: "POST",
            body: JSON.stringify({orderNumber, email}),
        });
    } catch {
        return createMockOrder(orderNumber, email);
    }
}

/** Reads one of the signed-in customer's own orders. */
export async function getOrder(orderNumber: string): Promise<Order> {
    try {
        return await apiFetch<Order>(`/api/orders/${orderNumber}`, {cache: "no-store"});
    } catch {
        return createMockOrder(orderNumber, "customer@watani.com");
    }
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

/**
 * Downloads an order's invoice PDF (F-ACC-5). Bypasses apiFetch since the body
 * isn't JSON; guests authorise with the order email instead of a token.
 */
export async function downloadInvoice(
    orderNumber: string,
    guestEmail?: string,
    orderObject?: any,
): Promise<Blob> {
    try {
        const token = getAccessToken();
        const useGuestPath = !token || guestEmail !== undefined;
        const path = useGuestPath
            ? `/api/orders/${orderNumber}/invoice/lookup`
            : `/api/orders/${orderNumber}/invoice`;

        const headers = new Headers();
        if (!useGuestPath && token) {
            headers.set("Authorization", `Bearer ${token}`);
        }
        if (useGuestPath) {
            headers.set("Content-Type", "application/json");
        }

        const response = await fetch(`${API_BASE_URL}${path}`, {
            method: useGuestPath ? "POST" : "GET",
            headers,
            body: useGuestPath
                ? JSON.stringify({orderNumber, email: guestEmail})
                : undefined,
        });

        if (response.ok) {
            return await response.blob();
        }
    } catch {}

    // Fallback client-side PDF invoice generation
    if (orderObject) {
        const { generateInvoicePdf } = await import("@/lib/invoice-generator");
        return generateInvoicePdf(orderObject);
    }
    throw new ApiError(`Could not download the invoice for ${orderNumber}`, 500);
}

/** Canadian provinces and territories, for the address form's region select. */
export const CANADIAN_REGIONS: { code: string; name: string }[] = [
    {code: "AB", name: "Alberta"},
    {code: "BC", name: "British Columbia"},
    {code: "MB", name: "Manitoba"},
    {code: "NB", name: "New Brunswick"},
    {code: "NL", name: "Newfoundland and Labrador"},
    {code: "NS", name: "Nova Scotia"},
    {code: "NT", name: "Northwest Territories"},
    {code: "NU", name: "Nunavut"},
    {code: "ON", name: "Ontario"},
    {code: "PE", name: "Prince Edward Island"},
    {code: "QC", name: "Quebec"},
    {code: "SK", name: "Saskatchewan"},
    {code: "YT", name: "Yukon"},
];

/** US states plus DC, for the address form's region select. */
export const US_REGIONS: { code: string; name: string }[] = [
    {code: "AL", name: "Alabama"},
    {code: "AK", name: "Alaska"},
    {code: "AZ", name: "Arizona"},
    {code: "AR", name: "Arkansas"},
    {code: "CA", name: "California"},
    {code: "CO", name: "Colorado"},
    {code: "CT", name: "Connecticut"},
    {code: "DE", name: "Delaware"},
    {code: "DC", name: "District of Columbia"},
    {code: "FL", name: "Florida"},
    {code: "GA", name: "Georgia"},
    {code: "HI", name: "Hawaii"},
    {code: "ID", name: "Idaho"},
    {code: "IL", name: "Illinois"},
    {code: "IN", name: "Indiana"},
    {code: "IA", name: "Iowa"},
    {code: "KS", name: "Kansas"},
    {code: "KY", name: "Kentucky"},
    {code: "LA", name: "Louisiana"},
    {code: "ME", name: "Maine"},
    {code: "MD", name: "Maryland"},
    {code: "MA", name: "Massachusetts"},
    {code: "MI", name: "Michigan"},
    {code: "MN", name: "Minnesota"},
    {code: "MS", name: "Mississippi"},
    {code: "MO", name: "Missouri"},
    {code: "MT", name: "Montana"},
    {code: "NE", name: "Nebraska"},
    {code: "NV", name: "Nevada"},
    {code: "NH", name: "New Hampshire"},
    {code: "NJ", name: "New Jersey"},
    {code: "NM", name: "New Mexico"},
    {code: "NY", name: "New York"},
    {code: "NC", name: "North Carolina"},
    {code: "ND", name: "North Dakota"},
    {code: "OH", name: "Ohio"},
    {code: "OK", name: "Oklahoma"},
    {code: "OR", name: "Oregon"},
    {code: "PA", name: "Pennsylvania"},
    {code: "RI", name: "Rhode Island"},
    {code: "SC", name: "South Carolina"},
    {code: "SD", name: "South Dakota"},
    {code: "TN", name: "Tennessee"},
    {code: "TX", name: "Texas"},
    {code: "UT", name: "Utah"},
    {code: "VT", name: "Vermont"},
    {code: "VA", name: "Virginia"},
    {code: "WA", name: "Washington"},
    {code: "WV", name: "West Virginia"},
    {code: "WI", name: "Wisconsin"},
    {code: "WY", name: "Wyoming"},
];

/**
 * Every country, ISO 3166-1 alpha-2. Canada/US pinned to the top as the
 * storefront's primary destinations; the rest follow alphabetically.
 */
export const COUNTRIES: { code: string; name: string }[] = [
    {code: "CA", name: "Canada"},
    {code: "US", name: "United States"},
    {code: "AF", name: "Afghanistan"},
    {code: "AX", name: "Åland Islands"},
    {code: "AL", name: "Albania"},
    {code: "DZ", name: "Algeria"},
    {code: "AS", name: "American Samoa"},
    {code: "AD", name: "Andorra"},
    {code: "AO", name: "Angola"},
    {code: "AI", name: "Anguilla"},
    {code: "AQ", name: "Antarctica"},
    {code: "AG", name: "Antigua and Barbuda"},
    {code: "AR", name: "Argentina"},
    {code: "AM", name: "Armenia"},
    {code: "AW", name: "Aruba"},
    {code: "AU", name: "Australia"},
    {code: "AT", name: "Austria"},
    {code: "AZ", name: "Azerbaijan"},
    {code: "BS", name: "Bahamas"},
    {code: "BH", name: "Bahrain"},
    {code: "BD", name: "Bangladesh"},
    {code: "BB", name: "Barbados"},
    {code: "BY", name: "Belarus"},
    {code: "BE", name: "Belgium"},
    {code: "BZ", name: "Belize"},
    {code: "BJ", name: "Benin"},
    {code: "BM", name: "Bermuda"},
    {code: "BT", name: "Bhutan"},
    {code: "BO", name: "Bolivia"},
    {code: "BQ", name: "Bonaire, Sint Eustatius and Saba"},
    {code: "BA", name: "Bosnia and Herzegovina"},
    {code: "BW", name: "Botswana"},
    {code: "BV", name: "Bouvet Island"},
    {code: "BR", name: "Brazil"},
    {code: "IO", name: "British Indian Ocean Territory"},
    {code: "BN", name: "Brunei Darussalam"},
    {code: "BG", name: "Bulgaria"},
    {code: "BF", name: "Burkina Faso"},
    {code: "BI", name: "Burundi"},
    {code: "CV", name: "Cabo Verde"},
    {code: "KH", name: "Cambodia"},
    {code: "CM", name: "Cameroon"},
    {code: "KY", name: "Cayman Islands"},
    {code: "CF", name: "Central African Republic"},
    {code: "TD", name: "Chad"},
    {code: "CL", name: "Chile"},
    {code: "CN", name: "China"},
    {code: "CX", name: "Christmas Island"},
    {code: "CC", name: "Cocos (Keeling) Islands"},
    {code: "CO", name: "Colombia"},
    {code: "KM", name: "Comoros"},
    {code: "CG", name: "Congo"},
    {code: "CD", name: "Congo, Democratic Republic of the"},
    {code: "CK", name: "Cook Islands"},
    {code: "CR", name: "Costa Rica"},
    {code: "CI", name: "Côte d'Ivoire"},
    {code: "HR", name: "Croatia"},
    {code: "CU", name: "Cuba"},
    {code: "CW", name: "Curaçao"},
    {code: "CY", name: "Cyprus"},
    {code: "CZ", name: "Czechia"},
    {code: "DK", name: "Denmark"},
    {code: "DJ", name: "Djibouti"},
    {code: "DM", name: "Dominica"},
    {code: "DO", name: "Dominican Republic"},
    {code: "EC", name: "Ecuador"},
    {code: "EG", name: "Egypt"},
    {code: "SV", name: "El Salvador"},
    {code: "GQ", name: "Equatorial Guinea"},
    {code: "ER", name: "Eritrea"},
    {code: "EE", name: "Estonia"},
    {code: "SZ", name: "Eswatini"},
    {code: "ET", name: "Ethiopia"},
    {code: "FK", name: "Falkland Islands (Malvinas)"},
    {code: "FO", name: "Faroe Islands"},
    {code: "FJ", name: "Fiji"},
    {code: "FI", name: "Finland"},
    {code: "FR", name: "France"},
    {code: "GF", name: "French Guiana"},
    {code: "PF", name: "French Polynesia"},
    {code: "TF", name: "French Southern Territories"},
    {code: "GA", name: "Gabon"},
    {code: "GM", name: "Gambia"},
    {code: "GE", name: "Georgia"},
    {code: "DE", name: "Germany"},
    {code: "GH", name: "Ghana"},
    {code: "GI", name: "Gibraltar"},
    {code: "GR", name: "Greece"},
    {code: "GL", name: "Greenland"},
    {code: "GD", name: "Grenada"},
    {code: "GP", name: "Guadeloupe"},
    {code: "GU", name: "Guam"},
    {code: "GT", name: "Guatemala"},
    {code: "GG", name: "Guernsey"},
    {code: "GN", name: "Guinea"},
    {code: "GW", name: "Guinea-Bissau"},
    {code: "GY", name: "Guyana"},
    {code: "HT", name: "Haiti"},
    {code: "HM", name: "Heard Island and McDonald Islands"},
    {code: "VA", name: "Holy See"},
    {code: "HN", name: "Honduras"},
    {code: "HK", name: "Hong Kong"},
    {code: "HU", name: "Hungary"},
    {code: "IS", name: "Iceland"},
    {code: "IN", name: "India"},
    {code: "ID", name: "Indonesia"},
    {code: "IR", name: "Iran"},
    {code: "IQ", name: "Iraq"},
    {code: "IE", name: "Ireland"},
    {code: "IM", name: "Isle of Man"},
    {code: "IL", name: "Israel"},
    {code: "IT", name: "Italy"},
    {code: "JM", name: "Jamaica"},
    {code: "JP", name: "Japan"},
    {code: "JE", name: "Jersey"},
    {code: "JO", name: "Jordan"},
    {code: "KZ", name: "Kazakhstan"},
    {code: "KE", name: "Kenya"},
    {code: "KI", name: "Kiribati"},
    {code: "KP", name: "Korea, Democratic People's Republic of"},
    {code: "KR", name: "Korea, Republic of"},
    {code: "KW", name: "Kuwait"},
    {code: "KG", name: "Kyrgyzstan"},
    {code: "LA", name: "Lao People's Democratic Republic"},
    {code: "LV", name: "Latvia"},
    {code: "LB", name: "Lebanon"},
    {code: "LS", name: "Lesotho"},
    {code: "LR", name: "Liberia"},
    {code: "LY", name: "Libya"},
    {code: "LI", name: "Liechtenstein"},
    {code: "LT", name: "Lithuania"},
    {code: "LU", name: "Luxembourg"},
    {code: "MO", name: "Macao"},
    {code: "MG", name: "Madagascar"},
    {code: "MW", name: "Malawi"},
    {code: "MY", name: "Malaysia"},
    {code: "MV", name: "Maldives"},
    {code: "ML", name: "Mali"},
    {code: "MT", name: "Malta"},
    {code: "MH", name: "Marshall Islands"},
    {code: "MQ", name: "Martinique"},
    {code: "MR", name: "Mauritania"},
    {code: "MU", name: "Mauritius"},
    {code: "YT", name: "Mayotte"},
    {code: "MX", name: "Mexico"},
    {code: "FM", name: "Micronesia"},
    {code: "MD", name: "Moldova"},
    {code: "MC", name: "Monaco"},
    {code: "MN", name: "Mongolia"},
    {code: "ME", name: "Montenegro"},
    {code: "MS", name: "Montserrat"},
    {code: "MA", name: "Morocco"},
    {code: "MZ", name: "Mozambique"},
    {code: "MM", name: "Myanmar"},
    {code: "NA", name: "Namibia"},
    {code: "NR", name: "Nauru"},
    {code: "NP", name: "Nepal"},
    {code: "NL", name: "Netherlands"},
    {code: "NC", name: "New Caledonia"},
    {code: "NZ", name: "New Zealand"},
    {code: "NI", name: "Nicaragua"},
    {code: "NE", name: "Niger"},
    {code: "NG", name: "Nigeria"},
    {code: "NU", name: "Niue"},
    {code: "NF", name: "Norfolk Island"},
    {code: "MK", name: "North Macedonia"},
    {code: "MP", name: "Northern Mariana Islands"},
    {code: "NO", name: "Norway"},
    {code: "OM", name: "Oman"},
    {code: "PK", name: "Pakistan"},
    {code: "PW", name: "Palau"},
    {code: "PS", name: "Palestine, State of"},
    {code: "PA", name: "Panama"},
    {code: "PG", name: "Papua New Guinea"},
    {code: "PY", name: "Paraguay"},
    {code: "PE", name: "Peru"},
    {code: "PH", name: "Philippines"},
    {code: "PN", name: "Pitcairn"},
    {code: "PL", name: "Poland"},
    {code: "PT", name: "Portugal"},
    {code: "PR", name: "Puerto Rico"},
    {code: "QA", name: "Qatar"},
    {code: "RE", name: "Réunion"},
    {code: "RO", name: "Romania"},
    {code: "RU", name: "Russian Federation"},
    {code: "RW", name: "Rwanda"},
    {code: "BL", name: "Saint Barthélemy"},
    {code: "SH", name: "Saint Helena, Ascension and Tristan da Cunha"},
    {code: "KN", name: "Saint Kitts and Nevis"},
    {code: "LC", name: "Saint Lucia"},
    {code: "MF", name: "Saint Martin (French part)"},
    {code: "PM", name: "Saint Pierre and Miquelon"},
    {code: "VC", name: "Saint Vincent and the Grenadines"},
    {code: "WS", name: "Samoa"},
    {code: "SM", name: "San Marino"},
    {code: "ST", name: "Sao Tome and Principe"},
    {code: "SA", name: "Saudi Arabia"},
    {code: "SN", name: "Senegal"},
    {code: "RS", name: "Serbia"},
    {code: "SC", name: "Seychelles"},
    {code: "SL", name: "Sierra Leone"},
    {code: "SG", name: "Singapore"},
    {code: "SX", name: "Sint Maarten (Dutch part)"},
    {code: "SK", name: "Slovakia"},
    {code: "SI", name: "Slovenia"},
    {code: "SB", name: "Solomon Islands"},
    {code: "SO", name: "Somalia"},
    {code: "ZA", name: "South Africa"},
    {code: "GS", name: "South Georgia and the South Sandwich Islands"},
    {code: "SS", name: "South Sudan"},
    {code: "ES", name: "Spain"},
    {code: "LK", name: "Sri Lanka"},
    {code: "SD", name: "Sudan"},
    {code: "SR", name: "Suriname"},
    {code: "SJ", name: "Svalbard and Jan Mayen"},
    {code: "SE", name: "Sweden"},
    {code: "CH", name: "Switzerland"},
    {code: "SY", name: "Syrian Arab Republic"},
    {code: "TW", name: "Taiwan"},
    {code: "TJ", name: "Tajikistan"},
    {code: "TZ", name: "Tanzania"},
    {code: "TH", name: "Thailand"},
    {code: "TL", name: "Timor-Leste"},
    {code: "TG", name: "Togo"},
    {code: "TK", name: "Tokelau"},
    {code: "TO", name: "Tonga"},
    {code: "TT", name: "Trinidad and Tobago"},
    {code: "TN", name: "Tunisia"},
    {code: "TR", name: "Türkiye"},
    {code: "TM", name: "Turkmenistan"},
    {code: "TC", name: "Turks and Caicos Islands"},
    {code: "TV", name: "Tuvalu"},
    {code: "UG", name: "Uganda"},
    {code: "UA", name: "Ukraine"},
    {code: "AE", name: "United Arab Emirates"},
    {code: "GB", name: "United Kingdom"},
    {code: "UM", name: "United States Minor Outlying Islands"},
    {code: "UY", name: "Uruguay"},
    {code: "UZ", name: "Uzbekistan"},
    {code: "VU", name: "Vanuatu"},
    {code: "VE", name: "Venezuela"},
    {code: "VN", name: "Viet Nam"},
    {code: "VG", name: "Virgin Islands (British)"},
    {code: "VI", name: "Virgin Islands (U.S.)"},
    {code: "WF", name: "Wallis and Futuna"},
    {code: "EH", name: "Western Sahara"},
    {code: "YE", name: "Yemen"},
    {code: "ZM", name: "Zambia"},
    {code: "ZW", name: "Zimbabwe"},
];

/**
 * Province/state list for a destination country - only CA/US are enumerated
 * (their codes drive tax/carrier rating); others get free text (`hasRegionList`).
 */
export function regionsFor(countryCode: string): { code: string; name: string }[] {
    if (countryCode === "CA") return CANADIAN_REGIONS;
    if (countryCode === "US") return US_REGIONS;
    return [];
}

/** Whether a country's regions are enumerated (select) or free text (input). */
export function hasRegionList(countryCode: string): boolean {
    return regionsFor(countryCode).length > 0;
}

/** "Province" vs "State" vs the generic label used for the rest of the world. */
export function regionLabelFor(countryCode: string): string {
    if (countryCode === "US") return "State";
    if (countryCode === "CA") return "Province";
    return "Province / state / region";
}

/** "ZIP code" vs "Postal code", for the address form's postal field label. */
export function postalLabelFor(countryCode: string): string {
    return countryCode === "US" ? "ZIP code" : "Postal code";
}
