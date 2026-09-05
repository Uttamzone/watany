"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Globe } from "lucide-react";
import { useCurrency } from "@/components/currency/currency-store";
import { motionTokens, sec } from "@/lib/motion";

const CURRENCY_NAMES: Record<string, string> = {
    CAD: "Canadian Dollar",
    USD: "US Dollar",
    EUR: "Euro",
    GBP: "British Pound",
    ILS: "Israeli Shekel",
};

const SYMBOLS: Record<string, string> = {
    CAD: "CA$",
    USD: "$",
    EUR: "€",
    GBP: "£",
    ILS: "₪",
};

export function CurrencySelector() {
    const { currency, availableCurrencies, setCurrency, ready } = useCurrency();
    const [open, setOpen] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;

        function onKey(event: KeyboardEvent) {
            if (event.key === "Escape") setOpen(false);
        }

        function onPointerDown(event: PointerEvent) {
            if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        }

        document.addEventListener("keydown", onKey);
        document.addEventListener("pointerdown", onPointerDown);
        return () => {
            document.removeEventListener("keydown", onKey);
            document.removeEventListener("pointerdown", onPointerDown);
        };
    }, [open]);

    if (!ready) return null;

    const currentSymbol = SYMBOLS[currency] ?? "$";

    return (
        <div className="relative block" ref={panelRef}>
            <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label={`Currency - ${CURRENCY_NAMES[currency] ?? currency}`}
                className="flex items-center gap-1.5 rounded-full bg-teal-950/10 hover:bg-teal-950/20 dark:bg-white/10 dark:hover:bg-white/20 px-3 py-2 text-xs font-extrabold text-teal-950 dark:text-white border border-teal-950/15 dark:border-white/25 shadow-xs transition-all cursor-pointer"
            >
                <Globe className="size-3.5 opacity-80" />
                <span className="font-bold">{currency}</span>
                <span className="text-[11px] opacity-75 font-mono">({currentSymbol})</span>
                <ChevronDown className={`size-3.5 opacity-70 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
            </button>
            <AnimatePresence>
                {open && (
                    <motion.div
                        role="menu"
                        aria-label="Select currency"
                        initial={{ opacity: 0, scale: 0.95, y: 6 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 6 }}
                        transition={{ duration: sec(motionTokens.fast), ease: motionTokens.easeOut }}
                        className="absolute right-0 top-[calc(100%+8px)] z-50 w-56 overflow-hidden rounded-2xl bg-white p-2 text-teal-950 shadow-2xl border border-black/10"
                    >
                        <div className="px-3 py-1.5 border-b border-black/5 text-[11px] font-extrabold uppercase tracking-wider text-muted">
                            Select Store Currency
                        </div>
                        <div className="mt-1 space-y-0.5">
                            {availableCurrencies.map((code) => {
                                const isSelected = code === currency;
                                const symbolStr = SYMBOLS[code] ?? "$";
                                return (
                                    <button
                                        key={code}
                                        type="button"
                                        role="menuitem"
                                        onClick={() => {
                                            setCurrency(code);
                                            setOpen(false);
                                        }}
                                        className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition-all ${
                                            isSelected
                                                ? "bg-teal-950 text-white shadow-xs"
                                                : "text-teal-950 hover:bg-teal-50"
                                        }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className={`font-mono text-[13px] font-bold ${isSelected ? "text-lime-400" : "text-teal-800"}`}>
                                                {symbolStr}
                                            </span>
                                            <span>{CURRENCY_NAMES[code] ?? code}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <span className={`text-[11px] uppercase font-bold ${isSelected ? "text-gray-300" : "text-muted"}`}>
                                                {code}
                                            </span>
                                            {isSelected && <Check className="size-3.5 text-lime-400" />}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
