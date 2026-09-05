"use client";

import {type FormEvent, useEffect, useState} from "react";
import {Pencil, Plus, Trash2} from "lucide-react";
import * as adminApi from "@/lib/admin/api";
import type {
    CategoryRequest,
    CategoryResponse,
    CurrencyExchangeRateRequest,
    CurrencyExchangeRateResponse,
    HsCodeTaxRateRequest,
    HsCodeTaxRateResponse,
    PalletShippingSettingsRequest,
    PalletShippingSettingsResponse,
    ShippingOriginRequest,
    ShippingOriginResponse,
    ShippingRateRequest,
    ShippingRateResponse,
} from "@/lib/admin/types";
import {AdminTable, type AdminTableColumn} from "@/components/admin/admin-table";
import {adminFieldClass, adminFieldLabelClass, AdminModal} from "@/components/admin/admin-modal";
import {ConfirmDialog} from "@/components/admin/confirm-dialog";
import {type RowAction, RowActions} from "@/components/admin/row-actions";
import {ApiError} from "@/lib/api";
import {COUNTRIES} from "@/lib/checkout";
import {useNotifications} from "@/components/notifications/notification-store";

type MasterDataTab =
    | "categories"
    | "hs-code-tax-rates"
    | "shipping-rates"
    | "shipping-origin"
    | "pallet-shipping"
    | "currency-rates";

const TABS: { key: MasterDataTab; label: string }[] = [
    {key: "categories", label: "Categories"},
    {key: "hs-code-tax-rates", label: "HS code tax rates"},
    {key: "shipping-rates", label: "Shipping rates"},
    {key: "shipping-origin", label: "Shipping origin"},
    {key: "pallet-shipping", label: "Pallet shipping"},
    {key: "currency-rates", label: "Currency rates"},
];

/**
 * Live slugify while typing: lowercases, collapses non-alphanumerics to hyphens.
 * Only strips a leading hyphen - trailing ones stay so the cursor isn't fought (see `finalizeSlug`).
 */
function slugify(value: string): string {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-/, "");
}

/**
 * Trims leftover leading/trailing hyphens on submit - `slugify` only strips a
 * leading one live, so a pasted "-seasonal-" would otherwise reach the backend.
 */
function finalizeSlug(value: string): string {
    return value.replace(/^-+|-+$/g, "");
}

/** The shape a finalized slug must have to be URL-safe; also enforced on submit. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Master data setup for catalogue reference data that isn't a product itself.
 * Only Categories exists today; tab strip leaves room for more later.
 */
export default function MasterDataSetupPage() {
    const [tab, setTab] = useState<MasterDataTab>("categories");

    return (
        <div>
            <h1 className="text-[26px] font-extrabold text-teal-950">Master data Setup</h1>
            <p className="mt-1 text-[13px] text-muted">Manage shared catalogue reference data.</p>

            <div className="mt-5 flex gap-1 border-b border-black/5">
                {TABS.map((t) => (
                    <button
                        key={t.key}
                        type="button"
                        onClick={() => setTab(t.key)}
                        className={`px-4 py-2.5 text-[13px] font-bold transition-colors ${
                            tab === t.key
                                ? "border-b-2 border-teal-950 text-teal-950"
                                : "border-b-2 border-transparent text-muted hover:text-teal-950"
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            <div className="mt-5">
                {tab === "categories" && <CategoriesPanel/>}
                {tab === "hs-code-tax-rates" && <HsCodeTaxRatesPanel/>}
                {tab === "shipping-rates" && <ShippingRatesPanel/>}
                {tab === "shipping-origin" && <ShippingOriginPanel/>}
                {tab === "pallet-shipping" && <PalletShippingPanel/>}
                {tab === "currency-rates" && <CurrencyRatesPanel/>}
            </div>
        </div>
    );
}

function emptyCategory(): CategoryRequest {
    return {slug: "", name: "", tagline: "", active: true};
}

function CategoriesPanel() {
    const notifications = useNotifications();
    const [categories, setCategories] = useState<CategoryResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<{ id: number | null; draft: CategoryRequest } | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<CategoryResponse | null>(null);

    function load() {
        setLoading(true);
        adminApi
            .listCategories()
            .then(setCategories)
            .catch((err) => {
                notifications.error(
                    "Failed to load categories",
                    err instanceof ApiError ? err.message : "Failed to load categories.",
                );
            })
            .finally(() => setLoading(false));
    }

    // Fetching on mount is what this effect is for; `load` flips `loading` synchronously,
    // which set-state-in-effect flags. `loading` already starts true, so the set is a
    // no-op on this path - the rule cannot see through the call to know that.
    /* eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
    useEffect(load, []);

    async function save(id: number | null, draft: CategoryRequest) {
        try {
            if (id) {
                await adminApi.updateCategory(id, draft);
            } else {
                await adminApi.createCategory(draft);
            }
            setEditing(null);
            load();
        } catch (err) {
            notifications.error("Save failed", err instanceof ApiError ? err.message : "Save failed.");
        }
    }

    async function remove(category: CategoryResponse) {
        try {
            await adminApi.deleteCategory(category.id);
            setDeleteTarget(null);
            load();
        } catch (err) {
            notifications.error("Delete failed", err instanceof ApiError ? err.message : "Delete failed.");
            setDeleteTarget(null);
        }
    }

    const columns: AdminTableColumn<CategoryResponse>[] = [
        {
            key: "name",
            header: "Name",
            render: (row) => (
                <div>
                    <p className="font-bold text-teal-950">{row.name}</p>
                    <p className="font-mono text-[12px] text-muted">{row.slug}</p>
                </div>
            ),
        },
        {
            key: "tagline",
            header: "Tagline",
            render: (row) => <span className="text-muted">{row.tagline || "-"}</span>,
        },
        {
            key: "products",
            header: "Products",
            render: (row) => <span className="text-muted">{row.productCount}</span>,
        },
        {
            key: "status",
            header: "Status",
            render: (row) => (
                <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
                        row.active ? "bg-lime-500/25 text-teal-950" : "bg-soft-control text-muted"
                    }`}
                >
          <span className={`size-1.5 rounded-full ${row.active ? "bg-teal-800" : "bg-muted"}`} aria-hidden/>
                    {row.active ? "Active" : "Inactive"}
        </span>
            ),
        },
        {
            key: "actions",
            header: "",
            className: "text-right",
            render: (row) => {
                const actions: RowAction[] = [
                    {
                        label: "Edit category",
                        icon: Pencil,
                        onSelect: () =>
                            setEditing({
                                id: row.id,
                                draft: {slug: row.slug, name: row.name, tagline: row.tagline ?? "", active: row.active},
                            }),
                    },
                    {
                        label: "Delete category",
                        icon: Trash2,
                        tone: "danger",
                        disabled: row.productCount > 0,
                        onSelect: () => setDeleteTarget(row),
                    },
                ];
                return <RowActions actions={actions} label={`Actions for category ${row.name}`}/>;
            },
        },
    ];

    return (
        <div>
            <div className="flex flex-wrap items-center justify-between gap-4">
                <p className="text-[13px] text-muted">
                    Categories group products in the storefront and admin catalogue filters.
                </p>
                <button
                    type="button"
                    onClick={() => setEditing({id: null, draft: emptyCategory()})}
                    className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-lime-500 px-4 text-[13px] font-bold text-teal-950 transition-opacity hover:opacity-90"
                >
                    <Plus className="size-4" aria-hidden/>
                    New category
                </button>
            </div>

            <div className="mt-5">
                <AdminTable
                    columns={columns}
                    rows={categories}
                    rowKey={(row) => row.id}
                    loading={loading}
                    emptyMessage="No categories yet."
                />
            </div>

            {editing && (
                <CategoryEditor
                    id={editing.id}
                    category={editing.draft}
                    onCancel={() => setEditing(null)}
                    onSave={(draft) => save(editing.id, draft)}
                />
            )}

            <ConfirmDialog
                open={deleteTarget !== null}
                title="Delete category?"
                description={
                    deleteTarget
                        ? `"${deleteTarget.name}" will be permanently removed.`
                        : undefined
                }
                confirmLabel="Delete"
                danger
                onCancel={() => setDeleteTarget(null)}
                onConfirm={() => deleteTarget && remove(deleteTarget)}
            />
        </div>
    );
}

function CategoryEditor({
                            id,
                            category,
                            onCancel,
                            onSave,
                        }: {
    id: number | null;
    category: CategoryRequest;
    onCancel: () => void;
    onSave: (category: CategoryRequest) => void;
}) {
    const [draft, setDraft] = useState<CategoryRequest>(category);
    const [slugError, setSlugError] = useState<string | null>(null);

    return (
        <AdminModal open onClose={onCancel} title={`${id ? "Edit" : "New"} category`}>
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    // Submitting with Enter skips blur, so finalize here too and only
                    // reject what the auto-fix genuinely can't repair (e.g. "!!!").
                    const slug = finalizeSlug(draft.slug);
                    if (!SLUG_PATTERN.test(slug)) {
                        setDraft((d) => ({...d, slug}));
                        setSlugError("Slug needs at least one letter or number, e.g. seasonal-specials.");
                        return;
                    }
                    setSlugError(null);
                    onSave({...draft, slug});
                }}
            >
                <h2 className="text-[18px] font-extrabold text-teal-950">{id ? "Edit" : "New"} category</h2>

                <label className="mt-4 block">
                    <span className={adminFieldLabelClass}>Slug</span>
                    <input
                        value={draft.slug}
                        onChange={(e) => {
                            setSlugError(null);
                            setDraft((d) => ({...d, slug: slugify(e.target.value)}));
                        }}
                        onBlur={() => setDraft((d) => ({...d, slug: finalizeSlug(d.slug)}))}
                        placeholder="e.g. seasonal-specials"
                        className={adminFieldClass}
                        required
                    />
                    {slugError ? (
                        <p className="mt-1 text-[12px] font-medium text-coral">{slugError}</p>
                    ) : (
                        <p className="mt-1 text-[12px] text-muted">
                            Lowercase letters and numbers only - spaces and symbols become a hyphen.
                        </p>
                    )}
                </label>

                <label className="mt-3 block">
                    <span className={adminFieldLabelClass}>Name</span>
                    <input
                        value={draft.name}
                        onChange={(e) => setDraft((d) => ({...d, name: e.target.value}))}
                        placeholder="e.g. Seasonal Specials"
                        className={adminFieldClass}
                        required
                    />
                </label>

                <label className="mt-3 block">
                    <span className={adminFieldLabelClass}>Tagline</span>
                    <input
                        value={draft.tagline ?? ""}
                        onChange={(e) => setDraft((d) => ({...d, tagline: e.target.value}))}
                        placeholder="e.g. Limited-run harvests"
                        className={adminFieldClass}
                    />
                </label>

                <label className="mt-3 flex items-center gap-2 text-[13px] font-semibold text-teal-950">
                    <input
                        type="checkbox"
                        checked={draft.active ?? true}
                        onChange={(e) => setDraft((d) => ({...d, active: e.target.checked}))}
                    />
                    Active
                </label>

                <div className="mt-6 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="h-10 rounded-full px-4 text-[13px] font-bold text-teal-950 transition-colors hover:bg-soft-control"
                    >
                        Cancel
                    </button>
                    <button type="submit"
                            className="h-10 rounded-full bg-lime-500 px-4 text-[13px] font-bold text-teal-950 transition-opacity hover:opacity-90">
                        Save
                    </button>
                </div>
            </form>
        </AdminModal>
    );
}

/** Country name for display; falls back to the raw code for anything not in COUNTRIES. */
function countryName(code: string): string {
    return COUNTRIES.find((country) => country.code === code)?.name ?? code;
}

function emptyHsCodeTaxRate(): HsCodeTaxRateRequest {
    return {hsCode: "", rate: 13};
}

function HsCodeTaxRatesPanel() {
    const notifications = useNotifications();
    const [rates, setRates] = useState<HsCodeTaxRateResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<{ id: number | null; draft: HsCodeTaxRateRequest } | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<HsCodeTaxRateResponse | null>(null);

    function load() {
        setLoading(true);
        adminApi
            .listHsCodeTaxRates()
            .then(setRates)
            .catch((err) => {
                notifications.error(
                    "Failed to load HS code tax rates",
                    err instanceof ApiError ? err.message : "Failed to load HS code tax rates.",
                );
            })
            .finally(() => setLoading(false));
    }

    // Fetching on mount is what this effect is for; `load` flips `loading` synchronously,
    // which set-state-in-effect flags. `loading` already starts true, so the set is a
    // no-op on this path - the rule cannot see through the call to know that.
    /* eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
    useEffect(load, []);

    async function save(draft: HsCodeTaxRateRequest) {
        try {
            await adminApi.upsertHsCodeTaxRate(draft);
            setEditing(null);
            load();
        } catch (err) {
            notifications.error("Save failed", err instanceof ApiError ? err.message : "Save failed.");
        }
    }

    async function remove(rate: HsCodeTaxRateResponse) {
        try {
            await adminApi.deleteHsCodeTaxRate(rate.id);
            setDeleteTarget(null);
            load();
        } catch (err) {
            notifications.error("Delete failed", err instanceof ApiError ? err.message : "Delete failed.");
            setDeleteTarget(null);
        }
    }

    const columns: AdminTableColumn<HsCodeTaxRateResponse>[] = [
        {
            key: "hsCode",
            header: "HS Code",
            render: (row) => <span className="font-mono font-bold text-teal-950">{row.hsCode}</span>,
        },
        {
            key: "products",
            header: "Product(s)",
            render: (row) =>
                row.productNames.length > 0 ? (
                    <span>{row.productNames.join(", ")}</span>
                ) : (
                    <span className="italic text-muted">No products yet</span>
                ),
        },
        {
            key: "rate",
            header: "Rate",
            render: (row) => <span className="font-mono">{(row.rate * 100).toFixed(2)}%</span>,
        },
        {
            key: "actions",
            header: "",
            className: "text-right",
            render: (row) => {
                const actions: RowAction[] = [
                    {
                        label: "Edit rate",
                        icon: Pencil,
                        onSelect: () =>
                            setEditing({id: row.id, draft: {hsCode: row.hsCode, rate: row.rate}}),
                    },
                    {
                        label: "Delete rate",
                        icon: Trash2,
                        tone: "danger",
                        onSelect: () => setDeleteTarget(row),
                    },
                ];
                return <RowActions actions={actions} label={`Actions for HS code ${row.hsCode} rate`}/>;
            },
        },
    ];

    return (
        <div>
            <div className="flex flex-wrap items-center justify-between gap-4">
                <p className="text-[13px] text-muted">
                    Tax applied at checkout, per product HS code. Changes take effect on the very next order -
                    no restart needed. A taxable item whose HS code has no rate here falls back to the default
                    rate of 13%.
                </p>
                <button
                    type="button"
                    onClick={() => setEditing({id: null, draft: emptyHsCodeTaxRate()})}
                    className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-lime-500 px-4 text-[13px] font-bold text-teal-950 transition-opacity hover:opacity-90"
                >
                    <Plus className="size-4" aria-hidden/>
                    New rate
                </button>
            </div>

            <div className="mt-5">
                <AdminTable
                    columns={columns}
                    rows={rates}
                    rowKey={(row) => row.id}
                    loading={loading}
                    emptyMessage="No HS code tax rates configured - taxable items use the default 13% rate."
                />
            </div>

            {editing && (
                <HsCodeTaxRateEditor
                    rate={editing.draft}
                    onCancel={() => setEditing(null)}
                    onSave={save}
                />
            )}

            <ConfirmDialog
                open={deleteTarget !== null}
                title="Delete HS code tax rate?"
                description={
                    deleteTarget
                        ? `The rate for HS code ${deleteTarget.hsCode} will be removed; items with that HS code will fall back to the default rate (13%).`
                        : undefined
                }
                confirmLabel="Delete"
                danger
                onCancel={() => setDeleteTarget(null)}
                onConfirm={() => deleteTarget && remove(deleteTarget)}
            />
        </div>
    );
}

function HsCodeTaxRateEditor({
                                 rate,
                                 onCancel,
                                 onSave,
                             }: {
    rate: HsCodeTaxRateRequest;
    onCancel: () => void;
    onSave: (rate: HsCodeTaxRateRequest) => void;
}) {
    const [draft, setDraft] = useState<HsCodeTaxRateRequest>(rate);
    // The rate is stored as a decimal fraction (0.13) but edited as a percentage
    // (13) since that's what a non-technical admin expects to type.
    const [percentInput, setPercentInput] = useState(() => (rate.rate * 100).toString());

    return (
        <AdminModal open onClose={onCancel} title="HS code tax rate">
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    onSave({...draft, rate: Number(percentInput) / 100});
                }}
            >
                <h2 className="text-[18px] font-extrabold text-teal-950">HS code tax rate</h2>

                <label className="mt-4 block">
                    <span className={adminFieldLabelClass}>HS Code</span>
                    <input
                        value={draft.hsCode}
                        onChange={(e) => setDraft((d) => ({...d, hsCode: e.target.value}))}
                        className={adminFieldClass}
                        placeholder="e.g. 2005.70.12.00"
                        required
                    />
                </label>

                <label className="mt-3 block">
                    <span className={adminFieldLabelClass}>Rate (%)</span>
                    <input
                        type="number"
                        step="0.001"
                        min="0"
                        value={percentInput}
                        onChange={(e) => setPercentInput(e.target.value)}
                        className={adminFieldClass}
                        required
                    />
                    <p className="mt-1 text-[12px] text-muted">e.g. 13 for 13%.</p>
                </label>

                <div className="mt-6 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="h-10 rounded-full px-4 text-[13px] font-bold text-teal-950 transition-colors hover:bg-soft-control"
                    >
                        Cancel
                    </button>
                    <button type="submit"
                            className="h-10 rounded-full bg-lime-500 px-4 text-[13px] font-bold text-teal-950 transition-opacity hover:opacity-90">
                        Save
                    </button>
                </div>
            </form>
        </AdminModal>
    );
}

function ShippingRatesPanel() {
    const notifications = useNotifications();
    const [rates, setRates] = useState<ShippingRateResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<ShippingRateRequest | null>(null);

    function load() {
        setLoading(true);
        adminApi
            .listShippingRates()
            .then(setRates)
            .catch((err) => {
                notifications.error(
                    "Failed to load shipping rates",
                    err instanceof ApiError ? err.message : "Failed to load shipping rates.",
                );
            })
            .finally(() => setLoading(false));
    }

    // Fetching on mount is what this effect is for; `load` flips `loading` synchronously,
    // which set-state-in-effect flags. `loading` already starts true, so the set is a
    // no-op on this path - the rule cannot see through the call to know that.
    /* eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
    useEffect(load, []);

    async function save(draft: ShippingRateRequest) {
        try {
            await adminApi.upsertShippingRate(draft);
            setEditing(null);
            load();
        } catch (err) {
            notifications.error("Save failed", err instanceof ApiError ? err.message : "Save failed.");
        }
    }

    const columns: AdminTableColumn<ShippingRateResponse>[] = [
        {
            key: "country",
            header: "Country",
            render: (row) => <span className="font-bold text-teal-950">{countryName(row.countryCode)}</span>,
        },
        {
            key: "flatRate",
            header: "Standard shipping rate",
            render: (row) => <span className="font-mono">${row.flatRate.toFixed(2)}</span>,
        },
        {
            key: "actions",
            header: "",
            className: "text-right",
            render: (row) => {
                const actions: RowAction[] = [
                    {
                        label: "Edit rate",
                        icon: Pencil,
                        onSelect: () => setEditing({countryCode: row.countryCode, flatRate: row.flatRate}),
                    },
                ];
                return <RowActions actions={actions}
                                   label={`Actions for ${countryName(row.countryCode)} shipping rate`}/>;
            },
        },
    ];

    return (
        <div>
            <p className="text-[13px] text-muted">
                Standard shipping charge applied at checkout, per destination country. Changes take effect
                on the very next order - no restart needed.
            </p>

            <div className="mt-5">
                <AdminTable
                    columns={columns}
                    rows={rates}
                    rowKey={(row) => row.id}
                    loading={loading}
                    emptyMessage="No shipping rates configured."
                />
            </div>

            {editing && (
                <ShippingRateEditor
                    rate={editing}
                    onCancel={() => setEditing(null)}
                    onSave={save}
                />
            )}
        </div>
    );
}

function emptyShippingOrigin(): ShippingOriginRequest {
    return {
        name: "",
        addressLine1: "",
        city: "",
        region: "",
        postalCode: "",
        country: "CA",
        phoneNumber: "",
        email: "",
    };
}

/**
 * The single ship-from address used for Freightcom rate quoting and booking. Required before
 * live rates/booking work - without it the backend falls back to flat-rate shipping.
 */
function ShippingOriginPanel() {
    const notifications = useNotifications();
    const [saved, setSaved] = useState<ShippingOriginResponse | null>(null);
    const [draft, setDraft] = useState<ShippingOriginRequest>(emptyShippingOrigin());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    function load() {
        setLoading(true);
        adminApi
            .getShippingOrigin()
            .then((origin) => {
                setSaved(origin);
                if (origin) {
                    setDraft({
                        name: origin.name,
                        addressLine1: origin.addressLine1,
                        city: origin.city,
                        region: origin.region,
                        postalCode: origin.postalCode,
                        country: origin.country,
                        phoneNumber: origin.phoneNumber,
                        email: origin.email,
                    });
                }
            })
            .catch((err) => {
                notifications.error(
                    "Failed to load shipping origin",
                    err instanceof ApiError ? err.message : "Failed to load shipping origin.",
                );
            })
            .finally(() => setLoading(false));
    }

    // Fetching on mount is what this effect is for; `load` flips `loading` synchronously,
    // which set-state-in-effect flags. `loading` already starts true, so the set is a
    // no-op on this path - the rule cannot see through the call to know that.
    /* eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
    useEffect(load, []);

    async function save(e: FormEvent) {
        e.preventDefault();
        setSaving(true);
        try {
            const result = await adminApi.updateShippingOrigin(draft);
            setSaved(result);
            notifications.success("Shipping origin saved", "Freightcom will use this address for rates and bookings.");
        } catch (err) {
            notifications.error("Save failed", err instanceof ApiError ? err.message : "Save failed.");
        } finally {
            setSaving(false);
        }
    }

    function field(key: keyof ShippingOriginRequest, value: string) {
        setDraft((d) => ({...d, [key]: value}));
    }

    if (loading) {
        return <p className="text-[13px] text-muted">Loading…</p>;
    }

    return (
        <div>
            <p className="text-[13px] text-muted">
                The ship-from address used to quote and book Freightcom shipments. Every field is
                required - until this is saved, orders fall back to flat-rate shipping instead of
                live carrier rates.
            </p>

            {!saved && (
                <p className="mt-4 rounded-xl bg-lime-500/10 px-4 py-3 text-[14px] font-medium text-teal-950">
                    Not configured yet - fill in the form below and save to enable live shipping rates.
                </p>
            )}

            <form onSubmit={save} className="mt-5 max-w-xl rounded-2xl bg-white p-5 shadow-card">
                <label className="block">
                    <span className={adminFieldLabelClass}>Business / sender name</span>
                    <input
                        value={draft.name}
                        onChange={(e) => field("name", e.target.value)}
                        placeholder="e.g. Watani & Sons"
                        className={adminFieldClass}
                        required
                    />
                </label>

                <label className="mt-3 block">
                    <span className={adminFieldLabelClass}>Address line 1</span>
                    <input
                        value={draft.addressLine1}
                        onChange={(e) => field("addressLine1", e.target.value)}
                        placeholder="Street address"
                        className={adminFieldClass}
                        required
                    />
                </label>

                <div className="mt-3 grid grid-cols-2 gap-3">
                    <label className="block">
                        <span className={adminFieldLabelClass}>City</span>
                        <input
                            value={draft.city}
                            onChange={(e) => field("city", e.target.value)}
                            className={adminFieldClass}
                            required
                        />
                    </label>
                    <label className="block">
                        <span className={adminFieldLabelClass}>Region / province / state</span>
                        <input
                            value={draft.region}
                            onChange={(e) => field("region", e.target.value)}
                            placeholder="e.g. ON"
                            className={adminFieldClass}
                            required
                        />
                    </label>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3">
                    <label className="block">
                        <span className={adminFieldLabelClass}>Postal / ZIP code</span>
                        <input
                            value={draft.postalCode}
                            onChange={(e) => field("postalCode", e.target.value)}
                            className={adminFieldClass}
                            required
                        />
                    </label>
                    <label className="block">
                        <span className={adminFieldLabelClass}>Country</span>
                        <select
                            value={draft.country}
                            onChange={(e) => field("country", e.target.value)}
                            className={adminFieldClass}
                            required
                        >
                            {COUNTRIES.map((c) => (
                                <option key={c.code} value={c.code}>
                                    {c.name}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3">
                    <label className="block">
                        <span className={adminFieldLabelClass}>Phone number</span>
                        <input
                            type="tel"
                            value={draft.phoneNumber}
                            onChange={(e) => field("phoneNumber", e.target.value)}
                            placeholder="e.g. +1 416 555 0100"
                            className={adminFieldClass}
                            required
                        />
                    </label>
                    <label className="block">
                        <span className={adminFieldLabelClass}>Email</span>
                        <input
                            type="email"
                            value={draft.email}
                            onChange={(e) => field("email", e.target.value)}
                            className={adminFieldClass}
                            required
                        />
                    </label>
                </div>

                <div className="mt-6 flex justify-end">
                    <button
                        type="submit"
                        disabled={saving}
                        className="h-10 rounded-full bg-lime-500 px-5 text-[13px] font-bold text-teal-950 transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                        {saving ? "Saving…" : "Save shipping origin"}
                    </button>
                </div>
            </form>
        </div>
    );
}

function emptyPalletShippingSettings(): PalletShippingSettingsRequest {
    return {weightPerPalletGrams: 600000, ratePerPallet: 200};
}

/**
 * The flat per-pallet shipping option's admin-editable inputs: how much weight fits on one
 * pallet, and what a pallet costs to ship. Pallet count on any order is ceil(order weight /
 * weight per pallet); the option's price is rate per pallet times that count. Single row,
 * always present (seeded by the V27 migration), so unlike shipping origin there's no
 * "not configured yet" state.
 */
function PalletShippingPanel() {
    const notifications = useNotifications();
    const [draft, setDraft] = useState<PalletShippingSettingsRequest>(emptyPalletShippingSettings());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    function load() {
        setLoading(true);
        adminApi
            .getPalletShippingSettings()
            .then((settings) => {
                setDraft({
                    weightPerPalletGrams: settings.weightPerPalletGrams,
                    ratePerPallet: settings.ratePerPallet,
                });
            })
            .catch((err) => {
                notifications.error(
                    "Failed to load pallet shipping settings",
                    err instanceof ApiError ? err.message : "Failed to load pallet shipping settings.",
                );
            })
            .finally(() => setLoading(false));
    }

    // Fetching on mount is what this effect is for; `load` flips `loading` synchronously,
    // which set-state-in-effect flags. `loading` already starts true, so the set is a
    // no-op on this path - the rule cannot see through the call to know that.
    /* eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
    useEffect(load, []);

    async function save(e: FormEvent) {
        e.preventDefault();
        setSaving(true);
        try {
            const result = await adminApi.updatePalletShippingSettings(draft);
            setDraft({
                weightPerPalletGrams: result.weightPerPalletGrams,
                ratePerPallet: result.ratePerPallet,
            });
            notifications.success(
                "Pallet shipping settings saved",
                "Checkout and the admin shipping panel will use these values immediately.",
            );
        } catch (err) {
            notifications.error("Save failed", err instanceof ApiError ? err.message : "Save failed.");
        } finally {
            setSaving(false);
        }
    }

    const weightPerPalletKg = draft.weightPerPalletGrams / 1000;

    if (loading) {
        return <p className="text-[13px] text-muted">Loading…</p>;
    }

    return (
        <div>
            <p className="text-[13px] text-muted">
                Controls the flat &quot;Watani &amp; Sons&quot; per-pallet shipping option shown at
                checkout and in the admin order shipping panel. The number of pallets an order needs
                is the order&apos;s total weight divided by the weight per pallet, rounded up; the
                option&apos;s price is the rate per pallet times that count.
            </p>

            <form onSubmit={save} className="mt-5 max-w-md rounded-2xl bg-white p-5 shadow-card">
                <label className="block">
                    <span className={adminFieldLabelClass}>Weight per pallet (kg)</span>
                    <input
                        type="number"
                        min={1}
                        step="1"
                        value={weightPerPalletKg}
                        onChange={(e) =>
                            setDraft((d) => ({
                                ...d,
                                weightPerPalletGrams: Math.round(Number(e.target.value) * 1000),
                            }))
                        }
                        placeholder="e.g. 600"
                        className={adminFieldClass}
                        required
                    />
                    <span className="mt-1 block text-[11px] text-muted">
                        Typically 500–650 kg per pallet.
                    </span>
                </label>

                <label className="mt-3 block">
                    <span className={adminFieldLabelClass}>Rate per pallet (CAD)</span>
                    <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={draft.ratePerPallet}
                        onChange={(e) =>
                            setDraft((d) => ({...d, ratePerPallet: Number(e.target.value)}))
                        }
                        className={adminFieldClass}
                        required
                    />
                </label>

                <div className="mt-6 flex justify-end">
                    <button
                        type="submit"
                        disabled={saving}
                        className="h-10 rounded-full bg-lime-500 px-5 text-[13px] font-bold text-teal-950 transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                        {saving ? "Saving…" : "Save pallet shipping settings"}
                    </button>
                </div>
            </form>
        </div>
    );
}

function emptyCurrencyRate(): CurrencyExchangeRateRequest {
    return {currencyCode: "", rateToCad: 1};
}

/**
 * Admin-editable currency exchange rates used by the storefront's currency switcher.
 * Base currency is CAD (rate always 1) - display-only, never affects pricing, checkout,
 * or what Stripe actually charges.
 */
function CurrencyRatesPanel() {
    const notifications = useNotifications();
    const [rates, setRates] = useState<CurrencyExchangeRateResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<{ id: number | null; draft: CurrencyExchangeRateRequest } | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<CurrencyExchangeRateResponse | null>(null);

    function load() {
        setLoading(true);
        adminApi
            .listCurrencyRates()
            .then(setRates)
            .catch((err) => {
                notifications.error(
                    "Failed to load currency rates",
                    err instanceof ApiError ? err.message : "Failed to load currency rates.",
                );
            })
            .finally(() => setLoading(false));
    }

    // Fetching on mount is what this effect is for; `load` flips `loading` synchronously,
    // which set-state-in-effect flags. `loading` already starts true, so the set is a
    // no-op on this path - the rule cannot see through the call to know that.
    /* eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
    useEffect(load, []);

    async function save(draft: CurrencyExchangeRateRequest) {
        try {
            await adminApi.upsertCurrencyRate(draft);
            setEditing(null);
            load();
        } catch (err) {
            notifications.error("Save failed", err instanceof ApiError ? err.message : "Save failed.");
        }
    }

    async function remove(rate: CurrencyExchangeRateResponse) {
        try {
            await adminApi.deleteCurrencyRate(rate.id);
            setDeleteTarget(null);
            load();
        } catch (err) {
            notifications.error("Delete failed", err instanceof ApiError ? err.message : "Delete failed.");
            setDeleteTarget(null);
        }
    }

    const columns: AdminTableColumn<CurrencyExchangeRateResponse>[] = [
        {
            key: "currencyCode",
            header: "Currency",
            render: (row) => (
                <span className="font-mono font-bold text-teal-950">
                    {row.currencyCode}
                    {row.currencyCode === "CAD" && (
                        <span className="ml-2 rounded-full bg-soft-control px-2 py-0.5 text-[11px] font-bold text-muted">
                            Base
                        </span>
                    )}
                </span>
            ),
        },
        {
            key: "rateToCad",
            header: "Units per 1 CAD",
            render: (row) => <span className="font-mono">{row.rateToCad.toFixed(6)}</span>,
        },
        {
            key: "actions",
            header: "",
            className: "text-right",
            render: (row) => {
                const actions: RowAction[] = [
                    {
                        label: "Edit rate",
                        icon: Pencil,
                        onSelect: () =>
                            setEditing({
                                id: row.id,
                                draft: {currencyCode: row.currencyCode, rateToCad: row.rateToCad},
                            }),
                    },
                    {
                        label: "Delete rate",
                        icon: Trash2,
                        tone: "danger",
                        disabled: row.currencyCode === "CAD",
                        onSelect: () => setDeleteTarget(row),
                    },
                ];
                return <RowActions actions={actions} label={`Actions for ${row.currencyCode} exchange rate`}/>;
            },
        },
    ];

    return (
        <div>
            <div className="flex flex-wrap items-center justify-between gap-4">
                <p className="max-w-2xl text-[13px] text-muted">
                    Display currencies the storefront's currency switcher offers. Base currency is CAD -
                    every price is still computed, checked out, and charged in CAD regardless of what a
                    shopper selects; these rates only convert the displayed amount. Changes take effect
                    on the storefront's next rate fetch - no restart needed.
                </p>
                <button
                    type="button"
                    onClick={() => setEditing({id: null, draft: emptyCurrencyRate()})}
                    className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-lime-500 px-4 text-[13px] font-bold text-teal-950 transition-opacity hover:opacity-90"
                >
                    <Plus className="size-4" aria-hidden/>
                    New currency
                </button>
            </div>

            <div className="mt-5">
                <AdminTable
                    columns={columns}
                    rows={rates}
                    rowKey={(row) => row.id}
                    loading={loading}
                    emptyMessage="No currency rates configured."
                />
            </div>

            {editing && (
                <CurrencyRateEditor
                    rate={editing.draft}
                    isBase={editing.draft.currencyCode === "CAD"}
                    onCancel={() => setEditing(null)}
                    onSave={save}
                />
            )}

            <ConfirmDialog
                open={deleteTarget !== null}
                title="Delete currency rate?"
                description={
                    deleteTarget
                        ? `Shoppers will no longer be able to switch to ${deleteTarget.currencyCode}.`
                        : undefined
                }
                confirmLabel="Delete"
                danger
                onCancel={() => setDeleteTarget(null)}
                onConfirm={() => deleteTarget && remove(deleteTarget)}
            />
        </div>
    );
}

function CurrencyRateEditor({
                                 rate,
                                 isBase,
                                 onCancel,
                                 onSave,
                             }: {
    rate: CurrencyExchangeRateRequest;
    isBase: boolean;
    onCancel: () => void;
    onSave: (rate: CurrencyExchangeRateRequest) => void;
}) {
    const [draft, setDraft] = useState<CurrencyExchangeRateRequest>(rate);

    return (
        <AdminModal open onClose={onCancel} title="Currency exchange rate">
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    onSave({...draft, currencyCode: draft.currencyCode.trim().toUpperCase()});
                }}
            >
                <h2 className="text-[18px] font-extrabold text-teal-950">Currency exchange rate</h2>

                <label className="mt-4 block">
                    <span className={adminFieldLabelClass}>Currency code</span>
                    <input
                        value={draft.currencyCode}
                        onChange={(e) => setDraft((d) => ({...d, currencyCode: e.target.value.toUpperCase()}))}
                        placeholder="e.g. USD"
                        maxLength={3}
                        className={adminFieldClass}
                        disabled={isBase}
                        required
                    />
                    {isBase && (
                        <p className="mt-1 text-[12px] text-muted">
                            CAD is the base currency and cannot be renamed.
                        </p>
                    )}
                </label>

                <label className="mt-3 block">
                    <span className={adminFieldLabelClass}>Units per 1 CAD</span>
                    <input
                        type="number"
                        step="0.000001"
                        min="0"
                        value={draft.rateToCad}
                        onChange={(e) => setDraft((d) => ({...d, rateToCad: Number(e.target.value)}))}
                        className={adminFieldClass}
                        disabled={isBase}
                        required
                    />
                    <p className="mt-1 text-[12px] text-muted">
                        e.g. 0.73 for USD means $1.00 CAD displays as $0.73 USD.
                    </p>
                </label>

                <div className="mt-6 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="h-10 rounded-full px-4 text-[13px] font-bold text-teal-950 transition-colors hover:bg-soft-control"
                    >
                        Cancel
                    </button>
                    <button type="submit"
                            className="h-10 rounded-full bg-lime-500 px-4 text-[13px] font-bold text-teal-950 transition-opacity hover:opacity-90">
                        Save
                    </button>
                </div>
            </form>
        </AdminModal>
    );
}

function ShippingRateEditor({
                                rate,
                                onCancel,
                                onSave,
                            }: {
    rate: ShippingRateRequest;
    onCancel: () => void;
    onSave: (rate: ShippingRateRequest) => void;
}) {
    const [amountInput, setAmountInput] = useState(() => rate.flatRate.toString());

    return (
        <AdminModal open onClose={onCancel} title="Shipping rate">
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    onSave({...rate, flatRate: Number(amountInput)});
                }}
            >
                <h2 className="text-[18px] font-extrabold text-teal-950">Shipping rate</h2>

                <label className="mt-4 block">
                    <span className={adminFieldLabelClass}>Country</span>
                    <input value={countryName(rate.countryCode)} disabled className={adminFieldClass}/>
                </label>

                <label className="mt-3 block">
                    <span className={adminFieldLabelClass}>Standard shipping rate ($)</span>
                    <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={amountInput}
                        onChange={(e) => setAmountInput(e.target.value)}
                        className={adminFieldClass}
                        required
                    />
                </label>

                <div className="mt-6 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="h-10 rounded-full px-4 text-[13px] font-bold text-teal-950 transition-colors hover:bg-soft-control"
                    >
                        Cancel
                    </button>
                    <button type="submit"
                            className="h-10 rounded-full bg-lime-500 px-4 text-[13px] font-bold text-teal-950 transition-opacity hover:opacity-90">
                        Save
                    </button>
                </div>
            </form>
        </AdminModal>
    );
}
