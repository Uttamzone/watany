import type {AuthResponse} from "@/lib/auth";

/**
 * Resolves API Base URL dynamically.
 * In production browser sessions, if NEXT_PUBLIC_API_BASE_URL was not passed at build time
 * (or defaulted to localhost), it dynamically falls back to the current browser origin or
 * https://wataniandsons.ca, preventing "Failed to fetch" and Mixed Content blocks for real shoppers.
 */
export function getApiBaseUrl(): string {
    if (typeof window !== "undefined") {
        const envUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
        if (envUrl && !envUrl.includes("localhost") && !envUrl.includes("127.0.0.1")) {
            return envUrl.replace(/\/$/, "");
        }
        if (window.location.hostname && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
            return window.location.origin;
        }
    }
    const envUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
    if (envUrl) {
        return envUrl.replace(/\/$/, "");
    }
    return process.env.NODE_ENV === "production" ? "https://wataniandsons.ca" : "http://localhost:8080";
}

export const API_BASE_URL = getApiBaseUrl();

export class ApiError extends Error {
    constructor(
        message: string,
        readonly status: number,
        readonly fieldErrors?: Record<string, string>,
        /** Machine-readable code for errors a caller needs to branch on, e.g. "ACCOUNT_PENDING_APPROVAL". */
        readonly errorCode?: string,
    ) {
        super(message);
        this.name = "ApiError";
    }
}

/** Matches GlobalExceptionHandler.ApiError on the backend. */
type BackendApiError = {
    message?: string;
    fieldErrors?: Record<string, string> | null;
    errorCode?: string | null;
};

// Mirrored here (not just in AuthProvider's React state) so apiFetch can
// read/refresh it synchronously, without a render dependency or circular import.
let currentAccessToken: string | null = null;

export function setAccessToken(token: string | null) {
    currentAccessToken = token;
    if (typeof window !== "undefined") {
        if (token) {
            localStorage.setItem("watani_access_token", token);
        } else {
            localStorage.removeItem("watani_access_token");
        }
    }
}

export function getAccessToken(): string | null {
    if (!currentAccessToken && typeof window !== "undefined") {
        currentAccessToken = localStorage.getItem("watani_access_token");
    }
    return currentAccessToken;
}

/**
 * Resolves once AuthProvider's mount-time silent refresh has settled, either way.
 *
 * Without this gate, CartProvider's read raced the refresh and went out anonymous
 * for a signed-in shopper. The backend then created a throwaway guest cart and
 * echoed its token, which the client persisted over the real one - the reloaded
 * cart looked empty and later adds landed in a different cart.
 */
let resolveAuthSettled: (() => void) | null = null;
const authSettled: Promise<void> = new Promise((resolve) => {
    resolveAuthSettled = resolve;
});

/** Called by AuthProvider once the mount-time refresh resolves or rejects. */
export function markAuthSettled() {
    resolveAuthSettled?.();
    resolveAuthSettled = null;
}

/**
 * Awaited by callers whose request must carry the access token if one exists.
 *
 * Races a timeout so a tree without an AuthProvider (or a hung refresh) degrades
 * to an anonymous request instead of leaving the cart spinning forever.
 */
const AUTH_SETTLE_TIMEOUT_MS = 5000;

export function whenAuthSettled(): Promise<void> {
    return Promise.race([
        authSettled,
        new Promise<void>((resolve) =>
            setTimeout(resolve, AUTH_SETTLE_TIMEOUT_MS),
        ),
    ]);
}

// Registered by AuthProvider on mount; invoked when a refresh-and-retry cycle
// still ends in an auth failure, so the app can clear state and redirect.
type AuthFailureHandler = () => void;
let authFailureHandler: AuthFailureHandler | null = null;

export function setAuthFailureHandler(handler: AuthFailureHandler | null) {
    authFailureHandler = handler;
}

// Registered by CartProvider on mount; invoked whenever AuthProvider clears a
// session (explicit logout or an auth failure) so the cart resets to empty
// immediately instead of showing the previous account's lines until the next
// background refetch resolves.
type SessionClearedHandler = () => void;
let sessionClearedHandler: SessionClearedHandler | null = null;

export function setSessionClearedHandler(handler: SessionClearedHandler | null) {
    sessionClearedHandler = handler;
}

export function notifySessionCleared() {
    sessionClearedHandler?.();
}

// Only one refresh should ever be in flight, full stop - not just for concurrent 401s sharing
// it, but so AuthProvider's mount-time session restore (auth-store.tsx) and any 401-triggered
// retry below always go through the exact same in-flight call. Two independent refresh calls
// (e.g. a backgrounded tab reloading and racing the click that follows) each present the same
// one-shot refresh token; the backend can only honor one, and used to revoke the *entire*
// session over what was really just this race - see RefreshTokenService's grace window for the
// backend half of this fix. Confirmed in production 2026-08.
let refreshPromise: Promise<AuthResponse | null> | null = null;

export async function silentRefresh(): Promise<AuthResponse | null> {
    if (refreshPromise) return refreshPromise;

    refreshPromise = (async () => {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2500);
            const baseUrl = getApiBaseUrl();
            const response = await fetch(`${baseUrl}/api/auth/refresh`, {
                method: "POST",
                credentials: "include",
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            if (!response.ok) {
                return null;
            }
            const body = (await response.json()) as AuthResponse;
            setAccessToken(body.token);
            return body;
        } catch {
            return null;
        } finally {
            refreshPromise = null;
        }
    })();

    return refreshPromise;
}

const AUTH_ENDPOINTS_WITHOUT_RETRY = new Set([
    "/api/auth/refresh",
    "/api/auth/login",
    "/api/auth/register",
]);

/**
 * Thin wrapper around fetch for watani-b2c-service. Uncached by default - caching a
 * pricing-group-specific response could leak wholesale pricing to retail (N-SCL-5).
 * A 401 triggers one silent refresh + retry, then falls back to the auth-failure handler.
 */
async function throwIfNotOk(response: Response, path: string): Promise<void> {
    if (response.ok) return;
    let message = `Request to ${path} failed`;
    let fieldErrors: Record<string, string> | undefined;
    let errorCode: string | undefined;
    try {
        const body = (await response.json()) as BackendApiError;
        if (body.message) message = body.message;
        if (body.fieldErrors) fieldErrors = body.fieldErrors;
        if (body.errorCode) errorCode = body.errorCode;
    } catch {
        // Non-JSON error body - fall back to the generic message.
    }
    throw new ApiError(message, response.status, fieldErrors, errorCode);
}

export async function apiFetch<T>(
    path: string,
    init?: RequestInit,
    _isRetry = false,
): Promise<T> {
    const headers = new Headers(init?.headers);
    headers.set("Content-Type", "application/json");
    if (currentAccessToken) {
        headers.set("Authorization", `Bearer ${currentAccessToken}`);
    }

    const baseUrl = getApiBaseUrl();
    let response: Response;
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);
        const signal = init?.signal ?? controller.signal;
        response = await fetch(`${baseUrl}${path}`, {
            ...init,
            headers,
            signal,
        });
        clearTimeout(timeoutId);
    } catch {
        throw new ApiError(
            `Unable to connect to backend server at ${baseUrl}. Please make sure the backend service is running on port 8080.`,
            0,
        );
    }

    if (response.status === 401 && !_isRetry && !AUTH_ENDPOINTS_WITHOUT_RETRY.has(path)) {
        const refreshed = await silentRefresh();
        if (refreshed) {
            return apiFetch<T>(path, init, true);
        }
        const hasStoredUser = typeof window !== "undefined" && Boolean(localStorage.getItem("watani_user_profile"));
        const isLocalToken = currentAccessToken && (
            currentAccessToken.startsWith("wataniadmin") ||
            currentAccessToken.startsWith("google-oauth-token") ||
            currentAccessToken.startsWith("dev-local-token") ||
            currentAccessToken.startsWith("session-token")
        );
        if (!hasStoredUser && !isLocalToken) {
            authFailureHandler?.();
        }
    }

    await throwIfNotOk(response, path);

    if (response.status === 204) {
        return undefined as T;
    }

    return response.json() as Promise<T>;
}

/**
 * Like apiFetch, but for multipart/form-data bodies (file uploads). Deliberately
 * does not set Content-Type - the browser must set its own multipart boundary.
 */
export async function apiFetchForm<T>(
    path: string,
    formData: FormData,
    init?: Omit<RequestInit, "body">,
    _isRetry = false,
): Promise<T> {
    const headers = new Headers(init?.headers);
    if (currentAccessToken) {
        headers.set("Authorization", `Bearer ${currentAccessToken}`);
    }

    const baseUrl = getApiBaseUrl();
    const response = await fetch(`${baseUrl}${path}`, {
        ...init,
        method: init?.method ?? "POST",
        headers,
        body: formData,
    });

    if (response.status === 401 && !_isRetry) {
        const refreshed = await silentRefresh();
        if (refreshed) {
            return apiFetchForm<T>(path, formData, init, true);
        }
        authFailureHandler?.();
    }

    await throwIfNotOk(response, path);

    if (response.status === 204) {
        return undefined as T;
    }

    return response.json() as Promise<T>;
}

/**
 * Like apiFetch, but for binary responses (PDF downloads). Returns the raw
 * blob instead of parsing JSON.
 */
export async function apiFetchBlob(
    path: string,
    init?: RequestInit,
    _isRetry = false,
): Promise<Blob> {
    const headers = new Headers(init?.headers);
    if (currentAccessToken) {
        headers.set("Authorization", `Bearer ${currentAccessToken}`);
    }

    const baseUrl = getApiBaseUrl();
    const response = await fetch(`${baseUrl}${path}`, {
        ...init,
        headers,
    });

    if (response.status === 401 && !_isRetry) {
        const refreshed = await silentRefresh();
        if (refreshed) {
            return apiFetchBlob(path, init, true);
        }
        authFailureHandler?.();
    }

    await throwIfNotOk(response, path);

    return response.blob();
}

