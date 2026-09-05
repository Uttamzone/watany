"use client";

import {useEffect, useState} from "react";
import {Ban, CheckCircle2, Plus, Shield, Trash2} from "lucide-react";
import * as adminApi from "@/lib/admin/api";
import type {CreateStaffRequest, RoleResponse, SortDirection, StaffResponse, StaffSortField} from "@/lib/admin/types";
import {AdminTable, type AdminTableColumn} from "@/components/admin/admin-table";
import {adminFieldClass, adminFieldLabelClass, AdminModal} from "@/components/admin/admin-modal";
import {ConfirmDialog} from "@/components/admin/confirm-dialog";
import {type RowAction, RowActions} from "@/components/admin/row-actions";
import {ApiError} from "@/lib/api";
import {useAuth} from "@/components/auth/auth-store";
import {useNotifications} from "@/components/notifications/notification-store";

const PAGE_SIZE = 10;

const ROLE_LABELS: Record<string, string> = {
    SUPER_ADMIN: "Super Admin",
    CATALOGUE_MANAGER: "Catalogue Manager",
    ORDER_MANAGER: "Order Manager",
    SUPPORT: "Support",
};

function roleLabel(name: string) {
    return ROLE_LABELS[name] ?? name;
}

function emptyStaff(defaultRole: string): CreateStaffRequest {
    return {email: "", password: "", firstName: "", lastName: "", roleName: defaultRole};
}

/** Staff account management - admins create/remove the logins other admins use to sign in. */
export default function AdminStaffPage() {
    const notifications = useNotifications();
    const {user} = useAuth();
    const [email, setEmail] = useState("");
    const [appliedEmail, setAppliedEmail] = useState("");
    const [page, setPage] = useState(0);
    const [sortKey, setSortKey] = useState<StaffSortField>("firstName");
    const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
    const [items, setItems] = useState<StaffResponse[]>([]);
    const [totalElements, setTotalElements] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [roles, setRoles] = useState<RoleResponse[]>([]);
    const [creating, setCreating] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<StaffResponse | null>(null);
    const [suspendTarget, setSuspendTarget] = useState<{ staff: StaffResponse; enable: boolean } | null>(null);

    function reload() {
        setLoading(true);
        adminApi
            .listStaff(appliedEmail, page, PAGE_SIZE, sortKey, sortDirection)
            .then((result) => {
                setItems(result.content);
                setTotalElements(result.totalElements);
                setTotalPages(result.totalPages);
            })
            .catch((err) => {
                const message = err instanceof ApiError ? err.message : "Failed to load staff.";
                setError(message);
                notifications.error("Failed to load staff", message);
            })
            .finally(() => setLoading(false));
    }

    // Refetching when the filter/sort/page changes is what this effect is for; `reload`
    // flips `loading` synchronously, which set-state-in-effect flags. On every path that
    // reaches here `loading` is already true (it starts true, and handleSearch/handleSort
    // set it before changing the dependency), so the set is a no-op - the rule cannot see
    // through the call to know that.
    /* eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
    useEffect(reload, [appliedEmail, page, sortKey, sortDirection]);

    useEffect(() => {
        adminApi.listStaffRoles().then(setRoles).catch(() => setRoles([]));
    }, []);

    function handleSearch(event: React.FormEvent) {
        event.preventDefault();
        setLoading(true);
        setPage(0);
        setAppliedEmail(email);
    }

    function handleSort(key: string) {
        setLoading(true);
        if (key === sortKey) {
            setSortDirection((direction) => (direction === "asc" ? "desc" : "asc"));
        } else {
            setSortKey(key as StaffSortField);
            setSortDirection("asc");
        }
        setPage(0);
    }

    async function runAction(action: () => Promise<StaffResponse | void>) {
        try {
            await action();
            reload();
        } catch (err) {
            notifications.error("Action failed", err instanceof ApiError ? err.message : "Action failed.");
        }
    }

    async function createStaff(draft: CreateStaffRequest) {
        try {
            await adminApi.createStaff(draft);
            setCreating(false);
            reload();
        } catch (err) {
            notifications.error("Save failed", err instanceof ApiError ? err.message : "Save failed.");
        }
    }

    const columns: AdminTableColumn<StaffResponse>[] = [
        {
            key: "name",
            header: "Staff member",
            sortKey: "firstName",
            render: (row) => (
                <div>
                    <p className="font-semibold text-teal-950">
                        {`${row.firstName ?? ""} ${row.lastName ?? ""}`.trim() || row.email}
                    </p>
                    <p className="text-[12px] text-muted">{row.email}</p>
                </div>
            ),
        },
        {
            key: "role",
            header: "Role",
            render: (row) => (
                <span
                    className="inline-flex items-center rounded-full bg-soft-control px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-teal-900">
          {row.roles.map(roleLabel).join(", ") || "-"}
        </span>
            ),
        },
        {
            key: "enabled",
            header: "Status",
            render: (row) => (
                <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
                        row.enabled ? "bg-lime-500/25 text-teal-950" : "bg-coral/15 text-coral"
                    }`}
                >
          <span className={`size-1.5 rounded-full ${row.enabled ? "bg-teal-800" : "bg-coral"}`} aria-hidden/>
                    {row.enabled ? "Active" : "Suspended"}
        </span>
            ),
        },
        {
            key: "actions",
            header: "",
            className: "text-right",
            render: (row) => {
                const isSelf = user?.email === row.email;
                const actions: RowAction[] = [
                    {
                        label: "Change role",
                        icon: Shield,
                        items: roles.map((role) => ({
                            label: roleLabel(role.name),
                            current: row.roles.includes(role.name),
                            disabled: row.roles.includes(role.name),
                            onSelect: () => runAction(() => adminApi.assignStaffRole(row.id, {roleName: role.name})),
                        })),
                    },
                ];

                actions.push({
                    label: row.enabled ? "Suspend account" : "Reactivate account",
                    icon: row.enabled ? Ban : CheckCircle2,
                    tone: row.enabled ? "danger" : "default",
                    disabled: isSelf && row.enabled,
                    onSelect: () => setSuspendTarget({staff: row, enable: !row.enabled}),
                });

                actions.push({
                    label: "Delete account",
                    icon: Trash2,
                    tone: "danger",
                    disabled: isSelf,
                    onSelect: () => setDeleteTarget(row),
                });

                return <RowActions actions={actions} label={`Actions for ${row.email}`}/>;
            },
        },
    ];

    return (
        <div>
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-[26px] font-extrabold text-teal-950">Staff</h1>
                    <p className="mt-1 text-[13px] text-muted">Manage the admin accounts that can sign in to this
                        dashboard.</p>
                </div>
                <button
                    type="button"
                    onClick={() => setCreating(true)}
                    className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-lime-500 px-4 text-[13px] font-bold text-teal-950 transition-opacity hover:opacity-90"
                >
                    <Plus className="size-4" aria-hidden/>
                    New staff account
                </button>
            </div>

            <form onSubmit={handleSearch} className="mt-5 flex max-w-sm items-center gap-2">
                <input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="Search by email"
                    className="h-10 w-full rounded-xl border border-black/10 bg-white px-4 text-[14px] outline-none transition-colors focus:border-teal-800"
                />
                <button
                    type="submit"
                    className="h-10 shrink-0 rounded-xl bg-teal-950 px-4 text-[13px] font-bold text-white transition-opacity hover:opacity-90"
                >
                    Search
                </button>
            </form>

            {error && (
                <p className="mt-4 rounded-xl bg-coral/10 px-4 py-3 text-[14px] font-medium text-coral">{error}</p>
            )}

            <div className="mt-4">
                <AdminTable
                    columns={columns}
                    rows={items}
                    rowKey={(row) => row.id}
                    loading={loading}
                    emptyMessage="No staff accounts found."
                    sorting={{sortKey, direction: sortDirection, onSort: handleSort}}
                    pagination={{page, totalPages, totalElements, onPageChange: setPage}}
                />
            </div>

            {creating && (
                <StaffEditor
                    roles={roles}
                    onCancel={() => setCreating(false)}
                    onSave={createStaff}
                />
            )}

            <ConfirmDialog
                open={suspendTarget !== null}
                title={suspendTarget?.enable ? "Reactivate account?" : "Suspend account?"}
                description={suspendTarget ? `This applies to ${suspendTarget.staff.email}.` : undefined}
                confirmLabel={suspendTarget?.enable ? "Reactivate" : "Suspend"}
                danger={!suspendTarget?.enable}
                onCancel={() => setSuspendTarget(null)}
                onConfirm={() => {
                    if (!suspendTarget) return;
                    const {staff, enable} = suspendTarget;
                    setSuspendTarget(null);
                    runAction(() => adminApi.setStaffEnabled(staff.id, enable));
                }}
            />

            <ConfirmDialog
                open={deleteTarget !== null}
                title="Delete staff account?"
                description={deleteTarget ? `"${deleteTarget.email}" will permanently lose access to this dashboard.` : undefined}
                confirmLabel="Delete"
                danger
                onCancel={() => setDeleteTarget(null)}
                onConfirm={() => {
                    if (!deleteTarget) return;
                    const target = deleteTarget;
                    setDeleteTarget(null);
                    runAction(() => adminApi.deleteStaff(target.id));
                }}
            />
        </div>
    );
}

function StaffEditor({
                         roles,
                         onCancel,
                         onSave,
                     }: {
    roles: RoleResponse[];
    onCancel: () => void;
    onSave: (draft: CreateStaffRequest) => void;
}) {
    const [draft, setDraft] = useState<CreateStaffRequest>(emptyStaff(roles[0]?.name ?? "SUPPORT"));

    return (
        <AdminModal open onClose={onCancel} title="New staff account">
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    onSave(draft);
                }}
            >
                <h2 className="text-[18px] font-extrabold text-teal-950">New staff account</h2>

                <label className="mt-4 block">
                    <span className={adminFieldLabelClass}>Email</span>
                    <input
                        type="email"
                        value={draft.email}
                        onChange={(e) => setDraft((d) => ({...d, email: e.target.value}))}
                        placeholder="name@watani.local"
                        className={adminFieldClass}
                        required
                    />
                </label>

                <label className="mt-3 block">
                    <span className={adminFieldLabelClass}>Temporary password</span>
                    <input
                        type="password"
                        value={draft.password}
                        onChange={(e) => setDraft((d) => ({...d, password: e.target.value}))}
                        placeholder="At least 8 characters"
                        className={adminFieldClass}
                        minLength={8}
                        required
                    />
                </label>

                <div className="mt-3 grid grid-cols-2 gap-3">
                    <label className="block">
                        <span className={adminFieldLabelClass}>First name</span>
                        <input
                            value={draft.firstName ?? ""}
                            onChange={(e) => setDraft((d) => ({...d, firstName: e.target.value}))}
                            className={adminFieldClass}
                        />
                    </label>
                    <label className="block">
                        <span className={adminFieldLabelClass}>Last name</span>
                        <input
                            value={draft.lastName ?? ""}
                            onChange={(e) => setDraft((d) => ({...d, lastName: e.target.value}))}
                            className={adminFieldClass}
                        />
                    </label>
                </div>

                <label className="mt-3 block">
                    <span className={adminFieldLabelClass}>Role</span>
                    <select
                        value={draft.roleName}
                        onChange={(e) => setDraft((d) => ({...d, roleName: e.target.value}))}
                        className={adminFieldClass}
                    >
                        {roles.map((role) => (
                            <option key={role.name} value={role.name}>
                                {roleLabel(role.name)}
                            </option>
                        ))}
                    </select>
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
                        Create
                    </button>
                </div>
            </form>
        </AdminModal>
    );
}
