"use client";

import {useEffect, useState} from "react";
import {Building2, CheckCircle2, Clock, Mail, MapPin, Pencil, Phone, Plus, ShieldAlert, ShieldCheck, Sparkles, Star, Tag, Trash2, User, X} from "lucide-react";
import {useAuth} from "@/components/auth/auth-store";
import {useNotifications} from "@/components/notifications/notification-store";
import {ApiError} from "@/lib/api";
import {changePassword, getUserInitials, updateProfile} from "@/lib/auth";
import {UpgradeAccountModal} from "@/components/auth/upgrade-account-modal";
import {
    createMyAddress,
    deleteMyAddress,
    listMyAddresses,
    type SavedAddress,
    type SavedAddressPayload,
    updateMyAddress,
} from "@/lib/portal/api";
import {
    type AddressFieldName,
    COUNTRIES,
    hasRegionList,
    postalLabelFor,
    regionLabelFor,
    regionsFor,
    validateAddressField,
} from "@/lib/checkout";

const GROUP_LABELS: Record<string, string> = {
    RETAIL: "Retail Customer",
    WHOLESALE: "Wholesale Customer",
    DISTRIBUTOR: "Distributor",
};

const APPROVAL_LABELS: Record<string, string> = {
    NOT_REQUESTED: "Not applicable",
    PENDING: "Pending admin approval",
    APPROVED: "Approved",
    REJECTED: "Rejected",
};

export function ProfileView() {
    const {user} = useAuth();

    if (!user) {
        return <div className="h-64"/>;
    }

    const displayName = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email;

    return (
        <div>
            <div className="flex items-center gap-4">
        <span
            className="grid size-14 shrink-0 place-items-center rounded-full bg-lime-500/30 text-[18px] font-bold text-teal-950">
          {getUserInitials(user)}
        </span>
                <div>
                    <h1 className="text-[26px] font-extrabold text-teal-950">Profile</h1>
                    <p className="mt-0.5 text-[13px] text-muted">Manage your account details and security</p>
                </div>
            </div>

            <ProfileDetailsSection displayName={displayName}/>

            <B2BProgramSection/>

            <SavedAddressesSection/>

            <ChangePasswordSection/>
        </div>
    );
}

function SectionHeading({
                            icon: Icon,
                            title,
                            action,
                        }: {
    icon: typeof User;
    title: string;
    action?: React.ReactNode;
}) {
    return (
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-soft-control text-teal-950">
          <Icon className="size-4.5" aria-hidden/>
        </span>
                <h2 className="text-[16px] font-extrabold text-teal-950">{title}</h2>
            </div>
            {action}
        </div>
    );
}

function Row({icon: Icon, label, children}: { icon: typeof User; label: string; children: React.ReactNode }) {
    return (
        <div
            className="flex items-center gap-3 border-b border-black/5 py-4 first:pt-6 last:border-0 last:pb-0 sm:gap-4">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-soft-control text-teal-950">
        <Icon className="size-4" aria-hidden/>
      </span>
            {/* Label column is fixed from sm up so values align; below that it sizes
          to content, leaving the value room on a narrow screen. */}
            <span className="shrink-0 text-[13px] font-semibold text-muted sm:w-28">{label}</span>
            <div className="min-w-0 flex-1">{children}</div>
        </div>
    );
}

function ProfileDetailsSection({displayName}: { displayName: string }) {
    const {user, updateProfile} = useAuth();
    const notifications = useNotifications();
    const [editing, setEditing] = useState(false);
    const [firstName, setFirstName] = useState(user?.firstName ?? "");
    const [lastName, setLastName] = useState(user?.lastName ?? "");
    const [phone, setPhone] = useState(user?.phone ?? "");
    const [submitting, setSubmitting] = useState(false);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

    if (!user) return null;

    function startEditing() {
        setFirstName(user!.firstName ?? "");
        setLastName(user!.lastName ?? "");
        setPhone(user!.phone ?? "");
        setFieldErrors({});
        setEditing(true);
    }

    function cancelEditing() {
        setEditing(false);
        setFieldErrors({});
    }

    async function handleSubmit(event: React.FormEvent) {
        event.preventDefault();
        setFieldErrors({});
        setSubmitting(true);
        try {
            await updateProfile({
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                phone: phone.trim(),
            });
            notifications.success("Profile updated", "Your account details have been saved.");
            setEditing(false);
        } catch (error) {
            if (error instanceof ApiError) {
                setFieldErrors(error.fieldErrors ?? {});
                notifications.error("Couldn't update profile", error.message);
            } else {
                notifications.error("Couldn't update profile", "Something went wrong. Please try again.");
            }
        } finally {
            setSubmitting(false);
        }
    }

    const accountType = GROUP_LABELS[user.pricingGroup] ?? user.pricingGroup;
    const showApplicationStatus = user.requestedGroup && user.requestedGroup !== "RETAIL";

    return (
        <div className="mt-6 max-w-2xl rounded-2xl bg-white p-6 shadow-card sm:p-8">
            <SectionHeading
                icon={User}
                title="Account information"
                action={
                    editing ? (
                        <button
                            type="button"
                            onClick={cancelEditing}
                            disabled={submitting}
                            className="flex items-center gap-1.5 rounded-full border border-black/10 px-4 py-2 text-[13px] font-bold text-teal-950 transition-colors hover:bg-soft-control disabled:opacity-60"
                        >
                            <X className="size-3.5" aria-hidden/>
                            Cancel
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={startEditing}
                            className="flex items-center gap-1.5 rounded-full border border-teal-950/15 px-4 py-2 text-[13px] font-bold text-teal-950 transition-colors hover:bg-soft-control"
                        >
                            <Pencil className="size-3.5" aria-hidden/>
                            Edit profile
                        </button>
                    )
                }
            />

            {editing ? (
                <form onSubmit={handleSubmit} className="mt-5">
                    <div className="grid gap-4 border-b border-black/5 pb-6 sm:grid-cols-2">
                        <div>
                            <label htmlFor="first-name"
                                   className="mb-1.5 block text-[13px] font-semibold text-teal-950">
                                First name
                            </label>
                            <input
                                id="first-name"
                                type="text"
                                value={firstName}
                                onChange={(event) => setFirstName(event.target.value)}
                                className={inputClass(Boolean(fieldErrors.firstName))}
                            />
                            <FieldError message={fieldErrors.firstName}/>
                        </div>
                        <div>
                            <label htmlFor="last-name" className="mb-1.5 block text-[13px] font-semibold text-teal-950">
                                Last name
                            </label>
                            <input
                                id="last-name"
                                type="text"
                                value={lastName}
                                onChange={(event) => setLastName(event.target.value)}
                                className={inputClass(Boolean(fieldErrors.lastName))}
                            />
                            <FieldError message={fieldErrors.lastName}/>
                        </div>
                    </div>

                    <Row icon={Mail} label="Email">
                        <span className="text-[15px] font-semibold text-teal-950">{user.email}</span>
                    </Row>

                    <div className="flex items-center gap-3 border-b border-black/5 py-4 sm:gap-4">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-soft-control text-teal-950">
              <Phone className="size-4" aria-hidden/>
            </span>
                        <span className="shrink-0 text-[13px] font-semibold text-muted sm:w-28">Phone</span>
                        <div className="min-w-0 flex-1">
                            <input
                                id="phone"
                                type="tel"
                                value={phone}
                                onChange={(event) => setPhone(event.target.value)}
                                className={inputClass(Boolean(fieldErrors.phone))}
                            />
                            <FieldError message={fieldErrors.phone}/>
                        </div>
                    </div>

                    <Row icon={Tag} label="Account type">
            <span
                className="inline-flex items-center rounded-full border border-lime-500/60 bg-lime-500/15 px-3 py-1 text-[13px] font-bold text-teal-950">
              {accountType}
            </span>
                    </Row>

                    {showApplicationStatus && (
                        <Row icon={Tag} label="Application">
              <span className="text-[14px] font-semibold text-teal-950">
                {GROUP_LABELS[user.requestedGroup!] ?? user.requestedGroup} -{" "}
                  {APPROVAL_LABELS[user.approvalStatus] ?? user.approvalStatus}
              </span>
                        </Row>
                    )}

                    {user.companyName && (
                        <Row icon={Tag} label="Company">
                            <span className="text-[14px] font-semibold text-teal-950">{user.companyName}</span>
                        </Row>
                    )}

                    <div className="mt-6 flex gap-3">
                        <button
                            type="submit"
                            disabled={submitting}
                            className="h-11 rounded-full bg-lime-500 px-7 text-[14px] font-bold text-teal-950 transition-opacity disabled:opacity-60"
                        >
                            {submitting ? "Saving…" : "Save changes"}
                        </button>
                    </div>
                </form>
            ) : (
                <div className="mt-1">
                    <Row icon={User} label="Name">
                        <span className="text-[15px] font-semibold text-teal-950">{displayName}</span>
                    </Row>
                    <Row icon={Mail} label="Email">
                        <span className="text-[15px] font-semibold text-teal-950">{user.email}</span>
                    </Row>
                    <Row icon={Phone} label="Phone">
                        <span className="text-[15px] font-semibold text-teal-950">{user.phone || "-"}</span>
                    </Row>
                    <Row icon={Tag} label="Account type">
            <span
                className="inline-flex items-center rounded-full border border-lime-500/60 bg-lime-500/15 px-3 py-1 text-[13px] font-bold text-teal-950">
              {accountType}
            </span>
                    </Row>
                    {showApplicationStatus && (
                        <Row icon={Tag} label="Application">
              <span className="text-[14px] font-semibold text-teal-950">
                {GROUP_LABELS[user.requestedGroup!] ?? user.requestedGroup} -{" "}
                  {APPROVAL_LABELS[user.approvalStatus] ?? user.approvalStatus}
              </span>
                        </Row>
                    )}
                    {user.companyName && (
                        <Row icon={Tag} label="Company">
                            <span className="text-[14px] font-semibold text-teal-950">{user.companyName}</span>
                        </Row>
                    )}
                    {user.taxId && (
                        <Row icon={Tag} label="Tax ID / BN">
                            <span className="text-[14px] font-semibold text-teal-950">{user.taxId}</span>
                        </Row>
                    )}
                    {user.businessLicenceRef && (
                        <Row icon={Tag} label="Licence Ref">
                            <span className="text-[14px] font-semibold text-teal-950">{user.businessLicenceRef}</span>
                        </Row>
                    )}
                </div>
            )}
        </div>
    );
}

function B2BProgramSection() {
    const {user} = useAuth();
    const [modalOpen, setModalOpen] = useState(false);
    const [targetGroup, setTargetGroup] = useState<"WHOLESALE" | "DISTRIBUTOR">("WHOLESALE");

    if (!user) return null;

    const isDistributor = user.pricingGroup === "DISTRIBUTOR";
    const isWholesale = user.pricingGroup === "WHOLESALE";
    const isPending = user.approvalStatus === "PENDING";
    const isRejected = user.approvalStatus === "REJECTED";

    function openModal(group: "WHOLESALE" | "DISTRIBUTOR") {
        setTargetGroup(group);
        setModalOpen(true);
    }

    return (
        <>
            <div className="mt-6 max-w-2xl rounded-2xl bg-white p-6 shadow-card sm:p-8">
                <SectionHeading
                    icon={Building2}
                    title="Wholesale & Distributor Program"
                    action={
                        !isDistributor && !isPending && (
                            <button
                                type="button"
                                onClick={() => openModal(isWholesale ? "DISTRIBUTOR" : "WHOLESALE")}
                                className="flex items-center gap-1.5 rounded-full bg-teal-950 px-4 py-2 text-[13px] font-bold text-white transition-opacity hover:opacity-90"
                            >
                                <Sparkles className="size-3.5 text-lime-400" aria-hidden />
                                {isWholesale ? "Apply for Distributor" : "Apply to Upgrade"}
                            </button>
                        )
                    }
                />

                {isDistributor ? (
                    <div className="mt-4 rounded-xl border border-teal-950/10 bg-teal-950/[0.03] p-4">
                        <div className="flex items-center gap-2 text-[14px] font-bold text-teal-950">
                            <CheckCircle2 className="size-4.5 text-emerald-600" aria-hidden />
                            Distributor Account Active
                        </div>
                        <p className="mt-1 text-[13px] text-muted leading-relaxed">
                            You have full access to top-tier distributor pricing and offline payment terms (Cheque, e-Transfer, and Stripe) at checkout.
                        </p>
                        {user.companyName && (
                            <div className="mt-2.5 text-[12.5px] text-teal-950">
                                <span className="font-semibold text-muted">Registered Company:</span> {user.companyName}
                            </div>
                        )}
                    </div>
                ) : isWholesale && !isPending ? (
                    <div className="mt-4 space-y-3">
                        <div className="rounded-xl border border-teal-950/10 bg-teal-950/[0.03] p-4">
                            <div className="flex items-center gap-2 text-[14px] font-bold text-teal-950">
                                <CheckCircle2 className="size-4.5 text-emerald-600" aria-hidden />
                                Wholesale Account Active
                            </div>
                            <p className="mt-1 text-[13px] text-muted leading-relaxed">
                                You receive exclusive volume wholesale pricing. If you qualify as a regional volume distributor and wish to place orders with offline payment terms (Cheque / e-Transfer), you can apply for Distributor status.
                            </p>
                            <div className="mt-3">
                                <button
                                    type="button"
                                    onClick={() => openModal("DISTRIBUTOR")}
                                    className="inline-flex items-center gap-1.5 text-[13px] font-bold text-teal-900 underline hover:text-teal-950"
                                >
                                    Apply to become a Distributor &rarr;
                                </button>
                            </div>
                        </div>
                    </div>
                ) : isPending ? (
                    <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4.5">
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 text-[14px] font-bold text-amber-950">
                                <Clock className="size-4.5 text-amber-600 animate-pulse" aria-hidden />
                                Application Under Review
                            </div>
                            <span className="rounded-full bg-amber-200/80 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-amber-900">
                                Pending Admin Approval
                            </span>
                        </div>
                        <p className="mt-1.5 text-[13px] text-amber-900/90 leading-relaxed">
                            Your application to upgrade to <strong className="font-bold">{user.requestedGroup === "DISTRIBUTOR" ? "Distributor" : "Wholesale"}</strong> tier has been submitted and is currently being reviewed by Watani administration.
                        </p>

                        <div className="mt-3.5 grid gap-2 rounded-lg bg-white/80 p-3 text-[12.5px] sm:grid-cols-2">
                            <div>
                                <span className="font-semibold text-muted">Company Name:</span>{" "}
                                <span className="font-bold text-teal-950">{user.companyName || "—"}</span>
                            </div>
                            <div>
                                <span className="font-semibold text-muted">Requested Tier:</span>{" "}
                                <span className="font-bold text-teal-950">{user.requestedGroup === "DISTRIBUTOR" ? "Distributor" : "Wholesale"}</span>
                            </div>
                            <div>
                                <span className="font-semibold text-muted">Tax ID / BN:</span>{" "}
                                <span className="font-bold text-teal-950">{user.taxId || "—"}</span>
                            </div>
                            <div>
                                <span className="font-semibold text-muted">Business Licence:</span>{" "}
                                <span className="font-bold text-teal-950">{user.businessLicenceRef || "—"}</span>
                            </div>
                        </div>

                        <div className="mt-3 flex items-center justify-between text-[12px] text-amber-800">
                            <span>Notification sent to: info@wataniandsons.com</span>
                            <button
                                type="button"
                                onClick={() => openModal((user.requestedGroup as any) || "WHOLESALE")}
                                className="font-bold underline hover:text-amber-950"
                            >
                                Edit Application Details
                            </button>
                        </div>
                    </div>
                ) : isRejected ? (
                    <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
                        <div className="flex items-center gap-2 text-[14px] font-bold text-red-950">
                            <ShieldAlert className="size-4.5 text-red-600" aria-hidden />
                            Previous Application Update
                        </div>
                        <p className="mt-1 text-[13px] text-red-900/80 leading-relaxed">
                            Your previous business tier application could not be approved at this time. If your business information has changed or you have additional documentation, you may re-apply below.
                        </p>
                        <div className="mt-3">
                            <button
                                type="button"
                                onClick={() => openModal("WHOLESALE")}
                                className="rounded-full bg-red-950 px-4 py-1.5 text-[12px] font-bold text-white transition-opacity hover:opacity-90"
                            >
                                Re-apply for Business Account
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="mt-4 space-y-4">
                        <p className="text-[13px] leading-relaxed text-muted">
                            Are you a retailer, grocery store, or food distributor? Upgrade your account to unlock volume wholesale pricing, bulk ordering, and specialized payment terms (e-Transfer and Cheque for distributors).
                        </p>

                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="rounded-xl border border-black/10 bg-soft-control p-4 transition-colors hover:border-teal-950/20">
                                <div className="text-[14px] font-bold text-teal-950">Wholesale Tier</div>
                                <p className="mt-1 text-[12px] text-muted leading-relaxed">
                                    For grocers, restaurants, and retail stores buying by the case or box.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => openModal("WHOLESALE")}
                                    className="mt-3 inline-flex items-center gap-1 text-[12px] font-bold text-teal-900 hover:text-teal-950"
                                >
                                    Apply as Wholesaler &rarr;
                                </button>
                            </div>

                            <div className="rounded-xl border border-black/10 bg-soft-control p-4 transition-colors hover:border-teal-950/20">
                                <div className="text-[14px] font-bold text-teal-950">Distributor Tier</div>
                                <p className="mt-1 text-[12px] text-muted leading-relaxed">
                                    For regional distributors. Unlocks Cheque and e-Transfer terms without upfront payment.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => openModal("DISTRIBUTOR")}
                                    className="mt-3 inline-flex items-center gap-1 text-[12px] font-bold text-teal-900 hover:text-teal-950"
                                >
                                    Apply as Distributor &rarr;
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <UpgradeAccountModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                defaultGroup={targetGroup}
            />
        </>
    );
}

const EMPTY_ADDRESS_FORM: SavedAddressPayload = {
    fullName: "",
    line1: "",
    line2: "",
    city: "",
    region: "ON",
    postalCode: "",
    country: "CA",
    phone: "",
    defaultShipping: false,
    defaultBilling: false,
};

function SavedAddressesSection() {
    const notifications = useNotifications();
    const [addresses, setAddresses] = useState<SavedAddress[]>([]);
    const [loading, setLoading] = useState(true);
    const [formOpen, setFormOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [form, setForm] = useState<SavedAddressPayload>(EMPTY_ADDRESS_FORM);
    const [submitting, setSubmitting] = useState(false);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        listMyAddresses()
            .then(setAddresses)
            .catch(() => notifications.error("Couldn't load addresses", "Something went wrong. Please try again."))
            .finally(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function openAddForm() {
        setEditingId(null);
        setForm({...EMPTY_ADDRESS_FORM, defaultShipping: addresses.length === 0});
        setFieldErrors({});
        setFormOpen(true);
    }

    function openEditForm(address: SavedAddress) {
        setEditingId(address.id);
        setForm({
            fullName: address.fullName,
            line1: address.line1,
            line2: address.line2 ?? "",
            city: address.city,
            region: address.region,
            postalCode: address.postalCode,
            country: address.country,
            phone: address.phone ?? "",
            defaultShipping: address.defaultShipping,
            defaultBilling: address.defaultBilling,
        });
        setFieldErrors({});
        setFormOpen(true);
    }

    function closeForm() {
        setFormOpen(false);
        setFieldErrors({});
    }

    function updateField<K extends keyof SavedAddressPayload>(field: K, value: SavedAddressPayload[K]) {
        setForm((current) => ({...current, [field]: value}));
    }

    function updateCountry(country: string) {
        setForm((current) => ({...current, country, region: regionsFor(country)[0]?.code ?? ""}));
    }

    function validateForm(payload: SavedAddressPayload): Record<string, string> {
        const fields: Record<AddressFieldName, string> = {
            fullName: payload.fullName,
            line1: payload.line1,
            city: payload.city,
            region: payload.region,
            postalCode: payload.postalCode,
            phone: payload.phone ?? "",
        };
        const errors: Record<string, string> = {};
        for (const key of Object.keys(fields) as AddressFieldName[]) {
            // A region picked from a select can never be blank or malformed, so it
            // is exempt rather than reported as an error the shopper cannot fix.
            if (key === "region" && hasRegionList(payload.country)) continue;
            const message = validateAddressField(key, fields[key], payload.country);
            if (message) errors[key] = message;
        }
        return errors;
    }

    async function handleSubmit(event: React.FormEvent) {
        event.preventDefault();
        setFieldErrors({});

        const payload: SavedAddressPayload = {
            ...form,
            fullName: form.fullName.trim(),
            line1: form.line1.trim(),
            line2: form.line2?.trim() || null,
            city: form.city.trim(),
            postalCode: form.postalCode.trim(),
            phone: form.phone?.trim() || null,
        };

        const validationErrors = validateForm(payload);
        if (Object.keys(validationErrors).length > 0) {
            setFieldErrors(validationErrors);
            notifications.warning("Check the highlighted fields", "Some details need to be corrected before this address can be saved.");
            return;
        }

        setSubmitting(true);
        try {
            const saved = editingId
                ? await updateMyAddress(editingId, payload)
                : await createMyAddress(payload);
            setAddresses((current) => {
                const withoutSaved = current.filter((a) => a.id !== saved.id);
                const next = payload.defaultShipping
                    ? withoutSaved.map((a) => ({...a, defaultShipping: false}))
                    : withoutSaved;
                return [...next, saved].sort((a, b) => a.fullName.localeCompare(b.fullName));
            });
            notifications.success(editingId ? "Address updated" : "Address saved", "Your address book has been updated.");
            setFormOpen(false);
        } catch (error) {
            if (error instanceof ApiError) {
                setFieldErrors(error.fieldErrors ?? {});
                notifications.error("Couldn't save address", error.message);
            } else {
                notifications.error("Couldn't save address", "Something went wrong. Please try again.");
            }
        } finally {
            setSubmitting(false);
        }
    }

    async function handleDelete(address: SavedAddress) {
        setDeletingId(address.id);
        try {
            await deleteMyAddress(address.id);
            setAddresses((current) => current.filter((a) => a.id !== address.id));
            notifications.success("Address removed", "The address has been removed from your address book.");
        } catch (error) {
            notifications.error(
                "Couldn't remove address",
                error instanceof ApiError ? error.message : "Something went wrong. Please try again.",
            );
        } finally {
            setDeletingId(null);
        }
    }

    return (
        <div className="mt-6 max-w-2xl rounded-2xl bg-white p-6 shadow-card sm:p-8">
            <SectionHeading
                icon={MapPin}
                title="Saved addresses"
                action={
                    !formOpen && (
                        <button
                            type="button"
                            onClick={openAddForm}
                            className="flex items-center gap-1.5 rounded-full border border-teal-950/15 px-4 py-2 text-[13px] font-bold text-teal-950 transition-colors hover:bg-soft-control"
                        >
                            <Plus className="size-3.5" aria-hidden/>
                            Add address
                        </button>
                    )
                }
            />
            <p className="mt-1 pl-12 text-[13px] text-muted">
                Save an address once and reuse it at checkout instead of typing it in every time.
            </p>

            {formOpen && (
                <form onSubmit={handleSubmit} className="mt-5 rounded-2xl bg-soft-control p-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <FormField label="Full name" htmlFor="addr-full-name" error={fieldErrors.fullName}>
                            <input
                                id="addr-full-name"
                                type="text"
                                value={form.fullName}
                                onChange={(event) => updateField("fullName", event.target.value)}
                                className={inputClass(Boolean(fieldErrors.fullName))}
                            />
                        </FormField>
                        <FormField label="Phone (optional)" htmlFor="addr-phone" error={fieldErrors.phone}>
                            <input
                                id="addr-phone"
                                type="tel"
                                value={form.phone ?? ""}
                                onChange={(event) => updateField("phone", event.target.value)}
                                className={inputClass(Boolean(fieldErrors.phone))}
                            />
                        </FormField>
                        <FormField label="Address" htmlFor="addr-line1" error={fieldErrors.line1} full>
                            <input
                                id="addr-line1"
                                type="text"
                                value={form.line1}
                                onChange={(event) => updateField("line1", event.target.value)}
                                className={inputClass(Boolean(fieldErrors.line1))}
                            />
                        </FormField>
                        <FormField label="Apartment, suite (optional)" htmlFor="addr-line2" full>
                            <input
                                id="addr-line2"
                                type="text"
                                value={form.line2 ?? ""}
                                onChange={(event) => updateField("line2", event.target.value)}
                                className={inputClass(false)}
                            />
                        </FormField>
                        <FormField label="Country" htmlFor="addr-country" error={fieldErrors.country}>
                            <select
                                id="addr-country"
                                value={form.country}
                                onChange={(event) => updateCountry(event.target.value)}
                                className={inputClass(Boolean(fieldErrors.country))}
                            >
                                {COUNTRIES.map((c) => (
                                    <option key={c.code} value={c.code}>{c.name}</option>
                                ))}
                            </select>
                        </FormField>
                        <FormField label="City" htmlFor="addr-city" error={fieldErrors.city}>
                            <input
                                id="addr-city"
                                type="text"
                                value={form.city}
                                onChange={(event) => updateField("city", event.target.value)}
                                className={inputClass(Boolean(fieldErrors.city))}
                            />
                        </FormField>
                        <FormField label={regionLabelFor(form.country)} htmlFor="addr-region" error={fieldErrors.region}>
                            {hasRegionList(form.country) ? (
                                <select
                                    id="addr-region"
                                    value={form.region}
                                    onChange={(event) => updateField("region", event.target.value)}
                                    className={inputClass(Boolean(fieldErrors.region))}
                                >
                                    {regionsFor(form.country).map((r) => (
                                        <option key={r.code} value={r.code}>{r.name}</option>
                                    ))}
                                </select>
                            ) : (
                                <input
                                    id="addr-region"
                                    type="text"
                                    value={form.region}
                                    onChange={(event) => updateField("region", event.target.value)}
                                    className={inputClass(Boolean(fieldErrors.region))}
                                />
                            )}
                        </FormField>
                        <FormField label={postalLabelFor(form.country)} htmlFor="addr-postal" error={fieldErrors.postalCode}>
                            <input
                                id="addr-postal"
                                type="text"
                                value={form.postalCode}
                                onChange={(event) => updateField("postalCode", event.target.value)}
                                className={inputClass(Boolean(fieldErrors.postalCode))}
                            />
                        </FormField>
                    </div>

                    <label className="mt-4 flex items-center gap-2 text-[13px] font-semibold text-teal-950">
                        <input
                            type="checkbox"
                            checked={form.defaultShipping}
                            onChange={(event) => updateField("defaultShipping", event.target.checked)}
                            className="size-4 rounded border-black/20"
                        />
                        Use as my default address at checkout
                    </label>

                    <div className="mt-5 flex gap-3">
                        <button
                            type="submit"
                            disabled={submitting}
                            className="h-11 rounded-full bg-lime-500 px-7 text-[14px] font-bold text-teal-950 transition-opacity disabled:opacity-60"
                        >
                            {submitting ? "Saving…" : editingId ? "Save changes" : "Save address"}
                        </button>
                        <button
                            type="button"
                            onClick={closeForm}
                            disabled={submitting}
                            className="h-11 rounded-full border border-black/10 px-6 text-[14px] font-bold text-teal-950 transition-colors hover:bg-white disabled:opacity-60"
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            )}

            <div className="mt-5">
                {loading ? (
                    <p className="text-[13px] text-muted">Loading your saved addresses…</p>
                ) : addresses.length === 0 && !formOpen ? (
                    <p className="text-[13px] text-muted">You haven&apos;t saved an address yet.</p>
                ) : (
                    <ul className="space-y-3">
                        {addresses.map((address) => (
                            <li
                                key={address.id}
                                className="flex items-start justify-between gap-3 rounded-xl border border-black/5 p-4"
                            >
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="text-[14px] font-bold text-teal-950">{address.fullName}</p>
                                        {address.defaultShipping && (
                                            <span
                                                className="inline-flex items-center gap-1 rounded-full bg-lime-500/20 px-2 py-0.5 text-[11px] font-bold text-teal-950">
                                                <Star className="size-3" aria-hidden/>
                                                Default
                                            </span>
                                        )}
                                    </div>
                                    <p className="mt-0.5 text-[13px] text-muted">
                                        {address.line1}{address.line2 ? `, ${address.line2}` : ""}
                                    </p>
                                    <p className="text-[13px] text-muted">
                                        {address.city}, {address.region} {address.postalCode}
                                    </p>
                                    {address.phone && <p className="text-[13px] text-muted">{address.phone}</p>}
                                </div>
                                <div className="flex shrink-0 items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={() => openEditForm(address)}
                                        aria-label={`Edit ${address.fullName}'s address`}
                                        className="grid size-9 place-items-center rounded-lg text-teal-950 transition-colors hover:bg-soft-control"
                                    >
                                        <Pencil className="size-4" aria-hidden/>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleDelete(address)}
                                        disabled={deletingId === address.id}
                                        aria-label={`Delete ${address.fullName}'s address`}
                                        className="grid size-9 place-items-center rounded-lg text-coral transition-colors hover:bg-coral/10 disabled:opacity-50"
                                    >
                                        <Trash2 className="size-4" aria-hidden/>
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}

function FormField({
                        label,
                        htmlFor,
                        error,
                        full,
                        children,
                    }: {
    label: string;
    htmlFor: string;
    error?: string;
    full?: boolean;
    children: React.ReactNode;
}) {
    return (
        <div className={full ? "sm:col-span-2" : undefined}>
            <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-semibold text-teal-950">
                {label}
            </label>
            {children}
            <FieldError message={error}/>
        </div>
    );
}

function inputClass(hasError: boolean) {
    return `h-11 w-full rounded-xl border px-4 text-[15px] outline-none transition-colors focus:border-teal-800 ${
        hasError ? "border-coral" : "border-black/10"
    }`;
}

function FieldError({message}: { message?: string }) {
    if (!message) return null;
    return <p className="mt-1 text-[13px] font-medium text-coral">{message}</p>;
}

const MIN_PASSWORD_LENGTH = 10;

function passwordChecks(password: string) {
    return {
        length: password.length >= MIN_PASSWORD_LENGTH,
        letterAndNumber: /[a-zA-Z]/.test(password) && /[0-9]/.test(password),
        special: /[^a-zA-Z0-9]/.test(password),
    };
}

function ChangePasswordSection() {
    const notifications = useNotifications();
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

    const checks = passwordChecks(newPassword);

    function resetForm() {
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
    }

    async function handleSubmit(event: React.FormEvent) {
        event.preventDefault();
        setFieldErrors({});

        const clientErrors: Record<string, string> = {};
        if (!currentPassword) clientErrors.currentPassword = "Enter your current password.";
        if (newPassword.length < MIN_PASSWORD_LENGTH) {
            clientErrors.newPassword = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
        }
        if (newPassword && currentPassword && newPassword === currentPassword) {
            clientErrors.newPassword = "New password must be different from your current password.";
        }
        if (confirmPassword !== newPassword) {
            clientErrors.confirmPassword = "Passwords do not match.";
        }
        if (Object.keys(clientErrors).length > 0) {
            setFieldErrors(clientErrors);
            notifications.warning("Check the highlighted fields", "Some details need to be corrected before you can update your password.");
            return;
        }

        setSubmitting(true);
        try {
            await changePassword({currentPassword, newPassword});
            notifications.success("Password updated", "Your password has been changed successfully.");
            resetForm();
        } catch (error) {
            if (error instanceof ApiError) {
                setFieldErrors(error.fieldErrors ?? {});
                notifications.error(
                    error.status === 400 && !error.fieldErrors ? "Incorrect current password" : "Couldn't update password",
                    error.message,
                );
            } else {
                notifications.error("Couldn't update password", "Something went wrong. Please try again.");
            }
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="mt-6 max-w-2xl rounded-2xl bg-white p-6 shadow-card sm:p-8">
            <SectionHeading icon={ShieldCheck} title="Change password"/>
            <p className="mt-1 pl-12 text-[13px] text-muted">
                For your security, confirm your current password before setting a new one.
            </p>

            <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_260px]">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="current-password"
                               className="mb-1.5 block text-[13px] font-semibold text-teal-950">
                            Current password
                        </label>
                        <input
                            id="current-password"
                            type="password"
                            autoComplete="current-password"
                            required
                            value={currentPassword}
                            onChange={(event) => setCurrentPassword(event.target.value)}
                            className={inputClass(Boolean(fieldErrors.currentPassword))}
                        />
                        <FieldError message={fieldErrors.currentPassword}/>
                    </div>

                    <div>
                        <label htmlFor="new-password" className="mb-1.5 block text-[13px] font-semibold text-teal-950">
                            New password
                        </label>
                        <input
                            id="new-password"
                            type="password"
                            autoComplete="new-password"
                            required
                            minLength={MIN_PASSWORD_LENGTH}
                            value={newPassword}
                            onChange={(event) => setNewPassword(event.target.value)}
                            className={inputClass(Boolean(fieldErrors.newPassword))}
                        />
                        <FieldError message={fieldErrors.newPassword}/>
                        {!fieldErrors.newPassword && (
                            <p className="mt-1 text-[12px] text-muted">At least {MIN_PASSWORD_LENGTH} characters.</p>
                        )}
                    </div>

                    <div>
                        <label htmlFor="confirm-password"
                               className="mb-1.5 block text-[13px] font-semibold text-teal-950">
                            Confirm new password
                        </label>
                        <input
                            id="confirm-password"
                            type="password"
                            autoComplete="new-password"
                            required
                            minLength={MIN_PASSWORD_LENGTH}
                            value={confirmPassword}
                            onChange={(event) => setConfirmPassword(event.target.value)}
                            className={inputClass(Boolean(fieldErrors.confirmPassword))}
                        />
                        <FieldError message={fieldErrors.confirmPassword}/>
                    </div>

                    <button
                        type="submit"
                        disabled={submitting}
                        className="h-12 w-full rounded-full bg-lime-500 text-[15px] font-bold text-teal-950 transition-opacity disabled:opacity-60 sm:w-auto sm:px-8"
                    >
                        {submitting ? "Updating…" : "Update password"}
                    </button>
                </form>

                <div className="rounded-2xl bg-soft-control p-5">
          <span className="grid size-10 place-items-center rounded-full bg-white text-teal-950">
            <ShieldCheck className="size-5" aria-hidden/>
          </span>
                    <h3 className="mt-3 text-[14px] font-extrabold text-teal-950">Keep your account secure</h3>
                    <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
                        Use a strong password that includes a mix of letters, numbers and symbols.
                    </p>
                    <ul className="mt-4 space-y-2.5">
                        <ChecklistItem met={checks.length} label="At least 10 characters"/>
                        <ChecklistItem met={checks.letterAndNumber} label="Mix of letters & numbers"/>
                        <ChecklistItem met={checks.special} label="Include a special character"/>
                    </ul>
                </div>
            </div>
        </div>
    );
}

function ChecklistItem({met, label}: { met: boolean; label: string }) {
    return (
        <li className="flex items-center gap-2 text-[12.5px] font-medium">
      <span
          className={`grid size-4 shrink-0 place-items-center rounded-full text-[9px] transition-colors ${
              met ? "bg-teal-950 text-lime-500" : "bg-black/10 text-transparent"
          }`}
      >
        ✓
      </span>
            <span className={met ? "text-teal-950" : "text-muted"}>{label}</span>
        </li>
    );
}
