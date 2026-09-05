import type {Metadata} from "next";
import {ForgotPasswordView} from "./forgot-password-view";

export const metadata: Metadata = {
    title: "Reset your password",
    description: "Request a password reset link for your Watani & Sons account.",
};

export default function ForgotPasswordPage() {
    return (
        <div className="shell py-10 sm:py-16">
            <ForgotPasswordView/>
        </div>
    );
}
