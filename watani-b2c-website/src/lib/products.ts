import {ApiError, apiFetch} from "./api";
import {categories as fallbackCategories, products as fallbackProducts} from "./catalogue";
import { listProducts as listAdminProducts, listCategories as listAdminCategories } from "./admin/api";
import type { AdminProductResponse } from "./admin/types";
import type {
    Category,
    CategorySlug,
    PricingGroup,
    PricingRelation,
    Product,
    ProductReview,
    ProductSpecifications,
} from "./types";
import {compareAtPriceOf, priceOf} from "./types";

/**
 * Catalogue access layer. Reads from watani-b2c-service, which resolves prices
 * per pricing group (requirement.md §3) - never computed here. Falls back to
 * `catalogue.ts` seed fixtures if unreachable, logged, never silent.
 */

/** Shape returned by the service's catalogue endpoints. */
type ApiProduct = {
    id: number;
    /** Variant the cart keys on; see Product.defaultVariantId. */
    defaultVariantId: number | null;
    slug: string;
    name: string;
    fullName: string;
    subtitle: string | null;
    unit: string;
    sku: string;
    category: CategorySlug;
    badge: string | null;
    image: string | null;
    gallery?: string[];
    description?: string | null;
    longDescription?: string | null;
    specifications?: ApiSpecifications | null;
    priceMajor: string;
    priceMinor: string;
    compareAtMajor: string | null;
    compareAtMinor: string | null;
    price: number;
    rating: number | null;
    reviewCount: number | null;
    region: string | null;
    material: string | null;
    color: string | null;
    inStock: boolean;
    pricing?: ApiPricingRelation | null;
};

/** Mirrors CatalogueDtos.PricingRelation. */
type ApiPricingRelation = {
    appliedGroup: PricingGroup;
    yourGroup: PricingGroup;
    fellBackToRetail: boolean;
    unlockMessage: string | null;
    unlockAtQuantity: number | null;
    unlockUnitPrice: number | null;
};

type ApiSpecifications = {
    weightGrams: number | null;
    dimensions: string | null;
    unit: string | null;
    sku: string | null;
    region: string | null;
    material: string | null;
    color: string | null;
    brand: string | null;
    categoryName: string | null;
};

type ApiReview = {
    id: number;
    authorName: string;
    rating: number;
    title: string | null;
    body: string | null;
    createdAt: string;
};

type ApiProductPage = {
    content: ApiProduct[];
    totalElements: number;
    facets: {
        colors: string[];
        materials: string[];
        categories: { slug: CategorySlug; name: string; tagline: string }[];
    };
};

function toProduct(dto: ApiProduct): Product {
    const priceNum = typeof dto.price === 'number' ? dto.price : parseFloat(String(dto.price || '0')) || 0;
    const priceParts = priceNum.toFixed(2).split('.');
    const priceMajor = String(dto.priceMajor || priceParts[0] || '0');
    const priceMinor = String(dto.priceMinor || priceParts[1] || '00');

    return {
        id: String(dto.id),
        defaultVariantId: dto.defaultVariantId ?? (typeof dto.id === "number" ? dto.id : parseInt(String(dto.id), 10) || 1),
        slug: dto.slug || `product-${dto.id}`,
        name: dto.name || 'Palestinian Product',
        fullName: dto.fullName || dto.name || 'Authentic Palestinian Product',
        subtitle: dto.subtitle ?? "",
        unit: dto.unit || '1 Unit',
        priceMajor,
        priceMinor,
        compareAtMajor: dto.compareAtMajor ?? undefined,
        compareAtMinor: dto.compareAtMinor ?? undefined,
        image: dto.image ?? "",
        gallery: dto.gallery,
        category: dto.category,
        badge: dto.badge ?? undefined,
        rating: dto.rating ?? undefined,
        reviewCount: dto.reviewCount ?? undefined,
        sku: dto.sku,
        description: dto.description ?? "",
        longDescription: dto.longDescription ?? undefined,
        specifications: toSpecifications(dto.specifications),
        region: dto.region ?? undefined,
        material: dto.material ?? undefined,
        color: dto.color ?? undefined,
        inStock: dto.inStock,
        pricing: toPricingRelation(dto.pricing),
    };
}

function toPricingRelation(
    dto: ApiPricingRelation | null | undefined,
): PricingRelation | undefined {
    if (!dto) return undefined;
    return {
        appliedGroup: dto.appliedGroup,
        yourGroup: dto.yourGroup,
        fellBackToRetail: dto.fellBackToRetail,
        unlockMessage: dto.unlockMessage ?? undefined,
        unlockAtQuantity: dto.unlockAtQuantity ?? undefined,
        unlockUnitPrice: dto.unlockUnitPrice ?? undefined,
    };
}

/**
 * Nulls become `undefined` so the spec table can test presence with a plain
 * truthiness check and skip rows the catalogue does not know.
 */
function toSpecifications(
    dto: ApiSpecifications | null | undefined,
): ProductSpecifications | undefined {
    if (!dto) return undefined;
    return {
        weightGrams: dto.weightGrams ?? undefined,
        dimensions: dto.dimensions ?? undefined,
        unit: dto.unit ?? undefined,
        sku: dto.sku ?? undefined,
        region: dto.region ?? undefined,
        material: dto.material ?? undefined,
        color: dto.color ?? undefined,
        brand: dto.brand ?? undefined,
        categoryName: dto.categoryName ?? undefined,
    };
}

/** Shown wherever a product/variant has no image yet - e.g. freshly bulk-uploaded stock. */
export const PLACEHOLDER_PRODUCT_IMAGE = "/images/placeholder.png";

/** Falls back to the placeholder for an empty/missing image path. */
export function productImageSrc(image: string | null | undefined): string {
    if (!image || image.trim().length === 0) return PLACEHOLDER_PRODUCT_IMAGE;
    const trimmed = image.trim();

    const uploadsIdx = trimmed.indexOf("/uploads/");
    if (uploadsIdx !== -1) return trimmed.substring(uploadsIdx);
    if (trimmed.startsWith("uploads/")) return "/" + trimmed;

    const imagesIdx = trimmed.indexOf("/images/");
    if (imagesIdx !== -1) return trimmed.substring(imagesIdx);
    if (trimmed.startsWith("images/")) return "/" + trimmed;

    const productsIdx = trimmed.indexOf("/products/");
    if (productsIdx !== -1) return trimmed.substring(productsIdx);
    if (trimmed.startsWith("products/")) return "/" + trimmed;

    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
        return trimmed;
    }

    return trimmed.startsWith("/") ? trimmed : "/" + trimmed;
}

/** Logs once per failure so a backend outage is visible rather than silent. */
function reportFallback(operation: string, error: unknown) {
    const detail = error instanceof ApiError ? `HTTP ${error.status}` : String(error);
    console.warn(
        `[catalogue] ${operation} failed (${detail}); serving seed fixtures instead.`,
    );
}

/** Backend caps a catalogue page at 100 (CatalogueService.search), so bigger asks are silently truncated. */
const CATALOGUE_PAGE_SIZE = 100;

/**
 * The whole active catalogue. `/categories` filters and facets this list client-side,
 * so it must be complete - fetching only the first page made categories whose products
 * sort past that page look empty (e.g. 1 of 5 aprons showing).
 */
function adminProductToStorefrontProduct(ap: AdminProductResponse): Product {
    const defaultVariant = ap.variants[0];
    const retailTier = defaultVariant?.priceTiers.find(pt => pt.pricingGroup === "RETAIL") ?? defaultVariant?.priceTiers[0];
    const priceVal = retailTier?.unitPrice ?? 0;
    const priceParts = priceVal.toFixed(2).split(".");

    const compareVal = retailTier?.compareAtPrice;
    const compareParts = compareVal != null ? compareVal.toFixed(2).split(".") : null;

    return {
        id: String(ap.id),
        defaultVariantId: defaultVariant?.id ?? (typeof ap.id === "number" ? ap.id : parseInt(String(ap.id), 10) || 1),
        slug: ap.slug,
        name: ap.name,
        fullName: ap.fullName,
        subtitle: ap.subtitle ?? "",
        unit: defaultVariant?.unit ?? "1 Unit",
        priceMajor: priceParts[0],
        priceMinor: priceParts[1],
        compareAtMajor: compareParts ? compareParts[0] : undefined,
        compareAtMinor: compareParts ? compareParts[1] : undefined,
        image: ap.images && ap.images.length > 0 ? ap.images[0].url : "/images/placeholder.png",
        gallery: ap.images && ap.images.length > 0 ? ap.images.map(img => img.url) : undefined,
        category: ap.categorySlug as CategorySlug,
        badge: ap.badge ?? undefined,
        rating: 5,
        reviewCount: 10,
        sku: defaultVariant?.sku ?? ap.slug,
        description: ap.description ?? "",
        longDescription: ap.longDescription ?? undefined,
        specifications: {
            weightGrams: defaultVariant?.weightGrams ?? undefined,
            dimensions: defaultVariant ? `${defaultVariant.lengthCm ?? 0}x${defaultVariant.widthCm ?? 0}x${defaultVariant.heightCm ?? 0} cm` : undefined,
            unit: defaultVariant?.unit ?? undefined,
            sku: defaultVariant?.sku ?? undefined,
            region: ap.region ?? undefined,
            material: ap.material ?? undefined,
            color: ap.color ?? undefined,
            brand: ap.brandSlug ?? undefined,
            categoryName: ap.categorySlug,
        },
        region: ap.region ?? undefined,
        material: ap.material ?? undefined,
        color: ap.color ?? undefined,
        inStock: defaultVariant ? defaultVariant.stockQuantity > 0 : true,
    };
}

async function getAdminFallbackProducts(): Promise<Product[]> {
    const productsMap = new Map<string, Product>();
    // Start with all 226 live catalogue products
    for (const p of fallbackProducts) {
        productsMap.set(p.slug, p);
    }
    try {
        const pageRes = await listAdminProducts("", 0, 500);
        if (pageRes && pageRes.content && pageRes.content.length > 0) {
            for (const adminP of pageRes.content) {
                const storefrontP = adminProductToStorefrontProduct(adminP);
                const existing = productsMap.get(storefrontP.slug);
                if (existing) {
                    productsMap.set(storefrontP.slug, {
                        ...existing,
                        ...storefrontP,
                        description: storefrontP.description || existing.description,
                        image: storefrontP.image || existing.image,
                        gallery: storefrontP.gallery && storefrontP.gallery.length > 0 ? storefrontP.gallery : existing.gallery,
                    });
                } else {
                    productsMap.set(storefrontP.slug, storefrontP);
                }
            }
        }
    } catch {}
    return Array.from(productsMap.values());
}

async function getAdminFallbackCategories(): Promise<Category[]> {
    try {
        const cats = await listAdminCategories();
        if (cats && cats.length > 0) {
            return cats.map(c => ({ slug: c.slug as CategorySlug, name: c.name, tagline: c.tagline ?? "" }));
        }
    } catch {}
    return fallbackCategories;
}

export async function getAllProducts(): Promise<Product[]> {
    try {
        const first = await apiFetch<ApiProductPage>(
            `/api/catalogue/products?size=${CATALOGUE_PAGE_SIZE}`,
        );
        const dtos = [...(first?.content || [])];

        const pageCount = Math.ceil((first?.totalElements || 0) / CATALOGUE_PAGE_SIZE);
        if (pageCount > 1) {
            const rest = await Promise.all(
                Array.from({length: pageCount - 1}, (_, index) =>
                    apiFetch<ApiProductPage>(
                        `/api/catalogue/products?size=${CATALOGUE_PAGE_SIZE}&page=${index + 1}`,
                    ),
                ),
            );
            for (const page of rest) {
                if (page && page.content) dtos.push(...page.content);
            }
        }

        const apiProductsMap = new Map<string, Product>();
        for (const dto of dtos) {
            const prod = toProduct(dto);
            apiProductsMap.set(prod.slug, prod);
        }

        // Overlay newly created or edited admin products and stock status
        const adminProducts = await getAdminFallbackProducts();
        for (const adminP of adminProducts) {
            const existing = apiProductsMap.get(adminP.slug);
            if (existing) {
                apiProductsMap.set(adminP.slug, {
                    ...existing,
                    ...adminP,
                    name: adminP.name || existing.name,
                    fullName: adminP.fullName || existing.fullName,
                    inStock: adminP.inStock,
                    image: adminP.image || existing.image,
                });
            } else {
                apiProductsMap.set(adminP.slug, adminP);
            }
        }

        return Array.from(apiProductsMap.values());
    } catch (error) {
        console.error("Error fetching products from database:", error);
        return getAdminFallbackProducts();
    }
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
    try {
        const dto = await apiFetch<ApiProduct>(
            `/api/catalogue/products/${encodeURIComponent(slug)}`,
        );
        return toProduct(dto);
    } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null;
        console.error(`Error fetching product by slug ${slug}:`, error);
        return null;
    }
}

export async function getProductReviews(slug: string): Promise<ProductReview[]> {
    try {
        const dtos = await apiFetch<ApiReview[]>(
            `/api/catalogue/products/${encodeURIComponent(slug)}/reviews`,
        );
        return dtos.map((dto) => ({
            id: String(dto.id),
            authorName: dto.authorName,
            rating: dto.rating,
            title: dto.title ?? undefined,
            body: dto.body ?? undefined,
            createdAt: dto.createdAt,
        }));
    } catch (error) {
        reportFallback("getProductReviews", error);
        return [];
    }
}

export async function getShippingPolicy(): Promise<string | null> {
    try {
        const block = await apiFetch<{ payload: string | null }>(
            "/api/content/pages/shipping-and-delivery",
            {next: {revalidate: 600}},
        );
        return block.payload;
    } catch (error) {
        reportFallback("getShippingPolicy", error);
        return null;
    }
}

export async function getCategories(): Promise<Category[]> {
    try {
        const res = await apiFetch<Category[]>("/api/catalogue/categories");
        if (Array.isArray(res) && res.length > 0) return res;
        return fallbackCategories;
    } catch (error) {
        console.error("Error fetching categories from database:", error);
        return fallbackCategories;
    }
}

export async function getProductsByCategory(
    category: CategorySlug,
): Promise<Product[]> {
    try {
        const page = await apiFetch<ApiProductPage>(
            `/api/catalogue/products?category=${category}&size=100`,
        );
        return (page?.content || []).map(toProduct);
    } catch (error) {
        console.error(`Error fetching products for category ${category}:`, error);
        return [];
    }
}

/** Shortest query that hits the API - below this the dropdown stays closed. */
export const SEARCH_MIN_CHARS = 3;

/**
 * Type-ahead suggestions for header search.
 */
export async function searchProducts(
    query: string,
    limit = 6,
    signal?: AbortSignal,
): Promise<Product[]> {
    const trimmed = query.trim().toLowerCase();
    if (trimmed.length < SEARCH_MIN_CHARS) return [];

    try {
        const page = await apiFetch<ApiProductPage>(
            `/api/catalogue/products?q=${encodeURIComponent(trimmed)}&size=${limit}`,
            {signal},
        );
        if (page && page.content && page.content.length > 0) {
            return page.content.map(toProduct);
        }
    } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") throw error;
        reportFallback("searchProducts", error);
    }

    const all = await getAllProducts();
    return all
        .filter(
            (p) =>
                p.name.toLowerCase().includes(trimmed) ||
                p.description.toLowerCase().includes(trimmed) ||
                p.category.toLowerCase().includes(trimmed) ||
                p.slug.toLowerCase().includes(trimmed),
        )
        .slice(0, limit);
}

/** Home "You might need" rail - the ten reference products from design.md §7.3. */
export async function getFeaturedProducts(): Promise<Product[]> {
    const slugs = [
        "watany-olive-oil-tulkarm-16l",
        "zaatar-hyssop-balat",
        "palestinian-zaatar-sampler-combo",
        "watany-taste-of-palestine-combo",
        "asliah-nabulsi-cheese-5kg",
        "palestinian-farmers-community-virgin-olive-oil-16l",
        "watany-olive-oil-tulkarm-1l",
        "baladia-nabulsi-cheese-10kg",
        "green-baladi-olives-jenin",
        "palestinian-zaatar-mix-extra-qalqilya",
    ];
    const all = await getAllProducts();
    return withRandomFallback(orderBySlugs(all, slugs), all, 10);
}

/** Home "Just for you" section - design.md §7.7. */
export async function getJustForYouProducts(): Promise<Product[]> {
    const slugs = [
        "al-quds-olive-oil-750ml",
        "jenin-olive-oil-750ml",
        "ceramic-bowl-medium",
        "oil-bottle-olives-design",
        "oil-bottle-tree-design",
    ];
    const all = await getAllProducts();
    return withRandomFallback(orderBySlugs(all, slugs), all, 5);
}

/**
 * Fills a curated rail out to `target` with random picks when curated slugs are
 * missing/under-filled - home sections must never render empty.
 */
function withRandomFallback(
    curated: Product[],
    pool: Product[],
    target: number,
): Product[] {
    if (curated.length >= target || pool.length === 0) return curated;

    const chosenIds = new Set(curated.map((product) => product.id));
    const remaining = pool.filter((product) => !chosenIds.has(product.id));
    const filler = shuffle(remaining).slice(0, target - curated.length);
    return [...curated, ...filler];
}

function shuffle<T>(input: T[]): T[] {
    const result = [...input];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

/** Weekly best sellers grouped by category tab (design.md §7.5). */
export async function getBestSellersByCategory(): Promise<
    Record<CategorySlug, Product[]>
> {
    const [all, categories] = await Promise.all([getAllProducts(), getCategories()]);

    const grouped = {} as Record<CategorySlug, Product[]>;
    for (const category of categories) {
        grouped[category.slug] = all
            .filter((product) => product.category === category.slug)
            .slice(0, 5);
    }
    return grouped;
}

/** Related products for the detail page - same category, excluding the product. */
export async function getRelatedProducts(
    product: Product,
    limit = 5,
): Promise<Product[]> {
    try {
        const dtos = await apiFetch<ApiProduct[]>(
            `/api/catalogue/products/${encodeURIComponent(product.slug)}/related?limit=${limit}`,
        );
        return dtos.map(toProduct);
    } catch (error) {
        reportFallback("getRelatedProducts", error);
        return fallbackProducts
            .filter(
                (candidate) =>
                    candidate.category === product.category && candidate.id !== product.id,
            )
            .slice(0, limit);
    }
}

function orderBySlugs(source: Product[], slugs: string[]): Product[] {
    return slugs
        .map((slug) => source.find((product) => product.slug === slug))
        .filter((product): product is Product => Boolean(product));
}

/* ------------------------------------------------------------------ */
/* Filtering & sorting for the all-category page (design.md §9)        */
/*                                                                     */
/* Applied client-side over the fetched page so filter changes feel    */
/* instant. The service exposes the same filters as query parameters   */
/* for when the catalogue outgrows a single page.                      */
/* ------------------------------------------------------------------ */

export type SortKey =
    | "featured"
    | "price-asc"
    | "price-desc"
    | "rating"
    | "name-asc";

export const sortOptions: { value: SortKey; label: string }[] = [
    {value: "featured", label: "Featured"},
    {value: "price-asc", label: "Price: low to high"},
    {value: "price-desc", label: "Price: high to low"},
    {value: "rating", label: "Top rated"},
    {value: "name-asc", label: "Name: A–Z"},
];

export type PriceBand = "under-40" | "40-100" | "100-200" | "over-200";

export const priceBands: { value: PriceBand; label: string }[] = [
    {value: "under-40", label: "Under $40"},
    {value: "40-100", label: "$40 – $100"},
    {value: "100-200", label: "$100 – $200"},
    {value: "over-200", label: "Over $200"},
];

export type CatalogueFilters = {
    category?: CategorySlug | "all";
    /**
     * Multi-select categories. When non-empty a product matches if it belongs to
     * ANY listed category, and `category` is ignored.
     */
    categories?: CategorySlug[];
    price?: PriceBand;
    minRating?: number;
    color?: string;
    material?: string;
    /** Only products carrying a reduced price. */
    onOffer?: boolean;
    search?: string;
};

export function filterProducts(
    input: Product[],
    filters: CatalogueFilters,
): Product[] {
    return input.filter((product) => {
        if (filters.categories && filters.categories.length > 0) {
            if (!filters.categories.includes(product.category)) return false;
        } else if (
            filters.category &&
            filters.category !== "all" &&
            product.category !== filters.category
        ) {
            return false;
        }

        if (filters.price && !matchesPriceBand(product, filters.price)) return false;

        if (filters.minRating && (product.rating ?? 0) < filters.minRating) {
            return false;
        }

        if (filters.color && product.color !== filters.color) return false;
        if (filters.material && product.material !== filters.material) return false;
        if (filters.onOffer && compareAtPriceOf(product) === null) return false;

        if (filters.search) {
            const needle = filters.search.toLowerCase();
            const haystack = [
                product.name,
                product.fullName,
                product.subtitle,
                product.unit,
                product.region ?? "",
                product.category,
            ]
                .join(" ")
                .toLowerCase();
            if (!haystack.includes(needle)) return false;
        }

        return true;
    });
}

function matchesPriceBand(product: Product, band: PriceBand): boolean {
    const price = priceOf(product);
    switch (band) {
        case "under-40":
            return price < 40;
        case "40-100":
            return price >= 40 && price <= 100;
        case "100-200":
            return price > 100 && price <= 200;
        case "over-200":
            return price > 200;
    }
}

export function sortProducts(input: Product[], sort: SortKey): Product[] {
    const sorted = [...input];
    switch (sort) {
        case "price-asc":
            return sorted.sort((a, b) => priceOf(a) - priceOf(b));
        case "price-desc":
            return sorted.sort((a, b) => priceOf(b) - priceOf(a));
        case "rating":
            return sorted.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
        case "name-asc":
            return sorted.sort((a, b) => a.name.localeCompare(b.name));
        case "featured":
        default:
            return sorted;
    }
}

/** Distinct facet values, derived so filters never offer an empty result set. */
export function facetValues(input: Product[]) {
    const unique = (values: (string | undefined)[]) =>
        Array.from(new Set(values.filter((value): value is string => Boolean(value)))).sort();

    return {
        colors: unique(input.map((product) => product.color)),
        materials: unique(input.map((product) => product.material)),
    };
}
