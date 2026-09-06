import {apiFetch} from "@/lib/api";
export { isAdminRole } from "@/lib/admin/permissions";

/** Mirrors com.watani.b2c.domain.pricing.PricingGroup. */
export type PricingGroup = "RETAIL" | "WHOLESALE" | "DISTRIBUTOR" | "ADMIN";

/** Mirrors com.watani.b2c.domain.user.ApprovalStatus. */
export type ApprovalStatus = "NOT_REQUESTED" | "PENDING" | "APPROVED" | "REJECTED";

/** Mirrors AuthDtos.UserProfile. */
export type UserProfile = {
    id: number;
    email: string;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    pricingGroup: PricingGroup;
    requestedGroup: PricingGroup | null;
    approvalStatus: ApprovalStatus;
    companyName: string | null;
    taxId?: string | null;
    businessLicenceRef?: string | null;
    emailVerified: boolean;
    roles: string[];
};

/** Mirrors AuthDtos.AuthResponse. */
export type AuthResponse = {
    token: string;
    expiresInSeconds: number;
    user: UserProfile;
};

/** First letters of first+last name, falling back to the first two letters of the email. */
export function getUserInitials(user: UserProfile): string {
    const first = user.firstName?.trim().charAt(0) ?? "";
    const last = user.lastName?.trim().charAt(0) ?? "";
    const initials = `${first}${last}`.trim();
    if (initials) return initials.toUpperCase();
    return (user.email || "WA").slice(0, 2).toUpperCase();
}

export type RegisterPayload = {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    requestedGroup?: PricingGroup;
    companyName?: string;
    taxId?: string;
    businessLicenceRef?: string;
};

export type GoogleLoginPayload = {
    email: string;
    firstName?: string;
    lastName?: string;
    googleId?: string;
    idToken?: string;
    requestedGroup?: PricingGroup;
};

export type UpdateProfilePayload = {
    firstName?: string;
    lastName?: string;
    phone?: string;
    companyName?: string;
};

export type UpgradeRequestPayload = {
    requestedGroup: "WHOLESALE" | "DISTRIBUTOR";
    companyName: string;
    taxId?: string;
    businessLicenceRef?: string;
    phone?: string;
    notes?: string;
};

export type ChangePasswordPayload = {
    currentPassword: string;
    newPassword: string;
};

export function login(email: string, password: string): Promise<AuthResponse> {
    return apiFetch<AuthResponse>("/api/auth/login", {
        method: "POST",
        credentials: "include",
        body: JSON.stringify({email, password}),
    });
}

export function register(payload: RegisterPayload): Promise<AuthResponse> {
    return apiFetch<AuthResponse>("/api/auth/register", {
        method: "POST",
        credentials: "include",
        body: JSON.stringify(payload),
    });
}

export function loginWithGoogle(payload: GoogleLoginPayload): Promise<AuthResponse> {
    return apiFetch<AuthResponse>("/api/auth/google", {
        method: "POST",
        credentials: "include",
        body: JSON.stringify(payload),
    });
}

export function logout(): Promise<void> {
    return apiFetch<void>("/api/auth/logout", {
        method: "POST",
        credentials: "include",
    });
}

export async function getMe(): Promise<UserProfile> {
    const res = await apiFetch<any>("/api/auth/me");
    return res && res.user ? res.user : res;
}

export async function updateProfile(payload: UpdateProfilePayload): Promise<UserProfile> {
    const res = await apiFetch<any>("/api/auth/me", {
        method: "PUT",
        body: JSON.stringify(payload),
    });
    return res && res.user ? res.user : res;
}

export async function applyUpgradeRequest(payload: UpgradeRequestPayload): Promise<UserProfile> {
    const res = await apiFetch<any>("/api/auth/upgrade-request", {
        method: "POST",
        body: JSON.stringify(payload),
    });
    return res && res.user ? res.user : res;
}

export function changePassword(payload: ChangePasswordPayload): Promise<void> {
    return apiFetch<void>("/api/auth/me/password", {
        method: "PUT",
        body: JSON.stringify(payload),
    });
}

export function forgotPassword(email: string): Promise<void> {
    return apiFetch<void>("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({email}),
    });
}

export function resetPassword(token: string, newPassword: string): Promise<void> {
    return apiFetch<void>("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({token, newPassword}),
    });
}
