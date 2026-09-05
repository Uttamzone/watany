import type {Metadata} from "next";
import {OrdersView} from "./orders-view";

export const metadata: Metadata = {
    title: "My Orders",
    description: "Track the status of your Watani & Sons orders.",
};

export default function PortalOrdersPage() {
    return <OrdersView/>;
}
