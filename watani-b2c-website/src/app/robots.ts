import type {MetadataRoute} from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://wataniandsons.ca";

/** robots.txt - requirement.md F-CAT-9. Cart and checkout routes are non-indexable. */
export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
            userAgent: "*",
            allow: "/",
            disallow: ["/cart", "/checkout", "/account", "/portal", "/admin", "/login", "/forgot-password", "/reset-password"],
        },
        sitemap: `${siteUrl}/sitemap.xml`,
    };
}
