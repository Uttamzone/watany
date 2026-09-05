"use client";

import {useCallback, useEffect, useState} from "react";
import {AnimatePresence, motion, useReducedMotion} from "framer-motion";
import {motionTokens, sec} from "@/lib/motion";

/** Scroll distance (px) past which the button appears. */
const REVEAL_AFTER = 480;

/**
 * Back-to-top FAB - bottom-right, appears once the page is scrolled past
 * `REVEAL_AFTER`. Motion follows design.md §11 and honours reduced motion.
 */
export function ScrollToTop() {
    const [visible, setVisible] = useState(false);
    const reduceMotion = useReducedMotion();

    useEffect(() => {
        const update = () => setVisible(window.scrollY > REVEAL_AFTER);
        update();
        window.addEventListener("scroll", update, {passive: true});
        return () => window.removeEventListener("scroll", update);
    }, []);

    const toTop = useCallback(() => {
        window.scrollTo({top: 0, behavior: reduceMotion ? "auto" : "smooth"});
    }, [reduceMotion]);

    return (
        <AnimatePresence>
            {visible ? (
                <motion.button
                    type="button"
                    onClick={toTop}
                    aria-label="Back to top"
                    title="Back to top"
                    initial={{opacity: 0, y: 12}}
                    animate={{opacity: 1, y: 0}}
                    exit={{opacity: 0, y: 12}}
                    transition={{
                        duration: sec(motionTokens.fast),
                        ease: motionTokens.easeOut,
                    }}
                    className="fixed bottom-6 right-6 z-40 grid h-10 w-10 place-items-center rounded-full bg-teal-950 text-white shadow-[0_8px_24px_rgba(0,48,45,0.22)] transition-colors hover:bg-teal-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral"
                >
                    <svg
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="M12 19V5"/>
                        <path d="m5 12 7-7 7 7"/>
                    </svg>
                </motion.button>
            ) : null}
        </AnimatePresence>
    );
}
