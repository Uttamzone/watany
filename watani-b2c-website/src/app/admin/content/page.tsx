"use client";

import {useEffect, useState} from "react";
import {AnimatePresence, motion} from "framer-motion";
import {ChevronDown, Pencil, Plus} from "lucide-react";
import * as adminApi from "@/lib/admin/api";
import type {BannerPayload, ContentBlock, ContentSortField, ContentType, SortDirection} from "@/lib/admin/types";
import {AdminTable, type AdminTableColumn} from "@/components/admin/admin-table";
import {adminFieldClass, adminFieldLabelClass, AdminModal} from "@/components/admin/admin-modal";
import {type RowAction, RowActions} from "@/components/admin/row-actions";
import {ApiError} from "@/lib/api";
import {motionTokens, sec} from "@/lib/motion";
import {useNotifications} from "@/components/notifications/notification-store";

const PAGE_SIZE = 10;
const CONTENT_TYPES: ContentType[] = ["BANNER", "PAGE", "NAVIGATION", "EMAIL_TEMPLATE"];

function emptyBanner(): BannerPayload {
    return {imageUrl: "", headline: ""};
}

function parseBannerPayload(raw: string): BannerPayload {
    try {
        const parsed = JSON.parse(raw);
        return {...emptyBanner(), ...parsed};
    } catch {
        return emptyBanner();
    }
}

export default function AdminContentPage() {
    const notifications = useNotifications();
    const [page, setPage] = useState(0);
    const [sortKey, setSortKey] = useState<ContentSortField>("displayOrder");
    const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
    const [blocks, setBlocks] = useState<ContentBlock[]>([]);
    const [totalElements, setTotalElements] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editing, setEditing] = useState<ContentBlock | null>(null);

    function load() {
        setLoading(true);
        adminApi
            .listContent(page, PAGE_SIZE, sortKey, sortDirection)
            .then((result) => {
                setBlocks(result.content);
                setTotalElements(result.totalElements);
                setTotalPages(result.totalPages);
            })
            .catch((err) => {
                const message = err instanceof ApiError ? err.message : "Failed to load content.";
                setError(message);
                notifications.error("Failed to load content", message);
            })
            .finally(() => setLoading(false));
    }

    useEffect(() => {
        adminApi
            .listContent(page, PAGE_SIZE, sortKey, sortDirection)
            .then((result) => {
                setBlocks(result.content);
                setTotalElements(result.totalElements);
                setTotalPages(result.totalPages);
            })
            .catch((err) => {
                const message = err instanceof ApiError ? err.message : "Failed to load content.";
                setError(message);
                notifications.error("Failed to load content", message);
            })
            .finally(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, sortKey, sortDirection]);

    function handleSort(key: string) {
        setLoading(true);
        if (key === sortKey) {
            setSortDirection((direction) => (direction === "asc" ? "desc" : "asc"));
        } else {
            setSortKey(key as ContentSortField);
            setSortDirection("asc");
        }
        setPage(0);
    }

    function handlePageChange(nextPage: number) {
        setLoading(true);
        setPage(nextPage);
    }

    function startNew(type: ContentType) {
        setEditing({
            slug: "",
            type,
            title: "",
            payload: type === "BANNER" ? JSON.stringify(emptyBanner()) : "{}",
            displayOrder: 0,
            published: false,
        });
    }

    async function save(block: ContentBlock) {
        try {
            if (block.id) {
                await adminApi.updateContent(block.id, block);
            } else {
                await adminApi.createContent(block);
            }
            setEditing(null);
            load();
        } catch (err) {
            notifications.error("Save failed", err instanceof ApiError ? err.message : "Save failed.");
        }
    }

    async function togglePublished(block: ContentBlock) {
        if (!block.id) return;
        try {
            await adminApi.updateContent(block.id, {...block, published: !block.published});
            load();
        } catch (err) {
            notifications.error("Update failed", err instanceof ApiError ? err.message : "Update failed.");
        }
    }

    const columns: AdminTableColumn<ContentBlock>[] = [
        {
            key: "slug",
            header: "Slug",
            sortKey: "slug",
            render: (row) => <span className="font-mono text-[12px] text-muted">{row.slug}</span>,
        },
        {
            key: "type",
            header: "Type",
            sortKey: "type",
            render: (row) => <span className="text-muted">{row.type.replace(/_/g, " ")}</span>,
        },
        {
            key: "title",
            header: "Title",
            sortKey: "title",
            render: (row) => <span className="font-semibold text-teal-950">{row.title}</span>,
        },
        {
            key: "order",
            header: "Order",
            sortKey: "displayOrder",
            render: (row) => <span className="text-muted">{row.displayOrder}</span>,
        },
        {
            key: "status",
            header: "Status",
            sortKey: "published",
            render: (row) => (
                <button
                    type="button"
                    onClick={() => togglePublished(row)}
                    aria-pressed={row.published}
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide transition-colors ${
                        row.published ? "bg-lime-500/25 text-teal-950 hover:bg-lime-500/40" : "bg-soft-control text-muted hover:bg-black/5"
                    }`}
                >
                    <span className={`size-1.5 rounded-full ${row.published ? "bg-teal-800" : "bg-muted"}`}
                          aria-hidden/>
                    {row.published ? "Published" : "Draft"}
                </button>
            ),
        },
        {
            key: "actions",
            header: "",
            className: "text-right",
            render: (row) => {
                const actions: RowAction[] = [
                    {label: "Edit content", icon: Pencil, onSelect: () => setEditing(row)},
                ];
                return <RowActions actions={actions} label={`Actions for ${row.title}`}/>;
            },
        },
    ];

    return (
        <div>
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-[26px] font-extrabold text-teal-950">Content & banners</h1>
                    <p className="mt-1 text-[13px] text-muted">Manage homepage banners, pages, and templates.</p>
                </div>
                <NewContentMenu onSelect={startNew}/>
            </div>

            {error && (
                <p className="mt-4 rounded-xl bg-coral/10 px-4 py-3 text-[14px] font-medium text-coral">{error}</p>
            )}

            <div className="mt-5">
                <AdminTable
                    columns={columns}
                    rows={blocks}
                    rowKey={(row) => row.id ?? row.slug}
                    loading={loading}
                    emptyMessage="No content blocks yet."
                    sorting={{sortKey, direction: sortDirection, onSort: handleSort}}
                    pagination={{page, totalPages, totalElements, onPageChange: handlePageChange}}
                />
            </div>

            {editing && (
                <ContentEditor block={editing} onCancel={() => setEditing(null)} onSave={save}/>
            )}
        </div>
    );
}

function ContentEditor({
                           block,
                           onCancel,
                           onSave,
                       }: {
    block: ContentBlock;
    onCancel: () => void;
    onSave: (block: ContentBlock) => void;
}) {
    const [draft, setDraft] = useState<ContentBlock>(block);
    const [banner, setBanner] = useState<BannerPayload>(
        block.type === "BANNER" ? parseBannerPayload(block.payload) : emptyBanner(),
    );
    const [rawPayload, setRawPayload] = useState(block.payload);
    const [jsonError, setJsonError] = useState<string | null>(null);

    function submit(event: React.FormEvent) {
        event.preventDefault();
        if (draft.type === "BANNER") {
            onSave({...draft, payload: JSON.stringify(banner)});
            return;
        }
        try {
            JSON.parse(rawPayload);
            setJsonError(null);
            onSave({...draft, payload: rawPayload});
        } catch {
            setJsonError("Payload must be valid JSON.");
        }
    }

    return (
        <AdminModal
            open
            onClose={onCancel}
            title={`${block.id ? "Edit" : "New"} ${draft.type.replace(/_/g, " ")}`}
            widthClassName="max-w-lg"
        >
            <form onSubmit={submit}>
                <h2 className="text-[18px] font-extrabold text-teal-950">
                    {block.id ? "Edit" : "New"} {draft.type.replace(/_/g, " ")}
                </h2>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <label className="block">
                        <span className={adminFieldLabelClass}>Slug</span>
                        <input
                            value={draft.slug}
                            onChange={(e) => setDraft((d) => ({...d, slug: e.target.value}))}
                            className={adminFieldClass}
                            required
                        />
                    </label>
                    <label className="block">
                        <span className={adminFieldLabelClass}>Display order</span>
                        <input
                            type="number"
                            value={draft.displayOrder}
                            onChange={(e) => setDraft((d) => ({...d, displayOrder: Number(e.target.value)}))}
                            className={adminFieldClass}
                        />
                    </label>
                </div>

                <label className="mt-3 block">
                    <span className={adminFieldLabelClass}>Title</span>
                    <input
                        value={draft.title}
                        onChange={(e) => setDraft((d) => ({...d, title: e.target.value}))}
                        className={adminFieldClass}
                        required
                    />
                </label>

                {draft.type === "BANNER" ? (
                    <div className="mt-4 space-y-3 rounded-xl bg-soft-control p-4">
                        <p className="text-[12px] font-bold uppercase tracking-wide text-muted">Banner content</p>
                        <BannerField label="Image URL" value={banner.imageUrl}
                                     onChange={(v) => setBanner((b) => ({...b, imageUrl: v}))} required/>
                        <BannerField label="Headline" value={banner.headline}
                                     onChange={(v) => setBanner((b) => ({...b, headline: v}))} required/>
                        <BannerField label="Subheadline" value={banner.subheadline ?? ""}
                                     onChange={(v) => setBanner((b) => ({...b, subheadline: v}))}/>
                        <div className="grid grid-cols-2 gap-3">
                            <BannerField label="CTA label" value={banner.ctaLabel ?? ""}
                                         onChange={(v) => setBanner((b) => ({...b, ctaLabel: v}))}/>
                            <BannerField label="CTA link" value={banner.ctaHref ?? ""}
                                         onChange={(v) => setBanner((b) => ({...b, ctaHref: v}))}/>
                        </div>
                    </div>
                ) : (
                    <label className="mt-4 block">
                        <span className={adminFieldLabelClass}>Payload (JSON)</span>
                        <textarea
                            value={rawPayload}
                            onChange={(e) => setRawPayload(e.target.value)}
                            rows={6}
                            className="w-full rounded-xl border border-black/10 px-3 py-2 font-mono text-[12px] outline-none transition-colors focus:border-teal-800"
                        />
                        {jsonError && <p className="mt-1 text-[12px] text-coral">{jsonError}</p>}
                    </label>
                )}

                <label className="mt-4 flex items-center gap-2 text-[13px] font-semibold text-teal-950">
                    <input
                        type="checkbox"
                        checked={draft.published}
                        onChange={(e) => setDraft((d) => ({...d, published: e.target.checked}))}
                    />
                    Published
                </label>

                <div className="mt-6 flex justify-end gap-2">
                    <button type="button" onClick={onCancel}
                            className="h-10 rounded-full px-4 text-[13px] font-bold text-teal-950 transition-colors hover:bg-soft-control">
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

function BannerField({
                         label,
                         value,
                         onChange,
                         required,
                     }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    required?: boolean;
}) {
    return (
        <label className="block">
            <span className={adminFieldLabelClass}>{label}</span>
            <input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                required={required}
                className="h-9 w-full rounded-lg border border-black/10 bg-white px-2 text-[13px] outline-none transition-colors focus:border-teal-800"
            />
        </label>
    );
}

/** Single "New content" entry point replacing four separate always-visible type buttons. */
function NewContentMenu({onSelect}: { onSelect: (type: ContentType) => void }) {
    const [open, setOpen] = useState(false);

    useEffect(() => {
        if (!open) return;

        function onKey(event: KeyboardEvent) {
            if (event.key === "Escape") setOpen(false);
        }

        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open]);

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                aria-haspopup="menu"
                aria-expanded={open}
                className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-lime-500 px-4 text-[13px] font-bold text-teal-950 transition-opacity hover:opacity-90"
            >
                <Plus className="size-4" aria-hidden/>
                New content
                <ChevronDown className="size-3.5" aria-hidden/>
            </button>

            <AnimatePresence>
                {open && (
                    <>
                        <div className="fixed inset-0 z-20" onClick={() => setOpen(false)}/>
                        <motion.div
                            role="menu"
                            aria-label="Content type"
                            initial={{opacity: 0, scale: 0.96, y: -4}}
                            animate={{opacity: 1, scale: 1, y: 0}}
                            exit={{opacity: 0, scale: 0.96, y: -4}}
                            transition={{duration: sec(motionTokens.fast), ease: motionTokens.easeOut}}
                            className="absolute right-0 top-[calc(100%+6px)] z-30 w-52 overflow-hidden rounded-xl bg-white p-1.5 shadow-card ring-1 ring-black/5"
                        >
                            {CONTENT_TYPES.map((type) => (
                                <button
                                    key={type}
                                    type="button"
                                    role="menuitem"
                                    onClick={() => {
                                        setOpen(false);
                                        onSelect(type);
                                    }}
                                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-semibold text-teal-950 transition-colors hover:bg-soft-control"
                                >
                                    {type.replace(/_/g, " ")}
                                </button>
                            ))}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
