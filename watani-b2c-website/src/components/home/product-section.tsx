import Link from "next/link";
import {ArrowRight} from "lucide-react";
import {ProductCard} from "@/components/product/product-card";
import type {Product} from "@/lib/types";

/** Titled product grid with a "See more" link (design.md §7.3); columns responsive per §5. */
export function ProductSection({
                                   title,
                                   products,
                                   seeMoreHref = "/categories",
                                   headingId,
                               }: {
    title: string;
    products: Product[];
    seeMoreHref?: string;
    headingId?: string;
}) {
    const id = headingId ?? title.toLowerCase().replace(/\s+/g, "-");

  return (
    <section aria-labelledby={id} className="mt-12 sm:mt-20">
      <div className="flex items-center justify-between gap-4">
        <h2
          id={id}
          className="text-[26px] font-extrabold text-teal-950 sm:text-[32px] lg:text-[38px]"
        >
          {title}
        </h2>
        <Link
          href={seeMoreHref}
          className="flex h-11 shrink-0 items-center gap-1.5 px-1 text-[14px] font-bold text-coral transition-transform duration-150 hover:-translate-y-0.5"
        >
          See more
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>

      <ProductRail products={products} className="mt-6" />
    </section>
  );
}

/**
 * Home rails swipe on narrow screens and fall back to the shared grid at ≥900px.
 * Cards are a fixed width so the next one peeks past the edge - the affordance that
 * says "swipe" without a scrollbar. Bleeds to the viewport edge like the category rail.
 */
export function ProductRail({
  products,
  className = "",
}: {
  products: Product[];
  className?: string;
}) {
  return (
    <ul
      className={`rail-scroll product-rail -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 min-[900px]:mx-0 min-[900px]:grid min-[900px]:grid-cols-4 min-[900px]:gap-5 min-[900px]:overflow-visible min-[900px]:px-0 min-[900px]:pb-0 min-[1200px]:grid-cols-5 ${className}`}
    >
      {products.map((product) => (
        <li
          key={product.id}
          className="product-rail-item h-auto shrink-0 snap-start first:scroll-ml-4 sm:first:scroll-ml-6 min-[900px]:first:scroll-ml-0 min-[900px]:h-full"
        >
          <ProductCard product={product} />
        </li>
      ))}
    </ul>
  );
}

/** Shared responsive product grid - reused by the all-category page. */
export function ProductGrid({
                                products,
                                className = "",
                            }: {
    products: Product[];
    className?: string;
}) {
    return (
        <ul
            className={`grid grid-cols-2 gap-4 min-[900px]:grid-cols-4 min-[1200px]:grid-cols-5 lg:gap-5 ${className}`}
        >
            {products.map((product) => (
                <li key={product.id} className="h-full">
                    <ProductCard product={product}/>
                </li>
            ))}
        </ul>
    );
}
