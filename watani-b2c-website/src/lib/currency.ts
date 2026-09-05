import {apiFetch} from "@/lib/api";

/** Mirrors SettingsDtos.CurrencyExchangeRateResponse. Display-only, never fed back to the server. */
export type CurrencyRate = {
    id: number;
    currencyCode: string;
    /** Units of this currency per 1 CAD - multiply a CAD amount by this to get the display amount. */
    rateToCad: number;
};

/** Public, unauthenticated - base currency is CAD (rate 1.0). */
export function getCurrencyRates(): Promise<CurrencyRate[]> {
    return apiFetch<CurrencyRate[]>("/api/currency/rates");
}
