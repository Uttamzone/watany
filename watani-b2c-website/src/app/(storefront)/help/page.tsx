import type {Metadata} from "next";
import Link from "next/link";
import {PageHero} from "@/components/content/page-hero";
import {Reveal} from "@/components/content/reveal";
import {type Faq, FaqAccordion} from "@/components/content/faq-accordion";

export const metadata: Metadata = {
    title: "Shop Help",
    description:
        "Shipping options, order status, and answers to common questions about shopping with Watani & Sons.",
};

const shippingFaqs: Faq[] = [
    {
        question: "What are my shipping options?",
        answer:
            "We offer door-to-door delivery across our serviced areas in Canada, as well as collection at partner pickup points. Choose whichever suits you at checkout - shipping cost and delivery estimate are calculated from your address before you pay.",
    },
    {
        question: "How much does shipping cost?",
        answer:
            "Shipping is quoted live from your address and basket at checkout, so you see the exact cost before paying. Choosing a pickup point removes the shipping charge entirely.",
    },
    {
        question: "Do you ship to the United States?",
        answer:
            "We serve customers in both Canada and the United States. Enter your address at checkout to see the options and delivery estimate available to you.",
    },
];

const orderFaqs: Faq[] = [
    {
        question: "How do I check my order status?",
        answer:
            "Sign in and open Order History under your profile to see the status of any order. If you checked out as a guest, use the confirmation email we sent you, or contact us with your order number.",
    },
    {
        question: "What payment methods do you accept?",
        answer:
            "We accept Visa, Mastercard, and American Express, as well as Interac e-Transfer and cheque for eligible accounts. Available methods are shown at checkout.",
    },
    {
        question: "Something arrived damaged or incorrect - what now?",
        answer:
            "Contact us within 7 days of delivery with your order number and a photo where possible, and we'll put it right. Perishable and food items can't be returned once delivered unless faulty.",
    },
];

const productFaqs: Faq[] = [
    {
        question: "How fresh is your olive oil?",
        answer:
            "Our olive oil is sourced directly from family presses in Palestine. Pre-season orders let you reserve oil from the coming harvest before pressing begins, so it reaches you as fresh as it can.",
    },
    {
        question: "Do you offer wholesale or distributor pricing?",
        answer:
            "Yes. Retailers and distributors can apply for an account with case and pallet pricing across the full range. Wholesale applications are typically approved within 24 hours; until approval, orders are priced at standard retail rates.",
    },
    {
        question: "Why did my price change when I changed the quantity?",
        answer:
            "Pricing is tiered by quantity for wholesale and distributor accounts, so larger quantities can unlock a better rate. If a tier's minimum quantity isn't met, that line is priced at the retail rate instead.",
    },
];

const sections = [
    {title: "Shipping & delivery", faqs: shippingFaqs},
    {title: "Orders & payment", faqs: orderFaqs},
    {title: "Products & pricing", faqs: productFaqs},
];

export default function HelpPage() {
    return (
        <div className="shell pt-6 pb-20">
            <PageHero
                eyebrow="Shop Help"
                title="Answers, before you have to ask"
                intro="Shipping, orders, payment, and pricing - the things customers write in about most."
                image="/images/offers/olive-oil.webp"
            />

            {/* Quick paths out for the two most common intents. */}
            <Reveal as="section" className="mt-14 grid gap-5 sm:grid-cols-2">
                <Link
                    href="/portal/orders"
                    className="flex flex-col rounded-[22px] bg-surface p-6 shadow-card transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-card-hover"
                >
                    <h2 className="text-[18px] font-extrabold text-teal-950">
                        Track an order
                    </h2>
                    <p className="mt-2 flex-1 text-[14px] leading-relaxed text-muted">
                        Sign in to see status, tracking, and invoices for every order
                        you&apos;ve placed.
                    </p>
                    <span className="mt-4 inline-flex items-center gap-1.5 text-[14px] font-bold text-teal-950">
            View my orders <span aria-hidden>→</span>
          </span>
                </Link>

                <Link
                    href="/contact"
                    className="flex flex-col rounded-[22px] bg-surface p-6 shadow-card transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-card-hover"
                >
                    <h2 className="text-[18px] font-extrabold text-teal-950">
                        Talk to a person
                    </h2>
                    <p className="mt-2 flex-1 text-[14px] leading-relaxed text-muted">
                        Call +1 613-854-7777 or email us - we aim to reply within one
                        business day.
                    </p>
                    <span className="mt-4 inline-flex items-center gap-1.5 text-[14px] font-bold text-teal-950">
            Contact us <span aria-hidden>→</span>
          </span>
                </Link>
            </Reveal>

            {sections.map((section, index) => (
                <Reveal
                    as="section"
                    key={section.title}
                    className={index === 0 ? "mt-16" : "mt-12"}
                >
                    <h2 className="text-[22px] font-extrabold leading-tight text-teal-950 sm:text-[26px]">
                        {section.title}
                    </h2>
                    <div className="mt-5">
                        <FaqAccordion faqs={section.faqs}/>
                    </div>
                </Reveal>
            ))}

            <Reveal as="section" className="mt-16 rounded-[28px] bg-warm-canvas px-7 py-12 text-center md:px-12">
                <h2 className="text-[24px] font-extrabold leading-tight text-teal-950 sm:text-[28px]">
                    Still stuck?
                </h2>
                <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-muted">
                    If your question isn&apos;t here, get in touch and we&apos;ll sort it
                    out with you directly.
                </p>
                <Link
                    href="/contact"
                    className="mt-7 inline-flex h-[50px] items-center justify-center rounded-[10px] bg-teal-950 px-7 text-[15px] font-bold text-white transition-transform duration-150 hover:-translate-y-0.5 active:translate-y-px"
                >
                    Contact us
                </Link>
            </Reveal>
        </div>
    );
}
