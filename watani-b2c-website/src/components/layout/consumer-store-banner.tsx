"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";

/**
 * Top announcement bar routing individual buyers to the consumer store.
 * Enhanced with a smooth landing entrance animation.
 */
export function ConsumerStoreBanner() {
    const pathname = usePathname();
    const reduceMotion = useReducedMotion();

    if (pathname === "/login" || pathname?.startsWith("/login")) {
        return null;
    }

    return (
        <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
                duration: reduceMotion ? 0 : 0.5,
                ease: [0.16, 1, 0.3, 1],
            }}
            className="bg-teal-950 text-white border-b border-white/10"
        >
            <div className="shell flex items-center justify-center gap-x-2 gap-y-0.5 px-4 py-2.5 text-center text-[12.5px] leading-snug sm:flex-row sm:text-[13px]">
                <span className="text-white/70">
                    Shopping for individual quantities?
                </span>
                <Link
                    href="https://watanypalestinianproducts.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-flex shrink-0 items-center gap-1 font-bold text-lime-400 underline-offset-4 hover:underline"
                >
                    Visit our consumer store
                    <span
                        aria-hidden
                        className="transition-transform duration-200 group-hover:translate-x-1"
                    >
                        &rarr;
                    </span>
                </Link>
            </div>
        </motion.div>
    );
}
