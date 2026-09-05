"use client";

import {motion} from "framer-motion";
import {sectionReveal} from "@/lib/motion";

/** Scroll-triggered fade-up (design.md §11's `sectionReveal` token); respects prefers-reduced-motion. */
export function Reveal({
                           children,
                           delay = 0,
                           className,
                           as = "div",
                       }: {
    children: React.ReactNode;
    delay?: number;
    className?: string;
    as?: "div" | "section";
}) {
    const Component = as === "section" ? motion.section : motion.div;

    return (
        <Component
            {...sectionReveal}
            transition={{...sectionReveal.transition, delay}}
            className={className}
        >
            {children}
        </Component>
    );
}
