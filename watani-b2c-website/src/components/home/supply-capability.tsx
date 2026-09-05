"use client";

import Image from "next/image";
import {motion, useReducedMotion} from "framer-motion";
import {motionTokens, sec} from "@/lib/motion";

/**
 * What we supply - a capability index, not a shop. The client removed shopping
 * items from the home page, so these categories are stated as supply
 * capability with no prices, imagery or add-to-cart affordance.
 */

const groups = [
    {
        heading: "Pantry & food",
        image: "/images/supply/pantry-food.png",
        items: [
            "Extra virgin olive oil",
            "Zaatar, sumac & spice blends",
            "Nabulsi cheese",
            "Vegetable ghee",
            "Cracked green olives",
            "Freekeh & grains",
        ],
    },
    {
        heading: "Handmade & artisan",
        image: "/images/supply/handmade-artisan.png",
        items: [
            "Hebron ceramics",
            "Serving trays & coffee sets",
            "Vases, jugs & decorative pieces",
            "Custom artistic home pieces",
        ],
    },
    {
        heading: "Heritage wear & textiles",
        image: "/images/supply/heritage-textiles.png",
        items: [
            "Authentic Palestinian kuffiyehs",
            "Tatreez crossbody & tote bags",
            "Cushions & table textiles",
            "Aprons & phone pouches",
        ],
    },
];

/**
 * Two lead products the client wants stated first, above the category index.
 * Unlike the `groups` artwork these are supplied product photographs with the
 * subject centred, so they render as their own image band rather than as a
 * washed-out backdrop behind copy - a white scrim over these would bury the
 * labels that are the whole point of the shot.
 */
const highlights = [
    {
        heading: "Palestinian extra virgin olive oil",
        copy:
            "Organic, cold-pressed, unfiltered, low-acidity Palestinian olive oil from Salfit, Jenin, Tulkarm, Nablus, Ramallah, Al Quds (Jerusalem) and Al Rameh.",
        image: "/images/supply/olive-oil.jpeg",
        alt:
            "Watany Palestinian extra virgin olive oil bottles and tins from Al Quds, Jenin, Nablus, Salfit, Tulkarm, Al Rameh and Ramallah",
    },
    {
        heading: "Authentic Nabulsi knafa / kunafa",
        copy:
            "Boiled Nabulsi cheese with Kawakib and Balka ghee for an authentic taste.",
        image: "/images/supply/nabulsi-kunafa.jpeg",
        alt: "Watany Mashg'olah Nabulsi cheese carton alongside Al Kawakeb vegetable ghee tins",
    },
];

const marks = [
    {label: "Based in Canada", copy: "Canadian operations supporting wholesale, bulk and international orders."},
    {label: "Sourced from Palestine", copy: "Selected from Palestinian farmers, producers, manufacturers and artisans."},
    {label: "Handmade & heritage", copy: "Hebron ceramics, tatreez-inspired home pieces and cultural products."},
    {label: "Worldwide shipping", copy: "Strong wholesale and community demand across Canada and the USA."},
];

export function SupplyCapability() {
    const reduceMotion = useReducedMotion();

    return (
        <section aria-labelledby="supply-heading" className="mt-11 sm:mt-24">
            <motion.div
                initial={reduceMotion ? {opacity: 1, y: 0} : {opacity: 0, y: 16}}
                whileInView={{opacity: 1, y: 0}}
                viewport={{once: true, amount: 0.15}}
                transition={{duration: sec(motionTokens.slow), ease: motionTokens.easeOut}}
                className="relative overflow-hidden rounded-[24px] border border-teal-950/8 bg-surface p-6 sm:rounded-[32px] sm:p-10 lg:p-14"
            >
                <motion.div
                    initial={reduceMotion ? {opacity: 1, x: 0} : {opacity: 0, x: 40}}
                    whileInView={{opacity: 1, x: 0}}
                    viewport={{once: true, amount: 0.2}}
                    transition={{duration: 0.55, ease: [0.16, 1, 0.3, 1]}}
                    className="max-w-2xl"
                >
                    <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal-800">
                        Supply capability
                    </span>
                    <h2
                        id="supply-heading"
                        className="mt-2.5 text-[25px] font-extrabold leading-[1.12] text-teal-950 sm:text-[38px] lg:text-[42px]"
                    >
                        Palestinian food, handmade crafts &amp; heritage products
                    </h2>
                    <p className="mt-4 text-[15px] leading-relaxed text-muted sm:text-[17px]">
                        From handmade Hebron ceramics and custom artistic home pieces to
                        Palestinian clothing, tatreez, spices and traditional foods &mdash;
                        products rooted in Palestinian craft, heritage and everyday life.
                    </p>
                </motion.div>

                <div className="mt-8 grid gap-3.5 border-t border-teal-950/8 pt-8 sm:mt-10 sm:pt-10 md:grid-cols-2">
                    {highlights.map((highlight, i) => (
                        <motion.div
                            key={highlight.heading}
                            initial={reduceMotion ? {opacity: 1, x: 0} : i === 0 ? {opacity: 0, x: -45} : {opacity: 0, x: 45}}
                            whileInView={{opacity: 1, x: 0}}
                            viewport={{once: true, amount: 0.2}}
                            transition={{
                                duration: 0.55,
                                ease: [0.16, 1, 0.3, 1],
                                delay: reduceMotion ? 0 : i * 0.1,
                            }}
                            className="group overflow-hidden rounded-[18px] border border-teal-950/6 bg-white/60 origin-bottom transition-all duration-250 ease-out hover:scale-[1.04] hover:z-20 hover:shadow-card-hover"
                        >
                            {/* Both photographs are supplied at 16:9, so the frame shows
                                each one whole - object-cover here would shave the
                                outer products off either shot. */}
                            <div className="relative aspect-video w-full overflow-hidden">
                                <Image
                                    src={highlight.image}
                                    alt={highlight.alt}
                                    fill
                                    sizes="(max-width: 768px) 100vw, 50vw"
                                    className="object-contain transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                                />
                            </div>
                            <div className="p-5 sm:p-6">
                                <h3 className="text-[17px] font-extrabold leading-[1.2] text-teal-950 sm:text-[19px]">
                                    {highlight.heading}
                                </h3>
                                <p className="mt-2.5 text-[14px] leading-relaxed text-muted">
                                    {highlight.copy}
                                </p>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Each group gets its own tinted panel: three bare lists side by
                    side read as one undifferentiated column of text. */}
                <div className="mt-8 grid gap-3.5 border-t border-teal-950/8 pt-8 sm:mt-10 sm:pt-10 md:grid-cols-3">
                    {groups.map((group, i) => {
                        const initialPos = reduceMotion
                            ? {opacity: 1, x: 0, y: 0}
                            : i === 0
                            ? {opacity: 0, x: -45, y: 0}
                            : i === 2
                            ? {opacity: 0, x: 45, y: 0}
                            : {opacity: 0, x: 0, y: 25};

                        return (
                            <motion.div
                                key={group.heading}
                                initial={initialPos}
                                whileInView={{opacity: 1, x: 0, y: 0}}
                                viewport={{once: true, amount: 0.2}}
                                transition={{
                                    duration: 0.55,
                                    ease: [0.16, 1, 0.3, 1],
                                    delay: reduceMotion ? 0 : i * 0.1,
                                }}
                                className="group overflow-hidden rounded-[18px] border border-teal-950/6 bg-white/60 origin-bottom transition-all duration-250 ease-out hover:scale-[1.04] hover:z-20 hover:shadow-card-hover"
                            >
                                <div className="relative aspect-video w-full overflow-hidden">
                                    <Image
                                        src={group.image}
                                        alt=""
                                        fill
                                        sizes="(max-width: 768px) 100vw, 33vw"
                                        className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                                    />
                                </div>
                                <div className="p-5 sm:p-6">
                                    <div className="flex items-baseline gap-2.5">
                                        <span
                                            aria-hidden
                                            className="font-mono text-[11px] font-bold tracking-[0.16em] text-teal-800/50"
                                        >
                                            {String(i + 1).padStart(2, "0")}
                                        </span>
                                        <h3 className="text-[15px] font-extrabold text-teal-950">
                                            {group.heading}
                                        </h3>
                                    </div>
                                    <ul className="mt-4 space-y-2.5">
                                        {group.items.map((item) => (
                                            <li
                                                key={item}
                                                className="flex items-start gap-2.5 text-[14px] leading-snug text-teal-950/70"
                                            >
                                                <span
                                                    aria-hidden
                                                    className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-lime-500"
                                                />
                                                {item}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>

                <dl className="mt-8 grid grid-cols-2 gap-5 border-t border-teal-950/8 pt-8 sm:mt-10 sm:gap-6 sm:pt-10 lg:grid-cols-4">
                    {marks.map((mark) => (
                        <div key={mark.label}>
                            <dt className="text-[14px] font-extrabold text-teal-950">
                                {mark.label}
                            </dt>
                            <dd className="mt-2 text-[13px] leading-relaxed text-muted">
                                {mark.copy}
                            </dd>
                        </div>
                    ))}
                </dl>
            </motion.div>
        </section>
    );
}
