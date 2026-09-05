"use client";

import {AnimatePresence, motion} from "framer-motion";
import {AlertTriangle, CheckCircle2, Info, X, XCircle} from "lucide-react";
import {motionTokens, sec} from "@/lib/motion";
import {type Notification, type NotificationVariant, useNotifications,} from "./notification-store";

/** Bottom-right stackable toast viewport (design.md §11); mounted once per root layout. */

const VARIANT_STYLES: Record<
    NotificationVariant,
    { icon: typeof CheckCircle2; iconClass: string; accentClass: string }
> = {
    success: {
        icon: CheckCircle2,
        iconClass: "text-teal-800",
        accentClass: "bg-lime-500",
    },
    error: {
        icon: XCircle,
        iconClass: "text-coral",
        accentClass: "bg-coral",
    },
    warning: {
        icon: AlertTriangle,
        iconClass: "text-gold",
        accentClass: "bg-gold",
    },
    info: {
        icon: Info,
        iconClass: "text-navy",
        accentClass: "bg-navy",
    },
};

export function NotificationViewport() {
    const {notifications, dismiss} = useNotifications();

    return (
        <div
            aria-live="polite"
            aria-label="Notifications"
            className="pointer-events-none fixed inset-x-4 bottom-4 z-[100] flex flex-col items-end gap-2 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-[380px]"
        >
            <AnimatePresence initial={false}>
                {notifications.map((notification) => (
                    <NotificationCard
                        key={notification.id}
                        notification={notification}
                        onDismiss={() => dismiss(notification.id)}
                    />
                ))}
            </AnimatePresence>
        </div>
    );
}

function NotificationCard({
                              notification,
                              onDismiss,
                          }: {
    notification: Notification;
    onDismiss: () => void;
}) {
    const {icon: Icon, iconClass, accentClass} = VARIANT_STYLES[notification.variant];

    return (
        <motion.div
            layout
            initial={{opacity: 0, y: 16, scale: 0.96}}
            animate={{opacity: 1, y: 0, scale: 1}}
            exit={{opacity: 0, x: 32, scale: 0.96, transition: {duration: sec(motionTokens.fast)}}}
            transition={{duration: sec(motionTokens.base), ease: motionTokens.easeOut}}
            className="pointer-events-auto relative flex w-full items-start gap-3 overflow-hidden rounded-lg bg-surface p-4 pr-10 shadow-card-hover ring-1 ring-black/5"
            role="status"
        >
            <span className={`absolute inset-y-0 left-0 w-1 ${accentClass}`} aria-hidden/>
            <Icon className={`mt-0.5 size-5 shrink-0 ${iconClass}`} aria-hidden/>
            <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-text">{notification.title}</p>
                {notification.description ? (
                    <p className="mt-0.5 text-[13px] leading-snug text-muted">
                        {notification.description}
                    </p>
                ) : null}
            </div>
            <button
                type="button"
                onClick={onDismiss}
                aria-label="Dismiss notification"
                className="absolute right-3 top-3 rounded-md p-1 text-muted transition-colors hover:bg-soft-control hover:text-text"
            >
                <X className="size-4" aria-hidden/>
            </button>
        </motion.div>
    );
}
