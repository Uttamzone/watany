"use client";

import {AnimatePresence, motion} from "framer-motion";
import {motionTokens, sec} from "@/lib/motion";

type ConfirmDialogProps = {
    open: boolean;
    title: string;
    description?: string;
    confirmLabel?: string;
    danger?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
};

/** Modal confirmation for destructive/irreversible admin actions. */
export function ConfirmDialog({
                                  open,
                                  title,
                                  description,
                                  confirmLabel = "Confirm",
                                  danger = false,
                                  onConfirm,
                                  onCancel,
                              }: ConfirmDialogProps) {
    return (
        <AnimatePresence>
            {open && (
                <div className="fixed inset-0 z-[60] grid place-items-center p-4">
                    <motion.div
                        initial={{opacity: 0}}
                        animate={{opacity: 1}}
                        exit={{opacity: 0}}
                        transition={{duration: sec(motionTokens.fast)}}
                        onClick={onCancel}
                        className="absolute inset-0 bg-teal-950/50"
                    />
                    <motion.div
                        role="alertdialog"
                        aria-modal="true"
                        aria-label={title}
                        initial={{opacity: 0, scale: 0.96, y: 8}}
                        animate={{opacity: 1, scale: 1, y: 0}}
                        exit={{opacity: 0, scale: 0.96, y: 8}}
                        transition={{duration: sec(motionTokens.base), ease: motionTokens.easeOut}}
                        className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-card"
                    >
                        <h2 className="text-[17px] font-extrabold text-teal-950">{title}</h2>
                        {description && <p className="mt-2 text-[14px] text-muted">{description}</p>}
                        <div className="mt-6 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={onCancel}
                                className="h-10 rounded-full px-4 text-[13px] font-bold text-teal-950 transition-colors hover:bg-soft-control"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={onConfirm}
                                className={`h-10 rounded-full px-4 text-[13px] font-bold text-white transition-opacity hover:opacity-90 ${
                                    danger ? "bg-coral" : "bg-teal-950"
                                }`}
                            >
                                {confirmLabel}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
