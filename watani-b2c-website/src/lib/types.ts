/**
 * Catalogue domain types (design.md §12). Prices split into major/minor parts
 * since product cards render cents smaller and raised (design.md §4, §7.3).
 */

export type CategorySlug =
    | "olive-oil"
    | "olives"
    | "cheese"
    | "zaatar"
    | "spices-grains"
    | "ghee"
    | "ceramics"
    | "beauty-care"
    | "nabulsi-cheese"
    | "natural-soap"
    | "cross-body-bags"
    | "card-cases"
    | "tablecloths"
    | "scarves-shawls"
    | "shopper-bags"
    | "chair-sofa-cushion-covers"
    | "spoon-rests"
    | "kunafa-pan"
    | "aprons";

/** Mirrors com.watani.b2c.domain.pricing.PricingGroup. */
export type PricingGroup = "RETAIL" | "WHOLESALE" | "DISTRIBUTOR";

export type PriceTierSummary = {
    id?: number;
    pricingGroup: PricingGroup;
    unitPrice: number;
    minQuantity: number;
    compareAtPrice?: number | null;
};

export type PricingRelation = {
    appliedGroup: PricingGroup;
    yourGroup: PricingGroup;
    fellBackToRetail: boolean;
    retailPrice?: number;
    wholesalePrice?: number;
    minQuantity?: number;
    minimumOrderQuantity?: number;
    unlockMessage?: string;
    unlockAtQuantity?: number;
    unlockUnitPrice?: number;
    tiers?: PriceTierSummary[];
};

export type Product = {
    id: string;
    /**
     * The variant "add to cart" sends - carts/orders key on variants, never products.
     * Undefined only for offline seed fixtures, which cannot be ordered.
     */
    defaultVariantId?: number;
    slug: string;
    /** Shortened display name - keeps the two-line card composition (design.md §7.3). */
    name: string;
    /** Complete official product title, used on the detail page and as accessible name. */
    fullName: string;
    subtitle: string;
    /** Pack-size label such as `750ML`, `1.2kg × 6`, `16L`. */
    unit: string;
    priceMajor: string;
    priceMinor: string;
    /** Pre-sale price, present only on discounted products. */
    compareAtMajor?: string;
    compareAtMinor?: string;
    image: string;
    gallery?: string[];
    category: CategorySlug;
    badge?: string;
    rating?: number;
    reviewCount?: number;
    sku: string;
    description: string;
    /** Retail & wholesale price references */
    retailPrice?: number;
    wholesalePrice?: number;
    /** Minimum order quantity required or configured for this product */
    minQuantity?: number;
    minimumOrderQuantity?: number;
    /**
     * Long-form HTML for the Description tab. Admin-authored, so it must pass
     * through `sanitizeRichText` before rendering.
     */
    longDescription?: string;
    /** Physical attributes for the "Additional information" tab. */
    specifications?: ProductSpecifications;
    /** Region of origin in Palestine, where the source product names one. */
    region?: string;
    material?: string;
    color?: string;
    /** False once the default variant's stock is exhausted (and backorder isn't allowed). Undefined for the offline seed fixtures, treated as in stock. */
    inStock?: boolean;
    /** Group-aware pricing outcome for the current viewer; absent for seed fixtures. */
    pricing?: PricingRelation;
};

/**
 * Weight, box size and provenance for the "Additional information" tab.
 * Every field optional - only known rows render, no "-" placeholders.
 */
export type ProductSpecifications = {
    weightGrams?: number;
    /** Pre-formatted "23 × 23 × 33 cm"; absent when any axis is unknown. */
    dimensions?: string;
    unit?: string;
    sku?: string;
    region?: string;
    material?: string;
    color?: string;
    brand?: string;
    categoryName?: string;
    minQuantity?: number;
    minimumOrderQuantity?: number;
};

/** A published customer review (F-CAT-7). */
export type ProductReview = {
    id: string;
    authorName: string;
    rating: number;
    title?: string;
    body?: string;
    /** ISO-8601 instant. */
    createdAt: string;
};

export type Category = {
    slug: CategorySlug;
    name: string;
    tagline: string;
};

/** Numeric price in CAD, derived from the split major/minor representation. */
export function priceOf(product: Product): number {
    if (!product) return 0;
    const major = String(product.priceMajor || "0").replace(/,/g, "");
    const minor = String(product.priceMinor || "00");
    return Number(`${major}.${minor}`) || 0;
}

export function compareAtPriceOf(product: Product): number | null {
    if (!product || !product.compareAtMajor || !product.compareAtMinor) return null;
    const major = String(product.compareAtMajor || "0").replace(/,/g, "");
    const minor = String(product.compareAtMinor || "00");
    return Number(`${major}.${minor}`) || null;
}

export function formatCad(value: number): string {
    return `$${value.toFixed(2)}`;
}

/** Formats price numbers/strings cleanly into $45 or $45.50 format without throwing on strings/NaN/null */
export function safeFormatPrice(val: any): string {
    if (val === null || val === undefined || val === "") return "0";
    const num = typeof val === "number" ? val : parseFloat(String(val).replace(/[^0-9.-]/g, ""));
    if (isNaN(num)) return "0";
    return num % 1 === 0 ? String(num) : num.toFixed(2);
}

/** Shipping weight in the easiest unit: grams below 1kg, kg above (no trailing `.0`). */
export function formatWeight(grams: number | null | undefined): string {
    if (grams == null || isNaN(Number(grams))) return "-";
    const num = Number(grams);
    if (num < 1000) return `${num} g`;
    const kg = num / 1000;
    return `${Number.isInteger(kg) ? kg : kg.toFixed(2)} kg`;
}
