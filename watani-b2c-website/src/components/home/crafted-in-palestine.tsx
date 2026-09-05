"use client";

import Image from "next/image";
import Link from "next/link";
import {motion, useReducedMotion} from "framer-motion";
import {motionTokens, sec} from "@/lib/motion";

/**
 * "Crafted in Palestine" - the handmade/artisan story the client asked for.
 *
 * This sits between the product tiles and the supply index deliberately: the
 * tiles say what we sell and the supply index says what we can source, but
 * neither says who makes it. The craft story is the differentiator against a
 * commodity importer, so it gets photography rather than another list.
 *
 * Two bands: a photo trio (the story) then three cards (the routes into the
 * catalogue). No prices or add-to-cart - this site is not a consumer store.
 */

type Feature = {
    title: string;
    copy: string;
    image: string;
    /** Desktop-only span; the first frame is the lead image. */
    span?: string;
};

const features: Feature[] = [
    {
        title: "Made by Palestinian artisans",
        copy: "Traditional ceramic work shaped and painted by skilled craftspeople.",
        image: "/images/supply/handmade-artisan.png",
        span: "lg:col-span-2",
    },
    {
        title: "Hebron ceramics",
        copy: "Functional art for kitchens, tables and meaningful gifts.",
        image: "/art/ceramics.jpeg",
    },
    {
        title: "Artistic home pieces",
        copy: "Tatreez-inspired cushions, table textiles, bags and accessories.",
        image: "/images/supply/heritage-textiles.png",
    },
];

type Craft = {
    index: string;
    title: string;
    copy: string;
    cta: string;
    href: string;
};

const crafts: Craft[] = [
    {
        index: "01",
        title: "Handmade ceramics",
        copy: "Handcrafted Hebron ceramics including bowls, serving trays, coffee sets, vases, jugs and decorative pieces — each with its own artistic character.",
        cta: "Explore ceramics",
        href: "/categories?category=ceramics",
    },
    {
        index: "02",
        title: "Artistic home collection",
        copy: "Cushions, tablecloths, aprons, bags and custom home accessories inspired by Palestinian tatreez, heritage patterns and traditional design.",
        cta: "Explore home & tatreez",
        href: "/categories",
    },
    {
        index: "03",
        title: "Clothing & heritage wear",
        copy: "Kuffiyehs, apparel, textile accessories and Palestinian-inspired clothing designed for everyday wear, gifting and cultural events.",
        cta: "Explore clothing",
        href: "/categories",
    },
];

export function CraftedInPalestine() {
    const reduceMotion = useReducedMotion();

    return (
        <section aria-labelledby="crafted-heading" className="mt-11 sm:mt-24">
            <motion.div
                initial={reduceMotion ? {opacity: 1, x: 0} : {opacity: 0, x: -40}}
                whileInView={{opacity: 1, x: 0}}
                viewport={{once: true, amount: 0.2}}
                transition={{duration: 0.55, ease: [0.16, 1, 0.3, 1]}}
                className="max-w-2xl"
            >
                <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal-800">
                    Artisan &amp; Heritage
                </span>
                <h2
                    id="crafted-heading"
                    className="mt-2.5 text-[25px] font-extrabold leading-[1.12] text-teal-950 sm:text-[38px] lg:text-[44px]"
                >
                    Crafted in Palestine
                </h2>
                <p className="mt-4 text-[15px] leading-relaxed text-muted sm:text-[17px]">
                    Watani &amp; Sons Corp brings together traditional Palestinian
                    craftsmanship and contemporary design &mdash; handmade ceramics,
                    custom home pieces, tatreez-inspired textiles, clothing and specialty
                    products for retail, wholesale and bulk buyers.
                </p>
            </motion.div>

            {/*
              * Mobile: snap rail, matching the discovery tiles and path cards. Three
              * 420px-tall photo frames stacked ran past two screens on a phone.
              *
              * Desktop (lg+): one row of four columns, the artisan frame leading at
              * double width. Three tiles can't fill a two-row bento - an earlier
              * 2x2 lead left columns 3-4 of row two empty - so the row stays single
              * and the emphasis comes from width, not height.
              */}
            <ul className="rail-scroll -mx-4 mt-8 flex snap-x snap-mandatory gap-3.5 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:mx-0 lg:mt-10 lg:grid lg:grid-cols-4 lg:gap-5 lg:overflow-visible lg:px-0 lg:pb-0 [&>*]:min-w-0">
                {features.map((feature, i) => {
                    const initialPos = reduceMotion
                        ? {opacity: 1, x: 0, y: 0}
                        : i === 0
                        ? {opacity: 0, x: -45, y: 0}
                        : i === 2
                        ? {opacity: 0, x: 45, y: 0}
                        : {opacity: 0, x: 0, y: 25};

                    return (
                        <motion.li
                            key={feature.title}
                            initial={initialPos}
                            whileInView={{opacity: 1, x: 0, y: 0}}
                            viewport={{once: true, amount: 0.2}}
                            transition={{
                                duration: 0.55,
                                ease: [0.16, 1, 0.3, 1],
                                delay: reduceMotion ? 0 : i * 0.1,
                            }}
                            className={[
                                "w-[76vw] max-w-[300px] shrink-0 snap-start first:scroll-ml-4 sm:w-[320px] sm:first:scroll-ml-6 lg:w-auto lg:max-w-none lg:first:scroll-ml-0",
                                feature.span ?? "",
                            ].join(" ")}
                        >
                            <div className="group relative flex flex-col h-full overflow-hidden rounded-[22px] border border-teal-950/8 bg-surface shadow-card origin-bottom transition-all duration-300 ease-out hover:scale-[1.03] hover:z-20 hover:shadow-card-hover cursor-pointer">
                                <div className="relative h-[180px] sm:h-[220px] w-full overflow-hidden bg-[#edf3ef]">
                                    <Image
                                        src={feature.image}
                                        alt={feature.title}
                                        fill
                                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                                        className="object-cover transition-transform duration-500 ease-out group-hover:scale-108"
                                    />
                                    <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-teal-950/10 via-transparent to-black/5 opacity-60 group-hover:opacity-30 transition-opacity duration-300" />
                                </div>

                                <div className="flex flex-col flex-1 p-5 sm:p-6 bg-surface">
                                    <h3 className="text-[18px] font-extrabold leading-tight text-teal-950 group-hover:text-teal-800 transition-colors duration-200">
                                        {feature.title}
                                    </h3>
                                    <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
                                        {feature.copy}
                                    </p>
                                </div>
                            </div>
                        </motion.li>
                    );
                })}
            </ul>

            <div className="mt-3.5 grid gap-3.5 sm:mt-4 sm:gap-4 lg:grid-cols-3 [&>*]:min-w-0">
                {crafts.map((craft, i) => {
                    const initialPos = reduceMotion
                        ? {opacity: 1, x: 0, y: 0}
                        : i === 0
                        ? {opacity: 0, x: -45, y: 0}
                        : i === 2
                        ? {opacity: 0, x: 45, y: 0}
                        : {opacity: 0, x: 0, y: 25};

                    return (
                        <motion.div
                            key={craft.title}
                            initial={initialPos}
                            whileInView={{opacity: 1, x: 0, y: 0}}
                            viewport={{once: true, amount: 0.2}}
                            transition={{
                                duration: 0.55,
                                ease: [0.16, 1, 0.3, 1],
                                delay: reduceMotion ? 0 : i * 0.1,
                            }}
                        >
                            <Link
                                href={craft.href}
                                className="group flex h-full flex-col rounded-[22px] border border-teal-950/8 bg-surface p-5 shadow-card origin-bottom transition-all duration-250 ease-out hover:scale-[1.04] hover:z-20 hover:shadow-card-hover sm:p-7"
                            >
                                <span className="font-mono text-[12px] font-bold tracking-[0.18em] text-teal-800/60">
                                    {craft.index}
                                </span>
                                <h3 className="mt-4 text-[19px] font-extrabold leading-tight text-teal-950 sm:mt-5 sm:text-[21px]">
                                    {craft.title}
                                </h3>
                                <p className="mt-2.5 text-[13.5px] leading-relaxed text-muted sm:text-[14.5px]">
                                    {craft.copy}
                                </p>
                                <span className="mt-auto inline-flex items-center gap-1.5 pt-6 text-[13.5px] font-bold text-teal-900 sm:text-[14px]">
                                    {craft.cta}
                                    <span
                                        aria-hidden
                                        className="transition-transform duration-200 ease-out group-hover:translate-x-1"
                                    >
                                        &rarr;
                                    </span>
                                </span>
                            </Link>
                        </motion.div>
                    );
                })}
            </div>
        </section>
    );
}
