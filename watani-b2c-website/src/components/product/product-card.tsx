"use client";

import Image from "next/image";
import Link from "next/link";
import {QuantityControl} from "./quantity-control";
import {useCataloguePricedProduct} from "./catalogue-pricing-store";
import {productImageSrc} from "@/lib/products";
import {type Product, safeFormatPrice} from "@/lib/types";

/**
 * Product card (design.md §7.3). Hover/focus effects are plain CSS, not Framer - Framer can't
 * interpolate `var(--token)` shadows, and CSS group-hover covers keyboard focus for free.
 */
export function ProductCard({product}: { product: Product }) {
    const pricedProduct = useCataloguePricedProduct(product);

    // Extract clean description text without HTML tags
    const rawDesc = (product.description || "").replace(/<[^>]*>?/gm, "").trim();
    const cleanDesc = rawDesc || product.subtitle || "";

    const cardMoq = pricedProduct.minimumOrderQuantity ?? pricedProduct.minQuantity ?? pricedProduct.pricing?.minimumOrderQuantity ?? pricedProduct.pricing?.minQuantity ?? 1;
    const retailPrice = pricedProduct.retailPrice ?? pricedProduct.pricing?.retailPrice ?? (parseFloat(pricedProduct.priceMajor || "0") + parseFloat(pricedProduct.priceMinor || "0") / 100);
    const wholesalePrice = pricedProduct.wholesalePrice ?? pricedProduct.pricing?.wholesalePrice ?? (
      pricedProduct.pricing?.tiers?.find(t => t.pricingGroup === "WHOLESALE")?.unitPrice ?? 
      Math.round((typeof retailPrice === "number" ? retailPrice : parseFloat(String(retailPrice || 0))) * 0.8 * 100) / 100
    );

  return (
    // Sized against its own container, not the viewport: the same card sits in a ~158px
    // swipe-rail slot and in a ~45vw catalogue grid column at the same screen width, so a
    // viewport breakpoint can't serve both. `@` variants read the `card` container.
    <article className="@container/card group flex h-full flex-col rounded-[20px] bg-surface p-3 shadow-card product-card-hover focus-within:shadow-card-hover @[240px]/card:p-4">
      <Link
        href={`/product/${product.slug}`}
        className="flex flex-1 flex-col rounded-xl"
        // The card's accessible name is the full official title (design.md §7.3).
        aria-label={product.fullName}
      >
        {/* Square ratio held, but capped below the column width so a narrow card doesn't
            grow tall; a roomy card restores the design.md §7.3 172px size. */}
        <div className="relative mx-auto grid aspect-square max-h-[116px] w-full max-w-[116px] place-items-center overflow-hidden rounded-xl bg-soft-control/30 @[240px]/card:max-h-[172px] @[240px]/card:max-w-[172px]">
          {product.inStock === false ? (
            <span className="absolute left-1.5 top-1.5 z-10 rounded-full bg-rose-600 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
              Out of stock
            </span>
          ) : product.badge ? (
            <span className="absolute left-1.5 top-1.5 z-10 rounded-full bg-teal-950 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-lime-400 shadow-sm">
              {product.badge}
            </span>
          ) : null}
          <div className="grid size-full place-items-center transition-transform duration-[220ms] ease-out group-focus-within:-translate-y-1 group-focus-within:scale-[1.04] group-hover:-translate-y-1 group-hover:scale-[1.04]">
            <Image
              src={productImageSrc(product.image, product.slug || product.name)}
              alt={product.fullName}
              width={172}
              height={172}
              sizes="(max-width: 639px) 116px, 172px"
              className="size-full object-contain"
            />
          </div>
        </div>

        {/* Product Title */}
        <h3 className="mt-2.5 line-clamp-2 min-h-[38px] text-center text-[13.5px] font-bold leading-snug text-teal-950 transition-colors group-hover:text-teal-800 @[240px]/card:mt-3 @[240px]/card:min-h-[42px] @[240px]/card:text-[14.5px]">
          {product.name}
        </h3>

        {/* Clean Visible Description */}
        {cleanDesc ? (
          <p className="mt-1 line-clamp-2 text-center text-[11.5px] leading-relaxed text-muted @[240px]/card:text-[12px]">
            {cleanDesc}
          </p>
        ) : null}

        {/* Clean MOQ & Unit Metadata */}
        <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-soft-control/80 px-2.5 py-0.5 text-[10.5px] font-medium text-teal-950/80">
            <span className="text-muted">MOQ:</span>
            <span className="font-bold text-teal-950">{cardMoq}</span>
          </span>
          {pricedProduct.unit ? (
            <span className="inline-flex items-center rounded-full bg-teal-950/[0.05] px-2.5 py-0.5 text-[10.5px] font-semibold text-teal-800">
              {pricedProduct.unit}
            </span>
          ) : null}
        </div>

        {/* Sleek Side-by-Side Retail & Wholesale Pricing */}
        <div className="mt-2.5 grid grid-cols-2 gap-1.5 rounded-xl border border-teal-950/10 bg-soft-control/40 p-1.5 text-center">
          <div className="flex flex-col justify-center rounded-lg bg-surface px-1.5 py-1 shadow-sm">
            <span className="block text-[9.5px] font-bold uppercase tracking-wider text-muted">Retail</span>
            <span className="text-[13px] font-extrabold text-teal-950 @[240px]/card:text-[14px]">
              ${safeFormatPrice(retailPrice)}
            </span>
          </div>
          <div className="flex flex-col justify-center rounded-lg bg-teal-950/[0.05] px-1.5 py-1 shadow-sm">
            <span className="block text-[9.5px] font-bold uppercase tracking-wider text-teal-800">Wholesale</span>
            <span className="text-[13px] font-extrabold text-teal-800 @[240px]/card:text-[14px]">
              ${safeFormatPrice(wholesalePrice)}
            </span>
          </div>
        </div>
      </Link>

      {/* Action / Quantity control */}
      <div className="mt-3 @[240px]/card:mt-4">
        <QuantityControl product={pricedProduct} />
      </div>
    </article>
  );
}

