import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Page Not Found | Watani & Sons",
    description: "The page you are looking for could not be found.",
    robots: { index: false, follow: false },
};

export default function NotFound() {
    return (
        <div className="shell flex min-h-[60vh] flex-col items-center justify-center pt-12 pb-20 text-center">
            <span className="rounded-full bg-lime-500/20 px-4 py-1.5 text-[13px] font-bold text-teal-950">
                404 Error
            </span>
            <h1 className="mt-4 text-[32px] font-extrabold text-teal-950 sm:text-[44px]">
                Page not found
            </h1>
            <p className="mt-3 max-w-md text-[16px] text-muted">
                Sorry, the page you are looking for does not exist or has been moved. Explore our authentic Palestinian products below.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                <Link
                    href="/"
                    className="inline-flex h-12 items-center justify-center rounded-full bg-lime-500 px-7 text-[15px] font-bold text-teal-950 transition-transform duration-150 hover:-translate-y-0.5"
                >
                    Back to homepage
                </Link>
                <Link
                    href="/categories"
                    className="inline-flex h-12 items-center justify-center rounded-full border border-black/15 bg-white px-7 text-[15px] font-bold text-teal-950 transition-colors duration-150 hover:bg-black/5"
                >
                    Browse catalogue
                </Link>
            </div>
        </div>
    );
}
