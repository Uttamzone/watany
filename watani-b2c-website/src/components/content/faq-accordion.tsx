"use client";

import {useState} from "react";
import {AnimatePresence, motion, useReducedMotion} from "framer-motion";
import {motionTokens, sec} from "@/lib/motion";

export type Faq = { question: string; answer: string };

/**
 * Expandable FAQ list, one panel open at a time. AnimatePresence is safe here (unlike list
 * swaps elsewhere) since it animates a measurable height, not a cross-fade of two mounted trees.
 */
export function FaqAccordion({faqs}: { faqs: Faq[] }) {
    const [openIndex, setOpenIndex] = useState<number | null>(0);
    const reduceMotion = useReducedMotion();

    return (
        <div className="divide-y divide-black/[0.06] overflow-hidden rounded-[22px] bg-surface shadow-card">
            {faqs.map((faq, index) => {
                const isOpen = openIndex === index;
                const panelId = `faq-panel-${index}`;

                return (
                    <div key={faq.question}>
                        <h3>
                            <button
                                type="button"
                                onClick={() => setOpenIndex(isOpen ? null : index)}
                                aria-expanded={isOpen}
                                aria-controls={panelId}
                                className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition-colors hover:bg-warm-canvas sm:px-7"
                            >
                <span className="text-[16px] font-extrabold text-teal-950">
                  {faq.question}
                </span>
                                <motion.span
                                    aria-hidden
                                    animate={{rotate: isOpen ? 45 : 0}}
                                    transition={{
                                        duration: reduceMotion ? 0 : sec(motionTokens.base),
                                        ease: motionTokens.easeOut,
                                    }}
                                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-lime-500 text-teal-950"
                                >
                                    <svg
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2.4"
                                        strokeLinecap="round"
                                        className="h-4 w-4"
                                    >
                                        <path d="M12 5v14M5 12h14"/>
                                    </svg>
                                </motion.span>
                            </button>
                        </h3>

                        <AnimatePresence initial={false}>
                            {isOpen && (
                                <motion.div
                                    id={panelId}
                                    key="panel"
                                    initial={reduceMotion ? false : {height: 0, opacity: 0}}
                                    animate={{height: "auto", opacity: 1}}
                                    exit={reduceMotion ? {opacity: 0} : {height: 0, opacity: 0}}
                                    transition={{
                                        duration: reduceMotion ? 0 : sec(motionTokens.base),
                                        ease: motionTokens.easeOut,
                                    }}
                                    className="overflow-hidden"
                                >
                                    <p className="px-6 pb-6 text-[14px] leading-relaxed text-muted sm:px-7">
                                        {faq.answer}
                                    </p>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                );
            })}
        </div>
    );
}
