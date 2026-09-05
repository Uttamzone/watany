import type {Metadata} from "next";
import {CheckoutView} from "@/components/checkout/checkout-view";

export const metadata: Metadata = {
    title: "Checkout",
    description: "Complete your Watani & Sons order.",
    // Checkout must never be indexed or shared into search results.
    robots: {index: false, follow: false},
};

export default function CheckoutPage() {
    return (
        <div className="shell pt-8">
            <h1 className="text-[30px] font-extrabold text-teal-950 sm:text-[38px]">
                Checkout
            </h1>
            <CheckoutView/>
        </div>
    );
}
