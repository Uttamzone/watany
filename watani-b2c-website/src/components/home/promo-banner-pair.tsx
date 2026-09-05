import Image from "next/image";

/**
 * Evergreen benefit banners, stacked on mobile.
 */
export function PromoBannerPair() {
  return (
    <section aria-label="Why shop with Watani" className="mt-12 sm:mt-20">
      <div className="grid gap-5 lg:grid-cols-2">
        <article className="relative flex min-h-[190px] items-center overflow-hidden rounded-[22px] sm:min-h-[250px] sm:rounded-[26px] bg-[#02244d] p-5 text-white sm:p-7 lg:min-h-[300px]">
          <Image
            src="/images/quality-products.png"
            alt=""
            aria-hidden
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="origin-right scale-[0.8] object-contain object-right"
          />
          <div className="relative z-10 max-w-[70%] sm:max-w-[62%]">
            <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-white/70">
              Quality products
            </p>
            {/* Breaks are desktop line-balancing - on a narrow card they force three
                lines that each wrap again, squeezing the artwork out of the frame. */}
            <p className="mt-2 text-[20px] font-extrabold leading-tight sm:mt-3 sm:text-[24px] lg:text-[30px]">
              Carefully selected
              <br className="hidden sm:inline" />{" "}
              authentic products
              <br className="hidden sm:inline" />{" "}
              you can trust
            </p>
          </div>
        </article>

        <article className="relative flex min-h-[190px] items-center overflow-hidden rounded-[22px] sm:min-h-[250px] sm:rounded-[26px] bg-rust p-5 text-white sm:p-7 lg:min-h-[300px]">
          <Image
            src="/images/easy-shopping.png"
            alt=""
            aria-hidden
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="origin-right scale-[0.8] object-contain object-right"
          />
          <div className="relative z-10 max-w-[70%] sm:max-w-[62%]">
            <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-white/70">
              Easy shopping
            </p>
            <p className="mt-2 text-[20px] font-extrabold leading-tight sm:mt-3 sm:text-[24px] lg:text-[30px]">
              Find your favourites
              <br className="hidden sm:inline" />{" "}
              and order online
              <br className="hidden sm:inline" />{" "}
              with ease
            </p>
          </div>
        </article>
      </div>
    </section>
  );
}
