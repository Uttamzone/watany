import type {Metadata} from "next";
import Image from "next/image";
import Link from "next/link";
import {PageHero} from "@/components/content/page-hero";
import {Reveal} from "@/components/content/reveal";

export const metadata: Metadata = {
    title: "About Us | Palestinian Heritage & Authenticity",
    description:
        "Learn about Watani & Sons Corp., bringing authentic Palestinian olive oil, za'atar, cheese, ceramics, and cultural products to Canada and the United States.",
    alternates: {
        canonical: "https://wataniandsons.ca/about",
    },
    openGraph: {
        title: "About Us | Watani & Sons",
        description:
            "Learn about Watani & Sons Corp., bringing authentic Palestinian olive oil, za'atar, cheese, ceramics, and cultural products to Canada and the United States.",
        url: "https://wataniandsons.ca/about",
        images: [{ url: "/images/offers/olive-grove.webp" }],
    },
};

const story = [
    {
        title: "Sourced from Palestine",
        copy: "Our olive oil, za'atar, olives, Nabulsi cheese, spices, grains, soap, ceramics, and other products are selected from trusted Palestinian farmers, producers, and artisans.",
    },
    {
        title: "Imported with Care",
        copy: "Watani & Sons Corp. manages sourcing, import, quality, and distribution while keeping a clear connection between Palestinian producers and the customers who support them.",
    },
    {
        title: "Shared with Purpose",
        copy: "Our mission is to preserve authenticity, support Palestinian production, and make genuine Palestinian products more accessible across North America.",
    },
];

const profiles = [
    {
        name: "Mr. Jamil",
        badge: "The Origin",
        title: "Mr. Jamil - Where the Story Began",
        image: "/images/team/mr-jamil.webp",
        reverse: false,
        paragraphs: [
            "Mr. Jamil represents the roots and agricultural heritage behind Watany Palestinian Products. Raised in a family of olive farmers, he devoted his life to cultivating olive trees and producing high-quality Palestinian olive oil.",
            "He was among the early pioneers in his region to combine traditional olive-growing knowledge with modern olive oil processing. His experience in farming, cold pressing, and quality helped establish the standards and values that continue to guide the family today.",
        ],
        quote: "A legacy of land, labor, knowledge, and generations of care.",
    },
    {
        name: "Watany Ben Jamil",
        badge: "Founder & CEO",
        title: "Watany Ben Jamil - Founder & CEO",
        image: "/images/team/watany-ben-jamil.jpg",
        reverse: true,
        paragraphs: [
            "Watany Ben Jamil is the Founder & CEO of Watani & Sons Corp., the company that owns and operates the WATANY Palestinian Products brand. He transformed his family's agricultural heritage into a North American business with a clear purpose: to bring authentic Palestinian products to customers across Canada and the United States.",
            "After moving to Canada, he recognized the demand for high-quality Palestinian olive oil, za'atar, Nabulsi cheese, traditional foods, ceramics, and cultural products. What began as a small effort to share trusted products with friends and community members grew into a family-owned brand serving consumers, restaurants, retailers, and wholesale customers.",
            "Today, he oversees the company's direction, sourcing relationships, import strategy, product development, and expansion while protecting the authenticity and Palestinian identity of the brand.",
        ],
        quote: "A vision rooted in heritage, built to carry Palestinian products further.",
    },
    {
        name: "Emman Ben Jamil",
        badge: "Leadership",
        title: "Emman Ben Jamil",
        subtitle: "Director of Legal & Trademark",
        image: "/images/team/emman-ben-jamil.jpg",
        reverse: false,
        paragraphs: [
            "Emman Ben Jamil is Director of Legal & Trademark for Watani & Sons Corp., owner of the WATANY Palestinian Products brand. She leads the company's legal and trademark matters, helping protect the brand as it grows across markets.",
            "Emman is the wife of Founder & CEO Watany Ben Jamil and the mother of Kanaan, Razeen, Hassen, and Shafiqa Ben Jamil, all of whom are part of the family team behind the company.",
            "Her role includes supporting trademark protection, brand rights, legal documentation, and the company's broader efforts to safeguard its identity, intellectual property, and long-term interests.",
        ],
        quote: "Protecting the name, identity, and integrity behind the brand.",
    },
];

const team = [
    {
        name: "Emman Ben Jamil",
        role: "Director of Legal & Trademark",
        image: "/images/team/emman-ben-jamil.jpg",
    },
    {
        name: "Kanaan Ben Jamil",
        role: "Director of Sales",
        image: "/images/team/kanaan-ben-jamil.webp",
    },
    {
        name: "Razeen Ben Jamil",
        role: "Director of Business Development & Logistics",
        image: "/images/team/razeen-ben-jamil.webp",
    },
    {
        name: "Hassen Ben Jamil",
        role: "Business Development",
        image: "/images/team/hassen-ben-jamil.webp",
    },
    {
        name: "Shafiqa Ben Jamil",
        role: "Ceramics & Palestinian Products Specialist",
        image: "/images/team/shafiqa-ben-jamil.webp",
    },
];

const products = [
    "Extra Virgin Olive Oil",
    "Za'atar",
    "Olives",
    "Nabulsi Cheese",
    "Freekeh",
    "Maftoul",
    "Spices",
    "Ghee",
    "Handmade Ceramics",
    "Home Decor",
    "Clothing & Accessories",
];

export default function AboutPage() {
    return (
        <div className="shell pt-6 pb-20">
            <PageHero
                eyebrow="Our Story"
                title={
                    <>
                        Rooted in Palestine.
                        <br/>
                        Growing across borders.
                    </>
                }
                intro="Watany Palestinian Products connects families and communities with authentic Palestinian food, handmade products, and the traditions behind them."
                image="/images/offers/olive-grove.webp"
            >
                <div className="flex flex-wrap gap-3">
                    <Link
                        href="/categories"
                        className="inline-flex h-[50px] items-center justify-center rounded-[10px] bg-lime-500 px-7 text-[15px] font-bold text-teal-950 transition-transform duration-150 hover:-translate-y-0.5 active:translate-y-px"
                    >
                        Shop our products
                    </Link>
                    <Link
                        href="/services"
                        className="inline-flex h-[50px] items-center justify-center rounded-[10px] border border-white/25 px-7 text-[15px] font-bold text-white transition-colors duration-150 hover:bg-white/10"
                    >
                        Wholesale enquiries
                    </Link>
                </div>
            </PageHero>

            {/* From Palestinian Land to North American Homes */}
            <Reveal as="section" className="mt-16">
                <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-muted">
                    Our story
                </p>
                <h2 className="mt-3 max-w-3xl text-[26px] font-extrabold leading-tight text-teal-950 sm:text-[32px]">
                    From Palestinian Land to North American Homes
                </h2>
                <p className="mt-5 max-w-3xl text-[15px] leading-relaxed text-muted lg:text-[17px]">
                    Watany Palestinian Products grew from generations of connection to
                    Palestinian land, olive farming, food traditions, and craftsmanship.
                    Today, Watani &amp; Sons Corp. operates and owns the WATANY
                    Palestinian Products brand. The company carefully sources and
                    imports authentic Palestinian products and makes them available to
                    customers across Canada and the United States.
                </p>

                <div className="mt-8 grid gap-6 md:grid-cols-3">
                    {story.map((item) => (
                        <div
                            key={item.title}
                            className="rounded-[22px] bg-surface p-6 shadow-card transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-card-hover"
                        >
                            <h3 className="text-[17px] font-extrabold leading-snug text-teal-950">
                                {item.title}
                            </h3>
                            <p className="mt-2 text-[14px] leading-relaxed text-muted">
                                {item.copy}
                            </p>
                        </div>
                    ))}
                </div>
            </Reveal>

            {/* Family profiles */}
            {profiles.map((profile) => (
                <Reveal
                    key={profile.name}
                    as="section"
                    className={`mt-20 grid items-center gap-10 lg:grid-cols-2 lg:gap-14`}
                >
                    <div
                        className={`relative aspect-[4/5] overflow-hidden rounded-[26px] bg-warm-canvas ${
                            profile.reverse ? "lg:order-2" : "lg:order-1"
                        }`}
                    >
                        <Image
                            src={profile.image}
                            alt={profile.name}
                            fill
                            sizes="(min-width: 1024px) 50vw, 100vw"
                            className="object-cover"
                        />
                    </div>
                    <div className={profile.reverse ? "lg:order-1" : "lg:order-2"}>
                        <span className="inline-flex items-center rounded-full bg-warm-canvas px-3 py-1.5 text-[12px] font-bold uppercase tracking-[0.08em] text-teal-800">
                            {profile.badge}
                        </span>
                        <h2 className="mt-4 text-[26px] font-extrabold leading-tight text-teal-950 sm:text-[32px]">
                            {profile.title}
                        </h2>
                        {profile.subtitle && (
                            <p className="mt-1 text-[17px] font-bold text-muted">
                                {profile.subtitle}
                            </p>
                        )}
                        <div className="mt-5 space-y-4 text-[15px] leading-relaxed text-muted">
                            {profile.paragraphs.map((p, i) => (
                                <p key={i}>{p}</p>
                            ))}
                        </div>
                        <p className="mt-5 border-l-4 border-lime-500 pl-4 text-[16px] italic leading-relaxed text-teal-900">
                            {profile.quote}
                        </p>
                    </div>
                </Reveal>
            ))}

            {/* Meet the Team Behind Watany */}
            <Reveal as="section" className="mt-20 rounded-[28px] bg-warm-canvas px-7 py-12 md:px-12">
                <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-muted">
                    Our family
                </p>
                <h2 className="mt-3 text-[26px] font-extrabold leading-tight text-teal-950 sm:text-[32px]">
                    Meet the Team Behind Watany
                </h2>
                <p className="mt-4 max-w-3xl text-[15px] leading-relaxed text-muted lg:text-[17px]">
                    A family team committed to Palestinian heritage, strong customer
                    relationships, thoughtful growth, and authentic products.
                </p>
                <p className="mt-4 max-w-3xl text-[14px] leading-relaxed text-muted">
                    <strong className="text-teal-950">Corporate structure:</strong>{" "}
                    Watani &amp; Sons Corp. is the company. WATANY Palestinian Products
                    is its brand. Watany Ben Jamil is the Founder &amp; CEO of Watani
                    &amp; Sons Corp.; Emman Ben Jamil serves as Director of Legal &amp;
                    Trademark.
                </p>

                <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {team.map((member) => (
                        <div
                            key={member.name}
                            className="overflow-hidden rounded-[18px] bg-surface shadow-card transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-card-hover"
                        >
                            <div className="relative aspect-square">
                                <Image
                                    src={member.image}
                                    alt={member.name}
                                    fill
                                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                                    className="object-cover"
                                />
                            </div>
                            <div className="p-5">
                                <h3 className="text-[18px] font-extrabold text-teal-950">
                                    {member.name}
                                </h3>
                                <p className="mt-1 text-[13px] font-bold text-muted">
                                    {member.role}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </Reveal>

            {/* What We Stand For */}
            <Reveal as="section" className="mt-20">
                <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-muted">
                    What we stand for
                </p>
                <h2 className="mt-3 max-w-3xl text-[26px] font-extrabold leading-tight text-teal-950 sm:text-[32px]">
                    Heritage, Quality, Authenticity, and Trust
                </h2>
                <p className="mt-5 max-w-3xl text-[15px] leading-relaxed text-muted lg:text-[17px]">
                    Our story is about more than selling products. It is about
                    representing Palestinian heritage with care, maintaining strong
                    relationships with farmers, producers, and artisans, and giving
                    customers confidence in the origin and character of what they are
                    buying.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                    {products.map((product) => (
                        <span
                            key={product}
                            className="rounded-full border border-black/10 bg-surface px-4 py-2 text-[13px] font-bold text-teal-900"
                        >
                            {product}
                        </span>
                    ))}
                </div>
            </Reveal>

            {/* Closing CTA - teal block bookends the teal hero. */}
            <Reveal as="section"
                    className="mt-16 overflow-hidden rounded-[28px] bg-teal-950 px-7 py-12 text-white md:px-12">
                <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                    <div className="max-w-lg">
                        <h2 className="text-[24px] font-extrabold leading-tight sm:text-[30px]">
                            Taste the difference for yourself
                        </h2>
                        <p className="mt-3 text-[15px] leading-relaxed text-white/80">
                            Browse the full range, or talk to us about wholesale and
                            distributor pricing.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <Link
                            href="/categories"
                            className="inline-flex h-[50px] items-center justify-center rounded-[10px] bg-lime-500 px-7 text-[15px] font-bold text-teal-950 transition-transform duration-150 hover:-translate-y-0.5 active:translate-y-px"
                        >
                            Shop now
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
