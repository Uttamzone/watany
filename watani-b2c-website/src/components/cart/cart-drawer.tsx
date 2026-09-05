"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ShoppingBag, X, ArrowRight, Plus, Minus, Trash2, ShieldCheck, Truck, Sparkles } from "lucide-react";
import { useCart } from "@/components/cart/cart-store";
import { useCurrency } from "@/components/currency/currency-store";
import { productImageSrc } from "@/lib/products";
import { motionTokens, sec } from "@/lib/motion";
import type { CartLine } from "@/lib/cart";

export function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { lines, count, subtotal, setQuantity, remove } = useCart();
  const { format } = useCurrency();
  const panelRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  // Close on Escape & disable background body scroll
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: sec(motionTokens.fast) }}
            onClick={onClose}
            className="absolute inset-0 bg-teal-950/40 backdrop-blur-sm"
          />

          {/* Drawer Panel */}
          <motion.div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label="Shopping Cart Drawer"
            initial={reduceMotion ? { opacity: 0 } : { x: "100%" }}
            animate={reduceMotion ? { opacity: 1 } : { x: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { x: "100%" }}
            transition={{
              duration: sec(motionTokens.base),
              ease: motionTokens.easeOut,
            }}
            className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-100 bg-teal-950 px-6 py-5 text-white">
              <div className="flex items-center gap-3">
                <ShoppingBag className="size-6 text-gold" />
                <h2 className="text-lg font-bold">Your Cart ({count})</h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close cart drawer"
                className="grid size-9 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Free Shipping / Pallet Coverage Banner */}
            <div className="bg-amber-50 px-6 py-3 border-b border-amber-100/60 flex items-center gap-2.5 text-xs text-amber-900 font-medium">
              <Truck className="size-4 shrink-0 text-amber-700" />
              <span>Amanat Pallet Shipping & Canada-Wide Express Available</span>
            </div>

            {/* Items List */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {lines.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center py-16">
                  <div className="grid size-16 place-items-center rounded-full bg-teal-50 text-teal-800 mb-4">
                    <ShoppingBag className="size-8" />
                  </div>
                  <h3 className="text-base font-bold text-gray-900">Your cart is empty</h3>
                  <p className="mt-1 text-sm text-gray-500 max-w-xs">
                    Browse our authentic Palestinian olive oil, zaatar, ceramics & bulk products.
                  </p>
                  <button
                    type="button"
                    onClick={onClose}
                    className="mt-6 rounded-full bg-teal-900 px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-teal-800"
                  >
                    Start Shopping
                  </button>
                </div>
              ) : (
                lines.map((line: CartLine) => (
                  <div
                    key={line.itemId}
                    className="flex gap-4 rounded-xl border border-gray-100 bg-gray-50/50 p-3.5 transition-all hover:border-gray-200"
                  >
                    <div className="relative size-20 shrink-0 overflow-hidden rounded-lg border border-gray-200/60 bg-white">
                      <Image
                        src={productImageSrc(line.image)}
                        alt={line.productName}
                        fill
                        className="object-cover"
                      />
                    </div>

                    <div className="flex flex-1 flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="line-clamp-1 text-sm font-bold text-gray-900">
                            {line.productName}
                          </h4>
                          <button
                            type="button"
                            onClick={() => void remove(line.itemId)}
                            aria-label={`Remove ${line.productName}`}
                            className="text-gray-400 hover:text-red-500 transition-colors p-1"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>

                        {line.unlockMessage && (
                          <div className="mt-1 flex items-center gap-1 text-[11px] text-amber-700 font-semibold">
                            <Sparkles className="size-3 shrink-0" />
                            <span>{line.unlockMessage}</span>
                          </div>
                        )}

                        <div className="mt-1 flex items-baseline gap-2">
                          <span className="text-sm font-extrabold text-teal-950">
                            {format(line.unitPrice)}
                          </span>
                          <span className="text-xs text-gray-400">/ {line.unit}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1">
                          <button
                            type="button"
                            onClick={() =>
                              void setQuantity(line.itemId, Math.max(1, line.quantity - 1))
                            }
                            aria-label="Decrease quantity"
                            className="grid size-6 place-items-center rounded text-gray-600 hover:bg-gray-100"
                          >
                            <Minus className="size-3" />
                          </button>
                          <span className="w-8 text-center text-xs font-bold text-gray-900">
                            {line.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => void setQuantity(line.itemId, line.quantity + 1)}
                            aria-label="Increase quantity"
                            className="grid size-6 place-items-center rounded text-gray-600 hover:bg-gray-100"
                          >
                            <Plus className="size-3" />
                          </button>
                        </div>

                        <span className="text-xs font-bold text-teal-900">
                          {format(line.lineTotal)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer Summary */}
            {lines.length > 0 && (
              <div className="border-t border-gray-100 bg-white p-6 space-y-4 shadow-lg">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal</span>
                    <span className="font-semibold text-gray-900">{format(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Taxes & Shipping</span>
                    <span>Calculated at checkout</span>
                  </div>
                </div>

                <div className="pt-2 flex flex-col gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      router.push("/checkout");
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-950 py-3.5 font-bold text-white shadow-md transition-all hover:bg-teal-900 active:scale-[0.99]"
                  >
                    <span>Proceed to Checkout</span>
                    <ArrowRight className="size-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      router.push("/cart");
                    }}
                    className="flex w-full items-center justify-center rounded-xl border border-gray-200 py-3 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    View Full Cart Page
                  </button>
                </div>

                <div className="flex items-center justify-center gap-2 pt-1 text-[11px] text-gray-400">
                  <ShieldCheck className="size-4 text-emerald-600" />
                  <span>Encrypted 256-bit Stripe Checkout</span>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
