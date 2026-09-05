"use client";

import {Manrope} from "next/font/google";
import "../globals.css";
import {useEffect} from "react";
import {usePathname, useRouter} from "next/navigation";
import {AuthProvider, useAuth} from "@/components/auth/auth-store";
import {NotificationProvider} from "@/components/notifications/notification-store";
import {NotificationViewport} from "@/components/notifications/notification-viewport";
import {DashboardShell} from "@/components/dashboard/dashboard-shell";

const manrope = Manrope({
    variable: "--font-manrope",
    subsets: ["latin"],
    weight: ["400", "500", "600", "700", "800"],
    display: "swap",
});

/**
 * Customer portal root layout - sibling root to `(storefront)/layout.tsx` and
 * `admin/layout.tsx`, using sidebar chrome instead of the storefront header/footer.
 */
export default function PortalLayout({children}: { children: React.ReactNode }) {
    return (
        <html lang="en" className={`${manrope.variable} h-full`}>
        <body className="admin-root h-full bg-canvas text-text antialiased">
        <NotificationProvider>
            <AuthProvider>
                <PortalGate>{children}</PortalGate>
            </AuthProvider>
            <NotificationViewport/>
        </NotificationProvider>
        </body>
        </html>
    );
}

function PortalGate({children}: { children: React.ReactNode }) {
    const {status} = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        if (status === "guest") {
            router.replace(`/login?next=${pathname}`);
        }
    }, [status, router, pathname]);

    if (status === "loading") {
        return <div className="grid h-full min-h-screen place-items-center text-[14px] text-muted">Loading…</div>;
    }

    if (status === "guest") {
        return <div className="grid h-full min-h-screen place-items-center text-[14px] text-muted">Redirecting…</div>;
    }

    return <DashboardShell>{children}</DashboardShell>;
}
