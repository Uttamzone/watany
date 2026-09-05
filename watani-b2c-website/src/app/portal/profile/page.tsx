import type {Metadata} from "next";
import {ProfileView} from "./profile-view";

export const metadata: Metadata = {
    title: "Profile",
    description: "View your Watani & Sons profile details.",
};

export default function PortalProfilePage() {
    return <ProfileView/>;
}
