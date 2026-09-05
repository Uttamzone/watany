"use client";

import {createContext, useCallback, useContext, useMemo, useRef, useState,} from "react";

/** Global toast/notification system (mirrors CartProvider/AuthProvider's context convention). */

export type NotificationVariant = "success" | "error" | "warning" | "info";

export type Notification = {
    id: string;
    variant: NotificationVariant;
    title: string;
    description?: string;
    /** Milliseconds before auto-dismiss. Pass 0 to require manual dismissal. */
    duration?: number;
};

type NotifyInput = Omit<Notification, "id">;

type NotificationContextValue = {
    notifications: Notification[];
    notify: (input: NotifyInput) => string;
    dismiss: (id: string) => void;
    success: (title: string, description?: string, duration?: number) => string;
    error: (title: string, description?: string, duration?: number) => string;
    warning: (title: string, description?: string, duration?: number) => string;
    info: (title: string, description?: string, duration?: number) => string;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

const DEFAULT_DURATION = 5000;
const MAX_VISIBLE = 5;

export function NotificationProvider({children}: { children: React.ReactNode }) {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

    const dismiss = useCallback((id: string) => {
        setNotifications((current) => current.filter((item) => item.id !== id));
        const timer = timers.current.get(id);
        if (timer) {
            clearTimeout(timer);
            timers.current.delete(id);
        }
    }, []);

    const notify = useCallback(
        ({variant, title, description, duration = DEFAULT_DURATION}: NotifyInput) => {
            const id =
                typeof crypto !== "undefined" && "randomUUID" in crypto
                    ? crypto.randomUUID()
                    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

            setNotifications((current) => {
                // Oldest-first list capped to MAX_VISIBLE so the stack never grows
                // unbounded when a caller fires notifications in a tight loop.
                const next = [...current, {id, variant, title, description, duration}];
                return next.length > MAX_VISIBLE ? next.slice(next.length - MAX_VISIBLE) : next;
            });

            if (duration > 0) {
                const timer = setTimeout(() => dismiss(id), duration);
                timers.current.set(id, timer);
            }

            return id;
        },
        [dismiss],
    );

    const success = useCallback(
        (title: string, description?: string, duration?: number) =>
            notify({variant: "success", title, description, duration}),
        [notify],
    );
    const error = useCallback(
        (title: string, description?: string, duration?: number) =>
            notify({variant: "error", title, description, duration}),
        [notify],
    );
    const warning = useCallback(
        (title: string, description?: string, duration?: number) =>
            notify({variant: "warning", title, description, duration}),
        [notify],
    );
    const info = useCallback(
        (title: string, description?: string, duration?: number) =>
            notify({variant: "info", title, description, duration}),
        [notify],
    );

    const value = useMemo<NotificationContextValue>(
        () => ({notifications, notify, dismiss, success, error, warning, info}),
        [notifications, notify, dismiss, success, error, warning, info],
    );

    return (
        <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
    );
}

export function useNotifications(): NotificationContextValue {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error("useNotifications must be used inside a NotificationProvider");
    }
    return context;
}
