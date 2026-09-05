"use client";

import Image from "next/image";
import Link from "next/link";
import {motion, useReducedMotion} from "framer-motion";
import {motionTokens, sec} from "@/lib/motion";
import {useAuth} from "@/components/auth/auth-store";

/**
 * The three service paths - Bulk / Wholesale / Amanat. The client asked for
 * these to carry the page, so each card is a full panel with its own numbered
 * index, capability list and CTA rather than the icon-blurb-link card from the
 * reference mockup.
 *
 * The middle card is the emphasised one (dark, lime accents): wholesale is the
 * highest-value path and the reference had no visual hierarchy at all.
 */

type Path = {
    index: string;
    title: string;
    copy: string;
    points: string[];
    cta: string;
    /** Omitted when the path isn't live yet - the card then renders inert. */
    href?: string;
    emphasis?: boolean;
    /**
     * Only the emphasised card carries a photo. Giving all three an image would
     * flatten the hierarchy back to the reference mockup's three equal tiles.
     */
    image?: string;
};

const paths: Path[] = [
    {
        index: "01",
        title: "Bulk Buyers",
        copy: "For families, events, community groups and organizations that want larger quantities at better value.",
        points: ["No account required", "Case & multi-unit sizes", "Event and community volumes"],
        cta: "Shop bulk",
        href: "/categories",
    },
    {
        index: "02",
        title: "Wholesale & Distributors",
        copy: "For grocery stores, restaurants, retailers and distributors. Login or apply for a business account.",
        points: ["Tiered business pricing", "Case & pallet quantities", "Dedicated account access"],
        cta: "Wholesale login",
        href: "/login",
        emphasis: true,
        image: "/images/services/wholesale.webp",
    },
    {
        // Amanat isn't launched yet: no href, so this renders as an inert card
        // with a "Coming soon" badge instead of a dead link.
        index: "03",
        title: "Amanat Shipping",
        copy: "Send olive oil, cheese, olives and eligible family products from Palestine to destinations worldwide.",
        points: ["Drop off in Palestine", "Consolidated freight", "Pick up locally, or Door2Door service"],
        cta: "Coming soon",
    },
];

export function ShoppingPaths() {
    const reduceMotion = useReducedMotion();
    const {status} = useAuth();
    const loggedIn = status === "authenticated";

    return (
        <section
            aria-labelledby="paths-heading"
            className="mt-11 sm:mt-24"
        >
            <motion.div
                initial={reduceMotion ? {opacity: 1, x: 0} : {opacity: 0, x: -40}}
                whileInView={{opacity: 1, x: 0}}
                viewport={{once: true, amount: 0.2}}
                transition={{duration: 0.55, ease: [0.16, 1, 0.3, 1]}}
                className="max-w-2xl"
            >
                <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal-800">
                    Choose your path
                </span>
                <h2
                    id="paths-heading"
                    className="mt-2.5 text-[25px] font-extrabold leading-[1.12] text-teal-950 sm:text-[38px] lg:text-[44px]"
                >
                    Choose how you want to shop
                </h2>
                <p className="mt-4 text-[15px] leading-relaxed text-muted sm:text-[17px]">
                    Wholesale & Bulk Palestinian Products + Amanat Shipping Services
                </p>
            </motion.div>

            {/* Mobile: snap-scroll rail, same pattern as the discovery tiles - three
                stacked cards ran well over a screen. Grid from lg up. */}
            <ul className="rail-scroll -mx-4 mt-8 flex snap-x snap-mandatory gap-3.5 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:mx-0 lg:mt-10 lg:grid lg:grid-cols-3 lg:gap-5 lg:overflow-visible lg:px-0 lg:pb-0 [&>*]:min-w-0">
                {paths.map((path, i) => {
                    // Once signed in, the wholesale card has nothing left to link to -
                    // render it inert like the unreleased Amanat card instead of
                    // looping back through /login.
                    const disabledForAuth = path.emphasis && loggedIn;
                    const href = disabledForAuth ? undefined : path.href;
                    const cta = disabledForAuth ? "Account active" : path.cta;

                    const cardClass = [
                        "relative flex h-full flex-col overflow-hidden rounded-[22px] p-5 origin-bottom transition-all duration-250 ease-out sm:rounded-[24px] sm:p-7",
                        href ? "hover:z-20 cursor-pointer" : "hover:z-10",
                        path.emphasis
                            ? "bg-teal-950 text-white shadow-[0_20px_50px_rgba(0,48,45,0.18)] hover:scale-[1.06] hover:shadow-[0_28px_60px_rgba(0,48,45,0.28)]"
                            : "border border-teal-950/8 bg-surface text-teal-950 shadow-card hover:scale-[1.04] hover:shadow-card-hover",
                    ].join(" ");

                    const initialPos = reduceMotion
                        ? {opacity: 1, x: 0, y: 0}
                        : i === 0
                        ? {opacity: 0, x: -45, y: 0}
                        : i === 2
                        ? {opacity: 0, x: 45, y: 0}
                        : {opacity: 0, x: 0, y: 25};

                    const body = (
                        <>
                            {/* Photo sits under the scrim so the copy keeps its contrast. */}
                            {path.image ? (
                                <span aria-hidden className="pointer-events-none absolute inset-0">
                                    <Image
                                        src={path.image}
                                        alt=""
                                        fill
                                        sizes="(max-width: 1024px) 100vw, 33vw"
                                        className="object-cover opacity-45 transition-transform duration-500 group-hover:scale-[1.06]"
                                    />
                                    <span className="absolute inset-0 bg-gradient-to-t from-teal-950 via-teal-950/85 to-teal-950/55" />
                                </span>
                            ) : null}

                            {/* Emphasised card gets the same lime pool as the hero. */}
                            {path.emphasis ? (
                                <span
                                    aria-hidden
                                    className="pointer-events-none absolute inset-0"
                                    style={{
                                        background:
                                            "radial-gradient(70% 60% at 100% 0%, rgba(169,235,90,0.22), transparent 62%)",
                                    }}
                                />
                            ) : null}

                            <div className="relative flex items-center justify-between">
                                <span
                                    className={[
                                        "font-mono text-[12px] font-bold tracking-[0.18em]",
                                        path.emphasis ? "text-lime-400" : "text-teal-800/60",
                                    ].join(" ")}
                                >
                                    {path.index}
                                </span>
                                {href ? (
                                    <span
                                        aria-hidden
                                        className={[
                                            "flex h-9 w-9 items-center justify-center rounded-full transition-transform duration-250 ease-out group-hover:rotate-45 group-hover:translate-x-1.5",
                                            path.emphasis
                                                ? "bg-lime-500 text-teal-950 shadow-sm"
                                                : "bg-soft-control text-teal-950",
                                        ].join(" ")}
                                    >
                                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                            <path
                                                d="M3 8h10M9 4l4 4-4 4"
                                                stroke="currentColor"
                                                strokeWidth="1.8"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            />
                                        </svg>
                                    </span>
                                ) : (
                                    <span className="rounded-full bg-soft-control px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-teal-950/60">
                                        {disabledForAuth ? "Account active" : "Coming soon"}
                                    </span>
                                )}
                            </div>

                            <h3 className="relative mt-5 text-[19px] font-extrabold leading-tight sm:mt-6 sm:text-[23px]">
                                {path.title}
                            </h3>
                            <p
                                className={[
                                    "relative mt-2.5 text-[13.5px] leading-relaxed sm:mt-3 sm:text-[14.5px]",
                                    path.emphasis ? "text-white/72" : "text-muted",
                                ].join(" ")}
                            >
                                {path.copy}
                            </p>

                            <ul className="relative mt-5 space-y-2 sm:mt-6 sm:space-y-2.5">
                                {path.points.map((point) => (
                                    <li
                                        key={point}
                                        className={[
                                            "flex items-start gap-2.5 text-[13px] sm:text-[14px]",
                                            path.emphasis ? "text-white/85" : "text-teal-950/75",
                                        ].join(" ")}
                                    >
                                        <span
                                            aria-hidden
                                            className={[
                                                "mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full",
                                                path.emphasis ? "bg-lime-400" : "bg-teal-800",
                                            ].join(" ")}
                                        />
                                        {point}
                                    </li>
                                ))}
                            </ul>

                            {disabledForAuth ? null : (
                                <span
                                    className={[
                                        // mt-auto pins the CTA to the card floor so all
                                        // three align despite different copy lengths.
                                        "relative mt-auto inline-flex items-center gap-1.5 pt-6 text-[13.5px] font-bold sm:text-[14px]",
                                        !href
                                            ? "text-teal-950/45"
                                            : path.emphasis
                                              ? "text-lime-400"
                                              : "text-teal-900",
                                    ].join(" ")}
                                >
                                    {cta}
                                    {href ? (
                                        <span
                                            aria-hidden
                                            className="transition-transform duration-200 ease-out group-hover:translate-x-1"
                                        >
                                            &rarr;
                                        </span>
                                    ) : null}
                                </span>
                            )}
                        </>
                    );

                    return (
                        <motion.li
                            key={path.title}
                            initial={initialPos}
                            whileInView={{opacity: 1, x: 0, y: 0}}
                            viewport={{once: true, amount: 0.2}}
                            transition={{
                                duration: 0.55,
                                ease: [0.16, 1, 0.3, 1],
                                delay: reduceMotion ? 0 : i * 0.1,
                            }}
                            className="group w-[78vw] max-w-[300px] shrink-0 snap-start first:scroll-ml-4 sm:w-[320px] sm:first:scroll-ml-6 lg:w-auto lg:max-w-none lg:first:scroll-ml-0"
                        >
                            {/* Unreleased paths (and the wholesale card once signed
                                in) render as a plain div: not a link, not focusable,
                                no hover lift - nothing reads as clickable. */}
                            {href ? (
                                <Link href={href} className={cardClass}>
                                    {body}
                                </Link>
                            ) : (
                                <div aria-disabled className={cardClass}>
                                    {body}
                                </div>
                            )}
                        </motion.li>
                    );
                })}
            </ul>
        </section>
    );
}
