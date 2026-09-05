import type {Metadata} from "next";
import {HomeLandingWrapper} from "@/components/home/home-landing-wrapper";

/**
 * Home page - corporate front door for wataniandsons.ca.
 * Enhanced with staggered landing animations across all sections.
 */

export const metadata: Metadata = {
    title: "Palestinian Wholesale Products Canada | Watani & Sons Corp",
    description:
        "Watani & Sons Corp is a Canada-based supplier of authentic Palestinian products shipping worldwide. Wholesale and bulk Palestinian olive oil, zaatar, sumac, spices, Nabulsi cheese, ghee, handmade Hebron ceramics, tatreez bags, kuffiyehs and home decor. Amanat shipping available.",
    alternates: {canonical: "https://wataniandsons.ca/"},
    openGraph: {
        title:
            "Watani & Sons Corp | Palestinian Wholesale, Bulk Products & Amanat Shipping",
        description:
            "Authentic Palestinian food, handmade ceramics, artistic home décor, tatreez, clothing and specialty products. Based in Canada and shipping worldwide.",
        type: "website",
        url: "https://wataniandsons.ca/",
    },
};

/** Mirrors the copy in <HomeFaq> - keep both in sync. */
const faqJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
        {
            "@type": "Organization",
            "@id": "https://wataniandsons.ca/#organization",
            name: "Watani & Sons Corp",
            url: "https://wataniandsons.ca/",
            sameAs: [
                "https://wataniandsons.com/",
                "https://watanypalestinianproducts.com/",
            ],
            description:
                "Canada-based supplier of authentic Palestinian wholesale and bulk products, handmade ceramics, artistic home goods, clothing, tatreez, spices, olive oil, cheese, ghee and Amanat shipping services.",
            areaServed: [
                {"@type": "Country", name: "Canada"},
                {"@type": "Country", name: "United States"},
                {"@type": "Place", name: "Worldwide"},
            ],
        },
        {
            "@type": "FAQPage",
            "@id": "https://wataniandsons.ca/#faq",
            mainEntity: [
                {
                    "@type": "Question",
                    name: "Does Watani & Sons Corp sell to consumers?",
                    acceptedAnswer: {
                        "@type": "Answer",
                        text: "Watani & Sons Corp focuses on wholesale, distribution, bulk purchasing and Amanat shipping. Individual consumer purchases are available through WatanyPalestinianProducts.com.",
                    },
                },
                {
                    "@type": "Question",
                    name: "Where is Watani & Sons Corp based?",
                    acceptedAnswer: {
                        "@type": "Answer",
                        text: "Watani & Sons Corp is based in Canada and serves customers in Canada, the United States and international destinations.",
                    },
                },
                {
                    "@type": "Question",
                    name: "What Palestinian products are available?",
                    acceptedAnswer: {
                        "@type": "Answer",
                        text: "Major categories include Palestinian olive oil, zaatar, sumac, spices, Nabulsi cheese, ghee, olives, freekeh, handmade Hebron ceramics, artistic home decor, tatreez products, clothing, kufiyas, aprons and bags.",
                    },
                },
                {
                    "@type": "Question",
                    name: "Who can apply for a wholesale or distributor account?",
                    acceptedAnswer: {
                        "@type": "Answer",
                        text: "Retailers, grocery stores, restaurants, community organizations and distributors can apply for wholesale or distributor access.",
                    },
                },
            ],
        },
    ],
};

export default function HomePage() {
    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{__html: JSON.stringify(faqJsonLd)}}
            />

            <HomeLandingWrapper />
        </>
    );
}
