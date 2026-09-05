"use client";

import Image from "next/image";
import {motion, useReducedMotion} from "framer-motion";
import {motionTokens, sec} from "@/lib/motion";

/**
 * Amanat shipping - the four-step route rendered as an actual timeline. The
 * reference showed four undifferentiated bullet rows; the sequence is the whole
 * value proposition, so it gets a connected spine and numbered nodes.
 */

const steps = [
    {title: "Drop off goods in Palestine", copy: "Bring eligible family goods to our collection point."},
    {title: "Consolidation & international shipping", copy: "We consolidate, document and dispatch the shipment."},
    {title: "Arrival at destination country", copy: "Customs clearance handled on arrival."},
    {title: "Pick up locally, or Door2Door service", copy: "Collect locally or have it delivered to the door."},
];

export function AmanatRoute() {
    const reduceMotion = useReducedMotion();

    return (
        <section aria-labelledby="amanat-heading" className="mt-11 sm:mt-24">
            <motion.div
                initial={reduceMotion ? {opacity: 1, y: 0} : {opacity: 0, y: 16}}
                whileInView={{opacity: 1, y: 0}}
                viewport={{once: true, amount: 0.15}}
                transition={{duration: sec(motionTokens.slow), ease: motionTokens.easeOut}}
                className="relative isolate overflow-hidden rounded-[28px] bg-teal-950 text-white sm:rounded-[32px]"
            >
                {/* Harvest photo, right-anchored - the timeline occupies the right
                    half on desktop, so the image reads behind it at low opacity. */}
                <div aria-hidden className="pointer-events-none absolute inset-0">
                    <Image
                        src="/images/offers/olive-harvest.webp"
                        alt=""
                        fill
                        sizes="100vw"
                        className="object-cover object-right opacity-30"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-teal-950 via-teal-950/92 to-teal-950/70" />
                </div>

                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0"
                    style={{
                        background:
                            "radial-gradient(55% 70% at 12% 0%, rgba(169,235,90,0.16), transparent 60%)," +
                            "radial-gradient(50% 60% at 95% 100%, rgba(7,91,86,0.9), transparent 62%)",
                    }}
                />

                <div className="relative grid gap-8 p-6 sm:gap-10 sm:p-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14 lg:p-14">
                    <motion.div
                        initial={reduceMotion ? {opacity: 1, x: 0} : {opacity: 0, x: -45}}
                        whileInView={{opacity: 1, x: 0}}
                        viewport={{once: true, amount: 0.2}}
                        transition={{duration: 0.55, ease: [0.16, 1, 0.3, 1]}}
                    >
                        <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-lime-400">
                            Amanat shipping
                        </span>
                        <h2
                            id="amanat-heading"
                            className="mt-2.5 text-[25px] font-extrabold leading-[1.12] sm:text-[38px] lg:text-[44px]"
                        >
                            From Palestine to your family &mdash; worldwide
                        </h2>
                        <p className="mt-5 max-w-md text-[15px] leading-relaxed text-white/72 sm:text-[17px]">
                            A dedicated service for the Palestinian community. Drop off
                            eligible goods in Palestine, and Watani &amp; Sons Corp handles
                            the shipment and destination pickup or delivery process.
                        </p>

                        {/* Service isn't live yet - inert badge rather than a CTA. */}
                        <div className="mt-8">
                            <span
                                aria-disabled
                                className="inline-flex h-[50px] cursor-default items-center justify-center gap-2.5 rounded-[12px] border border-white/15 bg-white/5 px-6 text-[15px] font-bold text-white/55"
                            >
                                Amanat shipping
                                <span className="rounded-full bg-lime-500/15 px-2.5 py-0.5 text-[11px] uppercase tracking-[0.1em] text-lime-400">
                                    Coming soon
                                </span>
                            </span>
                        </div>
                    </motion.div>

                    {/* Timeline: the spine is a pseudo-free absolute rule so the nodes
                        stay aligned with the numbers regardless of copy length. */}
                    <ol className="relative">
                        <span
                            aria-hidden
                            className="absolute left-[19px] top-3 bottom-3 w-px bg-gradient-to-b from-lime-500/70 via-white/25 to-white/5"
                        />
                        {steps.map((step, i) => (
                            <motion.li
                                key={step.title}
                                initial={reduceMotion ? {opacity: 1, x: 0} : {opacity: 0, x: 45}}
                                whileInView={{opacity: 1, x: 0}}
                                viewport={{once: true, amount: 0.3}}
                                transition={{
                                    duration: 0.55,
                                    ease: [0.16, 1, 0.3, 1],
                                    delay: reduceMotion ? 0 : i * 0.1,
                                }}
                                className="relative flex gap-4 pb-6 last:pb-0 sm:gap-5 sm:pb-8"
                            >
                                <span
                                    className={[
                                        "relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold",
                                        i === 0
                                            ? "bg-lime-500 text-teal-950"
                                            : "border border-white/20 bg-teal-950 text-white/70",
                                    ].join(" ")}
                                >
                                    {i + 1}
                                </span>
                                <div className="pt-1.5">
                                    <h3 className="text-[16px] font-bold leading-snug sm:text-[17px]">
                                        {step.title}
                                    </h3>
                                    <p className="mt-1.5 text-[13px] leading-relaxed text-white/60 sm:text-[14px]">
                                        {step.copy}
                                    </p>
                                </div>
                            </motion.li>
                        ))}
                    </ol>
                </div>
            </motion.div>
        </section>
    );
}
