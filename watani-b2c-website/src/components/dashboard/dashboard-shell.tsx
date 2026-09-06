"use client";

import Link from "next/link";
import Image from "next/image";
import {usePathname, useRouter} from "next/navigation";
import {useEffect, useRef, useState} from "react";
import {AnimatePresence, motion} from "framer-motion";
import {
    Boxes,
    ChevronsUpDown,
    Database,
    FileText,
    FolderTree,
    Globe,
    LayoutDashboard,
    LogOut,
    Menu,
    Package,
    ScrollText,
    ShoppingBag,
    Star,
    Tag,
    Truck,
    UserCircle,
    UserCog,
    Users,
    X,
} from "lucide-react";
import {useAuth} from "@/components/auth/auth-store";
import {isAdminRole, type Permission, permissionsForRoles} from "@/lib/admin/permissions";
import {motionTokens, sec} from "@/lib/motion";

type NavItem = {
    href: string;
    label: string;
    icon: typeof LayoutDashboard;
    permission?: Permission;
};

const ADMIN_NAV_ITEMS: NavItem[] = [
    {href: "/admin", label: "Dashboard", icon: LayoutDashboard, permission: "REPORT_READ"},
    {href: "/admin/orders", label: "Orders", icon: ShoppingBag, permission: "ORDER_READ"},
    {href: "/admin/customers", label: "Customers", icon: Users, permission: "CUSTOMER_READ"},
    {href: "/admin/catalogue", label: "Catalogue", icon: Package, permission: "CATALOGUE_READ"},
    {href: "/admin/categories", label: "Categories", icon: FolderTree, permission: "CATALOGUE_READ"},
    {href: "/admin/stock", label: "Stock", icon: Boxes, permission: "INVENTORY_WRITE"},
    {href: "/admin/master-data", label: "Master data Setup", icon: Database, permission: "CATALOGUE_READ"},
    {href: "/admin/logistics", label: "Logistics Hub", icon: Truck, permission: "ORDER_READ"},
    {href: "/admin/coupons", label: "Coupons", icon: Tag, permission: "CATALOGUE_READ"},
    {href: "/admin/reviews", label: "Reviews", icon: Star, permission: "REVIEW_MODERATE"},
    {href: "/admin/content", label: "Content Pages", icon: FileText, permission: "CATALOGUE_READ"},
    {href: "/admin/audit", label: "Audit log", icon: ScrollText, permission: "AUDIT_READ"},
];

const CUSTOMER_NAV_ITEMS: NavItem[] = [
    {href: "/portal/profile", label: "Profile", icon: UserCircle},
    {href: "/portal/orders", label: "My Orders", icon: ShoppingBag},
];

const WEBSITE_NAV_ITEM: NavItem = {href: "/", label: "Website", icon: Globe};

// Website link opens in a new tab to avoid bleeding admin auth state into storefront
const WEBSITE_HREF = typeof window !== "undefined" ? window.location.origin : "/";

const STAFF_NAV_ITEM: NavItem = {href: "/admin/staff", label: "Staff", icon: UserCog, permission: "STAFF_READ"};

const ROLE_LABELS: Record<string, string> = {
    SUPER_ADMIN: "Super Admin",
    CATALOGUE_MANAGER: "Catalogue Manager",
    ORDER_MANAGER: "Order Manager",
    SUPPORT: "Support",
};

function initials(email: string, firstName?: string | null, lastName?: string | null) {
    if (firstName || lastName) {
        return `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase() || email[0]?.toUpperCase();
    }
    return email[0]?.toUpperCase() ?? "?";
}

/**
 * Single dashboard shell shared by /admin and /portal - the nav items shown depend on the
 * signed-in user's roles, but the shell itself is the same for admins and customers.
 */
export function DashboardShell({children}: { children: React.ReactNode }) {
    const {user, logout} = useAuth();
    const pathname = usePathname();
    const router = useRouter();
    const [navOpen, setNavOpen] = useState(false);

    // Escape closes; body scroll is locked while the drawer covers the page.
    useEffect(() => {
        if (!navOpen) return;

        function onKey(event: KeyboardEvent) {
            if (event.key === "Escape") setNavOpen(false);
        }

        document.addEventListener("keydown", onKey);
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", onKey);
            document.body.style.overflow = previousOverflow;
        };
    }, [navOpen]);

    if (!user) return null;

    const admin = isAdminRole(user.roles);
    const permissions = permissionsForRoles(user.roles);
    const navItems = admin
        ? ADMIN_NAV_ITEMS.filter((item) => !item.permission || permissions.has(item.permission))
        : CUSTOMER_NAV_ITEMS;
    const homeHref = admin ? "/admin" : "/portal/profile";

    async function handleLogout() {
        await logout();
        router.push("/");
    }

    // Rendered twice (persistent sidebar + mobile drawer) from one definition;
    // `inDrawer` only adds the close affordance.
    const renderSidebar = (inDrawer: boolean) => (
        <>
            <div className="flex items-center justify-between px-6 py-6">
                <Link href={homeHref} className="block" aria-label="Watany - Palestinian Products">
                    <Image
                        src="/logo/watany-logo.png"
                        alt="Watany - Palestinian Products"
                        width={435}
                        height={373}
                        priority={!inDrawer}
                        className="h-auto w-[132px]"
                    />
                </Link>
                {inDrawer && (
                    <button
                        type="button"
                        onClick={() => setNavOpen(false)}
                        aria-label="Close menu"
                        className="grid size-9 shrink-0 place-items-center rounded-xl text-teal-950 transition-colors hover:bg-soft-control"
                    >
                        <X className="size-5" aria-hidden/>
                    </button>
                )}
            </div>

            <nav className="flex-1 space-y-1 px-3">
                {navItems.map((item) => {
                    const active =
                        item.href === "/admin" || item.href === "/"
                            ? pathname === item.href
                            : pathname.startsWith(item.href);
                    const Icon = item.icon;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setNavOpen(false)}
                            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-semibold transition-colors ${
                                active ? "bg-teal-950 text-white" : "text-teal-950 hover:bg-soft-control"
                            }`}
                        >
                            <Icon className="size-4.5" aria-hidden/>
                            {item.label}
                        </Link>
                    );
                })}
            </nav>

            <div className="border-t border-black/5 p-3">
                <a
                    href="/"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setNavOpen(false)}
                    className="mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-semibold transition-colors text-teal-950 hover:bg-soft-control"
                >
                    <Globe className="size-4.5" aria-hidden/>
                    {WEBSITE_NAV_ITEM.label}
                    <span className="ml-auto text-[11px] opacity-40">↗</span>
                </a>
                {admin && permissions.has("STAFF_READ") && (
                    <Link
                        href={STAFF_NAV_ITEM.href}
                        onClick={() => setNavOpen(false)}
                        className={`mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-semibold transition-colors ${
                            pathname.startsWith(STAFF_NAV_ITEM.href) ? "bg-teal-950 text-white" : "text-teal-950 hover:bg-soft-control"
                        }`}
                    >
                        <UserCog className="size-4.5" aria-hidden/>
                        {STAFF_NAV_ITEM.label}
                    </Link>
                )}
                <UserCard onLogout={handleLogout} onNavigate={() => setNavOpen(false)}/>
            </div>
        </>
    );

    const sidebar = renderSidebar(false);

    return (
        <div className="flex h-screen">
            {/* Persistent sidebar from lg up; below that it becomes the drawer. */}
            <aside
                className="hidden h-full w-64 shrink-0 flex-col overflow-y-auto border-r border-black/5 bg-white lg:flex">
                {sidebar}
            </aside>

            <AnimatePresence>
                {navOpen && (
                    <div className="fixed inset-0 z-50 lg:hidden">
                        <motion.div
                            initial={{opacity: 0}}
                            animate={{opacity: 1}}
                            exit={{opacity: 0}}
                            transition={{duration: sec(motionTokens.fast)}}
                            onClick={() => setNavOpen(false)}
                            className="absolute inset-0 bg-teal-950/45"
                        />
                        <motion.div
                            role="dialog"
                            aria-modal="true"
                            aria-label="Dashboard menu"
                            initial={{x: "-100%"}}
                            animate={{x: 0}}
                            exit={{x: "-100%"}}
                            transition={{duration: sec(motionTokens.base), ease: motionTokens.easeOut}}
                            className="absolute inset-y-0 left-0 flex w-[min(288px,84vw)] flex-col overflow-y-auto bg-white"
                        >
                            {renderSidebar(true)}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <div className="flex h-full min-w-0 flex-1 flex-col">
                {/* Mobile top bar - the drawer's only trigger. */}
                <div className="flex h-14 shrink-0 items-center gap-3 border-b border-black/5 bg-white px-4 lg:hidden">
                    <button
                        type="button"
                        onClick={() => setNavOpen(true)}
                        aria-haspopup="dialog"
                        aria-expanded={navOpen}
                        aria-label="Open menu"
                        className="grid size-10 shrink-0 place-items-center rounded-xl text-teal-950 transition-colors hover:bg-soft-control"
                    >
                        <Menu className="size-5" aria-hidden/>
                    </button>
                    <Link href={homeHref} className="flex items-center" aria-label="Watany - Palestinian Products">
                        {/* Near-square lockup (435x373) - size by height so it fits the bar
                rather than overflowing it, which sizing by width does. */}
                        <Image
                            src="/logo/watany-logo.png"
                            alt="Watany - Palestinian Products"
                            width={435}
                            height={373}
                            className="h-9 w-auto"
                        />
                    </Link>
                </div>

                <main className="min-w-0 flex-1 overflow-y-auto bg-canvas p-4 sm:p-6 lg:p-8">
                    <div className="mx-auto max-w-6xl">{children}</div>
                </main>
            </div>
        </div>
    );
}

/** Account card anchoring a popover with account links and logout - mirrors the storefront AccountMenu pattern. */
function UserCard({onLogout, onNavigate}: { onLogout: () => void; onNavigate?: () => void }) {
    const {user} = useAuth();
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;

        function onKey(event: KeyboardEvent) {
            if (event.key === "Escape") setOpen(false);
        }

        function onPointerDown(event: PointerEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        }

        document.addEventListener("keydown", onKey);
        document.addEventListener("pointerdown", onPointerDown);
        return () => {
            document.removeEventListener("keydown", onKey);
            document.removeEventListener("pointerdown", onPointerDown);
        };
    }, [open]);

    if (!user) return null;

    const displayName =
        user.firstName || user.lastName ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() : user.email;
    const primaryRole = user.roles[0];
    const admin = isAdminRole(user.roles);

    const CUSTOMER_TIER_LABEL: Record<string, string> = {
        RETAIL: "Retail Customer",
        WHOLESALE: "Wholesale Customer",
        DISTRIBUTOR: "Distributor",
        ADMIN: "Administrator",
    };

    const subtitle = admin
        ? (primaryRole ? ROLE_LABELS[primaryRole] ?? primaryRole : "Administrator")
        : (CUSTOMER_TIER_LABEL[user.pricingGroup] || (user.pricingGroup === "DISTRIBUTOR" ? "Distributor" : "Customer"));

    return (
        <div ref={containerRef} className="relative">
            <AnimatePresence>
                {open && (
                    <motion.div
                        role="menu"
                        aria-label="Account menu"
                        initial={{opacity: 0, scale: 0.96, y: 6}}
                        animate={{opacity: 1, scale: 1, y: 0}}
                        exit={{opacity: 0, scale: 0.96, y: 6}}
                        transition={{duration: sec(motionTokens.fast), ease: motionTokens.easeOut}}
                        className="absolute inset-x-0 bottom-[calc(100%+8px)] z-50 overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-black/5"
                    >
                        <div className="flex items-center gap-3 px-4 py-3.5">
              <span
                  className="grid size-10 shrink-0 place-items-center rounded-full bg-teal-950 text-[13px] font-bold text-white">
                {initials(user.email, user.firstName, user.lastName)}
              </span>
                            <div className="min-w-0">
                                <p className="truncate text-[14px] font-bold text-teal-950">{displayName}</p>
                                <p className="truncate text-[12px] text-muted">{user.email}</p>
                                <p className="mt-0.5 inline-block rounded-full bg-soft-control px-2 py-0.5 text-[11px] font-semibold text-teal-900">
                                    {subtitle}
                                </p>
                            </div>
                        </div>

                        <div className="h-px bg-black/5"/>

                        <nav className="p-2">
                            <Link
                                href="/portal/profile"
                                role="menuitem"
                                onClick={() => {
                                    setOpen(false);
                                    onNavigate?.();
                                }}
                                className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-semibold text-teal-950 transition-colors hover:bg-soft-control"
                            >
                                <UserCircle className="size-4" aria-hidden/>
                                My account
                            </Link>
                            <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                    setOpen(false);
                                    onLogout();
                                }}
                                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] font-semibold text-coral transition-colors hover:bg-soft-control"
                            >
                                <LogOut className="size-4" aria-hidden/>
                                Log out
                            </button>
                        </nav>
                    </motion.div>
                )}
            </AnimatePresence>

            <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                aria-haspopup="menu"
                aria-expanded={open}
                className={`flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors ${
                    open ? "bg-soft-control" : "hover:bg-soft-control"
                }`}
            >
        <span
            className="grid size-9 shrink-0 place-items-center rounded-full bg-lime-500/30 text-[12px] font-bold text-teal-950 ring-2 ring-white">
          {initials(user.email, user.firstName, user.lastName)}
        </span>
                <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-bold text-teal-950">{displayName}</span>
          <span className="block truncate text-[11px] font-medium text-muted">
            {subtitle}
          </span>
        </span>
                <ChevronsUpDown className="size-4 shrink-0 text-muted" aria-hidden/>
            </button>
        </div>
    );
}
