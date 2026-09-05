import type {Metadata} from "next";
import {CartView} from "@/components/cart/cart-view";

export const metadata: Metadata = {
    title: "Your cart",
    description: "Review the Palestinian products in your Watani & Sons cart.",
};

export default function CartPage() {
    return (
        <div className="shell pt-8">
            <h1 className="text-[30px] font-extrabold text-teal-950 sm:text-[38px]">
                Your cart
            </h1>
            <CartView/>
        </div>
    );
}
