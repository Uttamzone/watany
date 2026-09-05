import type {Metadata} from "next";
import {LegalPage, type LegalSection} from "@/components/content/legal-page";

export const metadata: Metadata = {
    title: "Terms of Service",
    description: "Terms and conditions for shopping with Watani & Sons.",
};

const sections: LegalSection[] = [
    {
        id: "orders-pricing",
        title: "Orders & pricing",
        body: (
            <p>
                All prices are shown in Canadian dollars (CAD) and are exclusive of
                tax, which is applied at checkout. Prices depend on your account&apos;s
                pricing group - Retail, Wholesale, or Distributor - and on the quantity
                ordered, and are confirmed at checkout before payment. We reserve the
                right to correct pricing errors and to cancel or adjust orders affected
                by them.
            </p>
        ),
    },
    {
        id: "accounts",
        title: "Wholesale & distributor accounts",
        body: (
            <p>
                Wholesale and distributor pricing requires an approved account. Until
                your application is approved, orders are priced at standard retail
                rates. Watani &amp; Sons may approve, decline, or revoke wholesale and
                distributor status at its discretion.
            </p>
        ),
    },
    {
        id: "shipping",
        title: "Shipping & pickup",
        body: (
            <p>
                Delivery estimates provided at checkout are approximate. Watani &amp;
                Sons is not liable for delays caused by carriers or by circumstances
                outside our control. Pickup orders must be collected from the selected
                location within the timeframe communicated at checkout.
            </p>
        ),
    },
    {
        id: "returns",
        title: "Returns & cancellations",
        body: (
            <p>
                If an item arrives damaged or incorrect, contact us within 7 days of
                delivery so we can make it right. Perishable and food items cannot be
                returned once delivered unless faulty.
            </p>
        ),
    },
    {
        id: "account-use",
        title: "Account use",
        body: (
            <p>
                You are responsible for keeping your account credentials confidential
                and for all activity that takes place under your account. Notify us
                immediately if you suspect unauthorized use.
            </p>
        ),
    },
    {
        id: "contact",
        title: "Contact",
        body: (
            <p>
                Questions about these terms can be directed to{" "}
                <a
                    href="mailto:Info@wataniandsons.com"
                    className="font-semibold text-teal-950 underline underline-offset-2"
                >
                    Info@wataniandsons.com
                </a>{" "}
                or{" "}
                <a
                    href="tel:+16138547777"
                    className="font-semibold text-teal-950 underline underline-offset-2"
                >
                    +1 613-854-7777
                </a>
                .
            </p>
        ),
    },
];

export default function TermsPage() {
    return (
        <LegalPage
            eyebrow="Legal"
            title="Terms of Service"
            intro="The terms that apply when you order from Watani & Sons."
            updated="August 2026"
            sections={sections}
        />
    );
}
