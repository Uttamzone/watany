"use client";

import {useState} from "react";
import {AnimatePresence, motion, useReducedMotion} from "framer-motion";
import {motionTokens, sec} from "@/lib/motion";

const faqs = [
    {
        q: "Who can shop with Watani & Sons Corp?",
        a: "We serve three types of customers: Regular Retail shoppers (buying individual and family units with no minimum order requirement), Wholesale & Bulk Buyers (businesses and organizations buying by the case or box), and Distributors (buying by the pallet with dedicated LTL freight and terms).",
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
                className="mt-8 overflow-hidden sm:mt-10 rounded-[24px] border border-teal-950/8 bg-surface shadow-xs"
            >
                {faqs.map((faq, index) => {
                    const isOpen = openQ === faq.q;
                    const panelId = `home-faq-panel-${index}`;
                    const btnId = `home-faq-btn-${index}`;

                    return (
                        <div
                            key={faq.q}
                            className="border-b border-teal-950/8 transition-colors duration-200 last:border-b-0"
                            style={{
                                backgroundColor: isOpen
                                    ? "color-mix(in oklab, var(--color-soft-control) 40%, transparent)"
                                    : "transparent",
                            }}
                        >
                            <h3>
                                <button
                                    type="button"
                                    id={btnId}
                                    aria-expanded={isOpen}
                                    aria-controls={panelId}
                                    onClick={() => setOpenQ(isOpen ? null : faq.q)}
                                    className="flex w-full cursor-pointer items-center justify-between gap-4 px-6 py-5 text-left text-[15px] font-bold text-teal-950 transition-colors duration-150 hover:bg-soft-control/60 sm:px-8 sm:text-[16px]"
                                >
                                    <span>{faq.q}</span>
                                    <motion.span
                                        aria-hidden
                                        animate={{
                                            rotate: isOpen ? 45 : 0,
                                            backgroundColor: isOpen
                                                ? "var(--color-lime-500)"
                                                : "var(--color-soft-control)",
                                        }}
                                        transition={{
                                            duration: reduceMotion ? 0 : sec(motionTokens.base),
                                            ease: motionTokens.easeOut,
                                        }}
                                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-teal-950 shadow-xs"
                                    >
                                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                            <path
                                                d="M7 2v10M2 7h10"
                                                stroke="currentColor"
                                                strokeWidth="1.8"
                                                strokeLinecap="round"
                                            />
                                        </svg>
                                    </motion.span>
                                </button>
                            </h3>

                            <AnimatePresence initial={false}>
                                {isOpen && (
                                    <motion.div
                                        id={panelId}
                                        role="region"
                                        aria-labelledby={btnId}
                                        initial={reduceMotion ? false : {height: 0, opacity: 0}}
                                        animate={{height: "auto", opacity: 1}}
                                        exit={reduceMotion ? {opacity: 0} : {height: 0, opacity: 0}}
                                        transition={{
                                            duration: reduceMotion ? 0 : 0.28,
                                            ease: [0.16, 1, 0.3, 1],
                                        }}
                                        className="overflow-hidden"
                                    >
                                        <p className="px-6 pb-6 text-[14px] leading-relaxed text-muted sm:px-8 sm:text-[15px]">
                                            {faq.a}
                                        </p>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    );
                })}
            </motion.div>
        </section>
    );
}
