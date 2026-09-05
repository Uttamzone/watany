import type {Metadata} from "next";
import {WishlistView} from "@/components/wishlist/wishlist-view";

export const metadata: Metadata = {
    title: "Your wishlist",
    description: "Products you've saved for later at Watani & Sons.",
};

export default function WishlistPage() {
    return (
        <div className="shell pt-8">
            <h1 className="text-[30px] font-extrabold text-teal-950 sm:text-[38px]">
                Your wishlist
            </h1>
            <WishlistView/>
        </div>
    );
}
