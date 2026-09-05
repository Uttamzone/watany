/**
 * Client-side mirror of the backend's role -> permission grants (V3__seed_roles.sql).
 * UX-only - backend re-checks via @PreAuthorize. Keep in sync with the migration.
 */
export type Permission =
    | "CATALOGUE_READ"
    | "CATALOGUE_WRITE"
    | "PRICE_WRITE"
    | "INVENTORY_WRITE"
    | "ORDER_READ"
    | "ORDER_WRITE"
    | "ORDER_REFUND"
    | "CUSTOMER_READ"
    | "CUSTOMER_WRITE"
    | "CUSTOMER_APPROVE"
    | "CUSTOMER_IMPERSONATE"
    | "PROMO_WRITE"
    | "CONTENT_WRITE"
    | "REVIEW_MODERATE"
    | "REPORT_READ"
    | "AUDIT_READ"
    | "SYSTEM_CONFIG"
    | "STAFF_READ"
    | "STAFF_WRITE";

const ALL_PERMISSIONS: Permission[] = [
    "CATALOGUE_READ", "CATALOGUE_WRITE", "PRICE_WRITE", "INVENTORY_WRITE",
    "ORDER_READ", "ORDER_WRITE", "ORDER_REFUND",
    "CUSTOMER_READ", "CUSTOMER_WRITE", "CUSTOMER_APPROVE", "CUSTOMER_IMPERSONATE",
    "PROMO_WRITE", "CONTENT_WRITE", "REVIEW_MODERATE",
    "REPORT_READ", "AUDIT_READ", "SYSTEM_CONFIG",
    "STAFF_READ", "STAFF_WRITE",
];

const ROLE_PERMISSIONS: Record<string, Permission[]> = {
    SUPER_ADMIN: ALL_PERMISSIONS,
    CATALOGUE_MANAGER: [
        "CATALOGUE_READ", "CATALOGUE_WRITE", "PRICE_WRITE", "INVENTORY_WRITE",
        "REVIEW_MODERATE", "REPORT_READ", "STAFF_READ", "STAFF_WRITE",
    ],
    ORDER_MANAGER: [
        "ORDER_READ", "ORDER_WRITE", "ORDER_REFUND",
        "CUSTOMER_READ", "CATALOGUE_READ", "REPORT_READ", "STAFF_READ", "STAFF_WRITE",
    ],
    SUPPORT: ["ORDER_READ", "CUSTOMER_READ", "CATALOGUE_READ", "STAFF_READ", "STAFF_WRITE"],
};

const ADMIN_ROLES = new Set(Object.keys(ROLE_PERMISSIONS));

export function permissionsForRoles(roles: string[]): Set<Permission> {
    const result = new Set<Permission>();
    if (!Array.isArray(roles)) return result;
    for (const role of roles) {
        for (const permission of ROLE_PERMISSIONS[role] ?? []) {
            result.add(permission);
        }
    }
    return result;
}

/** Whether any of the user's roles grant access to the admin portal at all. */
export function isAdminRole(roles: string[]): boolean {
    if (!Array.isArray(roles)) return false;
    return roles.some((role) => ADMIN_ROLES.has(role));
}

/**
 * Admin routes gated behind a permission, most-specific path first.
 * Mirrors dashboard-shell.tsx nav - single source of truth for page permissions.
 */
const ADMIN_ROUTE_PERMISSIONS: { path: string; permission: Permission }[] = [
    {path: "/admin/staff", permission: "STAFF_READ"},
    {path: "/admin/orders", permission: "ORDER_READ"},
    {path: "/admin/customers", permission: "CUSTOMER_READ"},
    {path: "/admin/catalogue", permission: "CATALOGUE_READ"},
    {path: "/admin/categories", permission: "CATALOGUE_READ"},
    {path: "/admin/stock", permission: "INVENTORY_WRITE"},
    {path: "/admin/master-data", permission: "CATALOGUE_READ"},
    {path: "/admin/logistics", permission: "ORDER_READ"},
    {path: "/admin/coupons", permission: "CATALOGUE_READ"},
    {path: "/admin/reviews", permission: "REVIEW_MODERATE"},
    {path: "/admin/content", permission: "CATALOGUE_READ"},
    {path: "/admin/audit", permission: "AUDIT_READ"},
    {path: "/admin", permission: "REPORT_READ"},
];

/** The permission an admin route requires, or null if the route isn't gated (e.g. outside /admin). */
export function routePermission(pathname: string): Permission | null {
    const match = ADMIN_ROUTE_PERMISSIONS.find(
        (entry) => pathname === entry.path || pathname.startsWith(`${entry.path}/`),
    );
    return match?.permission ?? null;
}

/** First admin route (in nav order) the given roles have permission for, or null if none. */
export function firstAccessibleAdminRoute(roles: string[]): string | null {
    const permissions = permissionsForRoles(roles);
    const match = ADMIN_ROUTE_PERMISSIONS.find((entry) => permissions.has(entry.permission));
    return match?.path ?? null;
}
