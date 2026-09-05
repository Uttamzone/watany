"use client";

import {Manrope} from "next/font/google";
import "../globals.css";
import {useEffect} from "react";
import {usePathname, useRouter} from "next/navigation";
import {AuthProvider, useAuth} from "@/components/auth/auth-store";
import {NotificationProvider} from "@/components/notifications/notification-store";
import {NotificationViewport} from "@/components/notifications/notification-viewport";
import {DashboardShell} from "@/components/dashboard/dashboard-shell";
import {firstAccessibleAdminRoute, isAdminRole, permissionsForRoles, routePermission} from "@/lib/admin/permissions";

const manrope = Manrope({
    variable: "--font-manrope",
    subsets: ["latin"],
    weight: ["400", "500", "600", "700", "800"],
    display: "swap",
});

/**
 * Admin portal root layout - sibling root to `(storefront)/layout.tsx`, not nested
 * under it, since the admin shell needs entirely different chrome (sidebar, no cart).
 */
export default function AdminLayout({children}: { children: React.ReactNode }) {
    return (
        <html lang="en" className={`${manrope.variable} h-full`}>
        <body className="admin-root h-full bg-canvas text-text antialiased">
        <NotificationProvider>
            <AuthProvider>
                <AdminGate>{children}</AdminGate>
            </AuthProvider>
            <NotificationViewport/>
        </NotificationProvider>
        </body>
        </html>
    );
}

function AdminGate({children}: { children: React.ReactNode }) {
    const {status, user} = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    const isLoginPage = pathname === "/admin/login";

    const required = routePermission(pathname);
    const hasAccess = !required || (user && permissionsForRoles(user.roles).has(required));

    useEffect(() => {
        if (isLoginPage) return;

        if (status === "guest") {
            router.replace("/admin/login");
        } else if (status === "authenticated" && (!user || !isAdminRole(user.roles))) {
            router.replace("/portal/profile");
        } else if (status === "authenticated" && user && !hasAccess) {
            router.replace(firstAccessibleAdminRoute(user.roles) ?? "/portal/profile");
        }
    }, [status, user, router, pathname, hasAccess, isLoginPage]);

    if (isLoginPage) {
        return <>{children}</>;
    }

    if (status === "loading") {
        return <div className="grid h-full min-h-screen place-items-center text-[14px] text-muted">Loading…</div>;
    }

    if (status === "guest" || !user || !isAdminRole(user.roles) || !hasAccess) {
        return <div className="grid h-full min-h-screen place-items-center text-[14px] text-muted">Redirecting…</div>;
    }

    return <DashboardShell>{children}</DashboardShell>;
}
