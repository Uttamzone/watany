"use client";

import {motion, useReducedMotion} from "framer-motion";
import {motionTokens, sec} from "@/lib/motion";

/**
 * Service coverage - Canada, the USA and beyond.
 *
 * The city lists are SEO surface as much as information: buyers search
 * "Palestinian wholesale <their city>", and this is where those terms live on
 * the page. They are named as *coverage*, not as branches or warehouses - hence
 * the disclaimer, which the client's mockup carried verbatim and which keeps the
 * claim honest when freight options differ by destination.
 *
 * Cities render as individual chips rather than one comma-run sentence: a
 * fifteen-item run in bold was a wall of text nobody scans for their own city.
 */

const regions = [
    {
        code: "CA",
        name: "Canada",
        copy: "Wholesale and bulk Palestinian food, handmade ceramics, tatreez, clothing, kuffiyehs, olive oil, zaatar, spices, cheese and ghee shipped across Canada.",
        cities: [
            "Toronto",
            "Mississauga",
            "Brampton",
            "Montreal",
            "Ottawa",
            "Gatineau",
            "Hamilton",
            "London",
            "Windsor",
            "Calgary",
            "Edmonton",
            "Vancouver",
            "Surrey",
            "Winnipeg",
        ],
        emphasis: true,
    },
    {
        code: "US",
        name: "United States",
        copy: "Authentic Palestinian products for stores, restaurants, organizations, community events, families and specialty retailers across the United States.",
        cities: [
            "New York City",
            "Northern New Jersey",
            "Chicago",
            "Detroit & Dearborn",
            "Washington DC",
            "Northern Virginia",
            "Boston",
            "Philadelphia",
            "Houston",
            "Dallas",
            "Los Angeles",
            "SF Bay Area",
            "Seattle",
            "Atlanta",
            "Orlando",
        ],
    },
];

export function ShippingCoverage() {
    const reduceMotion = useReducedMotion();

    return (
        <section aria-labelledby="coverage-heading" className="mt-11 sm:mt-24">
            <motion.div
                initial={reduceMotion ? {opacity: 1, x: 0} : {opacity: 0, x: -40}}
                whileInView={{opacity: 1, x: 0}}
                viewport={{once: true, amount: 0.2}}
                transition={{duration: 0.55, ease: [0.16, 1, 0.3, 1]}}
                className="max-w-2xl"
            >
                <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal-800">
                    Based in Canada &middot; Shipping worldwide
                </span>
                <h2
                    id="coverage-heading"
                    className="mt-2.5 text-[25px] font-extrabold leading-[1.12] text-teal-950 sm:text-[38px] lg:text-[42px]"
                >
                    Palestinian products across Canada, the USA &amp; beyond
                </h2>
                <p className="mt-4 text-[15px] leading-relaxed text-muted sm:text-[17px]">
                    We ship Palestinian wholesale products, bulk orders, handmade
                    ceramics, home d&eacute;cor, clothing, spices and specialty foods to
                    customers worldwide, with strong service across major Canadian and
                    U.S. markets.
                </p>
            </motion.div>

            <div className="mt-8 grid gap-4 sm:mt-10 sm:gap-5 lg:grid-cols-2 [&>*]:min-w-0">
                {regions.map((region, i) => (
                    <motion.div
                        key={region.code}
                        initial={reduceMotion ? {opacity: 1, x: 0} : i === 0 ? {opacity: 0, x: -50} : {opacity: 0, x: 50}}
                        whileInView={{opacity: 1, x: 0}}
                        viewport={{once: true, amount: 0.15}}
                        transition={{
                            duration: 0.55,
                            ease: [0.16, 1, 0.3, 1],
                            delay: reduceMotion ? 0 : i * 0.1,
                        }}
                        className={[
                            "relative isolate flex flex-col overflow-hidden rounded-[24px] p-6 origin-bottom transition-all duration-250 ease-out sm:p-9",
                            region.emphasis
                                ? "bg-teal-950 text-white shadow-[0_20px_50px_rgba(0,48,45,0.18)] hover:scale-[1.06] hover:z-20 hover:shadow-[0_28px_60px_rgba(0,48,45,0.28)]"
                                : "border border-teal-950/8 bg-surface text-teal-950 shadow-card hover:scale-[1.04] hover:z-20 hover:shadow-card-hover",
                        ].join(" ")}
                    >
                        {/* Same lime pool as the hero, on the home-market card only -
                            two identical panels read as a table, not a hierarchy. */}
                        {region.emphasis ? (
                            <span
                                aria-hidden
                                className="pointer-events-none absolute inset-0"
                                style={{
                                    background:
                                        "radial-gradient(70% 60% at 100% 0%, rgba(169,235,90,0.18), transparent 62%)",
                                }}
                            />
                        ) : null}

                        <div className="relative flex items-center gap-3">
                            <span
                                aria-hidden
                                className={[
                                    "flex h-9 items-center rounded-full px-3 font-mono text-[12px] font-bold tracking-[0.16em]",
                                    region.emphasis
                                        ? "bg-lime-500 text-teal-950"
                                        : "bg-soft-control text-teal-950",
                                ].join(" ")}
                            >
                                {region.code}
                            </span>
                            <h3 className="text-[22px] font-extrabold sm:text-[26px]">
                                {region.name}
                            </h3>
                        </div>

                        <p
                            className={[
                                "relative mt-4 text-[14px] leading-relaxed sm:text-[15px]",
                                region.emphasis ? "text-white/70" : "text-muted",
                            ].join(" ")}
                        >
                            {region.copy}
                        </p>

                        <ul
                            className={[
                                "relative mt-6 flex flex-wrap gap-2 border-t pt-6",
                                region.emphasis ? "border-white/12" : "border-teal-950/8",
                            ].join(" ")}
                        >
                            {region.cities.map((city) => (
                                <li
                                    key={city}
                                    className={[
                                        "rounded-full px-3 py-1.5 text-[12.5px] font-semibold",
                                        region.emphasis
                                            ? "bg-white/8 text-white/80"
                                            : "bg-soft-control text-teal-950/75",
                                    ].join(" ")}
                                >
                                    {city}
                                </li>
                            ))}
                        </ul>
                    </motion.div>
                ))}
            </div>

            <p className="mt-6 text-center text-[13px] leading-relaxed text-muted sm:mt-7 sm:text-[13.5px]">
                We serve customers beyond these cities as well. City names are shown to
                help customers understand our service coverage; availability, freight
                options and delivery methods can vary by destination.
            </p>
        </section>
    );
}
