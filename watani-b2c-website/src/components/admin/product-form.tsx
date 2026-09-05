"use client";

import {useEffect, useState} from "react";
import {useRouter} from "next/navigation";
import {Plus, Trash2} from "lucide-react";
import * as adminApi from "@/lib/admin/api";
import type {
    AdminImageResponse,
    PriceTierRequest,
    PricingGroup,
    ProductRequest,
    VariantRequest,
} from "@/lib/admin/types";
import {ApiError} from "@/lib/api";
import {getCategories} from "@/lib/products";
import {ProductImageManager, type StagedImage} from "@/components/admin/product-image-manager";
import {RichTextEditor} from "@/components/admin/rich-text-editor";
import {useNotifications} from "@/components/notifications/notification-store";

const OTHER_CATEGORY = "__other__";

// Local, not `Category` from @/lib/types: that type's slug is a closed union,
// but this form lets admins create arbitrary new categories.
type CategoryOption = { slug: string; name: string; tagline: string };

const GROUPS: PricingGroup[] = ["RETAIL", "WHOLESALE", "DISTRIBUTOR"];

function emptyTier(group: PricingGroup): PriceTierRequest {
    return {pricingGroup: group, unitPrice: 0, minQuantity: group === "RETAIL" ? null : 1};
}

function duplicateTierIndexes(priceTiers: PriceTierRequest[]): Set<number> {
    const seenAt = new Map<string, number>();
    const duplicates = new Set<number>();
    priceTiers.forEach((tier, index) => {
        const key = `${tier.pricingGroup}:${tier.minQuantity ?? 1}`;
        const firstIndex = seenAt.get(key);
        if (firstIndex === undefined) {
            seenAt.set(key, index);
        } else {
            duplicates.add(firstIndex);
            duplicates.add(index);
        }
    });
    return duplicates;
}

function emptyVariant(): VariantRequest {
    return {
        sku: "",
        unit: "",
        stockQuantity: 0,
        taxable: true,
        priceTiers: [emptyTier("RETAIL")],
    };
}

/** Empty numeric inputs clear the value instead of saving 0 - blank means "unknown". */
function numberOrNull(value: string): number | null {
    if (value.trim() === "") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Slug format is enforced here only (backend just checks @NotBlank). cleanSlugInput is the
 * lenient as-you-type pass; finalizeSlug trims edge hyphens on blur/submit.
 */
function cleanSlugInput(value: string): string {
    return value
        .toLowerCase()
        .replace(/[\s_]+/g, "-") // spaces and underscores read as word breaks
        .replace(/[^a-z0-9-]/g, "") // drop anything URL-unsafe outright
        .replace(/-{2,}/g, "-");
}

/** Lenient pass plus the edge trim that would fight the typist mid-word. */
function finalizeSlug(value: string): string {
    return cleanSlugInput(value).replace(/^-+|-+$/g, "");
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function emptyProduct(): ProductRequest {
    return {
        slug: "",
        name: "",
        fullName: "",
        subtitle: "",
        description: "",
        categorySlug: "",
        active: true,
        variants: [emptyVariant()],
    };
}

type ProductFormProps = {
    slug?: string; // when set, this is an edit - PUT fully replaces variants/price tiers
    initial?: ProductRequest;
    initialImages?: AdminImageResponse[];
};

/** Every variant needs >=1 tier including RETAIL, or the backend 400s (AdminCatalogueService rule). */
function validate(product: ProductRequest, isNewCategory: boolean, newCategoryName: string): string | null {
    if (!product.slug.trim()) return "Slug is required.";
    if (!SLUG_PATTERN.test(product.slug)) {
        return "Slug must be lowercase letters, numbers and single hyphens, e.g. jenin-olive-oil-1l.";
    }
    if (!product.name.trim()) return "Name is required.";
    if (!product.categorySlug.trim()) return "Category slug is required.";
    if (!SLUG_PATTERN.test(product.categorySlug)) {
        return "Category slug must be lowercase letters, numbers and single hyphens.";
    }
    if (isNewCategory && !newCategoryName.trim()) return "New category name is required.";
    if (product.variants.length === 0) return "At least one variant is required.";
    for (const variant of product.variants) {
        if (!variant.sku.trim()) return "Every variant needs a SKU.";
        if (!variant.priceTiers.some((tier) => tier.pricingGroup === "RETAIL")) {
            return `Variant ${variant.sku || "(unnamed)"} needs a RETAIL price tier.`;
        }
        if (duplicateTierIndexes(variant.priceTiers).size > 0) {
            return `Variant ${variant.sku || "(unnamed)"} has two price tiers for the same group and minimum quantity.`;
        }
    }
    return null;
}

export function ProductForm({slug: initialSlug, initial, initialImages}: ProductFormProps) {
    const router = useRouter();
    const notifications = useNotifications();
    const [product, setProduct] = useState<ProductRequest>(initial ?? emptyProduct());
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    // Lets a new product start receiving image uploads right after its first save.
    const [slug, setSlug] = useState<string | undefined>(initialSlug);
    // Slug mirrors the name until the admin edits it directly.
    const [slugEdited, setSlugEdited] = useState(Boolean(initialSlug));
    const [images, setImages] = useState<AdminImageResponse[]>(initialImages ?? []);
    // Images picked before the product exists; uploaded right after create.
    const [stagedImages, setStagedImages] = useState<StagedImage[]>([]);
    const [categories, setCategories] = useState<CategoryOption[]>([]);
    // Falls back to "Other" when the category isn't in the loaded list yet.
    const [categoryChoice, setCategoryChoice] = useState<string>(
        initial?.categorySlug ? OTHER_CATEGORY : "",
    );
    // Display name for a brand-new category (backend requires one).
    const [newCategoryName, setNewCategoryName] = useState("");
    // Same follow-until-touched rule as the product slug.
    const [categorySlugEdited, setCategorySlugEdited] = useState(false);

    useEffect(() => {
        getCategories().then((loaded) => {
            setCategories(loaded);
            const matches = initial?.categorySlug
                ? loaded.some((c) => c.slug === initial.categorySlug)
                : false;
            setCategoryChoice(matches ? initial!.categorySlug : initial?.categorySlug ? OTHER_CATEGORY : "");
        });
        // Only ever needs to run once per mount - `initial` is the form's starting value, not a live prop.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function updateVariant(index: number, patch: Partial<VariantRequest>) {
        setProduct((current) => ({
            ...current,
            variants: current.variants.map((v, i) => (i === index ? {...v, ...patch} : v)),
        }));
    }

    function updateTier(variantIndex: number, tierIndex: number, patch: Partial<PriceTierRequest>) {
        setProduct((current) => ({
            ...current,
            variants: current.variants.map((v, i) =>
                i === variantIndex
                    ? {...v, priceTiers: v.priceTiers.map((t, ti) => (ti === tierIndex ? {...t, ...patch} : t))}
                    : v,
            ),
        }));
    }

    function addVariant() {
        setProduct((current) => ({...current, variants: [...current.variants, emptyVariant()]}));
    }

    function removeVariant(index: number) {
        setProduct((current) => ({...current, variants: current.variants.filter((_, i) => i !== index)}));
    }

    function addTier(variantIndex: number) {
        const used = product.variants[variantIndex].priceTiers.map((t) => t.pricingGroup);
        const next = GROUPS.find((g) => !used.includes(g)) ?? "RETAIL";
        setProduct((current) => ({
            ...current,
            variants: current.variants.map((v, i) =>
                i === variantIndex ? {...v, priceTiers: [...v.priceTiers, emptyTier(next)]} : v,
            ),
        }));
    }

    function removeTier(variantIndex: number, tierIndex: number) {
        setProduct((current) => ({
            ...current,
            variants: current.variants.map((v, i) =>
                i === variantIndex ? {...v, priceTiers: v.priceTiers.filter((_, ti) => ti !== tierIndex)} : v,
            ),
        }));
    }

    async function handleSubmit(event: React.FormEvent) {
        event.preventDefault();
        // Submitting via Enter skips the inputs' blur, so run the strict pass here
        // too - otherwise a trailing hyphen the form would have fixed gets rejected.
        const normalized: ProductRequest = {
            ...product,
            slug: finalizeSlug(product.slug),
            categorySlug: finalizeSlug(product.categorySlug),
        };
        if (normalized.slug !== product.slug || normalized.categorySlug !== product.categorySlug) {
            setProduct(normalized);
        }
        const isNewCategory =
            categoryChoice === OTHER_CATEGORY &&
            !categories.some((c) => c.slug === normalized.categorySlug);
        const validationError = validate(normalized, isNewCategory, newCategoryName);
        if (validationError) {
            setError(validationError);
            notifications.error("Save failed", validationError);
            return;
        }
        setError(null);
        setSubmitting(true);
        try {
            if (isNewCategory) {
                const created = await adminApi.createCategory({
                    slug: normalized.categorySlug,
                    name: newCategoryName,
                });
                setCategories((current) => [...current, {
                    slug: created.slug,
                    name: created.name,
                    tagline: created.tagline ?? ""
                }]);
            }
            if (slug) {
                await adminApi.updateProduct(slug, normalized);
                router.push("/admin/catalogue");
            } else {
                // Stay on the form after create so images can be uploaded right away -
                // a brand-new product has no slug/id for the image endpoints until now.
                const created = await adminApi.createProduct(normalized);
                setSlug(created.slug);
                setImages(created.images);

                if (stagedImages.length > 0) {
                    const uploaded: AdminImageResponse[] = [];
                    let remaining = stagedImages;
                    try {
                        for (const staged of stagedImages) {
                            const image = await adminApi.uploadProductImage(created.slug, staged.file);
                            uploaded.push(image);
                            URL.revokeObjectURL(staged.previewUrl);
                            remaining = remaining.slice(1);
                        }
                    } catch (err) {
                        setImages([...created.images, ...uploaded]);
                        setStagedImages(remaining);
                        const uploadMessage = `Product created, but ${remaining.length} image(s) failed to upload: ${
                            err instanceof ApiError ? err.message : "Upload failed."
                        } You can retry below.`;
                        setError(uploadMessage);
                        notifications.error("Image upload failed", uploadMessage);
                        return;
                    }
                    setImages([...created.images, ...uploaded]);
                    setStagedImages([]);
                }
            }
        } catch (err) {
            const message = err instanceof ApiError ? err.message : "Save failed.";
            setError(message);
            notifications.error("Save failed", message);
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
                <p className="rounded-xl bg-coral/10 px-4 py-3 text-[14px] font-medium text-coral">{error}</p>
            )}

            <div className="rounded-2xl bg-white p-5 shadow-card">
                <h2 className="text-[15px] font-bold text-teal-950">Details</h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <Field label="Slug">
                        <input
                            value={product.slug}
                            onChange={(e) => {
                                setSlugEdited(true);
                                setProduct((c) => ({...c, slug: cleanSlugInput(e.target.value)}));
                            }}
                            onBlur={(e) =>
                                setProduct((c) => ({...c, slug: finalizeSlug(e.target.value)}))
                            }
                            disabled={Boolean(slug)}
                            placeholder="e.g. jenin-olive-oil-1l"
                            className="h-10 w-full rounded-xl border border-black/10 px-3 text-[14px] outline-none focus:border-teal-800 disabled:bg-soft-control"
                        />
                        {!slug && (
                            <p className="mt-1 text-[12px] text-muted">
                                Lowercase letters, numbers and hyphens. Spaces become hyphens as you type.
                            </p>
                        )}
                    </Field>
                    <Field label="Category slug">
                        <select
                            value={categoryChoice}
                            onChange={(e) => {
                                const value = e.target.value;
                                setCategoryChoice(value);
                                if (value === OTHER_CATEGORY) {
                                    // Re-entering "Other…" starts clean.
                                    setCategorySlugEdited(false);
                                    setNewCategoryName("");
                                    setProduct((c) => ({...c, categorySlug: ""}));
                                } else {
                                    setProduct((c) => ({...c, categorySlug: value}));
                                }
                            }}
                            className="h-10 w-full rounded-xl border border-black/10 px-3 text-[14px] outline-none focus:border-teal-800"
                        >
                            <option value="" disabled>
                                Select a category…
                            </option>
                            {categories.map((cat) => (
                                <option key={cat.slug} value={cat.slug}>
                                    {cat.name}
                                </option>
                            ))}
                            <option value={OTHER_CATEGORY}>Other…</option>
                        </select>
                        {categoryChoice === OTHER_CATEGORY && (
                            <div className="mt-2 space-y-2">
                                {/* Display name first: it's the field an admin actually knows,
                    and it fills in the slug below as they type. */}
                                <input
                                    value={newCategoryName}
                                    onChange={(e) => {
                                        const name = e.target.value;
                                        setNewCategoryName(name);
                                        if (!categorySlugEdited) {
                                            setProduct((c) => ({...c, categorySlug: cleanSlugInput(name)}));
                                        }
                                    }}
                                    placeholder="New category display name, e.g. Seasonal Specials"
                                    className="h-10 w-full rounded-xl border border-black/10 px-3 text-[14px] outline-none focus:border-teal-800"
                                />
                                <input
                                    value={product.categorySlug}
                                    onChange={(e) => {
                                        setCategorySlugEdited(true);
                                        setProduct((c) => ({...c, categorySlug: cleanSlugInput(e.target.value)}));
                                    }}
                                    onBlur={(e) =>
                                        setProduct((c) => ({...c, categorySlug: finalizeSlug(e.target.value)}))
                                    }
                                    placeholder="New category slug, e.g. seasonal-specials"
                                    className="h-10 w-full rounded-xl border border-black/10 px-3 text-[14px] outline-none focus:border-teal-800"
                                />
                                <p className="text-[12px] text-muted">
                                    Lowercase letters, numbers and hyphens - this becomes the category&apos;s URL.
                                    Saving the product creates the category.
                                </p>
                            </div>
                        )}
                    </Field>
                    <Field label="Name">
                        <input
                            value={product.name}
                            onChange={(e) => {
                                const name = e.target.value;
                                setProduct((c) => ({
                                    ...c,
                                    name,
                                    ...(slugEdited ? {} : {slug: cleanSlugInput(name)}),
                                }));
                            }}
                            placeholder="e.g. Jenin Olive Oil"
                            className="h-10 w-full rounded-xl border border-black/10 px-3 text-[14px] outline-none focus:border-teal-800"
                        />
                    </Field>
                    <Field label="Full name">
                        <input
                            value={product.fullName}
                            onChange={(e) => setProduct((c) => ({...c, fullName: e.target.value}))}
                            placeholder="e.g. Jenin Extra Virgin Olive Oil - 1L Tin"
                            className="h-10 w-full rounded-xl border border-black/10 px-3 text-[14px] outline-none focus:border-teal-800"
                        />
                    </Field>
                </div>
                <Field label="Description" className="mt-4">
          <textarea
              value={product.description ?? ""}
              onChange={(e) => setProduct((c) => ({...c, description: e.target.value}))}
              rows={3}
              placeholder="Short summary shown on product cards and search results."
              className="w-full rounded-xl border border-black/10 px-3 py-2 text-[14px] outline-none focus:border-teal-800"
          />
                </Field>
                {/* Not a <Field>: a <label> around contentEditable breaks caret placement. */}
                <div className="mt-4">
          <span className="mb-1 block text-[12px] font-semibold text-muted">
            Long description (Description tab)
          </span>
                    <RichTextEditor
                        value={product.longDescription ?? ""}
                        onChange={(html) => setProduct((c) => ({...c, longDescription: html}))}
                        placeholder="Describe the product - use Heading for section titles, and lists for key points."
                    />
                    <p className="mt-1.5 text-[12px] text-muted">
                        This is what shoppers read on the product page&rsquo;s Description tab.
                        Formatting is limited to the styles in the toolbar.
                    </p>
                </div>
                <label className="mt-4 flex items-center gap-2 text-[13px] font-semibold text-teal-950">
                    <input
                        type="checkbox"
                        checked={product.active ?? true}
                        onChange={(e) => setProduct((c) => ({...c, active: e.target.checked}))}
                    />
                    Active
                </label>
            </div>

            <ProductImageManager
                slug={slug}
                images={images}
                onImagesChange={setImages}
                stagedImages={stagedImages}
                onStagedImagesChange={setStagedImages}
            />

            <div className="rounded-2xl bg-white p-5 shadow-card">
                <div className="flex items-center justify-between">
                    <h2 className="text-[15px] font-bold text-teal-950">Variants</h2>
                    <button
                        type="button"
                        onClick={addVariant}
                        className="flex items-center gap-1 rounded-full bg-soft-control px-3 py-1.5 text-[12px] font-bold text-teal-950"
                    >
                        <Plus className="size-3.5"/> Add variant
                    </button>
                </div>

                <div className="mt-4 space-y-4">
                    {product.variants.map((variant, vi) => (
                        <div key={vi} className="rounded-xl border border-black/10 p-4">
                            <div className="flex items-center justify-between">
                                <p className="text-[13px] font-bold text-teal-950">Variant {vi + 1}</p>
                                {product.variants.length > 1 && (
                                    <button type="button" onClick={() => removeVariant(vi)} className="text-coral">
                                        <Trash2 className="size-4"/>
                                    </button>
                                )}
                            </div>
                            <div className="mt-3 grid gap-3 sm:grid-cols-3">
                                <Field label="SKU">
                                    <input
                                        value={variant.sku}
                                        onChange={(e) => updateVariant(vi, {sku: e.target.value})}
                                        placeholder="e.g. WS-OO-JEN-1L"
                                        className="h-9 w-full rounded-lg border border-black/10 px-2 text-[13px]"
                                    />
                                </Field>
                                <Field label="Unit">
                                    <input
                                        value={variant.unit}
                                        onChange={(e) => updateVariant(vi, {unit: e.target.value})}
                                        placeholder="e.g. 1L"
                                        className="h-9 w-full rounded-lg border border-black/10 px-2 text-[13px]"
                                    />
                                </Field>
                                <Field label="Stock quantity">
                                    <input
                                        type="number"
                                        min={0}
                                        value={variant.stockQuantity}
                                        onChange={(e) => updateVariant(vi, {stockQuantity: Number(e.target.value)})}
                                        placeholder="0"
                                        className="h-9 w-full rounded-lg border border-black/10 px-2 text-[13px]"
                                    />
                                </Field>
                            </div>

                            {/* Shipping dimensions: quoted by the courier, shown on the storefront's info tab. */}
                            <div className="mt-3 grid gap-3 sm:grid-cols-4">
                                <Field label="Weight (g)">
                                    <input
                                        type="number"
                                        min={0}
                                        value={variant.weightGrams ?? ""}
                                        onChange={(e) =>
                                            updateVariant(vi, {weightGrams: numberOrNull(e.target.value)})
                                        }
                                        placeholder="e.g. 920"
                                        className="h-9 w-full rounded-lg border border-black/10 px-2 text-[13px]"
                                    />
                                </Field>
                                <Field label="Length (cm)">
                                    <input
                                        type="number"
                                        min={0}
                                        step="0.01"
                                        value={variant.lengthCm ?? ""}
                                        onChange={(e) =>
                                            updateVariant(vi, {lengthCm: numberOrNull(e.target.value)})
                                        }
                                        placeholder="e.g. 9.5"
                                        className="h-9 w-full rounded-lg border border-black/10 px-2 text-[13px]"
                                    />
                                </Field>
                                <Field label="Width (cm)">
                                    <input
                                        type="number"
                                        min={0}
                                        step="0.01"
                                        value={variant.widthCm ?? ""}
                                        onChange={(e) =>
                                            updateVariant(vi, {widthCm: numberOrNull(e.target.value)})
                                        }
                                        placeholder="e.g. 9.5"
                                        className="h-9 w-full rounded-lg border border-black/10 px-2 text-[13px]"
                                    />
                                </Field>
                                <Field label="Height (cm)">
                                    <input
                                        type="number"
                                        min={0}
                                        step="0.01"
                                        value={variant.heightCm ?? ""}
                                        onChange={(e) =>
                                            updateVariant(vi, {heightCm: numberOrNull(e.target.value)})
                                        }
                                        placeholder="e.g. 24"
                                        className="h-9 w-full rounded-lg border border-black/10 px-2 text-[13px]"
                                    />
                                </Field>
                            </div>

                            <div className="mt-3 grid gap-3 sm:grid-cols-4">
                                <Field label="HS code">
                                    <input
                                        type="text"
                                        value={variant.hsCode ?? ""}
                                        onChange={(e) =>
                                            updateVariant(vi, {hsCode: e.target.value === "" ? null : e.target.value})
                                        }
                                        placeholder="e.g. 1509.10"
                                        className="h-9 w-full rounded-lg border border-black/10 px-2 text-[13px]"
                                    />
                                </Field>
                                <label
                                    className="flex items-center gap-2 self-end pb-1.5 text-[13px] font-semibold text-teal-950">
                                    <input
                                        type="checkbox"
                                        checked={variant.taxable ?? true}
                                        onChange={(e) => updateVariant(vi, {taxable: e.target.checked})}
                                    />
                                    Taxable
                                </label>
                            </div>

                            {/* Customs declaration data - distinct from the marketing name/description above,
                                since carriers need the plain commercial name, not our branding. */}
                            <div className="mt-3 grid gap-3 sm:grid-cols-3">
                                <Field label="Country of origin">
                                    <input
                                        type="text"
                                        value={variant.customsCountryOfOrigin ?? "Israel"}
                                        onChange={(e) =>
                                            updateVariant(vi, {
                                                customsCountryOfOrigin: e.target.value === "" ? null : e.target.value,
                                            })
                                        }
                                        placeholder="Israel"
                                        className="h-9 w-full rounded-lg border border-black/10 px-2 text-[13px]"
                                    />
                                </Field>
                                <Field label="Customs description">
                                    <input
                                        type="text"
                                        value={variant.customsDescription ?? ""}
                                        onChange={(e) =>
                                            updateVariant(vi, {
                                                customsDescription: e.target.value === "" ? null : e.target.value,
                                            })
                                        }
                                        placeholder="Plain commercial name for the customs form"
                                        className="h-9 w-full rounded-lg border border-black/10 px-2 text-[13px]"
                                    />
                                </Field>
                                <Field label="Manufacturer (name & address)">
                                    <input
                                        type="text"
                                        value={variant.customsManufacturer ?? ""}
                                        onChange={(e) =>
                                            updateVariant(vi, {
                                                customsManufacturer: e.target.value === "" ? null : e.target.value,
                                            })
                                        }
                                        placeholder="Full legal name and address"
                                        maxLength={300}
                                        className="h-9 w-full rounded-lg border border-black/10 px-2 text-[13px]"
                                    />
                                </Field>
                            </div>

                            <div className="mt-3">
                                <div className="flex items-center justify-between">
                                    <p className="text-[12px] font-bold uppercase tracking-wide text-muted">Price
                                        tiers</p>
                                    <button
                                        type="button"
                                        onClick={() => addTier(vi)}
                                        className="text-[11px] font-bold text-teal-800"
                                    >
                                        + Add tier
                                    </button>
                                </div>
                                <div className="mt-2 space-y-2">
                                    {(() => {
                                        const duplicates = duplicateTierIndexes(variant.priceTiers);
                                        return variant.priceTiers.map((tier, ti) => (
                                        <div
                                            key={ti}
                                            className={`rounded-lg border p-2.5 sm:flex sm:items-end sm:gap-2 sm:border-0 sm:p-0 ${
                                                duplicates.has(ti) ? "border-coral" : "border-black/10"
                                            }`}
                                        >
                                            <div className="flex items-end gap-1.5 sm:contents">
                                                <Field label="Group" className="w-[34%] shrink-0 sm:w-32">
                                                    <select
                                                        value={tier.pricingGroup}
                                                        onChange={(e) => updateTier(vi, ti, {pricingGroup: e.target.value as PricingGroup})}
                                                        className="h-9 w-full rounded-lg border border-black/10 px-1.5 text-[11px] sm:px-2 sm:text-[12px]"
                                                    >
                                                        {GROUPS.map((g) => (
                                                            <option key={g} value={g}>
                                                                {g}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </Field>
                                                <Field label="Unit price" className="min-w-0 flex-1 sm:w-28 sm:flex-none">
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        min={0}
                                                        placeholder="0.00"
                                                        value={tier.unitPrice}
                                                        onChange={(e) => updateTier(vi, ti, {unitPrice: Number(e.target.value)})}
                                                        className="h-9 w-full min-w-0 rounded-lg border border-black/10 px-1.5 text-[11px] sm:px-2 sm:text-[12px]"
                                                    />
                                                </Field>
                                                <Field label="Min qty" className="min-w-0 flex-1 sm:w-24 sm:flex-none">
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        placeholder="—"
                                                        value={tier.minQuantity ?? ""}
                                                        onChange={(e) =>
                                                            updateTier(vi, ti, {
                                                                minQuantity: e.target.value ? Number(e.target.value) : null,
                                                            })
                                                        }
                                                        className="h-9 w-full min-w-0 rounded-lg border border-black/10 px-1.5 text-[11px] sm:px-2 sm:text-[12px]"
                                                    />
                                                </Field>
                                                {variant.priceTiers.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => removeTier(vi, ti)}
                                                        aria-label="Remove price tier"
                                                        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-coral transition-colors hover:bg-coral/10"
                                                    >
                                                        <Trash2 className="size-3.5"/>
                                                    </button>
                                                )}
                                            </div>
                                            {duplicates.has(ti) && (
                                                <p className="mt-1.5 text-[11px] font-semibold text-coral sm:basis-full">
                                                    Duplicate: another tier already uses this group and minimum quantity.
                                                </p>
                                            )}
                                        </div>
                                    ));
                                    })()}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <button
                type="submit"
                disabled={submitting}
                className="h-11 rounded-full bg-lime-500 px-6 text-[14px] font-bold text-teal-950 disabled:opacity-60"
            >
                {submitting ? "Saving…" : slug ? "Save changes" : "Create product"}
            </button>
        </form>
    );
}

function Field({
                   label,
                   children,
                   className = "",
               }: {
    label: string;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <label className={`block ${className}`}>
            <span className="mb-1 block text-[12px] font-semibold text-muted">{label}</span>
            {children}
        </label>
    );
}
