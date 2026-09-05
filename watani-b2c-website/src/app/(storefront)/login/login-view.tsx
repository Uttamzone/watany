"use client";

import {useState, useEffect, useRef} from "react";
import {createPortal} from "react-dom";
import Image from "next/image";
import Link from "next/link";
import Script from "next/script";
import {useRouter, useSearchParams} from "next/navigation";
import {motion} from "framer-motion";
import {Eye, EyeOff} from "lucide-react";
import {useAuth} from "@/components/auth/auth-store";
import {useNotifications} from "@/components/notifications/notification-store";
import {ApiError} from "@/lib/api";
import type {PricingGroup} from "@/lib/auth";
import {motionTokens, sec} from "@/lib/motion";

declare global {
    interface Window {
        google?: any;
    }
}

type Mode = "login" | "register";

const ROLE_OPTIONS: { value: PricingGroup; label: string; hint: string }[] = [
    {value: "RETAIL", label: "Retail Customer", hint: "Shop at standard retail pricing."},
    {value: "WHOLESALE", label: "Wholesale Customer", hint: "Apply for wholesale pricing - subject to admin approval."},
    {value: "DISTRIBUTOR", label: "Distributor", hint: "Apply for distributor pricing - subject to admin approval."},
];

export function LoginView() {
    const [mode, setMode] = useState<Mode>("login");
    const router = useRouter();
    const searchParams = useSearchParams();
    const nextPath = searchParams.get("next") || "/";

    function onLoginSuccess() {
        router.push(nextPath);
    }

    // New accounts are never admin, so `next` may point into /admin - land
    // signups on the homepage instead.
    function onRegisterSuccess() {
        router.push("/");
    }

    return (
        <div className="mx-auto max-w-md">
            <div className="mb-6 flex rounded-full bg-soft-control p-1">
                {(["login", "register"] as const).map((value) => (
                    <button
                        key={value}
                        type="button"
                        onClick={() => setMode(value)}
                        className={`relative flex-1 rounded-full py-2.5 text-[14px] font-bold transition-colors ${
                            mode === value ? "text-white" : "text-teal-950"
                        }`}
                    >
                        {mode === value && (
                            <motion.span
                                layoutId="login-tab-pill"
                                transition={{duration: sec(motionTokens.base), ease: motionTokens.easeOut}}
                                className="absolute inset-0 rounded-full bg-teal-950"
                            />
                        )}
                        <span className="relative z-10">
              {value === "login" ? "Log in" : "Create account"}
            </span>
                    </button>
                ))}
            </div>

            {mode === "login" ? <LoginForm onSuccess={onLoginSuccess}/> : <RegisterForm onSuccess={onRegisterSuccess}/>}
        </div>
    );
}

function FieldError({message}: { message?: string }) {
    if (!message) return null;
    return <p className="mt-1 text-[13px] font-medium text-coral">{message}</p>;
}

function inputClass(hasError: boolean) {
    return `h-12 w-full rounded-xl border px-4 text-[15px] outline-none transition-colors focus:border-teal-800 ${
        hasError ? "border-coral" : "border-black/10"
    }`;
}

function GoogleIcon() {
    return (
        <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
        </svg>
    );
}

function GoogleAuthModal({
    isOpen,
    onClose,
    onSelectEmail,
    loading,
}: {
    isOpen: boolean;
    onClose: () => void;
    onSelectEmail: (email: string) => Promise<void>;
    loading: boolean;
}) {
    const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
    const [customEmail, setCustomEmail] = useState("");
    const [showCustomInput, setShowCustomInput] = useState(false);
    const [error, setError] = useState("");
    const [savedAccounts, setSavedAccounts] = useState<Array<{ name: string; email: string; avatarBg: string; initial: string }>>([]);
    const gisModalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isOpen) {
            setSelectedEmail(null);
            setCustomEmail("");
            setShowCustomInput(false);
            setError("");
        } else {
            try {
                const stored = localStorage.getItem("watani_device_google_accounts");
                if (stored) {
                    const parsed = JSON.parse(stored);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        setSavedAccounts(parsed);
                        setShowCustomInput(false);
                    } else {
                        setSavedAccounts([]);
                        setShowCustomInput(true);
                    }
                } else {
                    setSavedAccounts([]);
                    setShowCustomInput(true);
                }
            } catch (e) {
                setSavedAccounts([]);
                setShowCustomInput(true);
            }

            // Render Google official button directly inside modal if available
            setTimeout(() => {
                if (window.google?.accounts?.id && gisModalRef.current) {
                    try {
                        gisModalRef.current.innerHTML = "";
                        window.google.accounts.id.renderButton(gisModalRef.current, {
                            type: "standard",
                            theme: "outline",
                            size: "large",
                            width: 320,
                            text: "continue_with",
                            shape: "pill",
                            logo_alignment: "left",
                        });
                    } catch (e) {}
                }
            }, 100);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    function handleAccountChoose(email: string) {
        setSelectedEmail(email);
    }

    function saveAccountToDevice(email: string) {
        try {
            const cleanEmail = email.trim().toLowerCase();
            const parts = cleanEmail.split("@")[0].split(".");
            const firstName = parts[0] ? parts[0].charAt(0).toUpperCase() + parts[0].slice(1) : "Google";
            const lastName = parts[1] ? parts[1].charAt(0).toUpperCase() + parts[1].slice(1) : "User";
            const name = `${firstName} ${lastName}`;
            const initial = firstName.charAt(0).toUpperCase() || "G";

            const bgColors = ["bg-[#1a73e8]", "bg-[#0f9d58]", "bg-[#ea4335]", "bg-[#fbbc05]", "bg-[#673ab7]"];
            const charSum = cleanEmail.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
            const avatarBg = bgColors[Math.abs(charSum) % bgColors.length];

            const existing = savedAccounts.filter((acc) => acc.email.toLowerCase() !== cleanEmail);
            const updated = [{ name, email: cleanEmail, avatarBg, initial }, ...existing];
            setSavedAccounts(updated);
            localStorage.setItem("watani_device_google_accounts", JSON.stringify(updated));
        } catch (e) {
            // Ignore storage errors
        }
    }

    function removeAccountFromDevice(email: string, e: React.MouseEvent) {
        e.stopPropagation();
        const updated = savedAccounts.filter((acc) => acc.email.toLowerCase() !== email.toLowerCase());
        setSavedAccounts(updated);
        try {
            localStorage.setItem("watani_device_google_accounts", JSON.stringify(updated));
        } catch (e) {}
        if (updated.length === 0) {
            setShowCustomInput(true);
        }
    }

    async function handleCustomSubmit(e?: React.FormEvent) {
        if (e) e.preventDefault();
        if (!customEmail || !/^\S+@\S+\.\S+$/.test(customEmail)) {
            setError("Enter a valid Google email address.");
            return;
        }
        setError("");
        setSelectedEmail(customEmail.trim());
    }

    async function handleConfirmPermission() {
        if (!selectedEmail) return;
        saveAccountToDevice(selectedEmail);
        await onSelectEmail(selectedEmail);
    }

    const modalContent = (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px] animate-fade-in font-sans">
            <div className="relative w-full max-w-[448px] overflow-hidden rounded-[28px] bg-white shadow-[0_12px_32px_rgba(0,0,0,0.18)] transition-all border border-[#dadce0]">
                {/* STEP 1: OFFICIAL GOOGLE ACCOUNT CHOOSER */}
                {!selectedEmail ? (
                    <div className="p-8">
                        {/* Header: Google Logo + Title */}
                        <div className="flex flex-col items-center text-center">
                            <GoogleIcon />
                            <h2 className="mt-4 text-[24px] font-normal leading-tight text-[#202124]">
                                Sign in with Google
                            </h2>
                            <p className="mt-2 text-[14px] text-[#5f6368]">
                                to continue to <span className="font-medium text-[#202124]">Watani &amp; Sons Corp</span>
                            </p>
                        </div>

                        {/* Official Google GIS Native Account Button */}
                        <div className="mt-6 flex flex-col items-center justify-center">
                            <div ref={gisModalRef} className="min-h-[44px] flex items-center justify-center"></div>
                        </div>

                        {/* Device Account List */}
                        <div className="mt-4 divide-y divide-[#f1f3f4] border-t border-b border-[#f1f3f4]">
                            {savedAccounts.map((acc) => (
                                <div
                                    key={acc.email}
                                    className="group flex w-full items-center justify-between py-3.5 px-2 text-left transition-colors hover:bg-[#f8f9fa] active:bg-[#f1f3f4] rounded-xl cursor-pointer"
                                    onClick={() => handleAccountChoose(acc.email)}
                                >
                                    <div className="flex items-center gap-4 min-w-0">
                                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white font-medium text-[15px] ${acc.avatarBg}`}>
                                            {acc.initial}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[14px] font-medium text-[#202124] truncate">{acc.name}</p>
                                            <p className="text-[12px] text-[#5f6368] truncate">{acc.email}</p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        title="Remove account from device"
                                        onClick={(e) => removeAccountFromDevice(acc.email, e)}
                                        className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200/60 transition-all"
                                    >
                                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                                        </svg>
                                    </button>
                                </div>
                            ))}

                            {!showCustomInput ? (
                                <button
                                    type="button"
                                    onClick={() => setShowCustomInput(true)}
                                    className="flex w-full items-center gap-4 py-3.5 px-2 text-left transition-colors hover:bg-[#f8f9fa] active:bg-[#f1f3f4] rounded-xl"
                                >
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f1f3f4] text-[#5f6368]">
                                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
                                        </svg>
                                    </div>
                                    <span className="text-[14px] font-medium text-[#3c4043]">
                                        {savedAccounts.length > 0 ? "Use another account" : "Enter your Google account"}
                                    </span>
                                </button>
                            ) : (
                                <div
                                    className="py-4 space-y-3"
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault();
                                            void handleCustomSubmit();
                                        }
                                    }}
                                >
                                    <div>
                                        <label className="block text-[12px] font-medium text-[#5f6368] mb-1">
                                            Enter your Google / Gmail address on this device:
                                        </label>
                                        <input
                                            type="email"
                                            required
                                            autoFocus
                                            placeholder="your-name@gmail.com"
                                            value={customEmail}
                                            onChange={(e) => setCustomEmail(e.target.value)}
                                            className="w-full rounded-md border border-[#dadce0] px-3.5 py-2.5 text-[14px] outline-none focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8]"
                                        />
                                        {error && <p className="mt-1 text-[12px] text-[#d93025] font-medium">{error}</p>}
                                    </div>
                                    <div className="flex justify-end gap-2 pt-1">
                                        {savedAccounts.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => setShowCustomInput(false)}
                                                className="px-4 py-2 text-[14px] font-medium text-[#1a73e8] hover:bg-[#f8f9fa] rounded-md"
                                            >
                                                Back
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => void handleCustomSubmit()}
                                            className="rounded-md bg-[#1a73e8] px-5 py-2 text-[14px] font-medium text-white hover:bg-[#1557b0]"
                                        >
                                            Next
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Google Disclaimer */}
                        <div className="mt-6 text-center text-[12px] leading-normal text-[#5f6368]">
                            To continue, Google will share your name, email address, language preference, and profile picture with Watani &amp; Sons Corp.
                        </div>

                        <div className="mt-6 flex justify-center border-t border-[#f1f3f4] pt-4">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={loading}
                                className="px-4 py-2 text-[14px] font-medium text-[#5f6368] hover:text-[#202124]"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : (
                    /* STEP 2: OFFICIAL GOOGLE OAUTH 2.0 CONSENT SCREEN */
                    <div className="p-8">
                        {/* Top Header */}
                        <div className="flex items-center justify-between pb-4 border-b border-[#f1f3f4]">
                            <div className="flex items-center gap-2">
                                <GoogleIcon />
                                <span className="text-[14px] font-medium text-[#202124]">Google</span>
                            </div>
                            <div className="flex items-center gap-2 rounded-full border border-[#dadce0] px-3 py-1 bg-[#f8f9fa]">
                                <span className="h-2 w-2 rounded-full bg-[#1e8e3e]" />
                                <span className="text-[12px] font-medium text-[#3c4043] truncate max-w-[160px]">
                                    {selectedEmail}
                                </span>
                            </div>
                        </div>

                        {/* Title & Scopes */}
                        <div className="mt-6 space-y-4">
                            <h3 className="text-[20px] font-normal leading-snug text-[#202124]">
                                Watani &amp; Sons Corp wants access to your Google Account
                            </h3>
                            
                            <p className="text-[13px] text-[#5f6368]">
                                This will allow Watani &amp; Sons Corp to:
                            </p>

                            <div className="rounded-xl border border-[#dadce0] bg-[#f8f9fa] p-4 space-y-3">
                                <div className="flex items-start gap-3">
                                    <svg className="h-5 w-5 shrink-0 text-[#1a73e8] mt-0.5" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                                    </svg>
                                    <div>
                                        <p className="text-[13px] font-medium text-[#202124]">See your primary Google Account email address</p>
                                        <p className="text-[12px] text-[#5f6368]">{selectedEmail}</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3 border-t border-[#e0e0e0] pt-3">
                                    <svg className="h-5 w-5 shrink-0 text-[#1a73e8] mt-0.5" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                                    </svg>
                                    <div>
                                        <p className="text-[13px] font-medium text-[#202124]">See your personal info</p>
                                        <p className="text-[12px] text-[#5f6368]">Includes profile name and language preferences</p>
                                    </div>
                                </div>
                            </div>

                            <p className="text-[12px] leading-relaxed text-[#5f6368]">
                                Make sure you trust Watani &amp; Sons Corp. You may be sharing sensitive info with this site or app.
                            </p>
                        </div>

                        {/* Consent Actions */}
                        <div className="mt-8 flex items-center justify-end gap-3 pt-4 border-t border-[#f1f3f4]">
                            <button
                                type="button"
                                onClick={() => setSelectedEmail(null)}
                                disabled={loading}
                                className="px-5 py-2.5 text-[14px] font-medium text-[#1a73e8] hover:bg-[#f8f9fa] rounded-full transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={loading}
                                onClick={() => void handleConfirmPermission()}
                                className="flex items-center gap-2 rounded-full bg-[#1a73e8] px-6 py-2.5 text-[14px] font-medium text-white shadow-sm hover:bg-[#1557b0] active:bg-[#174ea6] disabled:opacity-60 transition-all"
                            >
                                {loading ? (
                                    <>
                                        <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                        <span>Connecting…</span>
                                    </>
                                ) : (
                                    <span>Allow &amp; Sign in</span>
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    if (typeof document === "undefined") return null;
    return createPortal(modalContent, document.body);
}

function GoogleSignInButton({
    onSuccess,
    requestedGroup,
}: {
    onSuccess: () => void;
    requestedGroup?: PricingGroup;
}) {
    const {loginWithGoogle} = useAuth();
    const notifications = useNotifications();
    const [loading, setLoading] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);

    function initGoogleGsi() {
        if (typeof window === "undefined" || !window.google?.accounts?.id) return;
        const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "726108565852-2cn7ffo6gq5gbfl1ogi55j47uljb57h1.apps.googleusercontent.com";

        try {
            window.google.accounts.id.initialize({
                client_id: clientId,
                use_fedcm_for_prompt: false,
                callback: async (response: { credential?: string }) => {
                    if (!response.credential) return;
                    setLoading(true);
                    try {
                        const base64Url = response.credential.split(".")[1];
                        const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
                        const jsonPayload = decodeURIComponent(
                            atob(base64)
                                .split("")
                                .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
                                .join("")
                        );
                        const payload = JSON.parse(jsonPayload);

                        const email = payload.email;
                        const firstName = payload.given_name || payload.name?.split(" ")[0] || "Google";
                        const lastName = payload.family_name || payload.name?.split(" ")[1] || "User";

                        await loginWithGoogle({
                            email,
                            firstName,
                            lastName,
                            googleId: payload.sub,
                            requestedGroup,
                        });
                        notifications.success("Signed in with Google", `Welcome, ${email}`);
                        onSuccess();
                    } catch (error: any) {
                        notifications.error("Google sign in failed", error?.message || "Authentication failed.");
                    } finally {
                        setLoading(false);
                    }
                },
                auto_select: false,
                cancel_on_tap_outside: true,
            });
        } catch (e) {
            console.warn("Google GIS init:", e);
        }
    }

    useEffect(() => {
        if (typeof window !== "undefined" && window.google?.accounts?.id) {
            initGoogleGsi();
        }
    }, []);

    function triggerGooglePopup() {
        const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "726108565852-2cn7ffo6gq5gbfl1ogi55j47uljb57h1.apps.googleusercontent.com";

        // Try Google GIS OAuth2 Token Client if Client ID is available
        if (typeof window !== "undefined" && window.google?.accounts?.oauth2) {
            try {
                const client = window.google.accounts.oauth2.initTokenClient({
                    client_id: clientId,
                    scope: "openid email profile",
                    prompt: "select_account",
                    error_callback: (err: any) => {
                        console.warn("Google OAuth popup error:", err);
                        setModalOpen(true);
                    },
                    callback: async (tokenResponse: any) => {
                        if (tokenResponse && tokenResponse.access_token) {
                            setLoading(true);
                            try {
                                const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
                                    headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
                                });
                                const googleUser = await res.json();
                                if (googleUser && googleUser.email) {
                                    await loginWithGoogle({
                                        email: googleUser.email,
                                        firstName: googleUser.given_name || "Google",
                                        lastName: googleUser.family_name || "User",
                                        googleId: googleUser.sub,
                                        requestedGroup,
                                    });
                                    notifications.success("Signed in with Google", `Welcome, ${googleUser.email}`);
                                    onSuccess();
                                    return;
                                }
                            } catch (e: any) {
                                notifications.error("Google sign in failed", e?.message || "Failed to authenticate.");
                            } finally {
                                setLoading(false);
                            }
                        }
                    },
                });
                client.requestAccessToken({ prompt: "select_account" });
                return;
            } catch (e) {
                console.warn("OAuth2 initTokenClient error:", e);
            }
        }

        // Fallback directly to Account Selection Modal
        setModalOpen(true);
    }

    async function handleSelectGoogleAccount(selectedEmail: string) {
        setLoading(true);
        try {
            const cleanEmail = selectedEmail.trim();
            const parts = cleanEmail.split("@")[0].split(".");
            const firstName = parts[0] ? parts[0].charAt(0).toUpperCase() + parts[0].slice(1) : "Google";
            const lastName = parts[1] ? parts[1].charAt(0).toUpperCase() + parts[1].slice(1) : "User";

            await loginWithGoogle({
                email: cleanEmail,
                firstName,
                lastName,
                requestedGroup,
            });
            notifications.success("Signed in with Google", `Welcome, ${cleanEmail}`);
            setModalOpen(false);
            onSuccess();
        } catch (error) {
            if (error instanceof ApiError) {
                notifications.error("Google sign in failed", error.message);
            } else if (error instanceof Error) {
                notifications.error("Google sign in failed", error.message);
            } else {
                notifications.error("Google sign in failed", "Could not complete Google authentication.");
            }
        } finally {
            setLoading(false);
        }
    }

    return (
        <>
            <Script
                src="https://accounts.google.com/gsi/client"
                strategy="afterInteractive"
                onLoad={initGoogleGsi}
            />

            <button
                type="button"
                onClick={triggerGooglePopup}
                disabled={loading}
                className="flex h-12 w-full items-center justify-center gap-3 rounded-full border border-[#dadce0] bg-white px-4 text-[14px] font-medium text-[#3c4043] shadow-sm transition-all hover:bg-[#f8f9fa] hover:shadow active:bg-[#f1f3f4] disabled:opacity-60"
            >
                <GoogleIcon />
                <span>{loading ? "Connecting to Google…" : "Sign in with Google"}</span>
            </button>

            <GoogleAuthModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                onSelectEmail={handleSelectGoogleAccount}
                loading={loading}
            />
        </>
    );
}

function PasswordInput({
    id,
    value,
    onChange,
    hasError,
    autoComplete,
    minLength,
}: {
    id: string;
    value: string;
    onChange: (value: string) => void;
    hasError: boolean;
    autoComplete: string;
    minLength?: number;
}) {
    const [show, setShow] = useState(false);

    return (
        <div className="relative">
            <input
                id={id}
                type={show ? "text" : "password"}
                autoComplete={autoComplete}
                minLength={minLength}
                required
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className={`${inputClass(hasError)} pr-11`}
            />
            <button
                type="button"
                onClick={() => setShow((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-teal-950"
                aria-label={show ? "Hide password" : "Show password"}
            >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
        </div>
    );
}

const COUNTRY_CODES = [
    { code: "+91", label: "🇮🇳 +91 (India)" },
    { code: "+1", label: "🇨🇦/🇺🇸 +1 (Canada/US)" },
    { code: "+44", label: "🇬🇧 +44 (UK)" },
    { code: "+971", label: "🇦🇪 +971 (UAE)" },
    { code: "+966", label: "🇸🇦 +966 (Saudi)" },
    { code: "+61", label: "🇦🇺 +61 (Australia)" },
];

function PhoneInput({
    countryCode,
    onCountryCodeChange,
    phoneDigits,
    onPhoneDigitsChange,
    hasError,
}: {
    countryCode: string;
    onCountryCodeChange: (code: string) => void;
    phoneDigits: string;
    onPhoneDigitsChange: (digits: string) => void;
    hasError: boolean;
}) {
    return (
        <div className="flex gap-2">
            <select
                value={countryCode}
                onChange={(e) => onCountryCodeChange(e.target.value)}
                className="h-11 rounded-xl border border-black/10 bg-soft-control px-2 text-[13px] font-bold text-teal-950 outline-none transition-colors focus:border-teal-800"
            >
                {COUNTRY_CODES.map((c) => (
                    <option key={c.code} value={c.code}>
                        {c.label}
                    </option>
                ))}
            </select>
            <input
                id="reg-phone"
                type="tel"
                value={phoneDigits}
                onChange={(event) => {
                    const cleaned = event.target.value.replace(/\D/g, "").slice(0, 10);
                    onPhoneDigitsChange(cleaned);
                }}
                placeholder="10-digit mobile number"
                maxLength={10}
                className={`h-11 flex-1 rounded-xl border bg-soft-control px-4 text-[14px] text-teal-950 outline-none transition-colors placeholder:text-muted focus:bg-white ${
                    hasError ? "border-coral focus:border-coral" : "border-black/10 focus:border-teal-800"
                }`}
            />
        </div>
    );
}

function LoginForm({onSuccess}: { onSuccess: () => void }) {
    const {login} = useAuth();
    const notifications = useNotifications();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

    async function handleSubmit(event: React.FormEvent) {
        event.preventDefault();
        setFieldErrors({});
        setSubmitting(true);
        try {
            await login(email, password);
            onSuccess();
        } catch (error) {
            if (error instanceof ApiError) {
                setFieldErrors(error.fieldErrors ?? {});
                if (!error.fieldErrors || Object.keys(error.fieldErrors).length === 0) {
                    notifications.error("Log in failed", error.message);
                }
            } else if (error instanceof Error) {
                notifications.error("Log in failed", error.message);
            } else {
                notifications.error("Log in failed", "Something went wrong. Please try again.");
            }
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4 rounded-3xl bg-white p-6 shadow-card sm:p-8">
            <h1 className="text-[22px] font-extrabold text-teal-950">Welcome back</h1>

            <div>
                <label htmlFor="login-email" className="mb-1.5 block text-[13px] font-semibold text-teal-950">
                    Email or User ID
                </label>
                <input
                    id="login-email"
                    type="text"
                    autoComplete="username"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className={inputClass(Boolean(fieldErrors.email))}
                />
                <FieldError message={fieldErrors.email}/>
            </div>

            <div>
                <div className="mb-1.5 flex items-center justify-between">
                    <label htmlFor="login-password" className="block text-[13px] font-semibold text-teal-950">
                        Password
                    </label>
                    <Link href="/forgot-password" className="text-[13px] font-semibold text-teal-800 hover:underline">
                        Forgot password?
                    </Link>
                </div>
                <PasswordInput
                    id="login-password"
                    autoComplete="current-password"
                    value={password}
                    onChange={setPassword}
                    hasError={Boolean(fieldErrors.password)}
                />
                <FieldError message={fieldErrors.password}/>
            </div>

            <button
                type="submit"
                disabled={submitting}
                className="h-12 w-full rounded-full bg-lime-500 text-[15px] font-bold text-teal-950 transition-opacity disabled:opacity-60"
            >
                {submitting ? "Logging in…" : "Log in"}
            </button>

            <div className="relative my-4 flex items-center justify-center">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-black/10"></div></div>
                <span className="relative bg-white px-3 text-[12px] font-semibold uppercase text-muted">Or</span>
            </div>

            <GoogleSignInButton onSuccess={onSuccess} />
        </form>
    );
}

function RegisterForm({onSuccess}: { onSuccess: () => void }) {
    const {register} = useAuth();
    const notifications = useNotifications();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [countryCode, setCountryCode] = useState("+91");
    const [phoneDigits, setPhoneDigits] = useState("");
    const [role, setRole] = useState<PricingGroup>("RETAIL");
    const [companyName, setCompanyName] = useState("");
    const [taxId, setTaxId] = useState("");
    const [businessLicenceRef, setBusinessLicenceRef] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

    const isBusiness = role !== "RETAIL";

    function validate(): Record<string, string> {
        const errors: Record<string, string> = {};
        if (!/^\S+@\S+\.\S+$/.test(email)) errors.email = "Enter a valid email address.";
        if (password.length < 10) errors.password = "Password must be at least 10 characters.";
        if (phoneDigits && phoneDigits.length !== 10) errors.phone = "Mobile number must be exactly 10 digits.";
        return errors;
    }

    async function handleSubmit(event: React.FormEvent) {
        event.preventDefault();
        const clientErrors = validate();
        if (Object.keys(clientErrors).length > 0) {
            setFieldErrors(clientErrors);
            return;
        }
        setFieldErrors({});
        setSubmitting(true);
        try {
            const fullPhone = phoneDigits ? `${countryCode} ${phoneDigits}` : undefined;
            await register({
                email,
                password,
                firstName: firstName || undefined,
                lastName: lastName || undefined,
                phone: fullPhone,
                requestedGroup: role,
                companyName: isBusiness ? companyName || undefined : undefined,
                taxId: isBusiness ? taxId || undefined : undefined,
                businessLicenceRef: isBusiness ? businessLicenceRef || undefined : undefined,
            });
            onSuccess();
        } catch (error) {
            if (error instanceof ApiError) {
                setFieldErrors(error.fieldErrors ?? {});
                if (!error.fieldErrors || Object.keys(error.fieldErrors).length === 0) {
                    notifications.error("Registration failed", error.message);
                }
            } else if (error instanceof Error) {
                notifications.error("Registration failed", error.message);
            } else {
                notifications.error("Registration failed", "Something went wrong. Please try again.");
            }
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4 rounded-3xl bg-white p-6 shadow-card sm:p-8">
            <h1 className="text-[22px] font-extrabold text-teal-950">Create your account</h1>

            <fieldset className="space-y-2">
                <legend className="mb-1.5 text-[13px] font-semibold text-teal-950">Account type</legend>
                <div className="grid gap-2">
                    {ROLE_OPTIONS.map((option) => (
                        <label
                            key={option.value}
                            className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-colors ${
                                role === option.value ? "border-teal-800 bg-soft-control" : "border-black/10"
                            }`}
                        >
                            <input
                                type="radio"
                                name="role"
                                value={option.value}
                                checked={role === option.value}
                                onChange={() => setRole(option.value)}
                                className="mt-1"
                            />
                            <span>
                <span className="block text-[14px] font-bold text-teal-950">{option.label}</span>
                <span className="block text-[12px] text-muted">{option.hint}</span>
              </span>
                        </label>
                    ))}
                </div>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
                <div>
                    <label htmlFor="reg-first-name" className="mb-1.5 block text-[13px] font-semibold text-teal-950">
                        First name
                    </label>
                    <input
                        id="reg-first-name"
                        value={firstName}
                        onChange={(event) => setFirstName(event.target.value)}
                        className={inputClass(false)}
                    />
                </div>
                <div>
                    <label htmlFor="reg-last-name" className="mb-1.5 block text-[13px] font-semibold text-teal-950">
                        Last name
                    </label>
                    <input
                        id="reg-last-name"
                        value={lastName}
                        onChange={(event) => setLastName(event.target.value)}
                        className={inputClass(false)}
                    />
                </div>
            </div>

            <div>
                <label htmlFor="reg-email" className="mb-1.5 block text-[13px] font-semibold text-teal-950">
                    Email
                </label>
                <input
                    id="reg-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className={inputClass(Boolean(fieldErrors.email))}
                />
                <FieldError message={fieldErrors.email}/>
            </div>

            <div>
                <label htmlFor="reg-phone" className="mb-1.5 block text-[13px] font-semibold text-teal-950">
                    Mobile Phone Number
                </label>
                <PhoneInput
                    countryCode={countryCode}
                    onCountryCodeChange={setCountryCode}
                    phoneDigits={phoneDigits}
                    onPhoneDigitsChange={setPhoneDigits}
                    hasError={Boolean(fieldErrors.phone)}
                />
                <FieldError message={fieldErrors.phone}/>
                {!fieldErrors.phone && (
                    <p className="mt-1 text-[12px] text-muted">10-digit mobile number with country code.</p>
                )}
            </div>

            <div>
                <label htmlFor="reg-password" className="mb-1.5 block text-[13px] font-semibold text-teal-950">
                    Password
                </label>
                <PasswordInput
                    id="reg-password"
                    autoComplete="new-password"
                    minLength={10}
                    value={password}
                    onChange={setPassword}
                    hasError={Boolean(fieldErrors.password)}
                />
                <FieldError message={fieldErrors.password}/>
                {!fieldErrors.password && (
                    <p className="mt-1 text-[12px] text-muted">At least 10 characters.</p>
                )}
            </div>

            {isBusiness && (
                <div className="space-y-4 rounded-xl bg-soft-control p-4">
                    <p className="text-[13px] font-semibold text-teal-950">Business details</p>
                    <div>
                        <label htmlFor="reg-company" className="mb-1.5 block text-[13px] font-semibold text-teal-950">
                            Company name
                        </label>
                        <input
                            id="reg-company"
                            value={companyName}
                            onChange={(event) => setCompanyName(event.target.value)}
                            className={inputClass(false)}
                        />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label htmlFor="reg-tax-id"
                                   className="mb-1.5 block text-[13px] font-semibold text-teal-950">
                                Tax / VAT ID
                            </label>
                            <input
                                id="reg-tax-id"
                                value={taxId}
                                onChange={(event) => setTaxId(event.target.value)}
                                className={inputClass(false)}
                            />
                        </div>
                        <div>
                            <label htmlFor="reg-licence"
                                   className="mb-1.5 block text-[13px] font-semibold text-teal-950">
                                Business licence ref.
                            </label>
                            <input
                                id="reg-licence"
                                value={businessLicenceRef}
                                onChange={(event) => setBusinessLicenceRef(event.target.value)}
                                className={inputClass(false)}
                            />
                        </div>
                    </div>
                </div>
            )}

            <button
                type="submit"
                disabled={submitting}
                className="h-12 w-full rounded-full bg-lime-500 text-[15px] font-bold text-teal-950 transition-opacity disabled:opacity-60"
            >
                {submitting ? "Creating account…" : "Create account"}
            </button>

            <div className="relative my-4 flex items-center justify-center">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-black/10"></div></div>
                <span className="relative bg-white px-3 text-[12px] font-semibold uppercase text-muted">Or</span>
            </div>

            <GoogleSignInButton onSuccess={onSuccess} requestedGroup={role} />
        </form>
    );
}
