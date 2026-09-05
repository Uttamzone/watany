import type {Metadata} from "next";
import Link from "next/link";
import {PageHero} from "@/components/content/page-hero";
import {Reveal} from "@/components/content/reveal";

export const metadata: Metadata = {
    title: "Contact Us | Wholesale & Customer Support",
    description:
        "Get in touch with Watani & Sons for authentic Palestinian product orders, shipping questions, or wholesale & distributor enquiries in Canada and the USA.",
    alternates: {
        canonical: "https://wataniandsons.ca/contact",
    },
    openGraph: {
        title: "Contact Us | Watani & Sons",
        description:
            "Get in touch with Watani & Sons for authentic Palestinian product orders, shipping questions, or wholesale & distributor enquiries in Canada and the USA.",
        url: "https://wataniandsons.ca/contact",
    },
};

const channels = [
    {
        label: "Call us",
        value: "+1 613-854-7777",
        href: "tel:+16138547777",
        note: "Product, order, and wholesale enquiries.",
        icon: (
            <path
                d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.58 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.46.57 3.6a1 1 0 0 1-.25 1z"/>
        ),
    },
    {
        label: "Email us",
        value: "Info@wataniandsons.com",
        href: "mailto:Info@wataniandsons.com",
        note: "We aim to reply within one business day.",
        icon: (
            <>
                <rect x="3" y="5" width="18" height="14" rx="2"/>
                <path d="m3 7 9 6 9-6"/>
            </>
        ),
    },
    {
        label: "Visit us",
        value: "300 Greenbank Rd, Ottawa, ON K2H 0B6",
        note: "Serving communities across Canada and the USA.",
        icon: (
            <>
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                <circle cx="12" cy="10" r="3"/>
            </>
        ),
    },
];

const quickLinks = [
    {
        title: "Track an order",
        copy: "Sign in to see the status of any recent order.",
        href: "/portal/orders",
        cta: "View my orders",
    },
    {
        title: "Shipping & shop help",
        copy: "Delivery options, payment methods, and common questions.",
        href: "/help",
        cta: "Read Shop Help",
    },
    {
        title: "Wholesale accounts",
        copy: "Case and pallet pricing for retailers and distributors.",
        href: "/services",
        cta: "Explore wholesale",
    },
];

export default function ContactPage() {
    return (
        <div className="shell pt-6 pb-20">
            <PageHero
                eyebrow="Contact"
                title="We'd love to hear from you"
                intro="Questions about a product, an order on its way, or becoming a wholesale partner - reach us however suits you best."
                image="/images/offers/palestinian-table.webp"
            />

            <Reveal as="section" className="mt-14 grid gap-5 md:grid-cols-3">
                {channels.map((channel) => {
                    const body = (
                        <>
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-lime-500 text-teal-950">
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-5 w-5"
                    aria-hidden
                >
                  {channel.icon}
                </svg>
              </span>
                            <p className="mt-5 text-[12px] font-bold uppercase tracking-[0.12em] text-muted">
                                {channel.label}
                            </p>
                            <p className="mt-2 text-[17px] font-extrabold leading-snug text-teal-950">
                                {channel.value}
                            </p>
                            <p className="mt-2 text-[13px] leading-relaxed text-muted">
                                {channel.note}
                            </p>
                        </>
                    );

                    const shared =
                        "flex h-full flex-col rounded-[22px] bg-surface p-6 shadow-card transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-card-hover";

                    // Phone and email are actionable; the address is not a link.
                    return channel.href ? (
                        <a key={channel.label} href={channel.href} className={shared}>
                            {body}
                        </a>
                    ) : (
                        <div key={channel.label} className={shared}>
                            {body}
                        </div>
                    );
                })}
            </Reveal>

            <Reveal as="section" className="mt-16 rounded-[28px] bg-warm-canvas px-7 py-12 md:px-12">
                <h2 className="text-[26px] font-extrabold leading-tight text-teal-950 sm:text-[32px]">
                    Looking for something specific?
                </h2>
                <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted">
                    These answer most of what people write in about - you may not need to
                    wait for a reply.
                </p>

                <div className="mt-8 grid gap-5 md:grid-cols-3">
                    {quickLinks.map((link) => (
                        <div
                            key={link.title}
                            className="flex flex-col rounded-[22px] bg-surface p-6 shadow-card"
                        >
                            <h3 className="text-[17px] font-extrabold text-teal-950">
                                {link.title}
                            </h3>
                            <p className="mt-2 flex-1 text-[14px] leading-relaxed text-muted">
                                {link.copy}
                            </p>
                            <Link
                                href={link.href}
                                className="mt-4 inline-flex items-center gap-1.5 text-[14px] font-bold text-teal-950 transition-colors hover:text-teal-900"
                            >
                                {link.cta}
                                <span aria-hidden>→</span>
                            </Link>
                        </div>
                    ))}
                </div>
            </Reveal>
        </div>
    );
}
