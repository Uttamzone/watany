import type {Metadata} from "next";
import Link from "next/link";
import {notFound} from "next/navigation";
import {ChevronRight} from "lucide-react";
import {ProductGallery} from "@/components/product/product-gallery";
import {ProductPurchasePanel} from "@/components/product/product-purchase-panel";
import {ProductTabs} from "@/components/product/product-tabs";
import {ProductSection} from "@/components/home/product-section";
import {categories} from "@/lib/catalogue";
import {
    getProductBySlug,
    getProductReviews,
    getRelatedProducts,
    getShippingPolicy,
    productImageSrc,
} from "@/lib/products";
import {sanitizeRichText} from "@/lib/rich-text";
import {priceOf} from "@/lib/types";

/**
 * force-dynamic: prices resolve per pricing group (requirement.md §3); a build-time
 * snapshot would bake retail pricing into HTML for wholesale/distributor too (N-SCL-5).
 */
export const dynamic = "force-dynamic";

export async function generateMetadata(
    props: PageProps<"/product/[slug]">,
): Promise<Metadata> {
    const {slug} = await props.params;
    const decodedSlug = decodeURIComponent(slug);
    const product = await getProductBySlug(decodedSlug);
    if (!product) return {title: "Product not found"};

    const productUrl = `https://wataniandsons.ca/product/${product.slug}`;
    const imageUrl = productImageSrc(product.image);

    return {
        title: product.fullName,
        description: product.description,
        alternates: {
            canonical: productUrl,
        },
        openGraph: {
            title: `${product.fullName} | Watani & Sons`,
            description: product.description,
            url: productUrl,
            siteName: "Watani & Sons",
            locale: "en_CA",
            type: "website",
            images: [{url: imageUrl, alt: product.fullName}],
        },
        twitter: {
            card: "summary_large_image",
            title: `${product.fullName} | Watani & Sons`,
            description: product.description,
            images: [imageUrl],
        },
    };
}

export default async function ProductDetailPage(
    props: PageProps<"/product/[slug]">,
) {
    // Route params arrive percent-encoded; getProductBySlug encodes again for the
    // request, so decode once here to avoid double-encoding the slug.
    const {slug} = await props.params;
    const product = await getProductBySlug(decodeURIComponent(slug));

    if (!product) notFound();

    // Independent reads, so they go out together rather than in series.
    const [related, reviews, shippingPolicy] = await Promise.all([
        getRelatedProducts(product).catch(() => []),
        getProductReviews(product.slug || decodeURIComponent(slug)).catch(() => []),
        getShippingPolicy().catch(() => null),
    ]);

    const safeReviews = Array.isArray(reviews) ? reviews : [];
    const safeRelated = Array.isArray(related) ? related : [];

    // Sanitised here, on the server, so the client component only ever receives
    // markup that is already safe to hand to dangerouslySetInnerHTML.
    const descriptionHtml = sanitizeRichText(
        product.longDescription ?? (product.description ? `<p>${product.description}</p>` : null),
    );
    const shippingHtml = sanitizeRichText(shippingPolicy);

    const categoryName =
        categories.find((category) => category.slug === product.category)?.name ??
        product.category ??
        "Catalogue";

    // Product structured data - requirement.md F-CAT-9.
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "Product",
        name: product.fullName,
        description: product.description,
        sku: product.sku,
        image: productImageSrc(product.image),
        brand: {"@type": "Brand", name: "Watani & Sons"},
        offers: {
            "@type": "Offer",
            priceCurrency: "CAD",
            price: (Number(priceOf(product)) || 0).toFixed(2),
            availability: product.inStock === false ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
        },
        ...(product.rating !== undefined && product.reviewCount !== undefined
            ? {
                aggregateRating: {
                    "@type": "AggregateRating",
                    ratingValue: typeof product.rating === "number" ? product.rating : 5,
                    reviewCount: typeof product.reviewCount === "number" ? product.reviewCount : 0,
                },
            }
            : {}),
        // Individual reviews, so search engines can show the same feedback the
        // Reviews tab does rather than only the aggregate (F-CAT-9).
        ...(safeReviews.length > 0
            ? {
                review: safeReviews.map((review) => ({
                    "@type": "Review",
                    author: {"@type": "Person", name: review.authorName || "Customer"},
                    datePublished: review.createdAt || new Date().toISOString(),
                    reviewRating: {
                        "@type": "Rating",
                        ratingValue: typeof review.rating === "number" ? review.rating : 5,
                        bestRating: 5,
                    },
                    ...(review.title ? {name: review.title} : {}),
                    ...(review.body ? {reviewBody: review.body} : {}),
                })),
            }
            : {}),
    };

    return (
        <div className="shell pt-8">
            <script
                type="application/ld+json"
                // Serialised catalogue data, not user input.
                dangerouslySetInnerHTML={{__html: JSON.stringify(jsonLd)}}
            />

            <nav aria-label="Breadcrumb">
                <ol className="flex flex-wrap items-center gap-1.5 text-[13px] text-muted">
                    <li>
                        <Link href="/" className="transition-colors hover:text-teal-900">
                            Home
                        </Link>
                    </li>
                    <ChevronRight className="size-3.5" aria-hidden/>
                    <li>
                        <Link
                            href={`/categories?category=${product.category || ""}`}
                            className="transition-colors hover:text-teal-900"
                        >
                            {categoryName || "Catalogue"}
                        </Link>
                    </li>
                    <ChevronRight className="size-3.5" aria-hidden/>
                    <li aria-current="page" className="font-semibold text-teal-950">
                        {product.name}
                    </li>
                </ol>
            </nav>

            <div className="mt-5 rounded-[28px] bg-surface p-6 md:p-10 lg:p-12">
                <div className="grid gap-10 min-[900px]:grid-cols-2 lg:gap-16">
                    <ProductGallery product={product}/>
                    <ProductPurchasePanel product={product}/>
                </div>
            </div>

            <ProductTabs
                product={product}
                reviews={safeReviews}
                descriptionHtml={descriptionHtml}
                shippingHtml={shippingHtml}
            />

            {safeRelated.length > 0 && (
                <ProductSection
                    title="You might also like"
                    products={safeRelated}
                    seeMoreHref={`/categories?category=${product.category || ""}`}
                    headingId="related-products"
                />
            )}
        </div>
    );
}
