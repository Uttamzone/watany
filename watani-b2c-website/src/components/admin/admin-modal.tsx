"use client";

import {AnimatePresence, motion} from "framer-motion";
import {useEffect} from "react";
import {motionTokens, sec} from "@/lib/motion";

type AdminModalProps = {
    open: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    /** Defaults to max-w-md; wider editors (e.g. content blocks) pass max-w-lg. */
    widthClassName?: string;
};

/**
 * Shared overlay shell for admin/portal editor forms - same backdrop/motion/dismiss
 * behaviour as ConfirmDialog, reused by every "New X"/"Edit X" form.
 */
export function AdminModal({open, onClose, title, children, widthClassName = "max-w-md"}: AdminModalProps) {
    useEffect(() => {
        if (!open) return;

        function onKey(event: KeyboardEvent) {
            if (event.key === "Escape") onClose();
        }

        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    return (
        <AnimatePresence>
            {open && (
                <div className="fixed inset-0 z-50 grid place-items-center p-4">
                    <motion.div
                        initial={{opacity: 0}}
                        animate={{opacity: 1}}
                        exit={{opacity: 0}}
                        transition={{duration: sec(motionTokens.fast)}}
                        onClick={onClose}
                        className="absolute inset-0 bg-teal-950/50"
                    />
                    <motion.div
                        role="dialog"
                        aria-modal="true"
                        aria-label={title}
                        initial={{opacity: 0, scale: 0.96, y: 8}}
                        animate={{opacity: 1, scale: 1, y: 0}}
                        exit={{opacity: 0, scale: 0.96, y: 8}}
                        transition={{duration: sec(motionTokens.base), ease: motionTokens.easeOut}}
                        className={`relative max-h-[85vh] w-full overflow-y-auto rounded-2xl bg-white p-6 shadow-card ${widthClassName}`}
                    >
                        {children}
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}

/** Shared input/select styling for admin editor forms - one definition instead of each form re-typing the same className string. */
export const adminFieldClass =
    "h-10 w-full rounded-xl border border-black/10 px-3 text-[14px] outline-none transition-colors focus:border-teal-800";

export const adminFieldLabelClass = "mb-1 block text-[12px] font-semibold text-muted";
