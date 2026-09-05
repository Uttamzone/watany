import type {MetadataRoute} from "next";
import {getAllProducts} from "@/lib/products";
import {categories} from "@/lib/catalogue";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://wataniandsons.ca";

/** XML sitemap - requirement.md F-CAT-9. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const products = await getAllProducts();

    return [
        {url: siteUrl, changeFrequency: "daily", priority: 1},
        {
            url: `${siteUrl}/categories`,
            changeFrequency: "daily",
            priority: 0.9,
        },
        ...categories.map((category) => ({
            url: `${siteUrl}/categories?category=${category.slug}`,
            changeFrequency: "weekly" as const,
            priority: 0.7,
        })),
        ...products.map((product) => ({
            url: `${siteUrl}/product/${product.slug}`,
            changeFrequency: "weekly" as const,
            priority: 0.8,
        })),
    ];
}
