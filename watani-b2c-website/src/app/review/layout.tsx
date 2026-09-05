import type {Metadata} from "next";
import {Manrope} from "next/font/google";
import "../globals.css";
import {NotificationProvider} from "@/components/notifications/notification-store";
import {NotificationViewport} from "@/components/notifications/notification-viewport";

const manrope = Manrope({
    variable: "--font-manrope",
    subsets: ["latin"],
    weight: ["400", "500", "600", "700", "800"],
    display: "swap",
});

export const metadata: Metadata = {
    title: "Rate your order · Watani & Sons",
    robots: {index: false, follow: false},
};

/**
 * Public "rate your order" root layout - sibling root to storefront/portal/admin.
 * No `AuthProvider` gate: reached via a tokenised link, must work signed-out.
 */
export default function ReviewLayout({children}: { children: React.ReactNode }) {
    return (
        <html lang="en" className={`${manrope.variable} h-full`}>
        <body className="min-h-full bg-canvas text-text antialiased">
        <NotificationProvider>
            <main className="mx-auto min-h-screen max-w-2xl px-4 py-10 sm:px-6">{children}</main>
            <NotificationViewport/>
        </NotificationProvider>
        </body>
        </html>
    );
}
