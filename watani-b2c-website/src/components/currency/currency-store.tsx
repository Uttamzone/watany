"use client";

import {createContext, useCallback, useContext, useEffect, useMemo, useState} from "react";
import {getCurrencyRates, type CurrencyRate} from "@/lib/currency";

/**
 * Selected display currency + admin-entered CAD exchange rates. Purely a display layer:
 * every price the backend returns (and everything checkout/Stripe/Freightcom ever see) is
 * in CAD, unaffected by this context. `convert`/`format` only transform already-fetched
 * CAD numbers for rendering.
 */

type CurrencyContextValue = {
    currency: string;
    availableCurrencies: string[];
    setCurrency: (code: string) => void;
    /** Converts a CAD amount into the selected display currency. */
    convert: (amountCad: number) => number;
    /** Converts and formats a CAD amount with the selected currency's symbol. */
    format: (amountCad: number) => string;
    /** Symbol for the currently selected currency, e.g. "$", "US$", "€". */
    symbol: string;
    /** True once the rate fetch has settled (success or fallback), to avoid a hydration flash. */
    ready: boolean;
};

const STORAGE_KEY = "watani-currency";
const BASE_CURRENCY = "CAD";
const FALLBACK: CurrencyRate[] = [
    {id: 1, currencyCode: "CAD", rateToCad: 1.0},
    {id: 2, currencyCode: "USD", rateToCad: 0.74},
    {id: 3, currencyCode: "EUR", rateToCad: 0.68},
    {id: 4, currencyCode: "GBP", rateToCad: 0.58},
    {id: 5, currencyCode: "ILS", rateToCad: 2.75},
];

const SYMBOLS: Record<string, string> = {
    CAD: "CA$",
    USD: "$",
    EUR: "€",
    GBP: "£",
    ILS: "₪",
};

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({children}: { children: React.ReactNode }) {
    const [rates, setRates] = useState<CurrencyRate[]>(FALLBACK);
    const [currency, setCurrencyState] = useState<string>(BASE_CURRENCY);
    const [ready, setReady] = useState(false);

    // Client-only fetch, mirroring CartProvider: an unreachable backend must never block
    // the storefront, it just leaves the shopper on CAD.
    useEffect(() => {
        let cancelled = false;

        async function load() {
            try {
                const data = await getCurrencyRates();
                if (!cancelled && data.length > 0) {
                    const merged = [...data];
                    for (const fb of FALLBACK) {
                        if (!merged.some(r => r.currencyCode === fb.currencyCode)) {
                            merged.push(fb);
                        }
                    }
                    setRates(merged);
                }
            } catch {
                // Fall back to CAD, USD, EUR, GBP, ILS.
            } finally {
                if (!cancelled) setReady(true);
            }
        }

        void load();
        return () => {
            cancelled = true;
        };
    }, []);

    // Restore a saved selection once rates are known, so we never "restore" a currency
    // that no longer exists (e.g. an admin removed it).
    useEffect(() => {
        if (!ready) return;
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved && rates.some((rate) => rate.currencyCode === saved)) {
            setCurrencyState(saved);
        }
    }, [ready, rates]);

    const setCurrency = useCallback((code: string) => {
        setCurrencyState(code);
        try {
            window.localStorage.setItem(STORAGE_KEY, code);
        } catch {
            // Private browsing / storage disabled - selection just won't persist.
        }
    }, []);

    const convert = useCallback(
        (amountCad: number) => {
            const rate = rates.find((r) => r.currencyCode === currency);
            return rate ? amountCad * rate.rateToCad : amountCad;
        },
        [rates, currency],
    );

    const symbol = SYMBOLS[currency] ?? `${currency} `;

    const format = useCallback(
        (amountCad: number) => `${symbol}${convert(amountCad).toFixed(2)}`,
        [convert, symbol],
    );

    const value = useMemo<CurrencyContextValue>(
        () => ({
            currency,
            availableCurrencies: rates.map((r) => r.currencyCode),
            setCurrency,
            convert,
            format,
            symbol,
            ready,
        }),
        [currency, rates, setCurrency, convert, format, symbol, ready],
    );

    return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): CurrencyContextValue {
    const context = useContext(CurrencyContext);
    if (!context) {
        throw new Error("useCurrency must be used inside a CurrencyProvider");
    }
    return context;
}
