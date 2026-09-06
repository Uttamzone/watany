"use client";

import Link from "next/link";
import {useRouter} from "next/navigation";
import {useState, useEffect, useRef} from "react";
import {AnimatePresence, motion} from "framer-motion";
import {Building2, LayoutDashboard, LogOut, Sparkles} from "lucide-react";
import {useAuth} from "@/components/auth/auth-store";
import {isAdminRole} from "@/lib/admin/permissions";
import {motionTokens, sec} from "@/lib/motion";
import {getUserInitials} from "@/lib/auth";
import {UpgradeAccountModal} from "@/components/auth/upgrade-account-modal";

const GROUP_LABELS: Record<string, string> = {
    RETAIL: "Retail Customer",
    WHOLESALE: "Wholesale Customer",
    DISTRIBUTOR: "Distributor",
};

/** Dropdown shown under the header avatar once a session is authenticated. */
export function AccountMenu({open, onClose}: { open: boolean; onClose: () => void }) {
    const {user, logout} = useAuth();
    const router = useRouter();
    const panelRef = useRef<HTMLDivElement>(null);
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);

    useEffect(() => {
        if (!open) return;

        function onKey(event: KeyboardEvent) {
            if (event.key === "Escape") onClose();
        }

        function onPointerDown(event: PointerEvent) {
            if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
                onClose();
            }
        }

        document.addEventListener("keydown", onKey);
        document.addEventListener("pointerdown", onPointerDown);
        return () => {
            document.removeEventListener("keydown", onKey);
            document.removeEventListener("pointerdown", onPointerDown);
        };
    }, [open, onClose]);

    async function handleLogout() {
        onClose();
        await logout();
        router.push("/");
    }

    if (!user) return null;

    return (
        <>
            <AnimatePresence>
                {open && (
                    <motion.div
                        ref={panelRef}
                        role="menu"
                        aria-label="Account menu"
                        initial={{opacity: 0, scale: 0.96, y: -6}}
                        animate={{opacity: 1, scale: 1, y: 0}}
                        exit={{opacity: 0, scale: 0.96, y: -6}}
                        transition={{duration: sec(motionTokens.fast), ease: motionTokens.easeOut}}
                        className="absolute right-0 top-[calc(100%+12px)] z-50 w-72 overflow-hidden rounded-2xl bg-white text-text shadow-card"
                    >
                        <div className="flex items-center gap-3 border-b border-black/5 px-5 py-4">
                <span
                    className="grid size-10 shrink-0 place-items-center rounded-full bg-lime-500 text-[13px] font-bold text-teal-950">
                  {getUserInitials(user)}
                </span>
                            <div className="min-w-0">
                                <p className="truncate text-[15px] font-bold text-teal-950">
                                    {user.firstName || user.lastName
                                        ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim()
                                        : user.email}
                                </p>
                                <p className="truncate text-xs text-muted">{user.email}</p>
                                <p className="mt-1 inline-block rounded-full bg-soft-control px-2 py-0.5 text-[11px] font-semibold text-teal-900">
                                    {GROUP_LABELS[user.pricingGroup] ?? user.pricingGroup}
                                    {user.approvalStatus === "PENDING" && " · Approval pending"}
                                </p>
                            </div>
                        </div>

                        <nav className="p-2 space-y-1">
                            <Link
                                href="/portal/profile"
                                role="menuitem"
                                onClick={onClose}
                                className="block rounded-xl px-3 py-2.5 text-[14px] font-semibold text-teal-950 transition-colors hover:bg-soft-control"
                            >
                                My Profile
                            </Link>

                            {!isAdminRole(user.roles) && user.pricingGroup !== "ADMIN" && user.pricingGroup !== "DISTRIBUTOR" && user.pricingGroup === "RETAIL" && (
                                <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => {
                                        setShowUpgradeModal(true);
                                    }}
                                    className="flex w-full items-center gap-2 rounded-xl bg-lime-500/15 px-3 py-2.5 text-left text-[13px] font-bold text-teal-950 transition-colors hover:bg-lime-500/25"
                                >
                                    <Building2 className="size-4 text-teal-900 shrink-0" aria-hidden />
                                    <span className="flex-1 truncate">
                                        {user.approvalStatus === "PENDING"
                                            ? "Wholesale (Pending)"
                                            : "Apply for Wholesale"}
                                    </span>
                                    <Sparkles className="size-3.5 text-lime-700 shrink-0" aria-hidden />
                                </button>
                            )}

                            <Link
                                href="/portal/orders"
                                role="menuitem"
                                onClick={onClose}
                                className="block rounded-xl px-3 py-2.5 text-[14px] font-semibold text-teal-950 transition-colors hover:bg-soft-control"
                            >
                                My Orders
                            </Link>

                            {isAdminRole(user.roles) && (
                                <Link
                                    href="/admin"
                                    role="menuitem"
                                    onClick={onClose}
                                    className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-[14px] font-semibold text-teal-950 transition-colors hover:bg-soft-control"
                                >
                                    <LayoutDashboard className="size-4" aria-hidden/>
                                    Dashboard
                                </Link>
                            )}

                            <button
                                type="button"
                                role="menuitem"
                                onClick={handleLogout}
                                className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[14px] font-semibold text-coral transition-colors hover:bg-soft-control"
                            >
                                <LogOut className="size-4" aria-hidden/>
                                Log out
                            </button>
                        </nav>
                    </motion.div>
                )}
            </AnimatePresence>

            <UpgradeAccountModal
                open={showUpgradeModal}
                onClose={() => {
                    setShowUpgradeModal(false);
                    onClose();
                }}
            />
        </>
    );
}
