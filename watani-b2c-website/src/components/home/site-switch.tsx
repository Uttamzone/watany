"use client";

import Image from "next/image";
import Link from "next/link";
import {motion, useReducedMotion} from "framer-motion";
import {motionTokens, sec} from "@/lib/motion";

/**
 * Which-site router. This exists because the .ca site is not a consumer store -
 * individual buyers must be sent to WatanyPalestinianProducts.com rather than
 * bounce. External links open in a new tab with rel="noopener".
 */
export function SiteSwitch() {
    const reduceMotion = useReducedMotion();

    return (
        <section aria-labelledby="sites-heading" className="mt-11 sm:mt-24">
            <motion.div
                initial={reduceMotion ? {opacity: 1, x: 0} : {opacity: 0, x: 40}}
                whileInView={{opacity: 1, x: 0}}
                viewport={{once: true, amount: 0.2}}
                transition={{duration: 0.55, ease: [0.16, 1, 0.3, 1]}}
                className="max-w-2xl"
            >
                <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal-800">
                    Our websites
                </span>
                <h2
                    id="sites-heading"
                    className="mt-2.5 text-[25px] font-extrabold leading-[1.12] text-teal-950 sm:text-[38px] lg:text-[42px]"
                >
                    Choose the right place to buy
                </h2>
                <p className="mt-4 text-[15px] leading-relaxed text-muted sm:text-[17px]">
                    Watani &amp; Sons Corp operates wataniandsons.ca and
                    wataniandsons.com, while WatanyPalestinianProducts.com is our consumer
                    shopping website.
                </p>
            </motion.div>

            {/* min-w-0 on the items: grid items default to min-width:auto and
                refuse to shrink below their content. */}
            <div className="mt-8 grid gap-4 sm:mt-10 sm:gap-5 lg:grid-cols-2 [&>*]:min-w-0">
                <motion.div
                    initial={reduceMotion ? {opacity: 1, x: 0} : {opacity: 0, x: -50}}
                    whileInView={{opacity: 1, x: 0}}
                    viewport={{once: true, amount: 0.2}}
                    transition={{duration: 0.55, ease: [0.16, 1, 0.3, 1]}}
                    className="relative isolate flex flex-col overflow-hidden rounded-[24px] bg-teal-950 p-6 text-white origin-bottom transition-all duration-250 ease-out shadow-[0_20px_50px_rgba(0,48,45,0.18)] hover:scale-[1.06] hover:z-20 hover:shadow-[0_28px_60px_rgba(0,48,45,0.28)] sm:p-9"
                >
                    {/* Grove photo - only the corporate card carries one; the
                        consumer card stays clean so the two read as distinct. */}
                    <span aria-hidden className="pointer-events-none absolute inset-0">
                        <Image
                            src="/images/offers/olive-grove.webp"
                            alt=""
                            fill
                            sizes="(max-width: 1024px) 100vw, 50vw"
                            className="object-cover opacity-35"
                        />
                        <span className="absolute inset-0 bg-gradient-to-br from-teal-950 via-teal-950/90 to-teal-950/70" />
                    </span>

                    <span
                        aria-hidden
                        className="pointer-events-none absolute inset-0"
                        style={{
                            background:
                                "radial-gradient(70% 60% at 100% 0%, rgba(169,235,90,0.18), transparent 60%)",
                        }}
                    />
                    <span className="relative inline-flex rounded-full bg-lime-500 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-teal-950">
                        You are here
                    </span>
                    <h3 className="relative mt-5 text-[24px] font-extrabold sm:text-[28px]">
                        Watani &amp; Sons Corp
                    </h3>
                    <p className="relative mt-2 text-[14px] font-bold text-lime-400">
                        Wholesale &middot; Bulk &middot; Distribution &middot; Amanat
                    </p>
                    <p className="relative mt-4 text-[14px] leading-relaxed text-white/70 sm:text-[15px]">
                        Our company websites for businesses, retailers, restaurants,
                        distributors, community organizations, large family orders and
                        Amanat shipping.
                    </p>
                    {/*
                      * One internal CTA rather than two ".ca"/".com" links: the visitor
                      * is already on this site, so sending them to our own domains was
                      * a no-op. The catalogue is the useful next step.
                      */}
                    <div className="relative mt-7">
                        <Link
                            href="/categories"
                            className="group inline-flex h-[46px] w-full items-center justify-center gap-2 rounded-[11px] bg-white px-5 text-[14px] font-bold text-teal-950 transition-transform duration-150 hover:-translate-y-0.5 sm:w-auto"
                        >
                            Explore products
                            <span
                                aria-hidden
                                className="transition-transform duration-200 group-hover:translate-x-1"
                            >
                                &rarr;
                            </span>
                        </Link>
                    </div>
                </motion.div>

                <motion.div
                    initial={reduceMotion ? {opacity: 1, x: 0} : {opacity: 0, x: 50}}
                    whileInView={{opacity: 1, x: 0}}
                    viewport={{once: true, amount: 0.2}}
                    transition={{
                        duration: 0.55,
                        ease: [0.16, 1, 0.3, 1],
                        delay: reduceMotion ? 0 : 0.1,
                    }}
                    className="flex flex-col rounded-[24px] border border-teal-950/8 bg-surface p-6 shadow-card origin-bottom transition-all duration-250 ease-out hover:scale-[1.04] hover:z-20 hover:shadow-card-hover sm:p-9"
                >
                    <span className="inline-flex rounded-full bg-soft-control px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-teal-950">
                        Consumer store
                    </span>
                    {/*
                      * `break-words`: this domain is a single unbreakable token wider
                      * than a 375px viewport. As a grid item it would set the track's
                      * min-content floor and push the whole row past the shell.
                      */}
                    <h3 className="mt-5 break-words text-[24px] font-extrabold text-teal-950 sm:text-[28px]">
                        WatanyPalestinianProducts.com
                    </h3>
                    <p className="mt-2 text-[14px] font-bold text-teal-800">
                        Individual quantities &middot; Home delivery
                    </p>
                    <p className="mt-4 text-[14px] leading-relaxed text-muted sm:text-[15px]">
                        For individual purchases, smaller quantities, gifts and regular
                        home-delivery orders.
                    </p>
                    <a
                        href="https://watanypalestinianproducts.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-7 inline-flex h-[46px] items-center justify-center gap-1.5 rounded-[11px] bg-teal-950 px-5 text-[14px] font-bold text-white transition-transform duration-150 hover:-translate-y-0.5"
                    >
                        Visit consumer store
                        <span aria-hidden>&#8599;</span>
                    </a>
                </motion.div>
            </div>
        </section>
    );
}
