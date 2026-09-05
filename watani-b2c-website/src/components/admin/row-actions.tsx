"use client";

import {useEffect, useLayoutEffect, useRef, useState} from "react";
import {createPortal} from "react-dom";
import {AnimatePresence, motion} from "framer-motion";
import {Check, ChevronDown, MoreHorizontal} from "lucide-react";
import {motionTokens, sec} from "@/lib/motion";

export type RowSubAction = {
    label: string;
    onSelect: () => void;
    current?: boolean;
    disabled?: boolean;
};

export type RowAction = {
    label: string;
    icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
    onSelect?: () => void;
    tone?: "default" | "danger";
    disabled?: boolean;
    /** When present, the item opens a flyout submenu instead of firing onSelect directly. */
    items?: RowSubAction[];
};

const MENU_WIDTH = 208; // w-52
const SUBMENU_WIDTH = 192; // w-48
const MENU_GAP = 4;

type Placement = { top: number; left: number; openUp: boolean };

function computePlacement(anchor: DOMRect, menuWidth: number, estimatedHeight: number): Placement {
    const openUp = anchor.bottom + estimatedHeight + MENU_GAP > window.innerHeight && anchor.top > estimatedHeight;
    const top = openUp ? anchor.top - MENU_GAP : anchor.bottom + MENU_GAP;
    let left = anchor.right - menuWidth;
    left = Math.min(Math.max(left, 8), window.innerWidth - menuWidth - 8);
    return {top, left, openUp};
}

/** Kebab-menu row actions for admin tables. Portaled to document.body so it isn't clipped by table ancestors. */
export function RowActions({actions, label = "Row actions"}: { actions: RowAction[]; label?: string }) {
    const [open, setOpen] = useState(false);
    const [submenuFor, setSubmenuFor] = useState<string | null>(null);
    const [placement, setPlacement] = useState<Placement | null>(null);
    const [narrow, setNarrow] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    function close() {
        setOpen(false);
        setSubmenuFor(null);
    }

    useLayoutEffect(() => {
        if (!open || !triggerRef.current) return;
        const estimatedHeight = actions.length * 40 + 12;
        setPlacement(computePlacement(triggerRef.current.getBoundingClientRect(), MENU_WIDTH, estimatedHeight));
        // Below this width a sideways submenu flyout can't fit on either side of the
        // main menu, so submenus render as an inline expansion instead (see below).
        setNarrow(window.innerWidth < MENU_WIDTH + SUBMENU_WIDTH + MENU_GAP * 3 + 16);
    }, [open, actions.length]);

    useEffect(() => {
        if (!open) return;

        function reposition() {
            if (triggerRef.current) {
                const estimatedHeight = actions.length * 40 + 12;
                setPlacement(computePlacement(triggerRef.current.getBoundingClientRect(), MENU_WIDTH, estimatedHeight));
            }
            setNarrow(window.innerWidth < MENU_WIDTH + SUBMENU_WIDTH + MENU_GAP * 3 + 16);
        }

        function onKey(event: KeyboardEvent) {
            if (event.key === "Escape") close();
        }

        function onPointerDown(event: PointerEvent) {
            const target = event.target as Node;
            if (
                triggerRef.current &&
                !triggerRef.current.contains(target) &&
                menuRef.current &&
                !menuRef.current.contains(target)
            ) {
                close();
            }
        }

        window.addEventListener("scroll", reposition, true);
        window.addEventListener("resize", reposition);
        document.addEventListener("keydown", onKey);
        document.addEventListener("pointerdown", onPointerDown);
        return () => {
            window.removeEventListener("scroll", reposition, true);
            window.removeEventListener("resize", reposition);
            document.removeEventListener("keydown", onKey);
            document.removeEventListener("pointerdown", onPointerDown);
        };
    }, [open, actions.length]);

    if (actions.length === 0) return null;

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                onClick={() => setOpen((value) => !value)}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label={label}
                className={`grid size-8 shrink-0 place-items-center rounded-lg transition-colors ${
                    open ? "bg-soft-control text-teal-950" : "text-muted hover:bg-soft-control hover:text-teal-950"
                }`}
            >
                <MoreHorizontal className="size-4.5" aria-hidden/>
            </button>

            {typeof document !== "undefined" &&
                createPortal(
                    <AnimatePresence>
                        {open && placement && (
                            <motion.div
                                ref={menuRef}
                                role="menu"
                                aria-label={label}
                                initial={{opacity: 0, scale: 0.96, y: placement.openUp ? 4 : -4}}
                                animate={{opacity: 1, scale: 1, y: 0}}
                                exit={{opacity: 0, scale: 0.96, y: placement.openUp ? 4 : -4}}
                                transition={{duration: sec(motionTokens.fast), ease: motionTokens.easeOut}}
                                style={{
                                    position: "fixed",
                                    top: placement.openUp ? undefined : placement.top,
                                    bottom: placement.openUp ? window.innerHeight - placement.top : undefined,
                                    left: placement.left,
                                    width: MENU_WIDTH,
                                    maxHeight: "calc(100vh - 16px)",
                                }}
                                className={`z-50 rounded-xl bg-white p-1.5 shadow-card ring-1 ring-black/5 ${narrow ? "overflow-y-auto" : "overflow-visible"}`}
                            >
                                {actions.map((action) => {
                                    const Icon = action.icon;
                                    const hasSubmenu = !!action.items?.length;
                                    const submenuOpen = submenuFor === action.label;
                                    const openSubmenuRight = placement.left - SUBMENU_WIDTH - MENU_GAP * 2 < 8;

                                    if (hasSubmenu) {
                                        const submenuItems = (
                                            <>
                                                {action.items!.map((sub) => (
                                                    <button
                                                        key={sub.label}
                                                        type="button"
                                                        role="menuitem"
                                                        disabled={sub.disabled}
                                                        aria-current={sub.current}
                                                        onClick={() => {
                                                            close();
                                                            sub.onSelect();
                                                        }}
                                                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-semibold text-teal-950 transition-colors hover:bg-soft-control disabled:cursor-not-allowed disabled:opacity-40"
                                                    >
                                <span className="grid size-4 shrink-0 place-items-center">
                                  {sub.current && <Check className="size-4 text-teal-800" aria-hidden/>}
                                </span>
                                                        {sub.label}
                                                    </button>
                                                ))}
                                            </>
                                        );

                                        return (
                                            <div key={action.label} className="relative">
                                                <button
                                                    type="button"
                                                    role="menuitem"
                                                    aria-haspopup="menu"
                                                    aria-expanded={submenuOpen}
                                                    disabled={action.disabled}
                                                    onClick={() => setSubmenuFor(submenuOpen ? null : action.label)}
                                                    className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                                                        submenuOpen ? "bg-soft-control text-teal-950" : "text-teal-950 hover:bg-soft-control"
                                                    }`}
                                                >
                                                    <Icon className="size-4 shrink-0" aria-hidden/>
                                                    <span className="flex-1">{action.label}</span>
                                                    <ChevronDown
                                                        className={`size-3.5 shrink-0 text-muted transition-transform ${
                                                            narrow && submenuOpen ? "rotate-180" : narrow ? "" : "-rotate-90"
                                                        }`}
                                                        aria-hidden
                                                    />
                                                </button>

                                                {narrow ? (
                                                    <AnimatePresence initial={false}>
                                                        {submenuOpen && (
                                                            <motion.div
                                                                role="menu"
                                                                aria-label={action.label}
                                                                initial={{height: 0, opacity: 0}}
                                                                animate={{height: "auto", opacity: 1}}
                                                                exit={{height: 0, opacity: 0}}
                                                                transition={{
                                                                    duration: sec(motionTokens.fast),
                                                                    ease: motionTokens.easeOut
                                                                }}
                                                                className="overflow-hidden pl-3"
                                                            >
                                                                <div className="mt-0.5 mb-1 space-y-0.5 border-l border-black/10 pl-2">
                                                                    {submenuItems}
                                                                </div>
                                                            </motion.div>
                                                        )}
                                                    </AnimatePresence>
                                                ) : (
                                                    <AnimatePresence>
                                                        {submenuOpen && (
                                                            <motion.div
                                                                role="menu"
                                                                aria-label={action.label}
                                                                initial={{
                                                                    opacity: 0,
                                                                    scale: 0.96,
                                                                    x: openSubmenuRight ? 4 : -4
                                                                }}
                                                                animate={{opacity: 1, scale: 1, x: 0}}
                                                                exit={{
                                                                    opacity: 0,
                                                                    scale: 0.96,
                                                                    x: openSubmenuRight ? 4 : -4
                                                                }}
                                                                transition={{
                                                                    duration: sec(motionTokens.fast),
                                                                    ease: motionTokens.easeOut
                                                                }}
                                                                className={`absolute top-0 z-50 w-48 overflow-hidden rounded-xl bg-white p-1.5 shadow-card ring-1 ring-black/5 ${
                                                                    openSubmenuRight ? "left-[calc(100%+6px)]" : "right-[calc(100%+6px)]"
                                                                }`}
                                                            >
                                                                {submenuItems}
                                                            </motion.div>
                                                        )}
                                                    </AnimatePresence>
                                                )}
                                            </div>
                                        );
                                    }

                                    return (
                                        <button
                                            key={action.label}
                                            type="button"
                                            role="menuitem"
                                            disabled={action.disabled}
                                            onClick={() => {
                                                close();
                                                action.onSelect?.();
                                            }}
                                            className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                                                action.tone === "danger"
                                                    ? "text-coral hover:bg-coral/10"
                                                    : "text-teal-950 hover:bg-soft-control"
                                            }`}
                                        >
                                            <Icon className="size-4" aria-hidden/>
                                            {action.label}
                                        </button>
                                    );
                                })}
                            </motion.div>
                        )}
                    </AnimatePresence>,
                    document.body,
                )}
        </>
    );
}
