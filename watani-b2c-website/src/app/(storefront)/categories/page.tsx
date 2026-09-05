import type {Metadata} from "next";
import {CatalogueBrowser} from "@/components/category/catalogue-browser";
import {ScrollToTop} from "@/components/layout/scroll-to-top";
import {getAllProducts, getCategories} from "@/lib/products";
import type {CategorySlug} from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
    title: "All Palestinian Products | Catalogue",
    description:
        "Explore the complete catalogue of authentic Palestinian olive oil, dates, za'atar, freekeh, Nabulsi cheese, handmade ceramics, and spices.",
    alternates: {
        canonical: "https://wataniandsons.ca/categories",
    },
    openGraph: {
        title: "All Palestinian Products | Watani & Sons",
        description:
            "Explore the complete catalogue of authentic Palestinian olive oil, dates, za'atar, freekeh, Nabulsi cheese, handmade ceramics, and spices.",
        url: "https://wataniandsons.ca/categories",
    },
};

/**
 * All-category page - design.md §9.
 * Content order: offer cards, heading, filter toolbar, product grid.
 */
export default async function CategoriesPage(props: PageProps<"/categories">) {
    const searchParams = await props.searchParams;
    const [products, categories] = await Promise.all([
        getAllProducts(),
        getCategories(),
    ]);

    const rawCategory = first(searchParams.category);
    const category = categories.some((item) => item.slug === rawCategory)
        ? (rawCategory as CategorySlug)
        : undefined;

    return (
        <div className="shell pt-8">

            <div>
                <p className="text-[14px] font-bold uppercase tracking-[0.16em] text-coral">
                    Watani &amp; Sons
                </p>
                <h1 className="mt-2 text-[30px] font-extrabold text-teal-950 sm:text-[38px] lg:text-[42px]">
                    All products
                </h1>
            </div>

            <div className="mt-7">
                <CatalogueBrowser
                    products={products}
                    categories={categories}
                    initialCategory={category}
                    initialQuery={first(searchParams.q)}
                    initialOffer={first(searchParams.offer) === "1"}
                />
            </div>

            <ScrollToTop/>
        </div>
    );
}

/** searchParams values arrive as string | string[] | undefined. */
function first(value: string | string[] | undefined): string | undefined {
    return Array.isArray(value) ? value[0] : value;
}
