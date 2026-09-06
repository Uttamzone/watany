import { apiFetch, apiFetchBlob, apiFetchForm, ApiError } from "@/lib/api";
import { products as fallbackProducts } from "@/lib/catalogue";
import type {
    AdminImageResponse,
    AdminOrderDetail,
    AdminProductResponse,
    AdminVariantResponse,
    ApprovalDecisionRequest,
    ApprovalStatusRequest,
    AssignGroupRequest,
    AssignStaffRoleRequest,
    AuditLog,
    BookShipmentRequest,
    BoxesResponse,
    BulkImageUploadResponse,
    BulkUploadResponse,
    CategoryRequest,
    CategoryResponse,
    ContentBlock,
    ContentSortField,
    Coupon,
    CouponSortField,
    CreateStaffRequest,
    CurrencyExchangeRateRequest,
    CurrencyExchangeRateResponse,
    CustomerResponse,
    CustomerSortField,
    DashboardKpis,
    HsCodeTaxRateRequest,
    HsCodeTaxRateResponse,
    MarkPaidRequest,
    OrderBoxResponse,
    OrderResponse,
    OrderSortField,
    PageResponse,
    PalletShippingSettingsRequest,
    PalletShippingSettingsResponse,
    ProductRequest,
    ProductSortField,
    RefundRequest,
    ReplaceBoxesRequest,
    Review,
    RoleResponse,
    SalesReportDimension,
    SalesReportRow,
    ShippingOriginRequest,
    ShippingOriginResponse,
    ShippingRateOption,
    ShippingRateRequest,
    ShippingRateResponse,
    SortDirection,
    StaffResponse,
    StaffSortField,
    StatusTransitionRequest,
    StockUpdateRequest,
} from "@/lib/admin/types";

// Helper to fall back gracefully to stateful data when backend API is offline
async function fetchWithFallback<T>(fetcher: () => Promise<T>, fallback: T | (() => T)): Promise<T> {
    try {
        return await fetcher();
    } catch {
        return typeof fallback === "function" ? (fallback as () => T)() : fallback;
    }
}

// Full 8 Storefront Categories
let stateCategories: CategoryResponse[] = [
    { id: 1, slug: "olive-oil", name: "Olive Oil", tagline: "Palestinian harvest", active: true, productCount: 7 },
    { id: 2, slug: "olives", name: "Olives", tagline: "Jenin & regional varieties", active: true, productCount: 2 },
    { id: 3, slug: "zaatar", name: "Zaatar", tagline: "Herbs and blends", active: true, productCount: 3 },
    { id: 4, slug: "cheese", name: "Cheese", tagline: "Nabulsi selection", active: true, productCount: 2 },
    { id: 5, slug: "ceramics", name: "Ceramics", tagline: "Palestinian craft", active: true, productCount: 4 },
    { id: 6, slug: "spices-grains", name: "Spices & Grains", tagline: "Pantry staples", active: true, productCount: 2 },
    { id: 7, slug: "ghee", name: "Ghee", tagline: "Traditional samneh", active: true, productCount: 1 },
    { id: 8, slug: "beauty-care", name: "Beauty Care", tagline: "Olive oil soap & care", active: true, productCount: 1 },
];

export function mapCatalogueToAdminProduct(p: any, index = 0): AdminProductResponse {
    const id = typeof p.id === "number" ? p.id : parseInt(p.id, 10) || (index + 1);
    const mainImg = (p.image && typeof p.image === "string" && p.image.trim()) ? p.image : "/images/placeholder.png";
    const galleryImgs = p.gallery && Array.isArray(p.gallery) && p.gallery.length > 0 ? p.gallery : [mainImg];

    const parsedPrice = typeof p.price === "number" && !isNaN(p.price)
        ? p.price
        : (p.priceMajor != null ? (parseFloat(`${p.priceMajor}.${p.priceMinor || '00'}`) || 50) : 50);

    return {
        id,
        slug: p.slug,
        name: p.name,
        fullName: p.fullName || p.name,
        subtitle: p.subtitle ?? null,
        description: p.description ?? null,
        longDescription: p.longDescription ?? null,
        categorySlug: p.category || "olive-oil",
        brandSlug: p.brand || "watani",
        region: p.region ?? null,
        material: p.material ?? null,
        color: p.color ?? null,
        badge: p.badge ?? null,
        active: true,
        images: galleryImgs.map((url: string, imgIdx: number) => ({
            id: imgIdx + 1,
            url,
            altText: p.name,
            displayOrder: imgIdx + 1,
            isDefault: imgIdx === 0,
        })),
        variants: (p.variants && p.variants.length > 0) ? p.variants.map((v: any, vIdx: number) => ({
            id: v.id || (id * 10 + vIdx),
            sku: v.sku || p.sku || `SKU-${id}`,
            unit: v.unit || p.unit || "Each",
            stockQuantity: v.stockQuantity ?? p.stockQuantity ?? 50,
            lowStockThreshold: 5,
            backorderAllowed: false,
            lowStock: (v.stockQuantity ?? p.stockQuantity ?? 50) <= 5,
            weightGrams: v.specifications?.weightGrams ?? p.specifications?.weightGrams ?? 1000,
            lengthCm: v.specifications?.lengthCm ?? p.specifications?.lengthCm ?? 10,
            widthCm: v.specifications?.widthCm ?? p.specifications?.widthCm ?? 10,
            heightCm: v.specifications?.heightCm ?? p.specifications?.heightCm ?? 10,
            hsCode: "1509.10",
            customsCountryOfOrigin: "Palestine",
            customsDescription: p.name,
            customsManufacturer: "Watani Co-op",
            taxable: true,
            priceTiers: [
                {
                    id: 1,
                    pricingGroup: "RETAIL",
                    unitPrice: v.price ?? parsedPrice,
                    minQuantity: v.minimumOrderQuantity ?? v.minQuantity ?? p.minimumOrderQuantity ?? p.minQuantity ?? 1,
                    compareAtPrice: p.compareAtPrice ?? null,
                    validFrom: null,
                    validTo: null,
                },
            ],
        })) : [
            {
                id: id * 10,
                sku: p.sku || `SKU-${id}`,
                unit: p.unit || "Each",
                stockQuantity: p.stockQuantity ?? (index % 11 === 0 ? 0 : index % 7 === 0 ? 3 : 50),
                lowStockThreshold: 5,
                backorderAllowed: false,
                lowStock: (p.stockQuantity ?? (index % 11 === 0 ? 0 : index % 7 === 0 ? 3 : 50)) <= 5,
                weightGrams: p.specifications?.weightGrams ?? 1000,
                lengthCm: p.specifications?.lengthCm ?? p.specifications?.lengthCm ?? 10,
                widthCm: p.specifications?.widthCm ?? p.specifications?.widthCm ?? 10,
                heightCm: p.specifications?.heightCm ?? p.specifications?.heightCm ?? 10,
                hsCode: "1509.10",
                customsCountryOfOrigin: "Palestine",
                customsDescription: p.name,
                customsManufacturer: "Watani Co-op",
                taxable: true,
                priceTiers: [
                    {
                        id: 1,
                        pricingGroup: "RETAIL",
                        unitPrice: parsedPrice,
                        minQuantity: p.minimumOrderQuantity ?? p.minQuantity ?? 1,
                        compareAtPrice: p.compareAtPrice ?? null,
                        validFrom: null,
                        validTo: null,
                    },
                ],
            },
        ],
    };
}

// All 226 Storefront Products mapped for Admin Management
let stateProducts: AdminProductResponse[] = fallbackProducts.map((p, idx) => mapCatalogueToAdminProduct(p, idx));

let stateOrders: OrderResponse[] = [
    {
        id: 501,
        orderNumber: "ORD-2026-1001",
        email: "customer@watani.ca",
        status: "PROCESSING",
        paymentStatus: "CAPTURED",
        paymentMethod: "STRIPE",
        pricingGroup: "RETAIL",
        subtotal: 44.98,
        discountTotal: 0,
        shippingTotal: 12.00,
        taxTotal: 7.41,
        grandTotal: 64.39,
        refundedTotal: 0,
        currency: "CAD",
        couponCode: null,
        carrierName: "Canada Post",
        shippingMethod: "Expedited Parcel",
        trackingNumber: "7038192049182",
        trackingUrl: "https://www.canadapost-postescanada.ca/track-repérage/en#/details/7038192049182",
        labelUrl: null,
        shippingAddress: {
            fullName: "Sami Al-Hassan",
            line1: "125 Bank Street",
            line2: "Apt 4B",
            city: "Ottawa",
            region: "ON",
            postalCode: "K1P 5N5",
            country: "Canada",
            phone: "613-555-0192"
        },
        items: [
            {
                id: 1,
                productName: "WATANY Olive Oil - Tulkarm (1L)",
                productSlug: "watany-olive-oil-tulkarm-1l",
                sku: "WS-OO-TLK-1L",
                unit: "1L",
                image: "/art/olive_oil.jpeg",
                quantity: 1,
                unitPrice: 23.46,
                lineTotal: 23.46,
                appliedGroup: "RETAIL",
                requestedGroup: "RETAIL",
                taxable: true,
                unitWeightGrams: 1000
            }
        ],
        timeline: [
            { status: "PLACED", message: "Order placed by customer", at: new Date(Date.now() - 86400000).toISOString() },
            { status: "PAID", message: "Payment captured via Stripe", at: new Date(Date.now() - 86000000).toISOString() },
            { status: "PROCESSING", message: "Sent to warehouse for fulfillment", at: new Date(Date.now() - 40000000).toISOString() }
        ],
        placedAt: new Date(Date.now() - 86400000).toISOString(),
        reviewToken: "rev-tok-1001"
    },
    {
        id: 502,
        orderNumber: "ORD-2026-1002",
        email: "wholesale@gourmetmarket.ca",
        status: "SHIPPED",
        paymentStatus: "CAPTURED",
        paymentMethod: "E_TRANSFER",
        pricingGroup: "WHOLESALE",
        subtotal: 1550.00,
        discountTotal: 0,
        shippingTotal: 45.00,
        taxTotal: 207.35,
        grandTotal: 1802.35,
        refundedTotal: 0,
        currency: "CAD",
        couponCode: null,
        carrierName: "UPS",
        shippingMethod: "Standard",
        trackingNumber: "1Z9999999999999999",
        trackingUrl: "https://www.ups.com/track?loc=en_CA&tracknum=1Z9999999999999999",
        labelUrl: null,
        shippingAddress: {
            fullName: "Fatima Mansour",
            line1: "450 Queen St W",
            line2: null,
            city: "Toronto",
            region: "ON",
            postalCode: "M5V 2A8",
            country: "Canada",
            phone: "416-555-0144"
        },
        items: [
            {
                id: 3,
                productName: "WATANY Olive Oil - Tulkarm (16L Tin)",
                productSlug: "watany-olive-oil-tulkarm-16l",
                sku: "WS-OO-TLK-16L",
                unit: "16L",
                image: "/art/olive_oil.jpeg",
                quantity: 5,
                unitPrice: 310.00,
                lineTotal: 1550.00,
                appliedGroup: "WHOLESALE",
                requestedGroup: "WHOLESALE",
                taxable: true,
                unitWeightGrams: 16000
            }
        ],
        timeline: [
            { status: "PLACED", message: "Order placed by customer", at: new Date(Date.now() - 172800000).toISOString() },
            { status: "PAID", message: "E-Transfer confirmed by admin", at: new Date(Date.now() - 160000000).toISOString() },
            { status: "SHIPPED", message: "Booked with UPS Standard", at: new Date(Date.now() - 70000000).toISOString() }
        ],
        placedAt: new Date(Date.now() - 172800000).toISOString(),
        reviewToken: "rev-tok-1002"
    }
];

let stateCustomers: CustomerResponse[] = [
    {
        id: 1,
        email: "wataniadmin@wataniandsons.ca",
        firstName: "Watani",
        lastName: "Admin",
        phone: "+1 613-854-7777",
        companyName: "Watani & Sons Corp",
        pricingGroup: "RETAIL",
        requestedGroup: null,
        approvalStatus: "APPROVED",
        enabled: true,
        createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
        defaultAddress: null
    },
    {
        id: 2,
        email: "wholesale@gourmetmarket.ca",
        firstName: "Fatima",
        lastName: "Mansour",
        phone: "416-555-0144",
        companyName: "Gourmet Levant Market",
        pricingGroup: "WHOLESALE",
        requestedGroup: "WHOLESALE",
        approvalStatus: "PENDING",
        enabled: true,
        createdAt: new Date(Date.now() - 15 * 86400000).toISOString(),
        defaultAddress: null
    }
];

let stateStaff: StaffResponse[] = [
    {
        id: 1,
        email: "wataniadmin@wataniandsons.ca",
        firstName: "Watani",
        lastName: "Admin",
        roles: ["SUPER_ADMIN"],
        enabled: true,
        createdAt: new Date(Date.now() - 60 * 86400000).toISOString()
    }
];

let stateHsCodeTaxRates: HsCodeTaxRateResponse[] = [
    { id: 1, hsCode: "1509.10", rate: 0.13, productNames: ["WATANY Olive Oil - Tulkarm"] },
    { id: 2, hsCode: "0406.90", rate: 0.05, productNames: ["Asliah Nabulsi Cheese"] }
];

let stateShippingRates: ShippingRateResponse[] = [
    { id: 1, countryCode: "CA", flatRate: 15.00 },
    { id: 2, countryCode: "US", flatRate: 25.00 }
];

let stateCurrencyRates: CurrencyExchangeRateResponse[] = [
    { id: 1, currencyCode: "USD", rateToCad: 0.74 },
    { id: 2, currencyCode: "EUR", rateToCad: 0.68 }
];

let stateShippingOrigin: ShippingOriginResponse = {
    id: 1,
    name: "Watani & Sons Central Warehouse",
    addressLine1: "150 Industrial Ave",
    city: "Ottawa",
    region: "ON",
    postalCode: "K1G 3N3",
    country: "CA",
    phoneNumber: "613-854-7777",
    email: "shipping@wataniandsons.ca"
};

let statePalletShipping: PalletShippingSettingsResponse = {
    id: 1,
    weightPerPalletGrams: 500000,
    ratePerPallet: 250
};

const ADMIN_ORDERS_STORAGE_KEY = "watani.adminOrders.v1";
const ADMIN_REVIEWS_STORAGE_KEY = "watani.adminReviews.v1";
const ADMIN_CUSTOMERS_STORAGE_KEY = "watani.adminCustomers.v1";

export function persistCustomersState(): void {
    if (typeof window !== "undefined") {
        try {
            window.localStorage.setItem(ADMIN_CUSTOMERS_STORAGE_KEY, JSON.stringify(stateCustomers));
        } catch {}
    }
}

let stateCoupons: Coupon[] = [];
let stateContentBlocks: ContentBlock[] = [];
let stateReviews: Review[] = [
    {
        id: 101,
        authorName: "Fatima Mansour",
        rating: 5,
        title: "Exceptional Harvest Olive Oil",
        body: "The 16L tin from Tulkarm exceeded our expectations. Truly authentic taste and fast shipping to Toronto.",
        status: "PENDING"
    },
    {
        id: 102,
        authorName: "Sami Al-Hassan",
        rating: 5,
        title: "Smoky and Fresh Freekeh",
        body: "The green wheat is roasted to perfection. Made a traditional chicken freekeh soup and the aroma was incredible.",
        status: "PENDING"
    },
    {
        id: 103,
        authorName: "Youssef Darwish",
        rating: 4,
        title: "Great Zaatar Blend",
        body: "Very aromatic with a generous amount of toasted sesame. Great quality overall.",
        status: "PENDING"
    }
];

function syncOrdersFromStorage() {
    if (typeof window === "undefined") return;
    try {
        const raw = window.localStorage.getItem(ADMIN_ORDERS_STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw) as OrderResponse[];
            if (Array.isArray(parsed) && parsed.length > 0) {
                const existingOrderNums = new Set(stateOrders.map(o => o.orderNumber));
                for (const o of parsed) {
                    if (!existingOrderNums.has(o.orderNumber)) {
                        stateOrders.push(o);
                        existingOrderNums.add(o.orderNumber);
                    }
                }
            }
        }
        const rawUser = window.localStorage.getItem("watani_user_orders");
        if (rawUser) {
            const userOrders = JSON.parse(rawUser) as any[];
            if (Array.isArray(userOrders)) {
                for (const uo of userOrders) {
                    if (uo && uo.orderNumber) {
                        registerOrderForAdmin(uo);
                    }
                }
            }
        }
    } catch {
        // Non-fatal
    }
}

function syncReviewsFromStorage() {
    if (typeof window === "undefined") return;
    try {
        const raw = window.localStorage.getItem(ADMIN_REVIEWS_STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw) as Review[];
            if (Array.isArray(parsed) && parsed.length > 0) {
                const existingIds = new Set(stateReviews.map(r => r.id));
                for (const r of parsed) {
                    if (!existingIds.has(r.id)) {
                        stateReviews.unshift(r);
                        existingIds.add(r.id);
                    }
                }
            }
        }
    } catch {
        // Non-fatal
    }
}

const ADMIN_PRODUCTS_STORAGE_KEY = "watani.adminProducts.v2";
const ADMIN_CATEGORIES_STORAGE_KEY = "watani.adminCategories.v1";

function syncProductsFromStorage() {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.removeItem("watani.adminProducts.v1");
        const raw = window.localStorage.getItem(ADMIN_PRODUCTS_STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw) as AdminProductResponse[];
            if (Array.isArray(parsed) && parsed.length > 0) {
                const map = new Map<string, AdminProductResponse>(stateProducts.map(p => [p.slug, p]));
                for (const item of parsed) {
                    const original = map.get(item.slug);
                    if (original) {
                        if (!item.images || item.images.length === 0 || item.images[0]?.url === "/images/offers/olive-oil.webp") {
                            item.images = original.images;
                        }
                    }
                    map.set(item.slug, item);
                }
                stateProducts = Array.from(map.values());
            }
        }
    } catch {
        // Non-fatal
    }
}

export function persistProductsToStorage() {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.setItem(ADMIN_PRODUCTS_STORAGE_KEY, JSON.stringify(stateProducts));
    } catch {
        // Non-fatal
    }
}

function syncCategoriesFromStorage() {
    if (typeof window === "undefined") return;
    try {
        const raw = window.localStorage.getItem(ADMIN_CATEGORIES_STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw) as CategoryResponse[];
            if (Array.isArray(parsed) && parsed.length > 0) {
                stateCategories = parsed;
            }
        }
    } catch {
        // Non-fatal
    }
}

export function persistCategoriesToStorage() {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.setItem(ADMIN_CATEGORIES_STORAGE_KEY, JSON.stringify(stateCategories));
    } catch {
        // Non-fatal
    }
}

if (typeof window !== "undefined") {
    syncOrdersFromStorage();
    syncReviewsFromStorage();
    syncProductsFromStorage();
    syncCategoriesFromStorage();
}

export function registerOrderForAdmin(order: any): void {
    if (!order || !order.orderNumber) return;
    const formattedOrder: OrderResponse = {
        id: order.id || Date.now(),
        orderNumber: order.orderNumber,
        email: order.email || "customer@watani.ca",
        status: order.status || "PROCESSING",
        paymentStatus: order.paymentStatus || "CAPTURED",
        paymentMethod: order.paymentMethod || "STRIPE",
        pricingGroup: order.pricingGroup || "RETAIL",
        subtotal: order.subtotal || order.grandTotal || 0,
        discountTotal: order.discountTotal || 0,
        shippingTotal: order.shippingTotal || 0,
        taxTotal: order.taxTotal || 0,
        grandTotal: order.grandTotal || 0,
        refundedTotal: order.refundedTotal || 0,
        currency: order.currency || "CAD",
        couponCode: order.couponCode || null,
        carrierName: order.carrierName || "Watani Express Logistics",
        shippingMethod: order.shippingMethod || "Standard Delivery",
        trackingNumber: order.trackingNumber || null,
        trackingUrl: order.trackingUrl || null,
        labelUrl: null,
        shippingAddress: order.shippingAddress || null,
        items: order.items || [],
        timeline: order.timeline || [
            { status: "PLACED", message: "Order placed by customer", at: new Date().toISOString() },
            { status: "PROCESSING", message: "Preparing for fulfillment", at: new Date().toISOString() }
        ],
        placedAt: order.placedAt || new Date().toISOString(),
        reviewToken: order.reviewToken || null
    };

    stateOrders = [formattedOrder, ...stateOrders.filter(o => o.orderNumber !== formattedOrder.orderNumber)];
    
    persistOrdersState();
}

export function persistOrdersState(): void {
    if (typeof window !== "undefined") {
        try {
            window.localStorage.setItem(ADMIN_ORDERS_STORAGE_KEY, JSON.stringify(stateOrders.slice(0, 100)));
            const userOrdersRaw = window.localStorage.getItem("watani_user_orders");
            if (userOrdersRaw) {
                const userOrders: OrderResponse[] = JSON.parse(userOrdersRaw);
                const adminMap = new Map(stateOrders.map(o => [o.orderNumber, o]));
                const updatedUserOrders = userOrders.map(uo => adminMap.get(uo.orderNumber) ?? uo);
                window.localStorage.setItem("watani_user_orders", JSON.stringify(updatedUserOrders));
            }
        } catch {}
    }
}

export function registerReviewForAdmin(review: Review): void {
    if (!review) return;
    stateReviews = [review, ...stateReviews.filter(r => r.id !== review.id)];
    if (typeof window !== "undefined") {
        try {
            window.localStorage.setItem(ADMIN_REVIEWS_STORAGE_KEY, JSON.stringify(stateReviews.slice(0, 100)));
        } catch {
            // Non-fatal
        }
    }
}

function isoWeekLabel(date: Date): string {
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function generateMockSalesReport(dimension: SalesReportDimension, days: number): SalesReportRow[] {
    const now = new Date();
    const rows: SalesReportRow[] = [];
    
    // Group actual non-cancelled stateOrders by dimension bucket
    const ordersMap = new Map<string, { orderCount: number; revenue: number }>();
    for (const order of stateOrders) {
        if (!order.placedAt || order.status === "CANCELLED") continue;
        const orderDate = new Date(order.placedAt);
        let key = "";
        if (dimension === "day") {
            key = orderDate.toISOString().slice(0, 10) + "T00:00:00Z";
        } else if (dimension === "week") {
            key = isoWeekLabel(orderDate);
        } else if (dimension === "month") {
            key = `${orderDate.getUTCFullYear()}-${String(orderDate.getUTCMonth() + 1).padStart(2, "0")}`;
        }
        if (key) {
            const existing = ordersMap.get(key) ?? { orderCount: 0, revenue: 0 };
            existing.orderCount += 1;
            existing.revenue = Math.round((existing.revenue + order.grandTotal) * 100) / 100;
            ordersMap.set(key, existing);
        }
    }

    if (dimension === "day") {
        for (let i = days - 1; i >= 0; i--) {
            const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
            const label = d.toISOString().slice(0, 10) + "T00:00:00Z";
            const actual = ordersMap.get(label);
            rows.push({
                label,
                orderCount: actual ? actual.orderCount : 0,
                revenue: actual ? actual.revenue : 0,
            });
        }
    } else if (dimension === "week") {
        const weeksCount = Math.max(4, Math.ceil(days / 7));
        for (let i = weeksCount - 1; i >= 0; i--) {
            const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i * 7));
            const label = isoWeekLabel(d);
            const actual = ordersMap.get(label);
            rows.push({
                label,
                orderCount: actual ? actual.orderCount : 0,
                revenue: actual ? actual.revenue : 0,
            });
        }
    } else if (dimension === "month") {
        for (let i = 11; i >= 0; i--) {
            const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
            const label = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
            const actual = ordersMap.get(label);
            rows.push({
                label,
                orderCount: actual ? actual.orderCount : 0,
                revenue: actual ? actual.revenue : 0,
            });
        }
    }
    return rows;
}

// Catalogue - /api/admin/catalogue

export function listCategories(): Promise<CategoryResponse[]> {
    return fetchWithFallback(
        () => apiFetch<CategoryResponse[]>("/api/admin/catalogue/categories"),
        () => stateCategories
    );
}

export function createCategory(payload: CategoryRequest): Promise<CategoryResponse> {
    return fetchWithFallback(
        () => apiFetch<CategoryResponse>("/api/admin/catalogue/categories", {
            method: "POST",
            body: JSON.stringify(payload),
        }),
        () => {
            const newCat: CategoryResponse = {
                id: Date.now(),
                slug: payload.slug,
                name: payload.name,
                tagline: payload.tagline ?? null,
                active: payload.active ?? true,
                productCount: 0,
            };
            stateCategories.push(newCat);
            persistCategoriesToStorage();
            return newCat;
        }
    );
}

export function updateCategory(id: number, payload: CategoryRequest): Promise<CategoryResponse> {
    return fetchWithFallback(
        () => apiFetch<CategoryResponse>(`/api/admin/catalogue/categories/${id}`, {
            method: "PUT",
            body: JSON.stringify(payload),
        }),
        () => {
            const idx = stateCategories.findIndex(c => c.id === id);
            let result: CategoryResponse;
            if (idx !== -1) {
                stateCategories[idx] = {
                    ...stateCategories[idx],
                    slug: payload.slug,
                    name: payload.name,
                    tagline: payload.tagline ?? null,
                    active: payload.active ?? true,
                };
                result = stateCategories[idx];
            } else {
                result = {
                    id,
                    slug: payload.slug,
                    name: payload.name,
                    tagline: payload.tagline ?? null,
                    active: payload.active ?? true,
                    productCount: 0,
                };
            }
            persistCategoriesToStorage();
            return result;
        }
    );
}

export function deleteCategory(id: number): Promise<void> {
    return fetchWithFallback(
        () => apiFetch<void>(`/api/admin/catalogue/categories/${id}`, {method: "DELETE"}),
        () => {
            stateCategories = stateCategories.filter(c => c.id !== id);
            persistCategoriesToStorage();
        }
    );
}

// Settings - /api/admin/settings

export function listHsCodeTaxRates(): Promise<HsCodeTaxRateResponse[]> {
    return fetchWithFallback(
        () => apiFetch<HsCodeTaxRateResponse[]>("/api/admin/settings/hs-code-tax-rates"),
        () => stateHsCodeTaxRates
    );
}

export function upsertHsCodeTaxRate(payload: HsCodeTaxRateRequest): Promise<HsCodeTaxRateResponse> {
    return fetchWithFallback(
        () => apiFetch<HsCodeTaxRateResponse>("/api/admin/settings/hs-code-tax-rates", {
            method: "PUT",
            body: JSON.stringify(payload),
        }),
        () => {
            const existingIdx = stateHsCodeTaxRates.findIndex(r => r.hsCode === payload.hsCode);
            if (existingIdx !== -1) {
                stateHsCodeTaxRates[existingIdx].rate = payload.rate;
                return stateHsCodeTaxRates[existingIdx];
            }
            const newRate: HsCodeTaxRateResponse = {
                id: Date.now(),
                hsCode: payload.hsCode,
                rate: payload.rate,
                productNames: []
            };
            stateHsCodeTaxRates.push(newRate);
            return newRate;
        }
    );
}

export function deleteHsCodeTaxRate(id: number): Promise<void> {
    return fetchWithFallback(
        () => apiFetch<void>(`/api/admin/settings/hs-code-tax-rates/${id}`, {method: "DELETE"}),
        () => {
            stateHsCodeTaxRates = stateHsCodeTaxRates.filter(r => r.id !== id);
        }
    );
}

export function listShippingRates(): Promise<ShippingRateResponse[]> {
    return fetchWithFallback(
        () => apiFetch<ShippingRateResponse[]>("/api/admin/settings/shipping-rates"),
        () => stateShippingRates
    );
}

export function upsertShippingRate(payload: ShippingRateRequest): Promise<ShippingRateResponse> {
    return fetchWithFallback(
        () => apiFetch<ShippingRateResponse>("/api/admin/settings/shipping-rates", {
            method: "PUT",
            body: JSON.stringify(payload),
        }),
        () => {
            const idx = stateShippingRates.findIndex(r => r.countryCode === payload.countryCode);
            if (idx !== -1) {
                stateShippingRates[idx].flatRate = payload.flatRate;
                return stateShippingRates[idx];
            }
            const newRate: ShippingRateResponse = { id: Date.now(), countryCode: payload.countryCode, flatRate: payload.flatRate };
            stateShippingRates.push(newRate);
            return newRate;
        }
    );
}

export function getShippingOrigin(): Promise<ShippingOriginResponse | null> {
    return fetchWithFallback(
        () => apiFetch<ShippingOriginResponse | null>("/api/admin/settings/shipping-origin"),
        () => stateShippingOrigin
    );
}

export function updateShippingOrigin(payload: ShippingOriginRequest): Promise<ShippingOriginResponse> {
    return fetchWithFallback(
        () => apiFetch<ShippingOriginResponse>("/api/admin/settings/shipping-origin", {
            method: "PUT",
            body: JSON.stringify(payload),
        }),
        () => {
            stateShippingOrigin = { id: 1, ...payload };
            return stateShippingOrigin;
        }
    );
}

export function listCurrencyRates(): Promise<CurrencyExchangeRateResponse[]> {
    return fetchWithFallback(
        () => apiFetch<CurrencyExchangeRateResponse[]>("/api/admin/settings/currency-rates"),
        () => stateCurrencyRates
    );
}

export function upsertCurrencyRate(
    payload: CurrencyExchangeRateRequest,
): Promise<CurrencyExchangeRateResponse> {
    return fetchWithFallback(
        () => apiFetch<CurrencyExchangeRateResponse>("/api/admin/settings/currency-rates", {
            method: "PUT",
            body: JSON.stringify(payload),
        }),
        () => {
            const idx = stateCurrencyRates.findIndex(r => r.currencyCode === payload.currencyCode);
            if (idx !== -1) {
                stateCurrencyRates[idx].rateToCad = payload.rateToCad;
                return stateCurrencyRates[idx];
            }
            const newRate: CurrencyExchangeRateResponse = { id: Date.now(), currencyCode: payload.currencyCode, rateToCad: payload.rateToCad };
            stateCurrencyRates.push(newRate);
            return newRate;
        }
    );
}

export function deleteCurrencyRate(id: number): Promise<void> {
    return fetchWithFallback(
        () => apiFetch<void>(`/api/admin/settings/currency-rates/${id}`, {method: "DELETE"}),
        () => {
            stateCurrencyRates = stateCurrencyRates.filter(r => r.id !== id);
        }
    );
}

export function getPalletShippingSettings(): Promise<PalletShippingSettingsResponse> {
    return fetchWithFallback(
        () => apiFetch<PalletShippingSettingsResponse>("/api/admin/settings/pallet-shipping"),
        () => statePalletShipping
    );
}

export function updatePalletShippingSettings(
    payload: PalletShippingSettingsRequest,
): Promise<PalletShippingSettingsResponse> {
    return fetchWithFallback(
        () => apiFetch<PalletShippingSettingsResponse>("/api/admin/settings/pallet-shipping", {
            method: "PUT",
            body: JSON.stringify(payload),
        }),
        () => {
            statePalletShipping = { id: 1, ...payload };
            return statePalletShipping;
        }
    );
}

export function listProducts(
    name: string,
    page: number,
    size = 25,
    sort: ProductSortField = "name",
    direction: SortDirection = "asc",
): Promise<PageResponse<AdminProductResponse>> {
    const params = new URLSearchParams({
        name,
        page: String(page),
        size: String(size),
        sort,
        direction,
    });
    return fetchWithFallback(
        async () => {
            const res = await apiFetch<any>(`/api/admin/catalogue/products?${params.toString()}`);
            if (Array.isArray(res)) {
                return {
                    content: res,
                    page,
                    size,
                    totalElements: res.length,
                    totalPages: Math.ceil(res.length / size) || 1
                };
            }
            return res;
        },
        () => {
            const filtered = name.trim()
                ? stateProducts.filter(p => p.name.toLowerCase().includes(name.toLowerCase()) || p.slug.toLowerCase().includes(name.toLowerCase()))
                : stateProducts;
            const start = page * size;
            const paged = filtered.slice(start, start + size);
            return {
                content: paged,
                page,
                size,
                totalElements: filtered.length,
                totalPages: Math.ceil(filtered.length / size) || 1,
            };
        }
    );
}

export function getProduct(slug: string): Promise<AdminProductResponse> {
    return fetchWithFallback(
        () => apiFetch<AdminProductResponse>(`/api/admin/catalogue/products/${encodeURIComponent(slug)}`),
        () => stateProducts.find(p => p.slug === slug) ?? stateProducts[0]
    );
}

function buildMockProductResponse(payload: ProductRequest): AdminProductResponse {
    return {
        id: Date.now(),
        slug: payload.slug,
        name: payload.name,
        fullName: payload.fullName,
        subtitle: payload.subtitle ?? null,
        description: payload.description ?? null,
        longDescription: payload.longDescription ?? null,
        categorySlug: payload.categorySlug,
        brandSlug: payload.brandSlug ?? null,
        region: payload.region ?? null,
        material: payload.material ?? null,
        color: payload.color ?? null,
        badge: payload.badge ?? null,
        active: payload.active ?? true,
        images: [],
        variants: payload.variants.map((v, i) => ({
            id: Date.now() + i,
            sku: v.sku,
            unit: v.unit,
            stockQuantity: v.stockQuantity,
            lowStockThreshold: v.lowStockThreshold ?? null,
            backorderAllowed: v.backorderAllowed ?? false,
            lowStock: v.stockQuantity <= (v.lowStockThreshold ?? 5),
            weightGrams: v.weightGrams ?? null,
            lengthCm: v.lengthCm ?? null,
            widthCm: v.widthCm ?? null,
            heightCm: v.heightCm ?? null,
            hsCode: v.hsCode ?? null,
            customsCountryOfOrigin: v.customsCountryOfOrigin ?? null,
            customsDescription: v.customsDescription ?? null,
            customsManufacturer: v.customsManufacturer ?? null,
            taxable: v.taxable ?? true,
            priceTiers: v.priceTiers.map((pt, j) => ({
                id: Date.now() + j,
                pricingGroup: pt.pricingGroup,
                unitPrice: pt.unitPrice,
                minQuantity: pt.minQuantity ?? null,
                compareAtPrice: pt.compareAtPrice ?? null,
                validFrom: pt.validFrom ?? null,
                validTo: pt.validTo ?? null,
            }))
        }))
    };
}

export function createProduct(payload: ProductRequest): Promise<AdminProductResponse> {
    return fetchWithFallback(
        () => apiFetch<AdminProductResponse>("/api/admin/catalogue/products", {
            method: "POST",
            body: JSON.stringify(payload),
        }),
        () => {
            const product = buildMockProductResponse(payload);
            stateProducts.push(product);
            persistProductsToStorage();
            return product;
        }
    );
}

export function updateProduct(slug: string, payload: ProductRequest): Promise<AdminProductResponse> {
    return fetchWithFallback(
        () => apiFetch<AdminProductResponse>(`/api/admin/catalogue/products/${encodeURIComponent(slug)}`, {
            method: "PUT",
            body: JSON.stringify(payload),
        }),
        () => {
            const idx = stateProducts.findIndex(p => p.slug === slug);
            const updated = buildMockProductResponse(payload);
            if (idx !== -1) {
                stateProducts[idx] = updated;
            } else {
                stateProducts.push(updated);
            }
            persistProductsToStorage();
            return updated;
        }
    );
}

export function deleteProduct(slug: string): Promise<void> {
    return fetchWithFallback(
        () => apiFetch<void>(`/api/admin/catalogue/products/${encodeURIComponent(slug)}`, {
            method: "DELETE",
        }),
        () => {
            stateProducts = stateProducts.filter(p => p.slug !== slug);
            persistProductsToStorage();
        }
    );
}

export function bulkUploadProducts(file: File): Promise<BulkUploadResponse> {
    const formData = new FormData();
    formData.append("file", file);
    return fetchWithFallback(
        () => apiFetchForm<BulkUploadResponse>("/api/admin/catalogue/products/bulk-upload", formData),
        { totalRows: 1, succeeded: 1, failed: 0, results: [], failedRowsWorkbookBase64: null }
    );
}

export function bulkUploadProductImages(file: File): Promise<BulkImageUploadResponse> {
    const formData = new FormData();
    formData.append("file", file);
    return fetchWithFallback(
        () => apiFetchForm<BulkImageUploadResponse>("/api/admin/catalogue/products/bulk-upload-images", formData),
        { totalFiles: 1, succeeded: 1, failed: 0, results: [] }
    );
}

function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

const XLSX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function downloadBulkUploadTemplate(): Promise<void> {
    try {
        const blob = await apiFetchBlob("/api/admin/catalogue/products/bulk-upload-template");
        downloadBlob(blob, "product-bulk-upload-template.xlsx");
    } catch {
        const blob = new Blob(["SKU,Name,Category,RetailPrice\nEVOO-750,Palestinian EVOO,olive-oil,24.99"], { type: "text/csv" });
        downloadBlob(blob, "product-bulk-upload-template.csv");
    }
}

export async function exportProducts(): Promise<void> {
    try {
        const blob = await apiFetchBlob("/api/admin/catalogue/products/export");
        downloadBlob(blob, "catalogue-export.xlsx");
    } catch {
        const blob = new Blob(["SKU,Name,Category,RetailPrice\nEVOO-750,Palestinian EVOO,olive-oil,24.99"], { type: "text/csv" });
        downloadBlob(blob, "catalogue-export.csv");
    }
}

export function downloadFailedRowsWorkbook(base64: string) {
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    const blob = new Blob([bytes], {type: XLSX_MIME_TYPE});
    downloadBlob(blob, "product-bulk-upload-failed-rows.xlsx");
}

export function updateStock(sku: string, payload: StockUpdateRequest): Promise<AdminVariantResponse> {
    return fetchWithFallback(
        () => apiFetch<AdminVariantResponse>(`/api/admin/catalogue/variants/${encodeURIComponent(sku)}/stock`, {
            method: "PUT",
            body: JSON.stringify(payload),
        }),
        () => {
            for (const p of stateProducts) {
                for (const v of p.variants) {
                    if (v.sku === sku) {
                        v.stockQuantity = payload.stockQuantity;
                        v.lowStock = v.stockQuantity <= (v.lowStockThreshold ?? 10);
                        persistProductsToStorage();
                        return v;
                    }
                }
            }
            return {
                id: Date.now(),
                sku,
                unit: "Unit",
                stockQuantity: payload.stockQuantity,
                lowStockThreshold: 10,
                backorderAllowed: false,
                lowStock: payload.stockQuantity <= 10,
                weightGrams: 500,
                lengthCm: 10,
                widthCm: 10,
                heightCm: 10,
                hsCode: null,
                customsCountryOfOrigin: null,
                customsDescription: null,
                customsManufacturer: null,
                taxable: true,
                priceTiers: []
            };
        }
    );
}

export function lowStock(): Promise<AdminVariantResponse[]> {
    return fetchWithFallback(
        () => apiFetch<AdminVariantResponse[]>("/api/admin/catalogue/low-stock"),
        () => {
            const result: AdminVariantResponse[] = [];
            for (const p of stateProducts) {
                for (const v of p.variants) {
                    if (v.lowStock || v.stockQuantity <= (v.lowStockThreshold ?? 10)) {
                        result.push(v);
                    }
                }
            }
            return result;
        }
    );
}

export function uploadProductImage(
    slug: string,
    file: File,
    altText?: string,
): Promise<AdminImageResponse> {
    const formData = new FormData();
    formData.append("file", file);
    if (altText) formData.append("altText", altText);
    return fetchWithFallback(
        () => apiFetchForm<AdminImageResponse>(
            `/api/admin/catalogue/products/${encodeURIComponent(slug)}/images`,
            formData,
        ),
        () => {
            const newImg: AdminImageResponse = {
                id: Date.now(),
                url: URL.createObjectURL(file),
                altText: altText ?? "Uploaded Image",
                displayOrder: 1,
                isDefault: false
            };
            const product = stateProducts.find(p => p.slug === slug);
            if (product) {
                product.images.push(newImg);
            }
            return newImg;
        }
    );
}

export function deleteProductImage(slug: string, imageId: number): Promise<void> {
    return fetchWithFallback(
        () => apiFetch<void>(
            `/api/admin/catalogue/products/${encodeURIComponent(slug)}/images/${imageId}`,
            {method: "DELETE"},
        ),
        () => {
            const product = stateProducts.find(p => p.slug === slug);
            if (product) {
                product.images = product.images.filter(img => img.id !== imageId);
            }
        }
    );
}

export function setDefaultProductImage(
    slug: string,
    imageId: number,
): Promise<AdminProductResponse> {
    return fetchWithFallback(
        () => apiFetch<AdminProductResponse>(
            `/api/admin/catalogue/products/${encodeURIComponent(slug)}/images/${imageId}/default`,
            {method: "PUT"},
        ),
        () => {
            const product = stateProducts.find(p => p.slug === slug);
            if (product) {
                product.images.forEach(img => {
                    img.isDefault = img.id === imageId;
                });
                return product;
            }
            return stateProducts[0];
        }
    );
}

// Orders - /api/admin/orders

export function listOrders(
    page: number,
    size = 25,
    sort: OrderSortField = "createdAt",
    direction: SortDirection = "desc",
): Promise<PageResponse<OrderResponse>> {
    const params = new URLSearchParams({page: String(page), size: String(size), sort, direction});
    return fetchWithFallback(
        async () => {
            const res = await apiFetch<PageResponse<OrderResponse>>(`/api/admin/orders?${params.toString()}`);
            let content = Array.isArray(res) ? res : (res?.content || []);
            if (typeof window !== "undefined") {
                syncOrdersFromStorage();
                const existingNos = new Set(content.map(o => o.orderNumber));
                for (const localOrder of stateOrders) {
                    if (!existingNos.has(localOrder.orderNumber)) {
                        content.unshift(localOrder);
                        existingNos.add(localOrder.orderNumber);
                    }
                }
            }
            return {
                ...res,
                content,
                totalElements: content.length,
                totalPages: Math.ceil(content.length / size) || 1,
            };
        },
        () => {
            if (typeof window !== "undefined") {
                syncOrdersFromStorage();
            }
            return {
                content: stateOrders,
                page,
                size,
                totalElements: stateOrders.length,
                totalPages: Math.ceil(stateOrders.length / size) || 1,
            };
        }
    );
}

export function getOrder(orderNumber: string): Promise<AdminOrderDetail> {
    return fetchWithFallback(
        async () => {
            const detail = await apiFetch<AdminOrderDetail>(`/api/admin/orders/${encodeURIComponent(orderNumber)}`);
            if (detail && detail.order) {
                const idx = stateOrders.findIndex(o => o.orderNumber === orderNumber);
                if (idx !== -1) stateOrders[idx] = detail.order;
                else stateOrders.unshift(detail.order);
                persistOrdersState();
            }
            return detail;
        },
        () => {
            if (typeof window !== "undefined") {
                syncOrdersFromStorage();
            }
            const match = stateOrders.find(o => o.orderNumber === orderNumber) ?? stateOrders[0];
            return {
                order: match,
                carrierCost: 18.50,
            };
        }
    );
}

export function transitionOrder(
    orderNumber: string,
    payload: StatusTransitionRequest,
): Promise<OrderResponse> {
    return fetchWithFallback(
        async () => {
            const updated = await apiFetch<OrderResponse>(`/api/admin/orders/${encodeURIComponent(orderNumber)}/status`, {
                method: "POST",
                body: JSON.stringify(payload),
            });
            const idx = stateOrders.findIndex(o => o.orderNumber === orderNumber);
            if (idx !== -1) {
                stateOrders[idx] = updated;
            } else {
                stateOrders.unshift(updated);
            }
            persistOrdersState();
            return updated;
        },
        () => {
            const match = stateOrders.find(o => o.orderNumber === orderNumber);
            if (match) {
                match.status = payload.status;
                match.timeline.push({
                    status: payload.status,
                    message: payload.message ?? `Status updated to ${payload.status}`,
                    at: new Date().toISOString()
                });
                persistOrdersState();
                return match;
            }
            return stateOrders[0];
        }
    );
}

export function markOrderPaid(orderNumber: string, payload: MarkPaidRequest): Promise<OrderResponse> {
    return fetchWithFallback(
        async () => {
            const updated = await apiFetch<OrderResponse>(`/api/admin/orders/${encodeURIComponent(orderNumber)}/mark-paid`, {
                method: "POST",
                body: JSON.stringify(payload),
            });
            const idx = stateOrders.findIndex(o => o.orderNumber === orderNumber);
            if (idx !== -1) stateOrders[idx] = updated;
            else stateOrders.unshift(updated);
            persistOrdersState();
            return updated;
        },
        () => {
            const match = stateOrders.find(o => o.orderNumber === orderNumber);
            if (match) {
                match.paymentStatus = "CAPTURED";
                match.status = "PAID";
                match.timeline.push({
                    status: "PAID",
                    message: payload.note ?? "Marked paid by admin",
                    at: new Date().toISOString()
                });
                persistOrdersState();
                return match;
            }
            return stateOrders[0];
        }
    );
}

export function refundOrder(orderNumber: string, payload: RefundRequest): Promise<OrderResponse> {
    return fetchWithFallback(
        async () => {
            const updated = await apiFetch<OrderResponse>(`/api/admin/orders/${encodeURIComponent(orderNumber)}/refund`, {
                method: "POST",
                body: JSON.stringify(payload),
            });
            const idx = stateOrders.findIndex(o => o.orderNumber === orderNumber);
            if (idx !== -1) stateOrders[idx] = updated;
            else stateOrders.unshift(updated);
            persistOrdersState();
            return updated;
        },
        () => {
            const match = stateOrders.find(o => o.orderNumber === orderNumber);
            if (match) {
                match.status = "REFUNDED";
                match.refundedTotal = payload.amount ?? match.grandTotal;
                match.timeline.push({
                    status: "REFUNDED",
                    message: `Refunded $${payload.amount ?? match.grandTotal}`,
                    at: new Date().toISOString()
                });
                persistOrdersState();
                return match;
            }
            return stateOrders[0];
        }
    );
}

export function deleteOrder(orderNumber: string): Promise<void> {
    return fetchWithFallback(
        async () => {
            await apiFetch<void>(`/api/admin/orders/${encodeURIComponent(orderNumber)}`, {
                method: "DELETE",
            });
            stateOrders = stateOrders.filter(o => o.orderNumber !== orderNumber);
            persistOrdersState();
        },
        () => {
            stateOrders = stateOrders.filter(o => o.orderNumber !== orderNumber);
            persistOrdersState();
        }
    );
}

export function getOrderBoxes(orderNumber: string): Promise<OrderBoxResponse[]> {
    return fetchWithFallback(
        () => apiFetch<OrderBoxResponse[]>(`/api/admin/orders/${encodeURIComponent(orderNumber)}/boxes`),
        []
    );
}

export function packOrder(orderNumber: string, payload: ReplaceBoxesRequest): Promise<BoxesResponse> {
    return fetchWithFallback(
        () => apiFetch<BoxesResponse>(`/api/admin/orders/${encodeURIComponent(orderNumber)}/boxes`, {
            method: "PUT",
            body: JSON.stringify(payload),
        }),
        () => ({
            boxes: payload.boxes.map((b, i) => ({
                id: Date.now() + i,
                sequence: i + 1,
                weightGrams: b.weightGrams,
                lengthIn: b.lengthIn,
                widthIn: b.widthIn,
                heightIn: b.heightIn,
                label: b.label ?? null,
                autoGenerated: false,
                items: b.items.map((it, j) => ({
                    id: Date.now() + j,
                    orderItemId: it.orderItemId,
                    productName: "Item " + it.orderItemId,
                    sku: "SKU-" + it.orderItemId,
                    quantity: it.quantity
                }))
            })),
            order: stateOrders[0]
        })
    );
}

export function quoteShippingRates(orderNumber: string): Promise<ShippingRateOption[]> {
    return fetchWithFallback(
        () => apiFetch<ShippingRateOption[]>(`/api/admin/orders/${encodeURIComponent(orderNumber)}/rates`, {
            method: "POST",
        }),
        [
            { serviceCode: "CP_EXP", carrierName: "Canada Post", serviceName: "Expedited Parcel", cost: 12.00, carrierCost: 9.50, etaDays: 3, packagingType: "PACKAGE" },
            { serviceCode: "UPS_STD", carrierName: "UPS", serviceName: "Standard", cost: 18.50, carrierCost: 14.20, etaDays: 2, packagingType: "PACKAGE" }
        ]
    );
}

export function bookShipment(orderNumber: string, payload: BookShipmentRequest): Promise<AdminOrderDetail> {
    return fetchWithFallback(
        async () => {
            const updated = await apiFetch<AdminOrderDetail>(`/api/admin/orders/${encodeURIComponent(orderNumber)}/shipment`, {
                method: "POST",
                body: JSON.stringify(payload),
            });
            if (updated && updated.order) {
                const idx = stateOrders.findIndex(o => o.orderNumber === orderNumber);
                if (idx !== -1) stateOrders[idx] = updated.order;
                else stateOrders.unshift(updated.order);
                persistOrdersState();
            }
            return updated;
        },
        () => {
            const match = stateOrders.find(o => o.orderNumber === orderNumber) ?? stateOrders[0];
            match.status = "SHIPPED";
            match.trackingNumber = "7038192049182";
            match.carrierName = payload.serviceCode?.startsWith("CP") ? "Canada Post" : "UPS";
            match.timeline.push({
                status: "SHIPPED",
                message: `Booked shipment with ${match.carrierName} - Tracking: ${match.trackingNumber}`,
                at: new Date().toISOString()
            });
            persistOrdersState();
            return {
                order: match,
                carrierCost: payload.carrierCost ?? 14.50
            };
        }
    );
}

export function cancelShipment(orderNumber: string): Promise<AdminOrderDetail> {
    return fetchWithFallback(
        async () => {
            const updated = await apiFetch<AdminOrderDetail>(`/api/admin/orders/${encodeURIComponent(orderNumber)}/shipment`, {
                method: "DELETE",
            });
            if (updated && updated.order) {
                const idx = stateOrders.findIndex(o => o.orderNumber === orderNumber);
                if (idx !== -1) stateOrders[idx] = updated.order;
                else stateOrders.unshift(updated.order);
                persistOrdersState();
            }
            return updated;
        },
        () => {
            const match = stateOrders.find(o => o.orderNumber === orderNumber) ?? stateOrders[0];
            match.status = "PACKED";
            match.trackingNumber = null;
            match.carrierName = null;
            match.trackingUrl = null;
            match.labelUrl = null;
            match.timeline.push({
                status: "PACKED",
                message: "Shipment cancelled/voided; ready to be rebooked",
                at: new Date().toISOString()
            });
            persistOrdersState();
            return {
                order: match,
                carrierCost: null
            };
        }
    );
}

// Customers - /api/admin/customers

export function listCustomers(
    email: string,
    page: number,
    size = 25,
    sort: CustomerSortField = "firstName",
    direction: SortDirection = "asc",
    status?: string,
    group?: string,
): Promise<PageResponse<CustomerResponse>> {
    const params = new URLSearchParams({
        email,
        page: String(page),
        size: String(size),
        sort,
        direction,
    });
    if (status) params.set("status", status);
    if (group) params.set("group", group);
    return fetchWithFallback(
        async () => {
            const res = await apiFetch<any>(`/api/admin/customers?${params.toString()}`);
            if (Array.isArray(res)) {
                return {
                    content: res,
                    page,
                    size,
                    totalElements: res.length,
                    totalPages: Math.ceil(res.length / size) || 1
                };
            }
            return res;
        },
        () => {
            let filtered = email.trim()
                ? stateCustomers.filter(c => c.email.toLowerCase().includes(email.toLowerCase()) || (c.companyName && c.companyName.toLowerCase().includes(email.toLowerCase())))
                : stateCustomers;
            if (status) {
                filtered = filtered.filter(c => c.approvalStatus === status);
            }
            if (group) {
                filtered = filtered.filter(c => c.pricingGroup === group);
            }
            return {
                content: filtered,
                page,
                size,
                totalElements: filtered.length,
                totalPages: Math.ceil(filtered.length / size) || 1,
            };
        }
    );
}

export function pendingApprovals(): Promise<CustomerResponse[]> {
    return fetchWithFallback(
        () => apiFetch<CustomerResponse[]>("/api/admin/customers/pending-approvals"),
        () => stateCustomers.filter(c => c.approvalStatus === "PENDING")
    );
}

export function decideApproval(
    userId: number,
    payload: ApprovalDecisionRequest,
): Promise<CustomerResponse> {
    return fetchWithFallback(
        () => apiFetch<CustomerResponse>(`/api/admin/customers/${userId}/approval`, {
            method: "POST",
            body: JSON.stringify(payload),
        }),
        () => {
            const match = stateCustomers.find(c => c.id === userId);
            if (match) {
                match.approvalStatus = payload.approve ? "APPROVED" : "REJECTED";
                match.pricingGroup = payload.approve ? (payload.targetGroup || match.requestedGroup || "WHOLESALE") : "RETAIL";
                return match;
            }
            return stateCustomers[0];
        }
    ).then((res) => {
        const match = stateCustomers.find(c => c.id === userId);
        if (match) {
            match.approvalStatus = res.approvalStatus;
            match.pricingGroup = res.pricingGroup;
        }
        persistCustomersState();
        return res;
    });
}

export function assignPricingGroup(
    userId: number,
    payload: AssignGroupRequest,
): Promise<CustomerResponse> {
    return fetchWithFallback(
        () => apiFetch<CustomerResponse>(`/api/admin/customers/${userId}/pricing-group`, {
            method: "PUT",
            body: JSON.stringify(payload),
        }),
        () => {
            const match = stateCustomers.find(c => c.id === userId);
            if (match) {
                match.pricingGroup = payload.pricingGroup;
                return match;
            }
            return stateCustomers[0];
        }
    ).then((res) => {
        const match = stateCustomers.find(c => c.id === userId);
        if (match) {
            match.pricingGroup = res.pricingGroup;
        }
        persistCustomersState();
        return res;
    });
}

export function setApprovalStatus(
    userId: number,
    payload: ApprovalStatusRequest,
): Promise<CustomerResponse> {
    return fetchWithFallback(
        () => apiFetch<CustomerResponse>(`/api/admin/customers/${userId}/approval-status`, {
            method: "PUT",
            body: JSON.stringify(payload),
        }),
        () => {
            const match = stateCustomers.find(c => c.id === userId);
            if (match) {
                match.approvalStatus = payload.approvalStatus;
                return match;
            }
            return stateCustomers[0];
        }
    ).then((res) => {
        const match = stateCustomers.find(c => c.id === userId);
        if (match) {
            match.approvalStatus = res.approvalStatus;
        }
        persistCustomersState();
        return res;
    });
}

export function setCustomerEnabled(userId: number, enabled: boolean): Promise<CustomerResponse> {
    return fetchWithFallback(
        () => apiFetch<CustomerResponse>(`/api/admin/customers/${userId}/enabled?enabled=${enabled}`, {
            method: "PUT",
        }),
        () => {
            const match = stateCustomers.find(c => c.id === userId);
            if (match) {
                match.enabled = enabled;
                return match;
            }
            return stateCustomers[0];
        }
    ).then((res) => {
        const match = stateCustomers.find(c => c.id === userId);
        if (match) {
            match.enabled = res.enabled;
        }
        persistCustomersState();
        return res;
    });
}

// Staff - /api/admin/staff

export function listStaff(
    email: string,
    page: number,
    size = 25,
    sort: StaffSortField = "firstName",
    direction: SortDirection = "asc",
): Promise<PageResponse<StaffResponse>> {
    const params = new URLSearchParams({
        email,
        page: String(page),
        size: String(size),
        sort,
        direction,
    });
    return fetchWithFallback(
        async () => {
            const res = await apiFetch<any>(`/api/admin/staff?${params.toString()}`);
            if (Array.isArray(res)) {
                return {
                    content: res,
                    page,
                    size,
                    totalElements: res.length,
                    totalPages: Math.ceil(res.length / size) || 1
                };
            }
            return res;
        },
        () => ({
            content: stateStaff,
            page,
            size,
            totalElements: stateStaff.length,
            totalPages: 1,
        })
    );
}

export function listStaffRoles(): Promise<RoleResponse[]> {
    return fetchWithFallback(
        () => apiFetch<RoleResponse[]>("/api/admin/staff/roles"),
        [
            { id: 1, name: "SUPER_ADMIN", description: "Full admin access" },
            { id: 2, name: "CATALOGUE_MANAGER", description: "Catalogue and inventory management" },
            { id: 3, name: "ORDER_MANAGER", description: "Order fulfillment and shipping" }
        ]
    );
}

export function createStaff(payload: CreateStaffRequest): Promise<StaffResponse> {
    return fetchWithFallback(
        () => apiFetch<StaffResponse>("/api/admin/staff", {
            method: "POST",
            body: JSON.stringify(payload),
        }),
        () => {
            const newStaff: StaffResponse = {
                id: Date.now(),
                email: payload.email,
                firstName: payload.firstName ?? null,
                lastName: payload.lastName ?? null,
                roles: [payload.roleName],
                enabled: true,
                createdAt: new Date().toISOString()
            };
            stateStaff.push(newStaff);
            return newStaff;
        }
    );
}

export function assignStaffRole(
    userId: number,
    payload: AssignStaffRoleRequest,
): Promise<StaffResponse> {
    return fetchWithFallback(
        () => apiFetch<StaffResponse>(`/api/admin/staff/${userId}/role`, {
            method: "PUT",
            body: JSON.stringify(payload),
        }),
        () => {
            const match = stateStaff.find(s => s.id === userId);
            if (match) {
                match.roles = [payload.roleName];
                return match;
            }
            return stateStaff[0];
        }
    );
}

export function setStaffEnabled(userId: number, enabled: boolean): Promise<StaffResponse> {
    return fetchWithFallback(
        () => apiFetch<StaffResponse>(`/api/admin/staff/${userId}/enabled?enabled=${enabled}`, {
            method: "PUT",
        }),
        () => {
            const match = stateStaff.find(s => s.id === userId);
            if (match) {
                match.enabled = enabled;
                return match;
            }
            return stateStaff[0];
        }
    );
}

export function deleteStaff(userId: number): Promise<void> {
    return fetchWithFallback(
        () => apiFetch<void>(`/api/admin/staff/${userId}`, {
            method: "DELETE",
        }),
        () => {
            stateStaff = stateStaff.filter(s => s.id !== userId);
        }
    );
}

// Reports - /api/admin/dashboard, /api/admin/reports, /api/admin/audit

export function dashboardKpis(): Promise<DashboardKpis> {
    return fetchWithFallback(
        () => apiFetch<DashboardKpis>("/api/admin/dashboard"),
        () => {
            const revenue = stateOrders.reduce((sum, o) => sum + o.grandTotal, 0);
            const totalOrders = stateOrders.length;
            const awaiting = stateOrders.filter(o => o.status === "PROCESSING" || o.status === "PLACED").length;
            let lowStockCount = 0;
            for (const p of stateProducts) {
                for (const v of p.variants) {
                    if (v.lowStock || v.stockQuantity <= (v.lowStockThreshold ?? 10)) {
                        lowStockCount++;
                    }
                }
            }
            const pendingApprovalsCount = stateCustomers.filter(c => c.approvalStatus === "PENDING").length;

            return {
                revenue30Days: Math.round(revenue * 100) / 100,
                ordersTotal: totalOrders,
                ordersAwaitingFulfilment: awaiting,
                averageOrderValue: totalOrders > 0 ? Math.round((revenue / totalOrders) * 100) / 100 : 0,
                lowStockCount,
                pendingApprovals: pendingApprovalsCount,
                pendingReviews: stateReviews.filter(r => r.status === "PENDING").length,
            };
        }
    );
}

export function salesReport(
    dimension: SalesReportDimension = "day",
    days = 30,
): Promise<SalesReportRow[]> {
    return fetchWithFallback(
        () => apiFetch<SalesReportRow[]>(`/api/admin/reports/sales?dimension=${dimension}&days=${days}`),
        () => generateMockSalesReport(dimension, days)
    );
}

export function auditLog(page: number, size = 50): Promise<PageResponse<AuditLog>> {
    return fetchWithFallback(
        () => apiFetch<PageResponse<AuditLog>>(`/api/admin/audit?page=${page}&size=${size}`),
        {
            content: [
                {
                    id: 1,
                    actor: "wataniadmin@wataniandsons.ca",
                    action: "ORDER_STATUS_UPDATE",
                    entityType: "ORDER",
                    entityId: "ORD-2026-1001",
                    previousValue: "PLACED",
                    newValue: "PROCESSING",
                    ipAddress: "127.0.0.1",
                    createdAt: new Date().toISOString()
                }
            ],
            page,
            size,
            totalElements: 1,
            totalPages: 1
        }
    );
}

// Marketing - /api/admin/coupons, /api/admin/reviews, /api/admin/content

export function listCoupons(
    page: number,
    size = 25,
    sort: CouponSortField = "code",
    direction: SortDirection = "asc",
): Promise<PageResponse<Coupon>> {
    const params = new URLSearchParams({page: String(page), size: String(size), sort, direction});
    return fetchWithFallback(
        () => apiFetch<PageResponse<Coupon>>(`/api/admin/coupons?${params.toString()}`),
        () => ({
            content: stateCoupons,
            page,
            size,
            totalElements: stateCoupons.length,
            totalPages: Math.ceil(stateCoupons.length / size) || 1
        })
    );
}

export function createCoupon(payload: Coupon): Promise<Coupon> {
    return fetchWithFallback(
        () => apiFetch<Coupon>("/api/admin/coupons", {
            method: "POST",
            body: JSON.stringify(payload),
        }),
        () => {
            const coupon = { ...payload, id: Date.now(), usageCount: 0 };
            stateCoupons.push(coupon);
            return coupon;
        }
    );
}

export function updateCoupon(id: number, payload: Coupon): Promise<Coupon> {
    return fetchWithFallback(
        () => apiFetch<Coupon>(`/api/admin/coupons/${id}`, {
            method: "PUT",
            body: JSON.stringify(payload),
        }),
        () => {
            const idx = stateCoupons.findIndex(c => c.id === id);
            const coupon = { ...payload, id };
            if (idx !== -1) {
                stateCoupons[idx] = coupon;
            } else {
                stateCoupons.push(coupon);
            }
            return coupon;
        }
    );
}

export function deleteCoupon(id: number): Promise<void> {
    return fetchWithFallback(
        () => apiFetch<void>(`/api/admin/coupons/${id}`, {method: "DELETE"}),
        () => {
            stateCoupons = stateCoupons.filter(c => c.id !== id);
        }
    );
}

export function pendingReviews(page: number, size = 25): Promise<PageResponse<Review>> {
    return fetchWithFallback(
        () => apiFetch<PageResponse<Review>>(`/api/admin/reviews?page=${page}&size=${size}`),
        () => ({
            content: stateReviews,
            page,
            size,
            totalElements: stateReviews.length,
            totalPages: Math.ceil(stateReviews.length / size) || 1
        })
    );
}

export const listReviews = pendingReviews;

export function moderateReview(id: number, approve: boolean): Promise<Review> {
    return fetchWithFallback(
        () => apiFetch<Review>(`/api/admin/reviews/${id}/moderate?approve=${approve}`, {
            method: "POST",
        }),
        () => {
            const idx = stateReviews.findIndex(r => r.id === id);
            if (idx !== -1) {
                stateReviews[idx].status = approve ? "APPROVED" : "REJECTED";
                return stateReviews[idx];
            }
            return {
                id,
                authorName: "Customer",
                rating: 5,
                title: "Great product",
                body: "Loved it!",
                status: approve ? "APPROVED" : "REJECTED"
            };
        }
    );
}

export function listContent(
    page: number,
    size = 25,
    sort: ContentSortField = "displayOrder",
    direction: SortDirection = "asc",
): Promise<PageResponse<ContentBlock>> {
    const params = new URLSearchParams({page: String(page), size: String(size), sort, direction});
    return fetchWithFallback(
        () => apiFetch<PageResponse<ContentBlock>>(`/api/admin/content?${params.toString()}`),
        () => ({
            content: stateContentBlocks,
            page,
            size,
            totalElements: stateContentBlocks.length,
            totalPages: Math.ceil(stateContentBlocks.length / size) || 1
        })
    );
}

export function createContent(payload: ContentBlock): Promise<ContentBlock> {
    return fetchWithFallback(
        () => apiFetch<ContentBlock>("/api/admin/content", {
            method: "POST",
            body: JSON.stringify(payload),
        }),
        () => {
            const block = { ...payload, id: Date.now() };
            stateContentBlocks.push(block);
            return block;
        }
    );
}

export function updateContent(id: number, payload: ContentBlock): Promise<ContentBlock> {
    return fetchWithFallback(
        () => apiFetch<ContentBlock>(`/api/admin/content/${id}`, {
            method: "PUT",
            body: JSON.stringify(payload),
        }),
        () => {
            const idx = stateContentBlocks.findIndex(c => c.id === id);
            const block = { ...payload, id };
            if (idx !== -1) {
                stateContentBlocks[idx] = block;
            } else {
                stateContentBlocks.push(block);
            }
            return block;
        }
    );
}
