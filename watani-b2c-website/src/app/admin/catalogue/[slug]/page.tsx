"use client";

import {use, useEffect, useState} from "react";
import Link from "next/link";
import * as adminApi from "@/lib/admin/api";
import type {AdminProductResponse, ProductRequest} from "@/lib/admin/types";
import {ProductForm} from "@/components/admin/product-form";
import {ApiError} from "@/lib/api";
import {useNotifications} from "@/components/notifications/notification-store";

/**
 * Round-trips the whole product since PUT fully replaces it - any field omitted
 * here would be erased on save. Images are handled by separate endpoints.
 */
function toRequest(response: AdminProductResponse): ProductRequest {
    return {
        slug: response.slug,
        name: response.name,
        fullName: response.fullName,
        subtitle: response.subtitle,
        description: response.description,
        longDescription: response.longDescription,
        categorySlug: response.categorySlug,
        brandSlug: response.brandSlug,
        region: response.region,
        material: response.material,
        color: response.color,
        badge: response.badge,
        active: response.active,
        variants: response.variants.map((variant) => ({
            id: variant.id,
            sku: variant.sku,
            unit: variant.unit,
            stockQuantity: variant.stockQuantity,
            lowStockThreshold: variant.lowStockThreshold,
            backorderAllowed: variant.backorderAllowed,
            weightGrams: variant.weightGrams,
            lengthCm: variant.lengthCm,
            widthCm: variant.widthCm,
            heightCm: variant.heightCm,
            hsCode: variant.hsCode,
            taxable: variant.taxable,
            priceTiers: variant.priceTiers.map((tier) => ({
                id: tier.id,
                pricingGroup: tier.pricingGroup,
                unitPrice: tier.unitPrice,
                minQuantity: tier.minQuantity,
                compareAtPrice: tier.compareAtPrice,
                validFrom: tier.validFrom,
                validTo: tier.validTo,
            })),
        })),
    };
}

export default function EditProductPage({params}: { params: Promise<{ slug: string }> }) {
    // Decode first - passing the raw (still-encoded) segment through would
    // double-encode it and the lookup would miss.
    const slug = decodeURIComponent(use(params).slug);
    const notifications = useNotifications();
    const [response, setResponse] = useState<AdminProductResponse | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        adminApi
            .getProduct(slug)
            .then(setResponse)
            .catch((err) => {
                const message = err instanceof ApiError ? err.message : "Failed to load product.";
                setError(message);
                notifications.error("Failed to load product", message);
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [slug]);

    return (
        <div>
            <Link href="/admin/catalogue" className="text-[13px] font-semibold text-muted hover:text-teal-950">
                ← Catalogue
            </Link>
            <h1 className="mt-2 text-[26px] font-extrabold text-teal-950">Edit product</h1>
            <p className="mt-1 text-[13px] text-muted">
                Saving fully replaces this product&apos;s variants and price tiers.
            </p>

            {error && (
                <p className="mt-4 rounded-xl bg-coral/10 px-4 py-3 text-[14px] font-medium text-coral">{error}</p>
            )}

            {response && (
                <div className="mt-6">
                    <ProductForm slug={slug} initial={toRequest(response)} initialImages={response.images}/>
                </div>
            )}
        </div>
    );
}
