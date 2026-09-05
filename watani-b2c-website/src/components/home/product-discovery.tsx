"use client";

import Image from "next/image";
import Link from "next/link";
import {motion, useReducedMotion} from "framer-motion";
import {motionTokens, sec} from "@/lib/motion";

/**
 * "Discover Authentic Palestinian Products" - a category showcase, not a
 * product grid. The client removed shopping from the home page, so nothing here
 * renders a price or an add-to-cart: each tile is a doorway into /categories.
 *
 * Layout is an asymmetric bento - the first tile spans two columns and two rows
 * on desktop so the section reads as editorial rather than as a uniform grid.
 */

type Tile = {
    name: string;
    blurb: string;
    image: string;
    /** Used as the React key, and as the `?category=` value unless `href` overrides. */
    slug: string;
    /** Set only when the tile has no matching catalogue category to filter by. */
    href?: string;
    /** Desktop-only span classes; the base layout stays a simple 2-col grid. */
    span?: string;
};

const tiles: Tile[] = [
    {
        name: "Palestinian Olive Oil",
        blurb:
            "Extra virgin oil from Palestinian groves, in retail, case and bulk formats.",
        image: "/art/olive_oil.jpeg",
        slug: "olive-oil",
        span: "lg:col-span-2 lg:row-span-2",
    },
    {
        name: "Zaatar, Sumac & Spices",
        blurb: "Regional blends for kitchens, restaurants and retail shelves.",
        image: "/art/zaatar.jpeg",
        slug: "zaatar",
    },
    {
        name: "Nabulsi Cheese",
        blurb: "Traditional cheese in brine, retail and food-service sizes.",
        image: "/art/cheese.jpeg",
        slug: "cheese",
    },
    {
        name: "Palestinian Olives",
        blurb: "Cracked green olives cured the traditional way.",
        image: "/art/olives.jpeg",
        slug: "olives",
    },
    {
        name: "Handmade Ceramics",
        blurb: "Hebron bowls, trays, coffee sets and decorative pieces.",
        image: "/art/ceramics.jpeg",
        slug: "ceramics",
    },
    {
        name: "Ghee & Pantry",
        blurb: "Vegetable ghee in retail and food-service tins.",
        image: "/images/supply/pantry-food.png",
        slug: "ghee",
    },
    {
        name: "Freekeh & Grains",
        blurb: "Roasted green wheat and traditional pantry staples.",
        image: "/art/zaatar.jpeg",
        slug: "spices-grains",
    },
    {
        name: "Beauty Care",
        blurb: "Olive oil soap and traditional skin care.",
        image: "/images/supply/handmade-artisan.png",
        slug: "beauty-care",
    },
    {
        // The client's mockup lists clothing, kuffiyehs and tatreez, but the
        // catalogue has no textiles category yet - so this tile opens the full
        // category index rather than linking somewhere that doesn't exist.
        name: "Heritage Textiles",
        blurb: "Kuffiyehs, tatreez bags, cushions and table textiles.",
        image: "/images/supply/heritage-textiles.png",
        href: "/categories",
        slug: "textiles",
    },
];

/*
 * Tile count is load-bearing on desktop: the lead tile spans 2x2 (four cells)
 * of a 4-col x 3-row grid, so the remaining eight tiles fill the other eight
 * cells exactly. Any other count leaves a hole in the last row - if you add or
 * remove a tile, re-check that the grid still packs flush.
 */

export function ProductDiscovery() {
    const reduceMotion = useReducedMotion();

    return (
        <section aria-labelledby="discover-heading" className="mt-11 sm:mt-24">
            <motion.div
                initial={reduceMotion ? {opacity: 1, x: 0} : {opacity: 0, x: 40}}
                whileInView={{opacity: 1, x: 0}}
                viewport={{once: true, amount: 0.2}}
                transition={{duration: 0.55, ease: [0.16, 1, 0.3, 1]}}
                className="flex flex-wrap items-end justify-between gap-6"
            >
                <div className="max-w-2xl">
                    <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal-800">
                        Our products
                    </span>
                    <h2
                        id="discover-heading"
                        className="mt-2.5 text-[25px] font-extrabold leading-[1.12] text-teal-950 sm:text-[38px] lg:text-[44px]"
                    >
                        Discover authentic Palestinian products
                    </h2>
                    <p className="mt-4 text-[15px] leading-relaxed text-muted sm:text-[17px]">
                        From handmade Hebron ceramics and custom artistic home pieces to
                        Palestinian clothing, tatreez, spices and traditional foods &mdash;
                        explore products rooted in Palestinian craft, heritage and everyday
                        life.
                    </p>
                </div>

                <Link
                    href="/categories"
                    className="group inline-flex h-[46px] w-full shrink-0 items-center justify-center gap-2 rounded-[12px] bg-teal-950 px-6 text-[14px] font-bold text-white transition-transform duration-150 hover:-translate-y-0.5 active:translate-y-px sm:h-[48px] sm:w-auto"
                >
                    Explore more
                    <span
                        aria-hidden
                        className="transition-transform duration-200 group-hover:translate-x-1"
                    >
                        &rarr;
                    </span>
                </Link>
            </motion.div>

            {/*
              * Mobile: a snap-scroll rail. Stacked, these five tiles ran 1600px -
              * roughly two full screens of scrolling for one section. The rail keeps
              * the whole set reachable in a thumb swipe and matches the horizontal
              * pattern used elsewhere on the storefront.
              * Desktop (lg+): the asymmetric bento, where tile one spans 2x2.
              */}
            <ul className="rail-scroll -mx-4 mt-8 flex snap-x snap-mandatory gap-3.5 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:mx-0 lg:mt-10 lg:grid lg:grid-cols-4 lg:gap-5 lg:overflow-visible lg:px-0 lg:pb-0 [&>*]:min-w-0">
                {tiles.map((tile, i) => {
                    const isLead = tile.span?.includes("lg:col-span-2");
                    const initialPos = reduceMotion
                        ? {opacity: 1, x: 0}
                        : i % 2 === 0
                        ? {opacity: 0, x: -45}
                        : {opacity: 0, x: 45};

                    return (
                        <motion.li
                            key={tile.slug}
                            initial={initialPos}
                            whileInView={{opacity: 1, x: 0}}
                            viewport={{once: true, amount: 0.15}}
                            transition={{
                                duration: 0.55,
                                ease: [0.16, 1, 0.3, 1],
                                delay: reduceMotion ? 0 : i * 0.07,
                            }}
                            className={[
                                "w-[76vw] max-w-[300px] shrink-0 snap-start first:scroll-ml-4 sm:w-[320px] sm:first:scroll-ml-6 lg:w-auto lg:max-w-none lg:first:scroll-ml-0",
                                tile.span ?? "",
                            ].join(" ")}
                        >
                            <Link
                                href={tile.href ?? `/categories?category=${tile.slug}`}
                                className="group relative flex flex-col h-full overflow-hidden rounded-[22px] border border-teal-950/8 bg-surface shadow-card origin-bottom transition-all duration-300 ease-out hover:scale-[1.03] hover:z-20 hover:shadow-card-hover"
                            >
                                {/* Top Section: Unobstructed Product Photo Frame */}
                                <div className={[
                                    "relative w-full overflow-hidden bg-[#edf3ef] flex items-center justify-center",
                                    isLead ? "h-[240px] sm:h-[300px] lg:h-[320px]" : "h-[170px] sm:h-[190px] lg:h-[170px]"
                                ].join(" ")}>
                                    <Image
                                        src={tile.image}
                                        alt={tile.name}
                                        fill
                                        sizes={isLead ? "(max-width: 1024px) 100vw, 50vw" : "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"}
                                        className="object-cover object-center transition-transform duration-500 ease-out group-hover:scale-108"
                                    />
                                    {/* Soft ambient gradient overlay */}
                                    <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-teal-950/10 via-transparent to-black/5 opacity-60 group-hover:opacity-30 transition-opacity duration-300" />
                                </div>

                                {/* Bottom Section: Text Content Below Product */}
                                <div className="flex flex-col flex-1 p-5 sm:p-6 bg-surface">
                                    <h3 className="text-[17px] sm:text-[19px] font-extrabold leading-tight text-teal-950 group-hover:text-teal-800 transition-colors duration-200">
                                        {tile.name}
                                    </h3>
                                    <p className="mt-2 text-[13px] sm:text-[14px] leading-relaxed text-muted">
                                        {tile.blurb}
                                    </p>
                                    <div className="mt-auto pt-4 flex items-center justify-between">
                                        <span className="inline-flex items-center gap-1.5 text-[13.5px] font-bold text-teal-900 group-hover:text-teal-950 transition-colors duration-200">
                                            Explore
                                            <span
                                                aria-hidden
                                                className="transition-transform duration-250 ease-out group-hover:translate-x-1.5"
                                            >
                                                &rarr;
                                            </span>
                                        </span>
                                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-soft-control text-teal-950 transition-all duration-250 ease-out group-hover:bg-lime-500 group-hover:rotate-45">
                                            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                                                <path
                                                    d="M3 8h10M9 4l4 4-4 4"
                                                    stroke="currentColor"
                                                    strokeWidth="1.8"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                />
                                            </svg>
                                        </span>
                                    </div>
                                </div>
                            </Link>
                        </motion.li>
                    );
                })}
            </ul>
        </section>
    );
}
