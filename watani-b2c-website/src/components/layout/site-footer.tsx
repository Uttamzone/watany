import Image from "next/image";
import Link from "next/link";

/**
 * Warm-cream footer - design.md §7.10.
 * Business details are the verified ones from wataniandsons.com.
 */

const linkColumns: { title: string; links: { label: string; href: string }[] }[] = [
    {
        title: "Products",
        links: [
            {label: "Olive Oil", href: "/categories?category=olive-oil"},
            {label: "Olives", href: "/categories?category=olives"},
            {label: "Cheese", href: "/categories?category=cheese"},
            {label: "Ghee", href: "/categories?category=ghee"},
            {label: "Zaatar", href: "/categories?category=zaatar"},
            {label: "Spices & Grains", href: "/categories?category=spices-grains"},
        ],
    },
    {
        title: "Company",
        links: [
            {label: "About Us", href: "/about"},
            {label: "Contact Us", href: "/contact"},
        ],
    },
    {
        title: "Help",
        links: [
            {label: "Shop Help", href: "/help"},
            {label: "Shipping Options", href: "/help"},
            {label: "Order Status", href: "/portal/orders"},
            {label: "Contact Us", href: "/contact"},
        ],
    },
];

/**
 * Link list shared by both breakpoints. Mobile wraps it in a <details>
 * accordion (below), desktop renders it open under a plain heading.
 */
function ColumnLinks({column}: { column: (typeof linkColumns)[number] }) {
    return (
        <ul className="mt-1 space-y-1">
            {column.links.map((link) => (
                <li key={link.label}>
                    <Link
                        href={link.href}
                        className="inline-flex py-1 text-[13px] text-muted transition-colors hover:text-teal-900"
                    >
                        {link.label}
                    </Link>
                </li>
            ))}
        </ul>
    );
}

export function SiteFooter() {
    return (
        <div className="sticky bottom-0 z-0 w-full overflow-hidden">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-black/10 to-transparent z-10" />
            <footer className="bg-warm-canvas pt-12 pb-10 md:pt-16 md:pb-14 lg:pt-20 lg:pb-16">
            <div className="shell">
                <div className="grid gap-8 pb-8 md:grid-cols-2 md:gap-10 md:pb-10 lg:grid-cols-[1.2fr_repeat(3,1fr)]">
                    <div>
                        <div className="flex items-start gap-4 md:block">
                            <Image
                                src="/logo/watany-logo.png"
                                alt="Watany - Palestinian Products"
                                width={435}
                                height={373}
                                className="h-auto w-[90px] shrink-0 md:w-[120px]"
                            />
                            <p className="text-[13px] leading-relaxed text-muted md:mt-3 md:max-w-xs">
                                Your trusted Canadian source for authentic Palestinian olive
                                oil, pantry products, cheese, and traditional ceramics.
                            </p>
                        </div>

                        <div className="mt-4 flex items-center gap-3">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-teal-950 shrink-0">
                                Payments
                            </span>
                            <Image
                                src="/art/payments.svg"
                                alt="Visa, Mastercard, American Express, and Interac e-Transfer accepted"
                                width={200}
                                height={32}
                                className="h-6 w-auto"
                            />
                        </div>
                    </div>

                    <div className="-mx-4 divide-y divide-black/[0.06] border-y border-black/[0.06] sm:-mx-6 md:hidden">
                        {linkColumns.map((column) => (
                            <details key={column.title} className="group px-4 sm:px-6">
                                <summary
                                    className="flex min-h-10 cursor-pointer list-none items-center justify-between text-xs font-extrabold text-teal-950 [&::-webkit-details-marker]:hidden">
                                    {column.title}
                                    <svg
                                        aria-hidden="true"
                                        viewBox="0 0 20 20"
                                        className="h-3.5 w-3.5 text-muted transition-transform duration-200 group-open:-rotate-180"
                                    >
                                        <path
                                            d="M5 8l5 5 5-5"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="1.75"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                    </svg>
                                </summary>
                                <div className="pb-2">
                                    <ColumnLinks column={column}/>
                                </div>
                            </details>
                        ))}
                    </div>

                    {linkColumns.map((column) => (
                        <nav
                            key={column.title}
                            aria-label={column.title}
                            className="hidden md:block"
                        >
                            <h2 className="text-xs font-extrabold text-teal-950 uppercase tracking-wider">
                                {column.title}
                            </h2>
                            <ColumnLinks column={column}/>
                        </nav>
                    ))}
                </div>

                <div
                    className="grid gap-1.5 border-t border-black/[0.06] py-4 text-[13px] text-muted sm:grid-cols-3 sm:gap-3">
                    <p className="flex items-center">
                        300 Greenbank Rd, Ottawa, ON K2H 0B6
                    </p>
                    <p className="sm:text-center">
                        <a
                            href="tel:+16138547777"
                            className="transition-colors hover:text-teal-900"
                        >
                            +1 613-854-7777
                        </a>
                    </p>
                    <p className="sm:text-right">
                        <a
                            href="mailto:Info@wataniandsons.com"
                            className="transition-colors hover:text-teal-900"
                        >
                            Info@wataniandsons.com
                        </a>
                    </p>
                </div>

                <div
                    className="flex flex-col-reverse gap-2 border-t border-black/[0.06] pt-4 text-[12px] text-muted sm:flex-row sm:items-center sm:justify-between">
                    <p>© 2026 Watani and Sons Corp. All rights reserved.</p>
                    <div className="flex gap-5">
                        <Link href="/terms" className="transition-colors hover:text-teal-900">
                            Terms
                        </Link>
                        <Link href="/privacy" className="transition-colors hover:text-teal-900">
                            Privacy
                        </Link>
                    </div>
                </div>
            </div>
        </footer>
    </div>
    );
}
