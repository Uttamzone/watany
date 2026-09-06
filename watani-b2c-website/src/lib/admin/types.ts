import type {ApprovalStatus, PricingGroup} from "@/lib/auth";

export type {ApprovalStatus, PricingGroup};

// Catalogue - mirrors AdminDtos (catalogue section) in AuthController's package.

export type CategoryRequest = {
    slug: string;
    name: string;
    tagline?: string | null;
    active?: boolean | null;
};

export type CategoryResponse = {
    id: number;
    slug: string;
    name: string;
    tagline: string | null;
    active: boolean;
    productCount: number;
};

// Settings - mirrors SettingsDtos. Master data Setup > HS code tax rates.

export type HsCodeTaxRateRequest = {
    hsCode: string;
    /** Decimal fraction, e.g. 0.13 for 13%. */
    rate: number;
};

export type HsCodeTaxRateResponse = {
    id: number;
    hsCode: string;
    rate: number;
    /** Products currently using this HS code, for display only. */
    productNames: string[];
};

// Settings - mirrors SettingsDtos. Master data Setup > Shipping rates.

export type ShippingRateRequest = {
    countryCode: string;
    /** Standard shipping charge for this country, in order currency. */
    flatRate: number;
};

export type ShippingRateResponse = {
    id: number;
    countryCode: string;
    flatRate: number;
};

// Settings - mirrors SettingsDtos. Master data Setup > Shipping origin.

export type ShippingOriginRequest = {
    name: string;
    addressLine1: string;
    city: string;
    region: string;
    postalCode: string;
    country: string;
    phoneNumber: string;
    email: string;
};

// Settings - mirrors SettingsDtos. Master data Setup > Pallet shipping.

export type PalletShippingSettingsRequest = {
    /** Weight (in grams) that fits on one pallet before another is needed. */
    weightPerPalletGrams: number;
    /** Flat shipping charge per pallet, in order currency. */
    ratePerPallet: number;
};

export type PalletShippingSettingsResponse = {
    id: number;
    weightPerPalletGrams: number;
    ratePerPallet: number;
};

export type ShippingOriginResponse = {
    id: number;
    name: string;
    addressLine1: string;
    city: string;
    region: string;
    postalCode: string;
    country: string;
    phoneNumber: string;
    email: string;
};

// Settings - mirrors SettingsDtos. Master data Setup > Currency rates.
// Display-only: never affects pricing, checkout, or what Stripe charges.

export type CurrencyExchangeRateRequest = {
    currencyCode: string;
    /** Units of this currency per 1 CAD - display-only. */
    rateToCad: number;
};

export type CurrencyExchangeRateResponse = {
    id: number;
    currencyCode: string;
    rateToCad: number;
};

export type PriceTierRequest = {
    id?: number | null;
    pricingGroup: PricingGroup;
    unitPrice: number;
    minQuantity?: number | null;
    compareAtPrice?: number | null;
    validFrom?: string | null;
    validTo?: string | null;
};

export type VariantRequest = {
    id?: number | null;
    sku: string;
    unit: string;
    stockQuantity: number;
    lowStockThreshold?: number | null;
    backorderAllowed?: boolean | null;
    weightGrams?: number | null;
    /** Box size in cm; feeds both the shipping quote and the spec table. */
    lengthCm?: number | null;
    widthCm?: number | null;
    heightCm?: number | null;
    /** Harmonized System code for customs/import declarations (e.g. Freightcom). */
    hsCode?: string | null;
    /** Customs declaration data - defaults to "Israel" server-side when omitted. */
    customsCountryOfOrigin?: string | null;
    /** Plain commercial description for customs; the storefront name is marketing copy. */
    customsDescription?: string | null;
    /** Manufacturer's full legal name and address, as required on a customs declaration. */
    customsManufacturer?: string | null;
    /** Whether this variant's price is subject to tax at checkout. Defaults to true. */
    taxable?: boolean | null;
    priceTiers: PriceTierRequest[];
};

export type ProductRequest = {
    slug: string;
    name: string;
    fullName: string;
    subtitle?: string | null;
    description?: string | null;
    /** Long-form HTML rendered in the storefront's Description tab. */
    longDescription?: string | null;
    categorySlug: string;
    brandSlug?: string | null;
    region?: string | null;
    material?: string | null;
    color?: string | null;
    badge?: string | null;
    active?: boolean | null;
    variants: VariantRequest[];
};

export type AdminPriceTierResponse = {
    id: number;
    pricingGroup: PricingGroup;
    unitPrice: number;
    minQuantity: number | null;
    compareAtPrice: number | null;
    validFrom: string | null;
    validTo: string | null;
};

export type AdminVariantResponse = {
    id: number;
    sku: string;
    unit: string;
    stockQuantity: number;
    lowStockThreshold: number | null;
    backorderAllowed: boolean;
    lowStock: boolean;
    weightGrams: number | null;
    lengthCm: number | null;
    widthCm: number | null;
    heightCm: number | null;
    hsCode: string | null;
    customsCountryOfOrigin: string | null;
    customsDescription: string | null;
    customsManufacturer: string | null;
    taxable: boolean;
    priceTiers: AdminPriceTierResponse[];
};

export type AdminImageResponse = {
    id: number;
    url: string;
    altText: string | null;
    displayOrder: number;
    isDefault: boolean;
};

export type AdminProductResponse = {
    id: number;
    slug: string;
    name: string;
    fullName: string;
    subtitle: string | null;
    description: string | null;
    longDescription: string | null;
    categorySlug: string;
    brandSlug: string | null;
    region: string | null;
    material: string | null;
    color: string | null;
    badge: string | null;
    active: boolean;
    images: AdminImageResponse[];
    variants: AdminVariantResponse[];
};

export type StockUpdateRequest = {
    stockQuantity: number;
};

export type ProductSortField = "name" | "categorySlug" | "active";

// Bulk upload - mirrors AdminDtos.BulkUploadResponse / BulkUploadRowResult.

export type BulkUploadRowResult = {
    rowNumber: number;
    slug: string | null;
    sku: string | null;
    success: boolean;
    message: string;
};

export type BulkUploadResponse = {
    totalRows: number;
    succeeded: number;
    failed: number;
    results: BulkUploadRowResult[];
    /** Base64-encoded .xlsx containing only the failed rows plus their error reason; null when nothing failed. */
    failedRowsWorkbookBase64: string | null;
};

// Bulk image upload - mirrors AdminDtos.BulkImageUploadResponse / BulkImageUploadRowResult.

export type BulkImageUploadRowResult = {
    fileName: string;
    slug: string | null;
    order: number | null;
    success: boolean;
    message: string;
};

export type BulkImageUploadResponse = {
    totalFiles: number;
    succeeded: number;
    failed: number;
    results: BulkImageUploadRowResult[];
};

// Orders - mirrors OrderDtos.OrderResponse / AdminDtos (orders section).

export type OrderStatus =
    | "PENDING_PAYMENT"
    | "AWAITING_PAYMENT_VERIFICATION"
    | "PLACED"
    | "PAID"
    | "PROCESSING"
    | "PACKED"
    | "SHIPPED"
    | "OUT_FOR_DELIVERY"
    | "DELIVERED"
    | "CANCELLED"
    | "REFUNDED";

export type PaymentStatus =
    | "PENDING"
    | "AUTHORIZED"
    | "CAPTURED"
    | "FAILED"
    | "REFUNDED"
    | "PARTIALLY_REFUNDED"
    | "DISPUTED";

export type PaymentMethod = "STRIPE" | "E_TRANSFER" | "CHEQUE";

/** Mirrors OrderStatus.canTransitionTo - UX-only, backend is the real gate. */
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
    // Payment callbacks own this transition; admins must not manually mark an
    // unverified checkout as paid or placed.
    PENDING_PAYMENT: [],
    // Customer chose E-Transfer/Cheque; an admin verifies receipt manually
    // (there is no payment callback to own this transition).
    AWAITING_PAYMENT_VERIFICATION: ["PAID", "CANCELLED"],
    PLACED: ["PAID", "CANCELLED"],
    PAID: ["PROCESSING", "CANCELLED", "REFUNDED"],
    // PACKED is reached only via the Pack panel (boxes must actually be saved),
    // not as a bare "Mark as PACKED" button - see order-pack-panel.tsx.
    PROCESSING: ["CANCELLED", "REFUNDED"],
    PACKED: ["SHIPPED", "CANCELLED", "REFUNDED"],
    SHIPPED: ["OUT_FOR_DELIVERY", "DELIVERED", "REFUNDED"],
    OUT_FOR_DELIVERY: ["DELIVERED", "REFUNDED"],
    DELIVERED: ["REFUNDED"],
    CANCELLED: [],
    REFUNDED: [],
};

export type AddressRequest = {
    fullName: string;
    line1: string;
    line2?: string | null;
    city: string;
    region: string;
    postalCode: string;
    country: string;
    phone?: string | null;
};

export type OrderLine = {
    id: number;
    productName: string;
    productSlug: string;
    sku: string;
    unit: string;
    image: string;
    quantity: number;
    unitPrice: number;
    retailPrice?: number;
    wholesalePrice?: number;
    lineTotal: number;
    appliedGroup: PricingGroup;
    requestedGroup: PricingGroup;
    taxable: boolean;
    /** Single unit's weight from the variant at order time; null if never set. Used to suggest fulfillment box weight. */
    unitWeightGrams: number | null;
};

export type OrderEventResponse = {
    status: OrderStatus;
    message: string | null;
    at: string;
};

export type OrderResponse = {
    id: number;
    orderNumber: string;
    email: string;
    status: OrderStatus;
    paymentStatus: PaymentStatus;
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
    labelUrl: string | null;
    shippingAddress: AddressRequest;
    items: OrderLine[];
    timeline: OrderEventResponse[];
    placedAt: string;
    /** Token for the public "rate your order" link; null until the order is paid. */
    reviewToken: string | null;
};

export type StatusTransitionRequest = {
    status: OrderStatus;
    message?: string | null;
};

export type RefundRequest = {
    amount?: number | null;
};

export type MarkPaidRequest = {
    reference?: string | null;
    note?: string | null;
};

export type PackagingType = "PACKAGE" | "PALLET";

export type BookShipmentRequest = {
    serviceCode?: string | null;
    /** Selected rate's carrier cost from the last quote - internal margin record only, never shown to the customer. */
    carrierCost?: number | null;
    /** Packaging type the selected rate was quoted under; must match on booking. */
    packagingType?: PackagingType | null;
};

// Fulfillment / packing - mirrors AdminDtos order-box records.

export type OrderBoxItemRequest = {
    orderItemId: number;
    quantity: number;
};

export type OrderBoxRequest = {
    lengthIn: number;
    widthIn: number;
    heightIn: number;
    weightGrams: number;
    label?: string | null;
    items: OrderBoxItemRequest[];
};

export type ReplaceBoxesRequest = {
    boxes: OrderBoxRequest[];
};

export type OrderBoxItemResponse = {
    id: number;
    orderItemId: number;
    productName: string;
    sku: string;
    quantity: number;
};

export type OrderBoxResponse = {
    id: number;
    sequence: number;
    weightGrams: number;
    lengthIn: number;
    widthIn: number;
    heightIn: number;
    label: string | null;
    autoGenerated: boolean;
    items: OrderBoxItemResponse[];
};

export type BoxesResponse = {
    boxes: OrderBoxResponse[];
    order: OrderResponse;
};

export type ShippingRateOption = {
    serviceCode: string;
    carrierName: string;
    serviceName: string;
    cost: number;
    /** What the carrier actually charges Watani for this service - admin-only, has nothing to do with `cost`/the customer's invoice. */
    carrierCost: number;
    etaDays: number | null;
    /** Whether this is a small-parcel courier rate or a palletized LTL freight rate. */
    packagingType: PackagingType;
};

/** Order detail with the admin-only carrier cost attached - never present on the customer-facing OrderResponse. */
export type AdminOrderDetail = {
    order: OrderResponse;
    /** What Watani paid the carrier for the booked shipment; null until one is booked. */
    carrierCost: number | null;
};

export const DEFAULT_BOX_LENGTH_IN = 14;
export const DEFAULT_BOX_WIDTH_IN = 10;
export const DEFAULT_BOX_HEIGHT_IN = 10;

export type OrderSortField = "orderNumber" | "email" | "status" | "grandTotal" | "createdAt";

// Customers - mirrors AdminDtos (customers section).

export type CustomerResponse = {
    id: number;
    email: string;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    companyName: string | null;
    taxId?: string | null;
    businessLicenceRef?: string | null;
    pricingGroup: PricingGroup;
    requestedGroup: PricingGroup | null;
    approvalStatus: ApprovalStatus;
    enabled: boolean;
    createdAt: string;
    defaultAddress: AddressRequest | null;
};

/** Backend-paginated list wrapper - mirrors AdminDtos.PageResponse. */
export type PageResponse<T> = {
    content: T[];
    page: number;
    size: number;
    totalElements: number;
    totalPages: number;
};

export type CustomerSortField = "firstName" | "lastName" | "email" | "createdAt";
export type SortDirection = "asc" | "desc";

export type AssignGroupRequest = {
    pricingGroup: PricingGroup;
};

// Staff - mirrors AdminDtos (staff section).

export type StaffResponse = {
    id: number;
    email: string;
    firstName: string | null;
    lastName: string | null;
    roles: string[];
    enabled: boolean;
    createdAt: string;
};

export type CreateStaffRequest = {
    email: string;
    password: string;
    firstName?: string | null;
    lastName?: string | null;
    roleName: string;
};

export type AssignStaffRoleRequest = {
    roleName: string;
};

export type RoleResponse = {
    id: number;
    name: string;
    description: string | null;
};

export type StaffSortField = "firstName" | "lastName" | "email" | "createdAt";

export type ApprovalDecisionRequest = {
    approve: boolean;
    targetGroup?: PricingGroup;
};

export type ApprovalStatusRequest = {
    approvalStatus: ApprovalStatus;
};

// Reports - mirrors AdminDtos (reports section).

export type DashboardKpis = {
    revenue30Days: number;
    ordersTotal: number;
    ordersAwaitingFulfilment: number;
    averageOrderValue: number;
    lowStockCount: number;
    pendingApprovals: number;
    pendingReviews: number;
};

export type SalesReportDimension = "day" | "week" | "month" | "group" | "status" | "product";

export type SalesReportRow = {
    label: string;
    orderCount: number;
    revenue: number;
};

export type AuditLog = {
    id: number;
    actor: string;
    action: string;
    entityType: string;
    entityId: string;
    previousValue: string | null;
    newValue: string | null;
    ipAddress: string | null;
    createdAt: string;
};

// Marketing - these endpoints serialize raw JPA entities, not DTOs.

export type DiscountType = "PERCENTAGE" | "FIXED_AMOUNT" | "FREE_SHIPPING";

export type Coupon = {
    id?: number;
    code: string;
    description?: string | null;
    discountType: DiscountType;
    discountValue: number;
    minOrderSubtotal?: number | null;
    maxDiscount?: number | null;
    usageLimit?: number | null;
    usageCount?: number;
    perUserLimit?: number | null;
    validFrom?: string | null;
    validTo?: string | null;
    active: boolean;
    applicableGroups: PricingGroup[];
};

export type CouponSortField = "code" | "discountValue" | "active";

export type ModerationStatus = "PENDING" | "APPROVED" | "REJECTED";

export type Review = {
    id: number;
    product?: { id: number; slug?: string; name?: string } | null;
    authorName: string;
    rating: number;
    title: string | null;
    body: string | null;
    status: ModerationStatus;
    createdAt?: string;
};

export type ContentType = "BANNER" | "PAGE" | "NAVIGATION" | "EMAIL_TEMPLATE";

export type ContentBlock = {
    id?: number;
    slug: string;
    type: ContentType;
    title: string;
    payload: string;
    displayOrder: number;
    published: boolean;
    createdAt?: string;
    updatedAt?: string;
};

export type ContentSortField = "slug" | "title" | "type" | "displayOrder" | "published";

/** Structured schema this admin UI defines for BANNER payloads - nothing enforces this server-side. */
export type BannerPayload = {
    imageUrl: string;
    headline: string;
    subheadline?: string;
    ctaLabel?: string;
    ctaHref?: string;
    startsAt?: string;
    endsAt?: string;
};
