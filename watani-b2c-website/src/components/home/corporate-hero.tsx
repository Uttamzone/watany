"use client";

import Image from "next/image";
import Link from "next/link";
import {motion, useReducedMotion, useScroll, useTransform} from "framer-motion";
import {motionTokens, sec} from "@/lib/motion";
import {useAuth} from "@/components/auth/auth-store";

/**
 * Corporate hero - replaces the shopping-led banner. The .ca site is a
 * wholesale/bulk/Amanat front door, not a storefront, so the hero sells the
 * three service paths rather than a product.
 *
 * Enhanced with scroll-driven expansion: as the page is scrolled, the hero card's
 * padding box expands to fill 100% of the website width before standard scrolling continues.
 */
export function CorporateHero() {
    const reduceMotion = useReducedMotion();
    const {status} = useAuth();
    const {scrollY} = useScroll();

    // Smooth scroll expansion: start compact (780px) on landing and enlarge to 100% full-width on scroll
    const borderRadius = useTransform(scrollY, [0, 260], [36, 0]);
    const paddingX = useTransform(scrollY, [0, 260], [48, 0]);
    const paddingTop = useTransform(scrollY, [0, 260], [32, 0]);
    const imageScale = useTransform(scrollY, [0, 350], [1.0, 1.18]);
    const maxWidth = useTransform(scrollY, [0, 260], ["780px", "100%"]);

    const container = {
        hidden: {opacity: 0},
        show: {
            opacity: 1,
            transition: {
                duration: sec(motionTokens.slow),
                ease: motionTokens.easeOut,
                staggerChildren: sec(90),
            },
        },
    };

    const child = {
        hidden: {opacity: 0, y: 18},
        show: {opacity: 1, y: 0},
    };

    return (
        <motion.div
            style={
                reduceMotion
                    ? {}
                    : {
                          paddingLeft: paddingX,
                          paddingRight: paddingX,
                          paddingTop: paddingTop,
                          maxWidth: maxWidth,
                      }
            }
            className="w-full mx-auto"
        >
            <motion.section
                initial={reduceMotion ? "show" : "hidden"}
                animate="show"
                variants={container}
                style={reduceMotion ? {} : {borderRadius: borderRadius}}
                aria-labelledby="hero-heading"
                className="relative isolate overflow-hidden bg-teal-950 text-white shadow-xl transition-shadow duration-300"
            >
                {/* Product photo with smooth scroll expansion */}
                <motion.div
                    initial={reduceMotion ? {opacity: 1} : {opacity: 0, scale: 1.04}}
                    animate={{opacity: 1, scale: 1}}
                    style={reduceMotion ? {} : {scale: imageScale}}
                    transition={{duration: sec(650), ease: motionTokens.easeOut}}
                    aria-hidden
                    className="pointer-events-none absolute inset-0 transition-transform duration-75 ease-out"
                >
                    <Image
                        src="/art/hero-olive-scene.jpeg"
                        alt=""
                        fill
                        priority
                        sizes="100vw"
                        className="object-cover object-right"
                    />
                </motion.div>

                {/* Scrim & Ambient Overlay */}
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 bg-gradient-to-r from-teal-950 via-teal-950/95 via-55% to-teal-950/45 lg:via-40% lg:to-teal-950/10"
                />

                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0"
                    style={{
                        background:
                            "radial-gradient(60% 80% at 85% 8%, rgba(169,235,90,0.20), transparent 60%)," +
                            "radial-gradient(50% 70% at 8% 100%, rgba(7,91,86,0.85), transparent 65%)",
                    }}
                />

                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 opacity-[0.07]"
                    style={{
                        backgroundImage:
                            "linear-gradient(rgba(255,255,255,0.7) 1px, transparent 1px)," +
                            "linear-gradient(90deg, rgba(255,255,255,0.7) 1px, transparent 1px)",
                        backgroundSize: "72px 72px",
                        maskImage:
                            "radial-gradient(90% 70% at 70% 0%, black, transparent 75%)",
                        WebkitMaskImage:
                            "radial-gradient(90% 70% at 70% 0%, black, transparent 75%)",
                    }}
                />

                {/* Copy Column */}
                <div className="relative max-w-full px-5 pb-7 pt-7 sm:px-8 sm:pb-10 sm:pt-10 md:px-12 lg:max-w-[64%] lg:px-14 lg:pb-12 lg:pt-12">
                    <motion.h1
                        id="hero-heading"
                        variants={child}
                        className="max-w-[16ch] text-[29px] font-extrabold leading-[1.06] sm:max-w-[24ch] sm:text-[40px] lg:max-w-[26ch] lg:text-[46px]"
                    >
                        Palestinian retail,{" "}
                        <span className="text-lime-400">wholesale &amp; bulk</span> &amp; Amanat
                        shipping
                    </motion.h1>

                    <motion.p
                        variants={child}
                        className="mt-3.5 max-w-xl text-[14px] leading-relaxed text-white/75 sm:mt-5 sm:text-[15px] lg:text-[16px]"
                    >
                        Watani &amp; Sons Corp supplies authentic Palestinian products to
                        businesses, families, organizations and communities
                        <span className="hidden sm:inline">
                            {" "}
                            &mdash; handmade Hebron ceramics, tatreez, clothing and kufiyas,
                            zaatar, sumac, extra virgin olive oil, Nabulsi cheese, ghee, olives
                            and freekeh
                        </span>
                        .
                    </motion.p>

                    <motion.div
                        variants={child}
                        className="mt-5 flex flex-col gap-2.5 sm:mt-7 sm:flex-row sm:flex-wrap sm:gap-3"
                    >
                        <Link
                            href="/categories"
                            className="inline-flex h-[48px] items-center justify-center rounded-[12px] bg-lime-500 px-6 text-[15px] font-bold text-teal-950 transition-transform duration-150 hover:-translate-y-0.5 active:translate-y-px"
                        >
                            Shop
                        </Link>
                        {status !== "authenticated" && (
                            <Link
                                href="/login"
                                className="inline-flex h-[48px] items-center justify-center rounded-[12px] border border-white/25 bg-white/5 px-6 text-[15px] font-bold text-white backdrop-blur transition-colors duration-150 hover:bg-white/12"
                            >
                                Wholesale login
                            </Link>
                        )}
                        <span
                            aria-disabled
                            className="inline-flex h-[48px] cursor-default items-center justify-center gap-2 rounded-[12px] border border-white/12 px-6 text-[15px] font-bold text-white/40"
                        >
                            Amanat shipping
                            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.1em]">
                                Soon
                            </span>
                        </span>
                    </motion.div>

                    <motion.dl
                        variants={child}
                        className="mt-7 hidden max-w-3xl grid-cols-4 gap-x-3 gap-y-6 border-t border-white/12 pt-5 sm:mt-9 sm:grid sm:gap-x-6 sm:pt-6"
                    >
                        {[
                            {value: "Canada", label: "Head office & fulfilment"},
                            {value: "Palestine", label: "Source & artisan network"},
                            {value: "USA", label: "Cross-border distribution"},
                            {value: "Worldwide", label: "Amanat destinations"},
                        ].map((stat) => (
                            <div key={stat.value}>
                                <dt className="text-[19px] font-extrabold leading-tight text-lime-400">
                                    {stat.value}
                                </dt>
                                <dd className="mt-1 text-[13px] leading-snug text-white/55">
                                    {stat.label}
                                </dd>
                            </div>
                        ))}
                    </motion.dl>
                </div>
            </motion.section>
        </motion.div>
    );
}
