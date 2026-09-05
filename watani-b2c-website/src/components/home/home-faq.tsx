"use client";

import {useState} from "react";
import {motion, useReducedMotion} from "framer-motion";

/**
 * FAQ - native <details>/<summary>, so it still opens without JS and keeps the
 * built-in accessibility semantics. The questions mirror the FAQPage JSON-LD
 * emitted from the home page metadata; keep the two in sync if either changes.
 *
 * The open-state visuals (tint, lime toggle, rotation) are driven by React
 * state and applied inline rather than by CSS. Tailwind's `open:`/`group-open:`
 * variants are not emitted in this setup, and plain `[open]` rules in
 * globals.css matched the element but never won the cascade - even with
 * !important - so inline styles are the reliable option here.
 */

const faqs = [
    {
        q: "Does Watani & Sons Corp sell to individual consumers?",
        a: "Watani & Sons Corp focuses on wholesale, distribution, bulk purchasing and Amanat services. For regular consumer quantities and home-delivery shopping, visit WatanyPalestinianProducts.com.",
    },
    {
        q: "What products are available for wholesale & bulk order?",
        a: "Our wholesale catalogue includes Palestinian olive oil, za'atar, dates, handmade Hebron ceramics, custom home pieces, clothing, tatreez textiles and traditional foods.",
    },
    {
        q: "Where does Watani & Sons Corp ship?",
        a: "We are based in Canada and service Canadian businesses and communities, while shipping wholesale, bulk and specialty orders into the USA and internationally.",
    },
    {
        q: "What is Amanat shipping?",
        a: "Amanat shipping is a specialized personal-goods logistics service connecting Palestine to international destinations. Drop off eligible items in Palestine, and we handle collection, clearance and delivery.",
    },
];

export function HomeFaq() {
    const [openQ, setOpenQ] = useState<string | null>(null);
    const reduceMotion = useReducedMotion();

    return (
        <section aria-labelledby="faq-heading" className="mt-11 sm:mt-24">
            <motion.div
                initial={reduceMotion ? {opacity: 1, x: 0} : {opacity: 0, x: -45}}
                whileInView={{opacity: 1, x: 0}}
                viewport={{once: true, amount: 0.2}}
                transition={{duration: 0.55, ease: [0.16, 1, 0.3, 1]}}
                className="max-w-2xl"
            >
                <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal-800">
                    Frequently asked questions
                </span>
                <h2
                    id="faq-heading"
                    className="mt-2.5 text-[25px] font-extrabold leading-[1.12] text-teal-950 sm:text-[38px] lg:text-[42px]"
                >
                    Wholesale, bulk &amp; product FAQ
                </h2>
            </motion.div>

            <motion.div
                initial={reduceMotion ? {opacity: 1, x: 0} : {opacity: 0, x: 45}}
                whileInView={{opacity: 1, x: 0}}
                viewport={{once: true, amount: 0.2}}
                transition={{duration: 0.55, ease: [0.16, 1, 0.3, 1], delay: 0.1}}
                className="mt-8 overflow-hidden sm:mt-10 rounded-[24px] border border-teal-950/8 bg-surface"
            >
                {faqs.map((faq) => {
                    const isOpen = openQ === faq.q;

                    return (
                    <details
                        key={faq.q}
                        open={isOpen}
                        onToggle={(e) =>
                            setOpenQ(e.currentTarget.open ? faq.q : null)
                        }
                        className="border-b border-teal-950/8 transition-colors duration-200 last:border-b-0"
                        style={{
                            backgroundColor: isOpen
                                ? "color-mix(in oklab, var(--color-soft-control) 35%, transparent)"
                                : "transparent",
                        }}
                    >
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 text-[15px] font-bold text-teal-950 transition-colors duration-150 hover:bg-soft-control/60 sm:px-8 sm:text-[16px]">
                            {faq.q}
                            <span
                                aria-hidden
                                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-teal-950"
                                style={{
                                    backgroundColor: isOpen
                                        ? "var(--color-lime-500)"
                                        : "var(--color-soft-control)",
                                    transform: isOpen ? "rotate(45deg)" : "rotate(0deg)",
                                    transition:
                                        "transform 200ms ease, background-color 200ms ease",
                                }}
                            >
                                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                    <path
                                        d="M7 2v10M2 7h10"
                                        stroke="currentColor"
                                        strokeWidth="1.8"
                                        strokeLinecap="round"
                                    />
                                </svg>
                            </span>
                        </summary>
                        <p className="px-6 pb-6 text-[14px] leading-relaxed text-muted sm:px-8 sm:text-[15px]">
                            {faq.a}
                        </p>
                    </details>
                    );
                })}
            </motion.div>
        </section>
    );
}
