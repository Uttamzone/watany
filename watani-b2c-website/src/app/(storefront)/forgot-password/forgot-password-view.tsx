"use client";

import {useState} from "react";
import Link from "next/link";
import {ApiError} from "@/lib/api";
import {forgotPassword} from "@/lib/auth";

function inputClass(hasError: boolean) {
    return `h-12 w-full rounded-xl border px-4 text-[15px] outline-none transition-colors focus:border-teal-800 ${
        hasError ? "border-coral" : "border-black/10"
    }`;
}

export function ForgotPasswordView() {
    const [email, setEmail] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleSubmit(event: React.FormEvent) {
        event.preventDefault();
        setError(null);
        setSubmitting(true);
        try {
            await forgotPassword(email);
            setSubmitted(true);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
        } finally {
            setSubmitting(false);
        }
    }

    if (submitted) {
        return (
            <div className="mx-auto max-w-md rounded-3xl bg-white p-6 text-center shadow-card sm:p-8">
                <h1 className="text-[22px] font-extrabold text-teal-950">Check your email</h1>
                <p className="mt-2 text-[14px] text-muted">
                    If an account exists for <span className="font-semibold text-teal-950">{email}</span>, we&apos;ve
                    sent a link to reset your password. The link expires in 1 hour.
                </p>
                <Link href="/login" className="mt-6 inline-block text-[14px] font-semibold text-teal-800 hover:underline">
                    Back to log in
                </Link>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-md">
            <form onSubmit={handleSubmit} className="space-y-4 rounded-3xl bg-white p-6 shadow-card sm:p-8">
                <h1 className="text-[22px] font-extrabold text-teal-950">Reset your password</h1>
                <p className="text-[14px] text-muted">
                    Enter the email address on your account and we&apos;ll send you a link to reset your password.
                </p>

                <div>
                    <label htmlFor="forgot-email" className="mb-1.5 block text-[13px] font-semibold text-teal-950">
                        Email
                    </label>
                    <input
                        id="forgot-email"
                        type="email"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        className={inputClass(Boolean(error))}
                    />
                    {error && <p className="mt-1 text-[13px] font-medium text-coral">{error}</p>}
                </div>

                <button
                    type="submit"
                    disabled={submitting}
                    className="h-12 w-full rounded-full bg-lime-500 text-[15px] font-bold text-teal-950 transition-opacity disabled:opacity-60"
                >
                    {submitting ? "Sending…" : "Send reset link"}
                </button>

                <Link href="/login" className="block text-center text-[13px] font-semibold text-teal-800 hover:underline">
                    Back to log in
                </Link>
            </form>
        </div>
    );
}
