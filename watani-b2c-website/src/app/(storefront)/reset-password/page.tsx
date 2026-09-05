import type {Metadata} from "next";
import {Suspense} from "react";
import {ResetPasswordView} from "./reset-password-view";

export const metadata: Metadata = {
    title: "Set a new password",
    description: "Set a new password for your Watani & Sons account.",
};

export default function ResetPasswordPage() {
    return (
        <div className="shell py-10 sm:py-16">
            <Suspense fallback={<div className="mx-auto h-[420px] max-w-md"/>}>
                <ResetPasswordView/>
            </Suspense>
        </div>
    );
}
