import type {Metadata} from "next";
import {LegalPage, type LegalSection} from "@/components/content/legal-page";

export const metadata: Metadata = {
    title: "Privacy Policy",
    description:
        "How Watani & Sons collects, uses, and protects your information.",
};

const sections: LegalSection[] = [
    {
        id: "what-we-collect",
        title: "Information we collect",
        body: (
            <p>
                When you create an account, place an order, or contact us, we collect
                information such as your name, email address, phone number, shipping
                address, and order history. Payment card details are handled directly
                by our payment provider and are never stored on our servers.
            </p>
        ),
    },
    {
        id: "how-we-use-it",
        title: "How we use it",
        body: (
            <p>
                We use your information to process orders, resolve the correct pricing
                for your account type, arrange shipping or pickup, provide customer
                support, and - only if you opt in - send updates about products and
                promotions.
            </p>
        ),
    },
    {
        id: "sharing",
        title: "Sharing",
        body: (
            <p>
                We share information only with the parties needed to fulfil your order,
                such as payment processors and shipping carriers. We do not sell your
                personal information to third parties.
            </p>
        ),
    },
    {
        id: "applications",
        title: "Wholesale & distributor applications",
        body: (
            <p>
                If you apply for a wholesale or distributor account, the information
                you provide is used solely to review and manage that application and
                the resulting account.
            </p>
        ),
    },
    {
        id: "your-choices",
        title: "Your choices",
        body: (
            <p>
                You can review or update your details at any time from your profile, or
                contact us to request a copy or deletion of your personal information -
                subject to the order and tax records we are required to retain.
            </p>
        ),
    },
    {
        id: "contact",
        title: "Contact",
        body: (
            <p>
                For privacy questions or requests, contact{" "}
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

export default function PrivacyPage() {
    return (
        <LegalPage
            eyebrow="Legal"
            title="Privacy Policy"
            intro="How we collect, use, and protect the information you share with us."
            updated="August 2026"
            sections={sections}
        />
    );
}
