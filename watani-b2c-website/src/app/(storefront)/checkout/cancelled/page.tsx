import type {Metadata} from "next";
import {CancelledView} from "@/components/checkout/cancelled-view";

export const metadata: Metadata = {
    title: "Payment cancelled",
    description: "Your Watani & Sons payment was not completed.",
    robots: {index: false, follow: false},
};

/**
 * Stripe Checkout return page for abandoned payments - cart stays intact.
 * Order stays unpaid and is cancelled (stock released) once the session expires.
 */
export default async function CancelledPage(
    props: PageProps<"/checkout/cancelled">,
) {
    const searchParams = await props.searchParams;
    const raw = searchParams.order;
    const orderNumber = Array.isArray(raw) ? raw[0] : raw;

    return (
        <div className="shell pt-8">
            <h1 className="text-[30px] font-extrabold text-teal-950 sm:text-[38px]">
                Payment cancelled
            </h1>

            <CancelledView orderNumber={orderNumber}/>
        </div>
    );
}
