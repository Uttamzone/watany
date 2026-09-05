import {compareAtPriceOf, priceOf, type Product} from "@/lib/types";
import {useCurrency} from "@/components/currency/currency-store";

const CURRENCY_LABELS: Record<string, string> = {
    CAD: "Canadian",
    USD: "US",
    EUR: "Euro",
    GBP: "British Pound",
};

/**
 * Price hierarchy from design.md §4/§7.3 (dollar prefix, whole number, raised cents).
 * Split digits are `aria-hidden`; a single spelled-out label carries the price for assistive tech.
 *
 * Bypasses formatCad entirely for the raised-cents layout, so unlike other price displays
 * it converts priceOf(product)/compareAtPriceOf(product) itself via useCurrency() rather
 * than reading product.priceMajor/priceMinor (always CAD, as returned by the backend) directly.
 */
export function Price({
                          product,
                          size = "card",
                          showMinimumTierPrice = false,
                      }: {
    product: Product;
    size?: "card" | "detail";
    /** Show the available group price beneath the retail price on catalogue cards. */
    showMinimumTierPrice?: boolean;
}) {
    const {convert, format, symbol, currency} = useCurrency();
  const majorClass =
    size === "detail"
      ? "text-[32px] leading-none sm:text-[40px]"
      : "text-[26px] leading-none @[240px]/card:text-[30px] lg:@[240px]/card:text-[36px]";
  const minorClass =
    size === "detail"
      ? "text-[16px] sm:text-[20px]"
      : "text-[14px] @[240px]/card:text-[16px]";
  const prefixClass =
    size === "detail"
      ? "text-[16px] sm:text-[20px]"
      : "text-[14px] @[240px]/card:text-[16px]";

    const hasCompareAt = Boolean(product.compareAtMajor && product.compareAtMinor);

    const convertedPrice = convert(priceOf(product));
    const [displayMajor, displayMinor] = convertedPrice.toFixed(2).split(".");
    const convertedCompareAt = hasCompareAt ? convert(compareAtPriceOf(product)!) : null;
    const [compareMajor, compareMinor] = convertedCompareAt != null
        ? convertedCompareAt.toFixed(2).split(".")
        : [null, null];

    // A special price only applied if the buyer's tier minimum quantity was met;
    // otherwise the quoted price is still retail despite their group.
    const pricing = product.pricing;
    const hasSpecialPrice = Boolean(
        pricing && pricing.appliedGroup !== "RETAIL" && !pricing.fellBackToRetail,
    );
    const hasMinimumTierPrice = Boolean(
        showMinimumTierPrice &&
        !hasSpecialPrice &&
        pricing &&
        pricing.yourGroup !== "RETAIL" &&
        pricing.unlockAtQuantity != null &&
        pricing.unlockUnitPrice != null,
    );
    const currencyLabel = CURRENCY_LABELS[currency] ?? currency;
    const label = hasSpecialPrice
        ? `${pricing!.appliedGroup === "DISTRIBUTOR" ? "Distributor" : "Wholesale"} price ${symbol}${displayMajor}.${displayMinor} ${currencyLabel}, reduced from list price`
        : hasCompareAt
            ? `Sale price ${symbol}${displayMajor}.${displayMinor} ${currencyLabel}, reduced from ${symbol}${compareMajor}.${compareMinor}`
            : `${symbol}${displayMajor}.${displayMinor} ${currencyLabel}`;

    return (
        <div>
            <p
                className={`flex items-baseline gap-2 font-extrabold text-teal-950 ${
                    size === "card" ? "justify-center" : ""
                }`}
                aria-label={label}
            >
        <span className="flex items-baseline" aria-hidden="true">
          <span className={`${prefixClass} mr-0.5 font-bold`}>{symbol}</span>
          <span className={majorClass}>{displayMajor}</span>
          <span className={majorClass}>.</span>
          <span className={`${minorClass} self-start pt-0.5`}>
            {displayMinor}
          </span>
        </span>

                {hasCompareAt && (
                    <span
                        className="text-[15px] font-semibold text-muted line-through"
                        aria-hidden="true"
                    >
            {symbol}{compareMajor}.{compareMinor}
          </span>
                )}
            </p>

            {hasMinimumTierPrice && (
                <p className="mt-1 text-center text-[11px] font-semibold leading-snug text-teal-700">
                    {format(pricing!.unlockUnitPrice!)} each
                    <span aria-hidden="true"> · </span>
                    <span className="sr-only">, </span>
                    min. {pricing!.unlockAtQuantity} items
                </p>
            )}

            {/* Hint to unlock a better tier by buying more, shown to any viewer the
          backend quoted one for (design.md/requirement.md R-PR-7). */}
            {!hasSpecialPrice && !hasMinimumTierPrice && pricing?.unlockMessage && (
                <p className="mt-1 text-[11px] font-semibold leading-snug text-muted">
                    {pricing.unlockMessage}
                </p>
            )}
        </div>
    );
}
