import type {Metadata} from "next";
import Link from "next/link";
import {ConfirmationView} from "@/components/checkout/confirmation-view";

export const metadata: Metadata = {
    title: "Order confirmed",
    description: "Your Watani & Sons order has been placed.",
    // An order confirmation must never be indexed.
    robots: {index: false, follow: false},
};

/**
 * Stripe Checkout return page after a completed payment.
 * Order number arrives as a query param, set by the backend in the success URL.
 */
export default async function ConfirmationPage(
    props: PageProps<"/checkout/confirmation">,
) {
    const searchParams = await props.searchParams;
    const raw = searchParams.order;
    const orderNumber = Array.isArray(raw) ? raw[0] : raw;

    if (!orderNumber) {
        return (
            <div className="shell pt-8">
                <h1 className="text-[30px] font-extrabold text-teal-950 sm:text-[38px]">
                    Order not found
                </h1>
                <p className="mt-3 text-[15px] text-muted">
                    We could not tell which order to show. If you have just paid, check
                    your email for the confirmation.
                </p>
                <Link
                    href="/account"
                    className="mt-6 inline-flex h-12 items-center rounded-full bg-lime-500 px-7 text-[15px] font-bold text-teal-950"
                >
                    View your orders
                </Link>
            </div>
        );
    }

    return (
        <div className="shell pt-8">
            <h1 className="text-center text-[30px] font-extrabold text-teal-950 sm:text-[38px]">
                Order confirmed
            </h1>
            <ConfirmationView orderNumber={orderNumber}/>
        </div>
    );
}
