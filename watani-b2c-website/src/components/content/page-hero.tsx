"use client";

import Image from "next/image";
import {motion, useReducedMotion} from "framer-motion";
import {motionTokens, sec} from "@/lib/motion";

/**
 * Hero for editorial/content pages. Same visual language as the home hero (design.md §7.1),
 * but shorter since these pages lead with reading material rather than a CTA.
 */
export function PageHero({
                             eyebrow,
                             title,
                             intro,
                             image,
                             compact = false,
                             children,
                         }: {
    eyebrow: string;
    title: React.ReactNode;
    intro?: string;
    /** Right-bleed photo. Omitted on legal pages, which stay flat teal. */
    image?: string;
    /** Tighter height for pages with no photo (Terms/Privacy). */
    compact?: boolean;
    children?: React.ReactNode;
}) {
    const reduceMotion = useReducedMotion();

    const container = {
        hidden: {opacity: 0},
        show: {
            opacity: 1,
            transition: {
                duration: sec(500),
                ease: motionTokens.easeOut,
                staggerChildren: sec(70),
            },
        },
    };

    const child = {
        hidden: {opacity: 0, y: 14},
        show: {opacity: 1, y: 0},
    };

    return (
        <motion.section
            initial={reduceMotion ? "show" : "hidden"}
            animate="show"
            variants={container}
            aria-labelledby="page-hero-heading"
            className="relative overflow-hidden rounded-[28px] bg-teal-950 text-white"
        >
            {image && (
                <motion.div
                    initial={reduceMotion ? {opacity: 1} : {opacity: 0, scale: 1.04}}
                    animate={{opacity: 1, scale: 1}}
                    transition={{duration: sec(650), ease: motionTokens.easeOut}}
                    aria-hidden
                    className="pointer-events-none absolute inset-0"
                >
                    <Image
                        src={image}
                        alt=""
                        fill
                        priority
                        sizes="100vw"
                        className="object-cover object-right"
                    />
                </motion.div>
            )}

            {/* Keeps copy legible over the photo; harmless on the flat variant. */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-gradient-to-r from-teal-950 via-teal-950/95 via-45% to-teal-950/15"
            />

            <div
                className={`relative max-w-2xl px-7 md:px-12 ${
                    compact ? "py-10 md:py-12" : "py-12 md:py-16 lg:py-20"
                }`}
            >
                <motion.p
                    variants={child}
                    className="text-[12px] font-bold uppercase tracking-[0.14em] text-lime-500"
                >
                    {eyebrow}
                </motion.p>

                <motion.h1
                    id="page-hero-heading"
                    variants={child}
                    className={`mt-3 font-extrabold leading-[1.08] ${
                        compact
                            ? "text-[28px] sm:text-[34px]"
                            : "text-[32px] sm:text-[40px] lg:text-[48px]"
                    }`}
                >
                    {title}
                </motion.h1>

                {intro && (
                    <motion.p
                        variants={child}
                        className="mt-5 text-[15px] leading-relaxed text-white/80 lg:text-[17px]"
                    >
                        {intro}
                    </motion.p>
                )}

                {children && (
                    <motion.div variants={child} className="mt-8">
                        {children}
                    </motion.div>
                )}
            </div>
        </motion.section>
    );
}
