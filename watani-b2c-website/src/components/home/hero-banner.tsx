"use client";

import Image from "next/image";
import Link from "next/link";
import {motion, useReducedMotion} from "framer-motion";
import {motionTokens, sec} from "@/lib/motion";

/** Hero (design.md §7.1) - deep-teal block, copy on the left, product photo bled on the right. */
export function HeroBanner() {
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
      aria-labelledby="hero-heading"
      className="relative overflow-hidden rounded-[28px] bg-teal-950 text-white"
    >
      {/* Photo bleeds across the full banner, right-anchored. */}
      <motion.div
        initial={reduceMotion ? { opacity: 1 } : { opacity: 0, scale: 1.04 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: sec(650), ease: motionTokens.easeOut }}
        aria-hidden
        className="pointer-events-none absolute inset-0"
      >
        <Image
          src="/art/hero-olive-scene.jpeg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="scale-[1.08] object-cover object-right"
        />
      </motion.div>

      {/* Dark scrim over the left portion so copy stays legible over the photo. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-teal-950 via-teal-950/95 via-40% to-teal-950/10"
      />

      {/* Desktop hero height lands in the 380–420px band from design.md §7.1. */}
      <div className="relative grid items-center gap-8 px-5 pb-10 pt-8 sm:px-7 sm:pb-14 sm:pt-10 md:px-12 lg:grid-cols-[42fr_48fr] lg:pb-9 lg:pt-8">
        <div>
          <motion.h1
            id="hero-heading"
            variants={child}
            className="text-[28px] font-extrabold leading-[1.12] sm:text-[42px] sm:leading-[1.08] lg:text-[52px]"
          >
            {/* The break is a desktop line-balance; on mobile it would strand
                "A taste of Palestine" on its own line and ragged-wrap the rest. */}
            A taste of Palestine
            <br className="hidden sm:inline" />
            <span className="sm:hidden"> </span>
            delivered in Canada & USA
          </motion.h1>

          <motion.p
            variants={child}
            className="mt-4 max-w-lg text-[14px] leading-relaxed text-white/80 sm:mt-5 sm:text-[15px] lg:text-[17px]"
          >
            Shop seasonal Palestinian olive oil, olives, zaatar, grains, cheese,
            ceramics, and more-sourced through trusted farmers and producers.
          </motion.p>

          <motion.div variants={child} className="mt-6 sm:mt-8">
            <Link
              href="/categories"
              className="inline-flex h-[46px] items-center justify-center rounded-[10px] bg-lime-500 px-5 text-[14px] font-bold text-teal-950 transition-transform duration-150 hover:-translate-y-0.5 active:translate-y-px sm:h-[50px] sm:px-7 sm:text-[15px]"
            >
              Shop Palestinian products
            </Link>
          </motion.div>
        </div>

        {/* Right column stays empty on desktop - the bled photo shows through. */}
        <div aria-hidden className="hidden lg:block" />
      </div>
    </motion.section>
  );
}
