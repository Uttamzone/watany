"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Minus, Plus } from "lucide-react";
import { useCart } from "@/components/cart/cart-store";
import { motionTokens, sec } from "@/lib/motion";
import type { Product } from "@/lib/types";

/**
 * Add control on the product card. Idle/active crossfade is CSS, not Framer - Framer can't
 * interpolate `var(--token)` colours, and AnimatePresence mode="wait" could leave it mounted.
 */
export function QuantityControl({ product }: { product: Product }) {
  const { lines, add, setQuantity, hydrated, pending } = useCart();
  const reduceMotion = useReducedMotion();

  const line = lines.find(
    (entry) =>
      (product.defaultVariantId != null && entry.variantId === product.defaultVariantId) ||
      (product.id != null && String(entry.variantId) === String(product.id)) ||
      (entry.productSlug === product.slug) ||
      (product.sku != null && entry.sku === product.sku)
  );
  const quantity = line?.quantity ?? 0;
  const active = hydrated && quantity > 0;
  const outOfStock = product.inStock === false;
  // Server is the source of truth for stock (R-PR-6); stop firing more adds once
  // quantity hits the last-reported limit, or `+` just replays the same 409.
  const atStockLimit = line != null && quantity >= line.availableStock;

  // A line already in the cart when stock runs out must stay removable, so only
  // the idle "add" state collapses - the active stepper stays (its `+` disabled below).
  if (outOfStock && !active) {
    return (
      <div className="flex h-10 w-full items-center justify-center rounded-[14px] bg-soft-control @[240px]/card:h-12">
        <span className="text-[12px] font-bold uppercase tracking-wide text-teal-950/60">
          Out of stock
        </span>
      </div>
    );
  }

  return (
    <div
      // Inline custom property, not `bg-*` utility swap - Tailwind's cascade order
      // would otherwise let the idle colour always win.
      style={{
        backgroundColor: active
          ? "var(--color-lime-500)"
          : "var(--color-soft-control)",
      }}
      className="relative h-10 w-full overflow-hidden rounded-[14px] transition-colors duration-[260ms] @[240px]/card:h-12"
    >
      {!active ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => void add(product)}
          aria-label={`Add ${product.name} to cart`}
          className="absolute inset-0 grid animate-fade-in place-items-center text-teal-950 transition-colors hover:bg-black/[0.04] disabled:opacity-60"
        >
          <Plus className="size-5" aria-hidden />
        </button>
      ) : (
        <div className="absolute inset-0 flex animate-fade-in items-center justify-between px-1.5">
          <button
            type="button"
            disabled={pending || !line}
            onClick={() => line && void setQuantity(line.itemId, quantity - 1)}
            aria-label={`Decrease ${product.name} quantity`}
            className="grid size-9 place-items-center rounded-full bg-white/85 text-teal-950 transition-colors hover:bg-white disabled:opacity-60"
          >
            <Minus className="size-4" aria-hidden />
          </button>

          {/* aria-live announces the new quantity without moving focus. */}
          <span
            aria-live="polite"
            aria-atomic="true"
            className="text-[15px] font-extrabold text-teal-950"
          >
            <motion.span
              key={quantity}
              initial={reduceMotion ? false : { scale: 1 }}
              animate={reduceMotion ? {} : { scale: [1, 1.16, 1] }}
              transition={{ duration: sec(motionTokens.base) }}
              className="inline-block"
            >
              {quantity}
            </motion.span>
            <span className="sr-only"> in cart</span>
          </span>

          <button
            type="button"
            disabled={pending || outOfStock || atStockLimit}
            onClick={() => void add(product)}
            aria-label={`Increase ${product.name} quantity`}
            className="grid size-9 place-items-center rounded-full bg-white/85 text-teal-950 transition-colors hover:bg-white disabled:opacity-60"
          >
            <Plus className="size-4" aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}
