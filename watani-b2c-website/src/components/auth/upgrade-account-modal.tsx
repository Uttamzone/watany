"use client";

import {useState} from "react";
import {Building2, CheckCircle2, ChevronRight, Loader2, ShieldCheck, Sparkles, X} from "lucide-react";
import {useAuth} from "@/components/auth/auth-store";
import {useNotifications} from "@/components/notifications/notification-store";
import {ApiError} from "@/lib/api";

interface UpgradeAccountModalProps {
    open: boolean;
    onClose: () => void;
    defaultGroup?: "WHOLESALE" | "DISTRIBUTOR";
}

export function UpgradeAccountModal({open, onClose, defaultGroup = "WHOLESALE"}: UpgradeAccountModalProps) {
    const {user, applyUpgradeRequest} = useAuth();
    const notifications = useNotifications();

    const [requestedGroup, setRequestedGroup] = useState<"WHOLESALE" | "DISTRIBUTOR">(defaultGroup);
    const [companyName, setCompanyName] = useState(user?.companyName ?? "");
    const [taxId, setTaxId] = useState(user?.taxId ?? "");
    const [businessLicenceRef, setBusinessLicenceRef] = useState(user?.businessLicenceRef ?? "");
    const [phone, setPhone] = useState(user?.phone ?? "");
    const [notes, setNotes] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

    if (!open) return null;

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        const errors: Record<string, string> = {};

        if (!companyName.trim()) {
            errors.companyName = "Company or business name is required.";
        }
        if (Object.keys(errors).length > 0) {
            setFieldErrors(errors);
            return;
        }

        setFieldErrors({});
        setSubmitting(true);

        try {
            await applyUpgradeRequest({
                requestedGroup,
                companyName: companyName.trim(),
                taxId: taxId.trim() || undefined,
                businessLicenceRef: businessLicenceRef.trim() || undefined,
                phone: phone.trim() || undefined,
                notes: notes.trim() || undefined,
            });

            notifications.success(
                "Application Submitted",
                `Your application for ${requestedGroup === "DISTRIBUTOR" ? "Distributor" : "Wholesale"} account has been submitted. Watani administration will review your details.`,
            );
            onClose();
        } catch (err) {
            if (err instanceof ApiError) {
                setFieldErrors(err.fieldErrors ?? {});
                notifications.error("Submission failed", err.message);
            } else if (err instanceof Error) {
                notifications.error("Submission failed", err.message);
            } else {
                notifications.error("Submission failed", "Failed to submit upgrade application. Please try again.");
            }
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-teal-950/60 backdrop-blur-xs transition-opacity"
                onClick={onClose}
                aria-hidden
            />

            {/* Dialog Container */}
            <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl transition-all sm:p-8">
                {/* Close Button */}
                <button
                    type="button"
                    onClick={onClose}
                    className="absolute right-5 top-5 grid size-9 place-items-center rounded-full text-muted transition-colors hover:bg-black/5 hover:text-teal-950"
                    aria-label="Close dialog"
                >
                    <X className="size-5" aria-hidden />
                </button>

                <div className="flex items-center gap-2 text-lime-600">
                    <Building2 className="size-5 text-lime-600" aria-hidden />
                    <span className="text-[12px] font-bold uppercase tracking-wider text-teal-900">
                        B2B Account Program
                    </span>
                </div>

                <h2 className="mt-1 text-[22px] font-extrabold text-teal-950 sm:text-[24px]">
                    Upgrade to Business Account
                </h2>
                <p className="mt-1 text-[13px] leading-relaxed text-muted">
                    Unlock wholesale tier pricing, case buying, and distributor payment options. Submit your business details below for admin approval.
                </p>

                <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                    {/* Account Type Selection */}
                    <div>
                        <label className="mb-1.5 block text-[13px] font-semibold text-teal-950">
                            Requested Account Type
                        </label>
                        <div className="grid gap-2.5 sm:grid-cols-2">
                            <label
                                className={`flex cursor-pointer flex-col rounded-2xl border p-3.5 transition-all ${
                                    requestedGroup === "WHOLESALE"
                                        ? "border-teal-800 bg-teal-950/[0.03] ring-1 ring-teal-800"
                                        : "border-black/10 hover:border-black/20"
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-[14px] font-bold text-teal-950">Wholesale</span>
                                    <input
                                        type="radio"
                                        name="requestedGroup"
                                        value="WHOLESALE"
                                        checked={requestedGroup === "WHOLESALE"}
                                        onChange={() => setRequestedGroup("WHOLESALE")}
                                        className="size-4 accent-teal-800"
                                    />
                                </div>
                                <p className="mt-1 text-[11px] text-muted">
                                    For retailers, grocers, and businesses buying by the case or box.
                                </p>
                                <span className="mt-2 text-[10px] font-bold uppercase tracking-wide text-teal-700">
                                    • Wholesale Pricing Tier
                                </span>
                            </label>

                            <label
                                className={`flex cursor-pointer flex-col rounded-2xl border p-3.5 transition-all ${
                                    requestedGroup === "DISTRIBUTOR"
                                        ? "border-teal-800 bg-teal-950/[0.03] ring-1 ring-teal-800"
                                        : "border-black/10 hover:border-black/20"
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-[14px] font-bold text-teal-950">Distributor</span>
                                    <input
                                        type="radio"
                                        name="requestedGroup"
                                        value="DISTRIBUTOR"
                                        checked={requestedGroup === "DISTRIBUTOR"}
                                        onChange={() => setRequestedGroup("DISTRIBUTOR")}
                                        className="size-4 accent-teal-800"
                                    />
                                </div>
                                <p className="mt-1 text-[11px] text-muted">
                                    For regional distributors with e-Transfer / Cheque offline payment terms.
                                </p>
                                <span className="mt-2 text-[10px] font-bold uppercase tracking-wide text-lime-700">
                                    • Cheque &amp; e-Transfer terms
                                </span>
                            </label>
                        </div>
                    </div>

                    {/* Business Name */}
                    <div>
                        <label htmlFor="modal-company-name" className="mb-1 block text-[13px] font-semibold text-teal-950">
                            Company or Business Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            id="modal-company-name"
                            type="text"
                            required
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            placeholder="e.g. Al-Quds Mediterranean Market"
                            className={`h-11 w-full rounded-xl border bg-white px-3.5 text-[14px] text-teal-950 outline-none transition-colors focus:border-teal-800 ${
                                fieldErrors.companyName ? "border-red-500" : "border-black/10"
                            }`}
                        />
                        {fieldErrors.companyName && (
                            <p className="mt-1 text-[11px] font-semibold text-red-500">{fieldErrors.companyName}</p>
                        )}
                    </div>

                    {/* Tax ID & Licence */}
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                            <label htmlFor="modal-tax-id" className="mb-1 block text-[13px] font-semibold text-teal-950">
                                Tax ID / Business No. (BN)
                            </label>
                            <input
                                id="modal-tax-id"
                                type="text"
                                value={taxId}
                                onChange={(e) => setTaxId(e.target.value)}
                                placeholder="e.g. 123456789 RT0001"
                                className="h-11 w-full rounded-xl border border-black/10 bg-white px-3.5 text-[14px] text-teal-950 outline-none transition-colors focus:border-teal-800"
                            />
                        </div>

                        <div>
                            <label htmlFor="modal-licence-ref" className="mb-1 block text-[13px] font-semibold text-teal-950">
                                Business Licence Ref.
                            </label>
                            <input
                                id="modal-licence-ref"
                                type="text"
                                value={businessLicenceRef}
                                onChange={(e) => setBusinessLicenceRef(e.target.value)}
                                placeholder="e.g. BL-2026-904"
                                className="h-11 w-full rounded-xl border border-black/10 bg-white px-3.5 text-[14px] text-teal-950 outline-none transition-colors focus:border-teal-800"
                            />
                        </div>
                    </div>

                    {/* Business Phone */}
                    <div>
                        <label htmlFor="modal-phone" className="mb-1 block text-[13px] font-semibold text-teal-950">
                            Business Phone
                        </label>
                        <input
                            id="modal-phone"
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="e.g. +1 613-854-7777"
                            className="h-11 w-full rounded-xl border border-black/10 bg-white px-3.5 text-[14px] text-teal-950 outline-none transition-colors focus:border-teal-800"
                        />
                    </div>

                    {/* Business Notes / Address */}
                    <div>
                        <label htmlFor="modal-notes" className="mb-1 block text-[13px] font-semibold text-teal-950">
                            Store Address, Website, or Expected Volume (Optional)
                        </label>
                        <textarea
                            id="modal-notes"
                            rows={2}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="e.g. Retail store located in Ottawa, expecting 5-10 cases monthly."
                            className="w-full rounded-xl border border-black/10 bg-white p-3 text-[13px] text-teal-950 outline-none transition-colors focus:border-teal-800"
                        />
                    </div>

                    {/* Informational callout */}
                    <div className="rounded-xl border border-teal-950/10 bg-soft-control p-3 text-[12px] text-teal-950">
                        <div className="flex items-center gap-1.5 font-bold text-teal-900">
                            <ShieldCheck className="size-4 text-teal-800" aria-hidden />
                            Admin Approval Process
                        </div>
                        <p className="mt-0.5 text-muted leading-relaxed">
                            Once submitted, an approval notification will be sent to Watani administration (<span className="font-semibold text-teal-950">info@wataniandsons.com</span>). Your account tier will update as soon as the request is approved.
                        </p>
                    </div>

                    {/* Buttons */}
                    <div className="mt-5 flex items-center justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={submitting}
                            className="h-11 rounded-full border border-black/10 px-5 text-[14px] font-bold text-teal-950 transition-colors hover:bg-black/5 disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-lime-500 px-6 text-[14px] font-bold text-teal-950 shadow-xs transition-transform hover:-translate-y-0.5 disabled:opacity-50"
                        >
                            {submitting ? (
                                <>
                                    <Loader2 className="size-4 animate-spin" aria-hidden />
                                    Submitting…
                                </>
                            ) : (
                                "Submit Application"
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
