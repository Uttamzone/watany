"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock, ShieldCheck, User } from "lucide-react";
import { useAuth } from "@/components/auth/auth-store";
import { isAdminRole } from "@/lib/admin/permissions";
import { useNotifications } from "@/components/notifications/notification-store";

export default function AdminLoginPage() {
  const { login, logout } = useAuth();
  const router = useRouter();
  const notifications = useNotifications();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError("Please enter both Admin ID and Password.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const loggedInUser = await login(username.trim(), password);
      // After login, verify the user actually has an admin role
      const userRoles = (loggedInUser as any)?.roles ?? [];
      if (!isAdminRole(userRoles)) {
        // Log them out and deny access
        try { logout(); } catch {}
        setError("Access Denied: You do not have administrator privileges.");
        notifications.error("Access Denied", "This portal is for administrators only.");
        return;
      }
      notifications.success("Welcome back", "Logged into Watani Admin Portal");
      router.push("/admin");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid credentials";
      setError(message);
      notifications.error("Admin Login Failed", message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-teal-950 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Header Branding */}
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 p-3 shadow-xl backdrop-blur-md">
            <Image
              src="/logo/watany-logo.png"
              alt="Watani Logo"
              width={120}
              height={100}
              className="h-auto w-full"
            />
          </div>
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
            Watani Admin Portal
          </h1>
          <p className="mt-2 text-xs font-medium text-lime-400/90 uppercase tracking-widest flex items-center justify-center gap-1.5">
            <ShieldCheck className="size-4 inline" /> Secure Operations Dashboard
          </p>
        </div>

        {/* Login Card */}
        <div className="mt-8 rounded-3xl bg-white p-6 sm:p-8 shadow-2xl">
          {error && (
            <div className="mb-5 rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-600 border border-red-200">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="username"
                className="block text-xs font-extrabold uppercase tracking-wide text-teal-950"
              >
                Admin ID / Username
              </label>
              <div className="relative mt-1.5">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted">
                  <User className="size-4" />
                </div>
                <input
                  id="username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter Admin ID"
                  className="block w-full rounded-xl border border-black/15 bg-gray-50/50 py-2.5 pl-10 pr-3 text-sm text-teal-950 placeholder:text-gray-400 focus:border-teal-900 focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-extrabold uppercase tracking-wide text-teal-950"
              >
                Password
              </label>
              <div className="relative mt-1.5">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted">
                  <Lock className="size-4" />
                </div>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter Password"
                  className="block w-full rounded-xl border border-black/15 bg-gray-50/50 py-2.5 pl-10 pr-10 text-sm text-teal-950 placeholder:text-gray-400 focus:border-teal-900 focus:bg-white focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-teal-950"
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-6 flex w-full items-center justify-center rounded-xl bg-teal-950 py-3 text-sm font-bold text-white shadow-lg transition-all hover:bg-teal-900 focus:outline-none disabled:opacity-50"
            >
              {loading ? "Authenticating..." : "Sign In to Admin Portal"}
            </button>
          </form>

          <div className="mt-6 border-t border-black/10 pt-4 text-center">
            <a
              href="/"
              className="text-xs font-semibold text-muted hover:text-teal-950 hover:underline"
            >
              &larr; Back to Storefront Home
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
