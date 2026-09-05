"use client";

import {useState} from "react";
import Link from "next/link";
import {useRouter, useSearchParams} from "next/navigation";
import {Eye, EyeOff} from "lucide-react";
import {ApiError} from "@/lib/api";
import {resetPassword} from "@/lib/auth";

const MIN_PASSWORD_LENGTH = 10;

function inputClass(hasError: boolean) {
    return `h-12 w-full rounded-xl border px-4 text-[15px] outline-none transition-colors focus:border-teal-800 ${
        hasError ? "border-coral" : "border-black/10"
    }`;
}

function PasswordInput({
    id,
    value,
    onChange,
    hasError,
}: {
    id: string;
    value: string;
    onChange: (value: string) => void;
    hasError: boolean;
}) {
    const [visible, setVisible] = useState(false);

    return (
        <div className="relative">
            <input
                id={id}
                type={visible ? "text" : "password"}
                autoComplete="new-password"
                required
                minLength={MIN_PASSWORD_LENGTH}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className={`${inputClass(hasError)} pr-11`}
            />
            <button
                type="button"
                onClick={() => setVisible((prev) => !prev)}
                aria-label={visible ? "Hide password" : "Show password"}
                aria-pressed={visible}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-teal-950/60 transition-colors hover:text-teal-950"
            >
                {visible ? <EyeOff size={18}/> : <Eye size={18}/>}
            </button>
        </div>
    );
}

export function ResetPasswordView() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get("token") ?? "";

    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!token) {
        return (
            <div className="mx-auto max-w-md rounded-3xl bg-white p-6 text-center shadow-card sm:p-8">
                <h1 className="text-[22px] font-extrabold text-teal-950">Invalid reset link</h1>
                <p className="mt-2 text-[14px] text-muted">
                    This password reset link is missing or malformed. Request a new one to continue.
                </p>
                <Link href="/forgot-password" className="mt-6 inline-block text-[14px] font-semibold text-teal-800 hover:underline">
                    Request a new link
                </Link>
            </div>
        );
    }

    async function handleSubmit(event: React.FormEvent) {
        event.preventDefault();
        setError(null);

        if (newPassword.length < MIN_PASSWORD_LENGTH) {
            setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
            return;
        }
        if (newPassword !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        setSubmitting(true);
        try {
            await resetPassword(token, newPassword);
            router.push("/login");
        } catch (err) {
            setError(
                err instanceof ApiError
                    ? err.message
                    : "Something went wrong. Please try again.",
            );
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="mx-auto max-w-md">
            <form onSubmit={handleSubmit} className="space-y-4 rounded-3xl bg-white p-6 shadow-card sm:p-8">
                <h1 className="text-[22px] font-extrabold text-teal-950">Set a new password</h1>

                <div>
                    <label htmlFor="new-password" className="mb-1.5 block text-[13px] font-semibold text-teal-950">
                        New password
                    </label>
                    <PasswordInput id="new-password" value={newPassword} onChange={setNewPassword} hasError={Boolean(error)}/>
                    <p className="mt-1 text-[12px] text-muted">At least {MIN_PASSWORD_LENGTH} characters.</p>
                </div>

                <div>
                    <label htmlFor="confirm-password" className="mb-1.5 block text-[13px] font-semibold text-teal-950">
                        Confirm new password
                    </label>
                    <PasswordInput id="confirm-password" value={confirmPassword} onChange={setConfirmPassword} hasError={Boolean(error)}/>
                </div>

                {error && <p className="text-[13px] font-medium text-coral">{error}</p>}

                <button
                    type="submit"
                    disabled={submitting}
                    className="h-12 w-full rounded-full bg-lime-500 text-[15px] font-bold text-teal-950 transition-opacity disabled:opacity-60"
                >
                    {submitting ? "Updating…" : "Update password"}
                </button>
            </form>
        </div>
    );
}
