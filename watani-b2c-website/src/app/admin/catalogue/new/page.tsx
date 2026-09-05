"use client";

import Link from "next/link";
import {ProductForm} from "@/components/admin/product-form";

export default function NewProductPage() {
    return (
        <div>
            <Link href="/admin/catalogue" className="text-[13px] font-semibold text-muted hover:text-teal-950">
                ← Catalogue
            </Link>
            <h1 className="mt-2 text-[26px] font-extrabold text-teal-950">New product</h1>
            <div className="mt-6">
                <ProductForm/>
            </div>
        </div>
    );
}
