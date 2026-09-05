"use client";

import { useEffect, useMemo, useState } from "react";
import { FolderTree, Pencil, Plus, Search, Trash2, Power, AlertCircle } from "lucide-react";
import * as adminApi from "@/lib/admin/api";
import type { CategoryRequest, CategoryResponse } from "@/lib/admin/types";
import { AdminTable, type AdminTableColumn } from "@/components/admin/admin-table";
import { adminFieldClass, adminFieldLabelClass, AdminModal } from "@/components/admin/admin-modal";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { type RowAction, RowActions } from "@/components/admin/row-actions";
import { ApiError } from "@/lib/api";
import { useNotifications } from "@/components/notifications/notification-store";

function emptyCategory(): CategoryRequest {
    return {
        slug: "",
        name: "",
        tagline: "",
        active: true,
    };
}

function slugify(text: string): string {
    return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_-]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

export default function AdminCategoriesPage() {
    const notifications = useNotifications();
    const [categories, setCategories] = useState<CategoryResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState("");
    const [editing, setEditing] = useState<{ id?: number; draft: CategoryRequest } | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<CategoryResponse | null>(null);
    const [saving, setSaving] = useState(false);

    function load() {
        setLoading(true);
        adminApi
            .listCategories()
            .then((data) => {
                setCategories(Array.isArray(data) ? data : []);
                setError(null);
            })
            .catch((err) => {
                const message = err instanceof ApiError ? err.message : "Failed to load categories.";
                setError(message);
                notifications.error("Failed to load categories", message);
            })
            .finally(() => setLoading(false));
    }

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return categories;
        return categories.filter(
            (c) =>
                c.name.toLowerCase().includes(q) ||
                c.slug.toLowerCase().includes(q) ||
                (c.tagline && c.tagline.toLowerCase().includes(q))
        );
    }, [categories, query]);

    const stats = useMemo(() => {
        const total = categories.length;
        const active = categories.filter((c) => c.active).length;
        const totalProducts = categories.reduce((sum, c) => sum + (c.productCount || 0), 0);
        return { total, active, totalProducts };
    }, [categories]);

    async function handleSave(req: CategoryRequest, id?: number) {
        setSaving(true);
        try {
            if (id) {
                await adminApi.updateCategory(id, req);
                notifications.success("Category updated", `Successfully updated "${req.name}".`);
            } else {
                await adminApi.createCategory(req);
                notifications.success("Category created", `Successfully created "${req.name}".`);
            }
            setEditing(null);
            load();
        } catch (err) {
            const message = err instanceof ApiError ? err.message : "Save failed.";
            notifications.error("Failed to save category", message);
        } finally {
            setSaving(false);
        }
    }

    async function handleToggleActive(category: CategoryResponse) {
        try {
            await adminApi.updateCategory(category.id, {
                name: category.name,
                slug: category.slug,
                tagline: category.tagline,
                active: !category.active,
            });
            notifications.success(
                category.active ? "Category deactivated" : "Category activated",
                `"${category.name}" is now ${category.active ? "inactive" : "active"}.`
            );
            load();
        } catch (err) {
            const message = err instanceof ApiError ? err.message : "Update failed.";
            notifications.error("Failed to update status", message);
        }
    }

    async function handleDelete(category: CategoryResponse) {
        if (!category.id) return;
        if (category.productCount > 0) {
            notifications.error(
                "Cannot delete category",
                `This category has ${category.productCount} associated product(s). Move or delete the products first.`
            );
            setDeleteTarget(null);
            return;
        }

        try {
            await adminApi.deleteCategory(category.id);
            notifications.success("Category deleted", `"${category.name}" has been removed.`);
            setDeleteTarget(null);
            load();
        } catch (err) {
            const message = err instanceof ApiError ? err.message : "Delete failed.";
            notifications.error("Failed to delete category", message);
        }
    }

    const columns: AdminTableColumn<CategoryResponse>[] = [
        {
            key: "name",
            header: "Category Name",
            sortKey: "name",
            render: (row) => (
                <div>
                    <span className="font-semibold text-teal-950">{row.name}</span>
                    {row.tagline && <p className="text-[12px] text-muted">{row.tagline}</p>}
                </div>
            ),
        },
        {
            key: "slug",
            header: "Slug",
            sortKey: "slug",
            render: (row) => (
                <span className="font-mono text-[12px] text-teal-900 bg-teal-50 px-2 py-0.5 rounded border border-teal-200/60">
                    {row.slug}
                </span>
            ),
        },
        {
            key: "productCount",
            header: "Products",
            render: (row) => (
                <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[12px] font-medium text-slate-700">
                    {row.productCount ?? 0} {row.productCount === 1 ? "product" : "products"}
                </span>
            ),
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
                    <span
                        className={`size-1.5 rounded-full ${row.active ? "bg-teal-800" : "bg-muted"}`}
                        aria-hidden
                    />
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
                                draft: {
                                    slug: row.slug,
                                    name: row.name,
                                    tagline: row.tagline || "",
                                    active: row.active,
                                },
                            }),
                    },
                    {
                        label: row.active ? "Deactivate" : "Activate",
                        icon: Power,
                        onSelect: () => handleToggleActive(row),
                    },
                    {
                        label: "Delete category",
                        icon: Trash2,
                        tone: "danger",
                        onSelect: () => setDeleteTarget(row),
                    },
                ];
                return <RowActions actions={actions} label={`Actions for category ${row.name}`} />;
            },
        },
    ];

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-[22px] font-extrabold text-teal-950 sm:text-[26px]">Categories</h1>
                    <p className="mt-1 text-[13px] text-muted">
                        Manage product taxonomy, storefront navigation categories, and active statuses.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => setEditing({ draft: emptyCategory() })}
                    className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-lime-500 px-4 text-[13px] font-bold text-teal-950 transition-opacity hover:opacity-90 sm:h-10 sm:shrink-0"
                >
                    <Plus className="size-4" aria-hidden />
                    New category
                </button>
            </div>

            {/* Quick Stats Banner */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-2xl bg-white p-4 shadow-card flex items-center gap-3">
                    <div className="size-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-800">
                        <FolderTree className="size-5" />
                    </div>
                    <div>
                        <p className="text-[12px] text-muted font-medium">Total Categories</p>
                        <p className="text-[20px] font-extrabold text-teal-950">{stats.total}</p>
                    </div>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-card flex items-center gap-3">
                    <div className="size-10 rounded-xl bg-lime-500/15 flex items-center justify-center text-teal-900">
                        <Power className="size-5" />
                    </div>
                    <div>
                        <p className="text-[12px] text-muted font-medium">Active Categories</p>
                        <p className="text-[20px] font-extrabold text-teal-950">{stats.active}</p>
                    </div>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-card flex items-center gap-3">
                    <div className="size-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                        <FolderTree className="size-5" />
                    </div>
                    <div>
                        <p className="text-[12px] text-muted font-medium">Categorized Products</p>
                        <p className="text-[20px] font-extrabold text-teal-950">{stats.totalProducts}</p>
                    </div>
                </div>
            </div>

            {error && (
                <div className="flex items-center gap-2 rounded-xl bg-coral/10 px-4 py-3 text-[14px] font-medium text-coral">
                    <AlertCircle className="size-4 shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {/* Search Filter */}
            <div className="relative max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted" aria-hidden />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search categories by name, slug, tagline..."
                    className="w-full rounded-xl border border-black/10 bg-white pl-10 pr-4 py-2.5 text-[13px] text-teal-950 placeholder:text-muted focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
                />
            </div>

            {/* Table View */}
            <div className="hidden sm:block">
                <AdminTable
                    columns={columns}
                    rows={filtered}
                    rowKey={(row) => row.id ?? row.slug}
                    loading={loading}
                    emptyMessage="No categories found."
                />
            </div>

            {/* Mobile View */}
            <div className="sm:hidden space-y-3">
                {filtered.map((cat) => (
                    <div key={cat.id ?? cat.slug} className="rounded-2xl bg-white p-4 shadow-card">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <h3 className="font-bold text-teal-950">{cat.name}</h3>
                                <p className="mt-0.5 font-mono text-[12px] text-muted">{cat.slug}</p>
                                {cat.tagline && <p className="mt-1 text-[12px] text-muted">{cat.tagline}</p>}
                                <p className="mt-2 text-[12px] font-medium text-slate-600">
                                    {cat.productCount ?? 0} {cat.productCount === 1 ? "product" : "products"}
                                </p>
                            </div>
                            <RowActions
                                actions={[
                                    {
                                        label: "Edit category",
                                        icon: Pencil,
                                        onSelect: () =>
                                            setEditing({
                                                id: cat.id,
                                                draft: {
                                                    slug: cat.slug,
                                                    name: cat.name,
                                                    tagline: cat.tagline || "",
                                                    active: cat.active,
                                                },
                                            }),
                                    },
                                    {
                                        label: cat.active ? "Deactivate" : "Activate",
                                        icon: Power,
                                        onSelect: () => handleToggleActive(cat),
                                    },
                                    {
                                        label: "Delete category",
                                        icon: Trash2,
                                        tone: "danger",
                                        onSelect: () => setDeleteTarget(cat),
                                    },
                                ]}
                                label={`Actions for ${cat.name}`}
                            />
                        </div>
                        <div className="mt-3 border-t border-black/5 pt-3">
                            <span
                                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
                                    cat.active ? "bg-lime-500/25 text-teal-950" : "bg-soft-control text-muted"
                                }`}
                            >
                                <span
                                    className={`size-1.5 rounded-full ${cat.active ? "bg-teal-800" : "bg-muted"}`}
                                    aria-hidden
                                />
                                {cat.active ? "Active" : "Inactive"}
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal for Creating / Editing */}
            {editing && (
                <CategoryEditorModal
                    initial={editing.draft}
                    isEditing={Boolean(editing.id)}
                    saving={saving}
                    onCancel={() => setEditing(null)}
                    onSave={(draft) => handleSave(draft, editing.id)}
                />
            )}

            {/* Confirmation for Delete */}
            <ConfirmDialog
                open={deleteTarget !== null}
                title={`Delete category "${deleteTarget?.name}"?`}
                description={
                    deleteTarget && deleteTarget.productCount > 0
                        ? `This category currently has ${deleteTarget.productCount} product(s). You cannot delete a category with assigned products.`
                        : "Are you sure you want to delete this category? This action cannot be undone."
                }
                confirmLabel="Delete Category"
                danger
                onCancel={() => setDeleteTarget(null)}
                onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
            />
        </div>
    );
}

function CategoryEditorModal({
    initial,
    isEditing,
    saving,
    onCancel,
    onSave,
}: {
    initial: CategoryRequest;
    isEditing: boolean;
    saving: boolean;
    onCancel: () => void;
    onSave: (draft: CategoryRequest) => void;
}) {
    const [name, setName] = useState(initial.name);
    const [slug, setSlug] = useState(initial.slug);
    const [tagline, setTagline] = useState(initial.tagline || "");
    const [active, setActive] = useState(initial.active ?? true);
    const [slugManual, setSlugManual] = useState(Boolean(initial.slug));

    function handleNameChange(val: string) {
        setName(val);
        if (!slugManual && !isEditing) {
            setSlug(slugify(val));
        }
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        onSave({
            name: name.trim(),
            slug: slug.trim(),
            tagline: tagline.trim() || null,
            active,
        });
    }

    return (
        <AdminModal open onClose={onCancel} title={isEditing ? "Edit Category" : "New Category"}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <h2 className="text-[18px] font-extrabold text-teal-950">
                    {isEditing ? "Edit Category" : "New Category"}
                </h2>

                <label className="block">
                    <span className={adminFieldLabelClass}>Category Name</span>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => handleNameChange(e.target.value)}
                        placeholder="e.g. Traditional Olive Oils"
                        className={adminFieldClass}
                        required
                    />
                </label>

                <label className="block">
                    <span className={adminFieldLabelClass}>URL Slug</span>
                    <input
                        type="text"
                        value={slug}
                        onChange={(e) => {
                            setSlugManual(true);
                            setSlug(e.target.value);
                        }}
                        placeholder="e.g. traditional-olive-oils"
                        className={adminFieldClass}
                        required
                    />
                    <span className="mt-1 block text-[11px] text-muted">
                        Used in URL paths: /catalogue/{slug || "slug"}
                    </span>
                </label>

                <label className="block">
                    <span className={adminFieldLabelClass}>Tagline / Subtitle</span>
                    <input
                        type="text"
                        value={tagline}
                        onChange={(e) => setTagline(e.target.value)}
                        placeholder="e.g. Cold-pressed heritage harvests from West Bank groves"
                        className={adminFieldClass}
                    />
                </label>

                <label className="flex items-center gap-2 pt-2 text-[13px] font-semibold text-teal-950 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={active}
                        onChange={(e) => setActive(e.target.checked)}
                        className="rounded border-gray-300 text-teal-800 focus:ring-teal-500 size-4"
                    />
                    Active (visible in storefront navigation)
                </label>

                <div className="mt-6 flex justify-end gap-2 pt-4 border-t border-black/5">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={saving}
                        className="h-10 rounded-full px-4 text-[13px] font-bold text-teal-950 transition-colors hover:bg-soft-control"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={saving || !name.trim() || !slug.trim()}
                        className="h-10 rounded-full bg-lime-500 px-5 text-[13px] font-bold text-teal-950 transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                        {saving ? "Saving..." : isEditing ? "Save Changes" : "Create Category"}
                    </button>
                </div>
            </form>
        </AdminModal>
    );
}
