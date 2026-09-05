import type {Metadata} from "next";
import Image from "next/image";
import Link from "next/link";
import {PageHero} from "@/components/content/page-hero";
import {Reveal} from "@/components/content/reveal";

export const metadata: Metadata = {
    title: "Wholesale & B2B Distributor Services | Palestinian Goods",
    description:
        "Wholesale Palestinian olive oil, bulk food supply, restaurant & grocery distribution, case/pallet pricing, and door-to-door delivery across Canada and the USA.",
    alternates: {
        canonical: "https://wataniandsons.ca/services",
    },
    openGraph: {
        title: "Wholesale & B2B Distributor Services | Watani & Sons",
        description:
            "Wholesale Palestinian olive oil, bulk food supply, restaurant & grocery distribution, case/pallet pricing, and door-to-door delivery across Canada and the USA.",
        url: "https://wataniandsons.ca/services",
    },
};

const benefits = [
    {
        title: "Increased margins",
        copy: "Buy in bulk at case and pallet pricing, and sell at a healthy markup.",
    },
    {
        title: "A wider range for your shelves",
        copy: "Access the full catalogue - olive oil, olives, zaatar, spices and grains, cheese, ghee, beauty care, and ceramics.",
    },
    {
        title: "A supplier you can plan around",
        copy: "Ongoing partnership with consistent sourcing, not one-off opportunistic stock.",
    },
];

const services = [
    {
        title: "Door-to-door delivery",
        copy: "We deliver directly to homes and businesses across our serviced areas in Canada, so your order arrives without a detour through a third-party locker.",
        image: "/images/services/palestinian-farmers.webp",
    },
    {
        title: "Pickup across Canada",
        copy: "Prefer to collect yourself? Choose a partner pickup point at checkout and skip shipping altogether.",
        image: "/images/services/pickup-canada.webp",
    },
    {
        title: "Pre-season olive oil orders",
        copy: "Reserve from the coming harvest before pressing begins, and receive extra virgin olive oil as fresh as it can reach you.",
        image: "/images/services/preseason-orders.webp",
    },
];

export default function ServicesPage() {
    return (
        <div className="shell pt-6 pb-20">
            <PageHero
                eyebrow="Wholesale & Services"
                title="Built for shelves, not just tables"
                intro="Retailers, distributors, and households all order from us - with pricing, delivery, and harvest timing arranged to suit each."
                image="/images/services/wholesale.webp"
            >
                <Link
                    href="/login"
                    className="inline-flex h-[50px] items-center justify-center rounded-[10px] bg-lime-500 px-7 text-[15px] font-bold text-teal-950 transition-transform duration-150 hover:-translate-y-0.5 active:translate-y-px"
                >
                    Apply for a wholesale account
                </Link>
            </PageHero>

            {/* Wholesale is the headline offer, so it gets the feature treatment. */}
            <Reveal as="section" className="mt-16 grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
                <div>
                    <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-muted">
                        Wholesale &amp; distributor accounts
                    </p>
                    <h2 className="mt-3 text-[26px] font-extrabold leading-tight text-teal-950 sm:text-[32px]">
                        Stock authentic Palestinian products
                    </h2>
                    <p className="mt-4 text-[15px] leading-relaxed text-muted">
                        Retailers can apply for wholesale pricing on case and pallet
                        quantities across our full range. Distributor accounts are
                        available for businesses looking to represent Watani &amp; Sons in
                        their region.
                    </p>

                    <ul className="mt-7 space-y-5">
                        {benefits.map((benefit) => (
                            <li key={benefit.title} className="flex gap-3.5">
                <span
                    aria-hidden
                    className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-lime-500 text-teal-950"
                >
                  <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-3.5 w-3.5"
                  >
                    <path d="m5 12.5 4.5 4.5L19 7.5"/>
                  </svg>
                </span>
                                <div>
                                    <h3 className="text-[16px] font-extrabold text-teal-950">
                                        {benefit.title}
                                    </h3>
                                    <p className="mt-1 text-[14px] leading-relaxed text-muted">
                                        {benefit.copy}
                                    </p>
                                </div>
                            </li>
                        ))}
                    </ul>

                    <div className="mt-8 rounded-[18px] bg-warm-canvas p-5">
                        <p className="text-[14px] leading-relaxed text-muted">
                            <strong className="font-bold text-teal-950">
                                Approval timelines:
                            </strong>{" "}
                            wholesale accounts are typically approved within 24 hours.
                            Distributor accounts are reviewed and approved as soon as
                            possible. Until approval, orders are priced at standard retail
                            rates.
                        </p>
                    </div>
                </div>

                <div
                    className="relative aspect-[4/3] overflow-hidden rounded-[26px] bg-warm-canvas lg:aspect-auto lg:h-full lg:min-h-[460px]">
                    <Image
                        src="/images/offers/ceramics.webp"
                        alt="Palestinian ceramics and pantry products"
                        fill
                        sizes="(min-width: 1024px) 45vw, 100vw"
                        className="object-cover"
                    />
                </div>
            </Reveal>

            {/* Fulfilment options, image-backed like the home services rail. */}
            <Reveal as="section" className="mt-20">
                <h2 className="text-[26px] font-extrabold leading-tight text-teal-950 sm:text-[32px]">
                    How your order reaches you
                </h2>

                <ul className="mt-8 grid gap-5 md:grid-cols-3">
                    {services.map((service) => (
                        <li key={service.title}>
                            <div
                                className="relative flex h-[280px] flex-col justify-end overflow-hidden rounded-[22px] bg-cover bg-center bg-no-repeat p-6 text-white transition-transform duration-200 hover:-translate-y-1"
                                style={{backgroundImage: `url(${service.image})`}}
                            >
                <span
                    aria-hidden
                    className="absolute inset-0 bg-gradient-to-t from-teal-950 via-teal-950/70 to-teal-950/10"
                />
                                <h3 className="relative text-[18px] font-extrabold leading-snug">
                                    {service.title}
                                </h3>
                                <p className="relative mt-2 text-[13px] leading-relaxed text-white/85">
                                    {service.copy}
                                </p>
                            </div>
                        </li>
                    ))}
                </ul>
            </Reveal>

            <Reveal as="section"
                    className="mt-16 overflow-hidden rounded-[28px] bg-teal-950 px-7 py-12 text-white md:px-12">
                <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                    <div className="max-w-lg">
                        <h2 className="text-[24px] font-extrabold leading-tight sm:text-[30px]">
                            Ready to talk numbers?
                        </h2>
                        <p className="mt-3 text-[15px] leading-relaxed text-white/80">
                            Create an account to apply for wholesale pricing, or reach out
                            and we&apos;ll walk you through the range.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <Link
                            href="/login"
                            className="inline-flex h-[50px] items-center justify-center rounded-[10px] bg-lime-500 px-7 text-[15px] font-bold text-teal-950 transition-transform duration-150 hover:-translate-y-0.5 active:translate-y-px"
                        >
                            Apply now
                        </Link>
                        <Link
                            href="/contact"
                            className="inline-flex h-[50px] items-center justify-center rounded-[10px] border border-white/25 px-7 text-[15px] font-bold text-white transition-colors duration-150 hover:bg-white/10"
                        >
                            Contact us
                        </Link>
                    </div>
                </div>
            </Reveal>
        </div>
    );
}
