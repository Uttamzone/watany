"use client";

import Image from "next/image";
import Link from "next/link";
import {Price} from "./price";
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

  return (
    // Sized against its own container, not the viewport: the same card sits in a ~158px
    // swipe-rail slot and in a ~45vw catalogue grid column at the same screen width, so a
    // viewport breakpoint can't serve both. `@` variants read the `card` container.
    <article className="@container/card group flex h-full flex-col rounded-[18px] bg-surface p-3 shadow-card product-card-hover focus-within:shadow-card-hover @[240px]/card:p-4">
      <Link
        href={`/product/${product.slug}`}
        className="flex flex-1 flex-col rounded-xl"
        // The card's accessible name is the full official title (design.md §7.3).
        aria-label={product.fullName}
      >
        {/* Square ratio held, but capped below the column width so a narrow card doesn't
            grow tall; a roomy card restores the design.md §7.3 172px size. */}
        <div className="relative mx-auto grid aspect-square max-h-[116px] w-full max-w-[116px] place-items-center overflow-hidden @[240px]/card:max-h-[172px] @[240px]/card:max-w-[172px]">
          {product.inStock === false ? (
            <span className="absolute left-0 top-0 z-10 rounded-full bg-rose-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
              Out of stock
            </span>
          ) : product.badge ? (
            <span className="absolute left-0 top-0 z-10 rounded-full bg-teal-950 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-lime-500">
              {product.badge}
            </span>
          ) : null}
          <div className="grid size-full place-items-center transition-transform duration-[220ms] ease-out group-focus-within:-translate-y-1.5 group-focus-within:scale-[1.035] group-hover:-translate-y-1.5 group-hover:scale-[1.035]">
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

        <h3 className="mt-2 line-clamp-2 min-h-[38px] text-center text-[14px] font-bold leading-snug text-teal-950 @[240px]/card:mt-3 @[240px]/card:min-h-[44px] @[240px]/card:text-[15px]">
          {product.name}
        </h3>
        <p className="mt-0.5 text-center text-[11px] font-semibold uppercase tracking-wide text-muted @[240px]/card:mt-1 @[240px]/card:text-[12px]">
          {product.unit}
        </p>
        {(() => {
          const cardMoq = pricedProduct.minimumOrderQuantity ?? pricedProduct.minQuantity ?? pricedProduct.pricing?.minimumOrderQuantity ?? pricedProduct.pricing?.minQuantity ?? 1;
          const retailPrice = pricedProduct.retailPrice ?? pricedProduct.pricing?.retailPrice ?? (parseFloat(pricedProduct.priceMajor || "0") + parseFloat(pricedProduct.priceMinor || "0") / 100);
          const wholesalePrice = pricedProduct.wholesalePrice ?? pricedProduct.pricing?.wholesalePrice ?? (
            pricedProduct.pricing?.tiers?.find(t => t.pricingGroup === "WHOLESALE")?.unitPrice ?? 
            Math.round((typeof retailPrice === "number" ? retailPrice : parseFloat(String(retailPrice || 0))) * 0.8 * 100) / 100
          );

          return (
            <div className="mt-2.5 w-full rounded-xl border border-teal-950/10 bg-teal-950/[0.03] p-2 text-left text-[11px] font-semibold leading-relaxed text-teal-950 @[240px]/card:text-[12px]">
              <div>Moq <span className="font-bold text-teal-950">{cardMoq}</span></div>
              <div>Unit <span className="font-bold text-teal-950">{pricedProduct.unit || "unit"}</span></div>
              <div>Price ( retail) :<span className="font-bold text-teal-950">${safeFormatPrice(retailPrice)}</span></div>
              <div>Price (wholesale) :<span className="font-bold text-teal-800">${safeFormatPrice(wholesalePrice)}</span></div>
            </div>
          );
        })()}
      </Link>

      <div className="mt-3 @[240px]/card:mt-4">
        <QuantityControl product={pricedProduct} />
      </div>
    </article>
  );
}
