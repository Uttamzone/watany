"use client";

import Link from "next/link";
import { useId, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { ProductRail } from "@/components/home/product-section";
import { motionTokens, sec } from "@/lib/motion";
import type { CategorySlug, Product } from "@/lib/types";

/** Weekly best-selling items (design.md §7.5) - scrollable pill tabs, ARIA tabs pattern with roving focus. */

const tabOrder: { slug: CategorySlug; label: string }[] = [
    {slug: "olive-oil", label: "Olive Oil"},
    {slug: "olives", label: "Olives"},
    {slug: "cheese", label: "Cheese"},
    {slug: "zaatar", label: "Zaatar"},
    {slug: "spices-grains", label: "Spices & Grains"},
    {slug: "ghee", label: "Ghee"},
    {slug: "ceramics", label: "Ceramics"},
    {slug: "beauty-care", label: "Beauty Care"},
];

export function BestSellerTabs({
                                   productsByCategory,
                               }: {
    productsByCategory: Record<CategorySlug, Product[]>;
}) {
    const [active, setActive] = useState<CategorySlug>("olive-oil");
    const reduceMotion = useReducedMotion();
    const baseId = useId();
    const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

    const activeProducts = productsByCategory[active] ?? [];

    function onKeyDown(event: React.KeyboardEvent) {
        const index = tabOrder.findIndex((tab) => tab.slug === active);
        let next = index;

        if (event.key === "ArrowRight") next = (index + 1) % tabOrder.length;
        else if (event.key === "ArrowLeft")
            next = (index - 1 + tabOrder.length) % tabOrder.length;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = tabOrder.length - 1;
        else return;

        event.preventDefault();
        const slug = tabOrder[next].slug;
        setActive(slug);
        tabRefs.current[slug]?.focus();
    }

  return (
    <section aria-labelledby={`${baseId}-heading`} className="mt-12 sm:mt-20">
      <div className="flex items-center justify-between gap-4">
        <h2
          id={`${baseId}-heading`}
          className="text-[26px] font-extrabold text-teal-950 sm:text-[32px] lg:text-[38px]"
        >
          Weekly best selling items
        </h2>
        <Link
          href="/categories"
          className="flex h-11 shrink-0 items-center gap-1.5 px-1 text-[14px] font-bold text-coral transition-transform duration-150 hover:-translate-y-0.5"
        >
          See more
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>

      <div
        role="tablist"
        aria-label="Best sellers by category"
        onKeyDown={onKeyDown}
        // Bleeds to the viewport edge like the rail below it, so the last pill scrolls
        // off-screen rather than clipping at the shell padding.
        className="rail-scroll -mx-4 mt-6 flex gap-2.5 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 min-[900px]:mx-0 min-[900px]:px-0"
      >
        {tabOrder.map((tab) => {
          const selected = tab.slug === active;
          return (
            <button
              key={tab.slug}
              ref={(node) => {
                tabRefs.current[tab.slug] = node;
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${tab.slug}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${tab.slug}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(tab.slug)}
              className={`flex h-11 shrink-0 items-center rounded-full px-5 text-[14px] font-semibold transition-colors duration-[180ms] ${
                selected
                  ? "bg-teal-950 text-white"
                  : "bg-surface text-teal-950 hover:bg-white"
              }`}
            >
              {/* Selected state is carried by aria-selected too, not colour alone. */}
              {tab.label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`${baseId}-panel-${active}`}
        aria-labelledby={`${baseId}-tab-${active}`}
        tabIndex={0}
        className="mt-6"
      >
        {/* Keyed remount, not AnimatePresence - a pending exit could leave the old tab's grid mounted. */}
        <motion.div
          key={active}
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: sec(motionTokens.base), ease: motionTokens.easeOut }}
        >
            {activeProducts.length > 0 ? (
              <ProductRail products={activeProducts} />
            ) : (
              <p className="rounded-[18px] bg-surface p-8 text-center text-[15px] text-muted">
                New arrivals in this category are on their way.
              </p>
            )}
        </motion.div>
      </div>
    </section>
  );
}
