import Image from "next/image";
import {PackageCheck, RefreshCcw} from "lucide-react";

/** App/download banner - a full-bleed promotional card in the page flow. */
export function AppDownloadBanner() {
  return (
    <section
      aria-labelledby="app-banner-heading"
      // Mobile min-height was 620px - taller than the desktop card and most of a phone
      // viewport. The copy block sets the real height here, so the floor just guarantees
      // enough artwork shows above it.
      className="relative isolate mt-12 sm:mt-20 flex min-h-[440px] items-end overflow-hidden rounded-[24px] bg-[#4a001e] shadow-[0_28px_70px_-38px_rgba(82,0,34,0.8)] sm:min-h-[560px] sm:items-center sm:rounded-[28px] lg:min-h-[510px] lg:rounded-[34px] xl:min-h-[540px]"
    >
      <Image
        src="/images/app-download-background.png"
        alt=""
        fill
        sizes="(max-width: 1280px) 100vw, 1280px"
        className="-z-20 object-cover object-[68%_center] sm:object-[64%_center] lg:object-center"
      />

            <div
                className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(42,0,17,0.08)_0%,rgba(42,0,17,0.2)_42%,rgba(42,0,17,0.94)_100%)] sm:bg-[linear-gradient(90deg,rgba(42,0,17,0.9)_0%,rgba(42,0,17,0.7)_42%,rgba(42,0,17,0.08)_74%)]"/>

      <div className="w-full px-5 py-6 sm:px-8 sm:py-8 md:px-12 lg:px-14 lg:py-12">
        <div className="max-w-[610px] rounded-[20px] border border-white/15 bg-[#2c0012]/50 p-5 shadow-[0_24px_60px_-24px_rgba(20,0,8,0.75)] backdrop-blur-md sm:rounded-[24px] sm:p-8 lg:p-9">
          <div className="mb-4 flex items-center gap-3 sm:mb-5">
            <span className="h-px w-8 bg-[#d6b06f]" />
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#efd49e]">
              Watani &amp; Sons App
            </p>
          </div>

          <h2
            id="app-banner-heading"
            className="max-w-xl text-[24px] font-extrabold leading-[1.12] tracking-[-0.025em] text-white sm:text-[36px] sm:leading-[1.08] lg:text-[42px]"
          >
            Your favorite essentials, delivered to your door.
          </h2>
          <p className="mt-4 max-w-lg text-[14px] leading-6 text-white/75 sm:text-[15px]">
            Track pre-season olive oil orders, reorder pantry staples, and follow
            your delivery from the Watani &amp; Sons app.
          </p>

          <div className="mt-5 grid gap-2.5 sm:mt-7 sm:gap-3 sm:grid-cols-2">
            {[
              {
                title: "Easy reordering",
                description: "Restock favorites in a few taps",
                Icon: RefreshCcw,
              },
              {
                title: "Live order tracking",
                description: "Follow every delivery update",
                Icon: PackageCheck,
              },
            ].map((item) => (
              <div
                key={item.title}
                className="flex items-center gap-3 rounded-xl border border-white/15 bg-black/30 px-3.5 py-3 text-white sm:px-4 sm:py-3.5"
              >
                <item.Icon
                  aria-hidden="true"
                  className="size-5 shrink-0 text-[#efd49e] sm:size-6"
                  strokeWidth={1.8}
                />
                <span className="text-left leading-tight">
                  <span className="block text-[14px] font-semibold">
                    {item.title}
                  </span>
                  <span className="mt-1 block text-[11px] leading-4 text-white/55">
                    {item.description}
                  </span>
                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
