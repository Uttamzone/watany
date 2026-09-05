import type {Metadata} from "next";
import {Suspense} from "react";
import Link from "next/link";
import Image from "next/image";
import {LoginView} from "./login-view";

export const metadata: Metadata = {
    title: "Log in or create an account",
    description: "Log in to your Watani & Sons account, or register as a Retail, Wholesale, or Distributor customer.",
};

export default function LoginPage() {
    return (
        <div className="min-h-[85vh] flex flex-col">
            {/* Top-left corner of the web page header logo */}
            <div className="w-full px-6 py-6 sm:px-10 lg:px-16">
                <Link
                    href="/"
                    className="inline-block transition-opacity hover:opacity-80"
                    aria-label="Watani &amp; Sons - Back to home"
                >
                    <Image
                        src="/logo/watany-logo.png"
                        alt="Watani &amp; Sons Logo"
                        width={200}
                        height={65}
                        priority
                        className="h-12 w-auto object-contain sm:h-14"
                    />
                </Link>
            </div>

            {/* Login Box View */}
            <div className="shell flex-1 py-4 sm:py-8">
                <Suspense fallback={<div className="mx-auto h-[520px] max-w-md"/>}>
                    <LoginView/>
                </Suspense>
            </div>
        </div>
    );
}
