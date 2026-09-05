import type {Metadata} from "next";
import {Manrope} from "next/font/google";
import "../globals.css";
import {CartProvider} from "@/components/cart/cart-store";
import {AuthProvider} from "@/components/auth/auth-store";
import {WishlistProvider} from "@/components/wishlist/wishlist-store";
import {NotificationProvider} from "@/components/notifications/notification-store";
import {NotificationViewport} from "@/components/notifications/notification-viewport";
import {ConsumerStoreBanner} from "@/components/layout/consumer-store-banner";
import {SiteHeader} from "@/components/layout/site-header";
import {SiteFooter} from "@/components/layout/site-footer";
import {FloralBackgroundDecor} from "@/components/layout/floral-background-decor";
import {CataloguePricingProvider} from "@/components/product/catalogue-pricing-store";
import {CurrencyProvider} from "@/components/currency/currency-store";

const manrope = Manrope({
    variable: "--font-manrope",
    subsets: ["latin"],
    weight: ["400", "500", "600", "700", "800"],
    display: "swap",
});

export const metadata: Metadata = {
    metadataBase: new URL(
        process.env.NEXT_PUBLIC_SITE_URL && process.env.NEXT_PUBLIC_SITE_URL.startsWith("http")
            ? process.env.NEXT_PUBLIC_SITE_URL
            : "https://wataniandsons.ca",
    ),
    title: {
        default: "Watani & Sons | Authentic Palestinian Olive Oil & Goods in Canada",
        template: "%s | Watani & Sons",
    },
    description:
        "Shop authentic Palestinian olive oil, olives, zaatar, cheese, ceramics, and artisan products directly sourced from trusted farmers and delivered across Canada.",
    keywords: [
        "Palestinian olive oil Canada",
        "Watani & Sons",
        "Watany olive oil Tulkarm",
        "Palestinian zaatar",
        "authentic Palestinian products",
        "Nablus olive oil soap",
        "Jericho Medjool dates",
        "Palestinian ceramics Ottawa Toronto",
        "halal Palestinian groceries Canada",
        "wholesale Mediterranean products Canada",
    ],
    authors: [{ name: "Watani & Sons", url: "https://wataniandsons.ca" }],
    creator: "Watani & Sons",
    publisher: "Watani & Sons",
    formatDetection: {
        email: false,
        address: false,
        telephone: false,
    },
    alternates: {
        canonical: "https://wataniandsons.ca",
    },
    openGraph: {
        type: "website",
        locale: "en_CA",
        url: "https://wataniandsons.ca",
        siteName: "Watani & Sons",
        title: "Watani & Sons | Authentic Palestinian Olive Oil & Goods in Canada",
        description:
            "Shop authentic Palestinian olive oil, olives, zaatar, cheese, ceramics, and artisan products directly sourced from trusted farmers and delivered across Canada.",
        images: [
            {
                url: "/images/offers/olive-oil-can.webp",
                width: 1200,
                height: 630,
                alt: "Watani & Sons Premium Palestinian Olive Oil",
            },
        ],
    },
    twitter: {
        card: "summary_large_image",
        title: "Watani & Sons | Authentic Palestinian Products",
        description:
            "Authentic Palestinian olive oil, zaatar, dates, and artisan products delivered across Canada.",
        images: ["/images/offers/olive-oil-can.webp"],
    },
    robots: {
        index: true,
        follow: true,
        googleBot: {
            index: true,
            follow: true,
            "max-video-preview": -1,
            "max-image-preview": "large",
            "max-snippet": -1,
        },
    },
};

const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Watani & Sons",
    url: "https://wataniandsons.ca",
    logo: "https://wataniandsons.ca/apple-icon.png",
    description:
        "Authentic Palestinian olive oil, dates, zaatar, and artisan products delivered across Canada.",
    address: {
        "@type": "PostalAddress",
        streetAddress: "300 Greenbank Rd",
        addressLocality: "Ottawa",
        addressRegion: "ON",
        postalCode: "K2H 0B6",
        addressCountry: "CA",
    },
    contactPoint: {
        "@type": "ContactPoint",
        telephone: "+1-613-555-0192",
        contactType: "customer service",
        availableLanguage: ["English", "Arabic"],
    },
    sameAs: [
        "https://facebook.com/wataniandsons",
        "https://instagram.com/wataniandsons",
    ],
};

const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Watani & Sons",
    url: "https://wataniandsons.ca",
    potentialAction: {
        "@type": "SearchAction",
        target: "https://wataniandsons.ca/categories?search={search_term_string}",
        "query-input": "required name=search_term_string",
    },
};

/**
 * Storefront root layout (design.md). Sibling to `app/admin/layout.tsx` - admin
 * needs different chrome, so each route group owns its own `<html>`/`<body>`.
 */
export default function StorefrontLayout({
                                             children,
                                         }: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" className={`${manrope.variable} h-full`}>
        <head>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
            />
        </head>
        <body className="flex min-h-full flex-col bg-canvas text-text antialiased">
        <NotificationProvider>
            <AuthProvider>
                <CurrencyProvider>
                    <CataloguePricingProvider>
                        <CartProvider>
                            <WishlistProvider>
                                <a
                                    href="#main"
                                    className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-teal-950 focus:px-4 focus:py-2 focus:text-white"
                                >
                                    Skip to content
                                </a>
                                <div className="relative z-10 flex min-h-screen flex-col bg-canvas shadow-[0_25px_60px_rgba(0,0,0,0.18),0_10px_20px_rgba(0,0,0,0.12)]">
                                    <FloralBackgroundDecor />
                                    <ConsumerStoreBanner/>
                                    <SiteHeader/>
                                    <main id="main" className="flex-1 pb-16 md:pb-24 lg:pb-32">
                                        {children}
                                    </main>
                                </div>
                                <SiteFooter/>
                            </WishlistProvider>
                        </CartProvider>
                    </CataloguePricingProvider>
                </CurrencyProvider>
            </AuthProvider>
            <NotificationViewport/>
        </NotificationProvider>
        </body>
        </html>
    );
}
