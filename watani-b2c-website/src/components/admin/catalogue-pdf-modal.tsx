"use client";

import {useEffect, useMemo, useState} from "react";
import {AnimatePresence, motion} from "framer-motion";
import {Download, FileText} from "lucide-react";
import {motionTokens, sec} from "@/lib/motion";
import * as adminApi from "@/lib/admin/api";
import type {AdminProductResponse, AdminVariantResponse, HsCodeTaxRateResponse, PricingGroup} from "@/lib/admin/types";
import {PLACEHOLDER_PRODUCT_IMAGE} from "@/lib/products";

type FieldKey =
    | "product"
    | "image"
    | "category"
    | "minQuantity"
    | "sku"
    | "unit"
    | "stock"
    | "tax"
    | "price"
    | "priceRetail"
    | "priceWholesale"
    | "priceDistributor";

/**
 * How a field renders in the card: "title" is the big product name, "chip" is a small pill
 * (category/tax), "price" gets bold emphasis in the brand color, "meta" is a small muted line -
 * this drives layout, not just which fields appear.
 */
type FieldRole = "title" | "chip" | "price" | "meta";

type FieldDef = {
    key: FieldKey;
    label: string;
    defaultOn: boolean;
    role: FieldRole;
    /** Field is per-variant, not per-product - selecting one switches the export to one row per variant. */
    variantLevel?: boolean;
};

const FIELD_DEFS: FieldDef[] = [
    {key: "product", label: "Product", defaultOn: true, role: "title"},
    {key: "image", label: "Image", defaultOn: true, role: "meta"},
    {key: "category", label: "Category", defaultOn: true, role: "chip"},
    {key: "minQuantity", label: "Min. Order (MOQ)", defaultOn: true, role: "chip"},
    {key: "price", label: "Price (retail)", defaultOn: true, role: "price"},
    {key: "tax", label: "Tax", defaultOn: true, role: "chip"},
    {key: "sku", label: "SKU", defaultOn: false, role: "meta", variantLevel: true},
    {key: "unit", label: "Unit", defaultOn: false, role: "meta", variantLevel: true},
    {key: "stock", label: "Stock", defaultOn: false, role: "meta", variantLevel: true},
    {key: "priceRetail", label: "Retail price (all tiers)", defaultOn: false, role: "price", variantLevel: true},
    {key: "priceWholesale", label: "Wholesale price (all tiers)", defaultOn: false, role: "price", variantLevel: true},
    {key: "priceDistributor", label: "Distributor price (all tiers)", defaultOn: false, role: "price", variantLevel: true},
    // Status is intentionally not offered here - excluded by default per catalogue PDF export requirements.
];

/** The on-screen preview is a taste of the layout, not a live render of every item - only the first few show. */
const PREVIEW_LIMIT = 2;

function money(value: number) {
    return new Intl.NumberFormat("en-CA", {style: "currency", currency: "CAD"}).format(value);
}

/** The lowest-minQuantity (base) tier for a pricing group - the price shown before quantity breaks apply. */
function baseTierPrice(variant: AdminVariantResponse | undefined, group: PricingGroup): number | null {
    if (!variant) return null;
    const tiers = variant.priceTiers.filter((t) => t.pricingGroup === group);
    if (tiers.length === 0) return null;
    const base = tiers.reduce((lowest, t) => ((t.minQuantity ?? 0) < (lowest.minQuantity ?? 0) ? t : lowest));
    return base.unitPrice;
}

/** All tiers for a group, formatted as "price (min qty+)" - e.g. wholesale often has multiple quantity breaks. */
function allTiersLabel(variant: AdminVariantResponse | undefined, group: PricingGroup): string {
    if (!variant) return "-";
    const tiers = variant.priceTiers
        .filter((t) => t.pricingGroup === group)
        .sort((a, b) => (a.minQuantity ?? 0) - (b.minQuantity ?? 0));
    if (tiers.length === 0) return "-";
    return tiers
        .map((t) => (t.minQuantity && t.minQuantity > 1 ? `${money(t.unitPrice)} (${t.minQuantity}+)` : money(t.unitPrice)))
        .join(", ");
}

function defaultImage(product: AdminProductResponse) {
    return product.images.find((img) => img.isDefault) ?? product.images[0];
}

/** The product's own image, falling back to the storefront's catalogue placeholder when it has none. */
function imageUrl(product: AdminProductResponse): string {
    return defaultImage(product)?.url ?? PLACEHOLDER_PRODUCT_IMAGE;
}

/** Company identity shown on every generated PDF's header/footer so it's recognizable when forwarded to customers. */
const COMPANY_NAME = "Watany and Sons Corp.";
const COMPANY_ADDRESS = "300 Greenbank Rd, Ottawa, ON K2H 0B6";
const COMPANY_PHONE = "+1 613-854-7777";
const COMPANY_EMAIL = "Info@wataniandsons.com";
const COMPANY_LOGO_URL = "/logo/watany-logo.png";

const JSPDF_SUPPORTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function blobToDataUri(blob: Blob): Promise<string | null> {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : null);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
    });
}

/** Redraws a data URI through a canvas as PNG, for image formats jsPDF's addImage can't embed directly (e.g. AVIF, SVG). */
function toPngDataUri(dataUri: string): Promise<string | null> {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = img.naturalWidth || 1;
            canvas.height = img.naturalHeight || 1;
            const ctx = canvas.getContext("2d");
            if (!ctx) return resolve(null);
            ctx.drawImage(img, 0, 0);
            try {
                resolve(canvas.toDataURL("image/png"));
            } catch {
                resolve(null);
            }
        };
        img.onerror = () => resolve(null);
        img.src = dataUri;
    });
}

/**
 * Loads an image URL into a jsPDF-compatible base64 data URI. Requires the backend to send
 * CORS headers for the image origin (see CorsConfig's /uploads/** mapping) - without them the
 * fetch is blocked by the browser and this resolves null, leaving the PDF's image cell blank.
 */
async function toDataUri(url: string): Promise<string | null> {
    try {
        const response = await fetch(url, {mode: "cors"});
        if (!response.ok) return null;
        const blob = await response.blob();
        const dataUri = await blobToDataUri(blob);
        if (!dataUri) return null;
        if (JSPDF_SUPPORTED_TYPES.has(blob.type)) return dataUri;
        return await toPngDataUri(dataUri);
    } catch {
        return null;
    }
}

type ExportRow = {
    product: AdminProductResponse;
    variant: AdminVariantResponse | undefined;
};

type CataloguePdfModalProps = {
    open: boolean;
    onClose: () => void;
    /** Products to include - the full filtered/searched list, or a single product for row-level export. */
    products: AdminProductResponse[];
    /** Shown in the modal title, e.g. "Catalogue" or the single product's name. */
    title?: string;
};

export function CataloguePdfModal({open, onClose, products, title}: CataloguePdfModalProps) {
    const [fields, setFields] = useState<Record<FieldKey, boolean>>(() =>
        Object.fromEntries(FIELD_DEFS.map((f) => [f.key, f.defaultOn])) as Record<FieldKey, boolean>,
    );
    const [taxRates, setTaxRates] = useState<HsCodeTaxRateResponse[]>([]);
    const [generating, setGenerating] = useState(false);

    useEffect(() => {
        if (!open) return;
        adminApi.listHsCodeTaxRates().then(setTaxRates).catch(() => setTaxRates([]));
    }, [open]);

    useEffect(() => {
        if (!open) return;

        function onKey(event: KeyboardEvent) {
            if (event.key === "Escape") onClose();
        }

        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    const taxRateByHsCode = useMemo(() => {
        const map = new Map<string, number>();
        for (const rate of taxRates) map.set(rate.hsCode, rate.rate);
        return map;
    }, [taxRates]);

    function taxLabel(variant: AdminVariantResponse | undefined): string {
        if (!variant || !variant.taxable) return "Tax-exempt";
        if (!variant.hsCode) return "-";
        const rate = taxRateByHsCode.get(variant.hsCode);
        return rate != null ? `${(rate * 100).toFixed(1)}%` : "-";
    }

    function toggleField(key: FieldKey) {
        setFields((prev) => ({...prev, [key]: !prev[key]}));
    }

    const activeFields = useMemo(() => FIELD_DEFS.filter((f) => fields[f.key]), [fields]);
    const isVariantLevel = useMemo(() => activeFields.some((f) => f.variantLevel), [activeFields]);

    // One row per variant once any variant-level field (SKU, stock, per-tier pricing, ...) is
    // selected, since those values differ per variant; otherwise one row per product (using its
    // first variant) to keep the export compact for a plain catalogue listing.
    const rows: ExportRow[] = useMemo(() => {
        if (!isVariantLevel) {
            return products.map((product): ExportRow => ({product, variant: product.variants[0]}));
        }
        return products.flatMap((product): ExportRow[] =>
            product.variants.length > 0
                ? product.variants.map((variant): ExportRow => ({product, variant}))
                : [{product, variant: undefined}],
        );
    }, [products, isVariantLevel]);

    function cellValue(row: ExportRow, field: FieldDef): string {
        switch (field.key) {
            case "product":
                return row.product.name;
            case "image":
                return ""; // drawn separately (PDF: didDrawCell, preview: <img>)
            case "category":
                return row.product.categorySlug;
            case "minQuantity": {
                const variant = row.variant ?? row.product.variants?.[0];
                const retailTier = variant?.priceTiers?.find((t) => t.pricingGroup === "RETAIL") ?? variant?.priceTiers?.[0];
                const moq = retailTier?.minQuantity ?? (row.product as any).minimumOrderQuantity ?? (row.product as any).minQuantity ?? 1;
                const unit = variant?.unit || (row.product as any).unit || "unit";
                return `MOQ: ${moq} ${unit}`;
            }
            case "sku":
                return row.variant?.sku ?? "-";
            case "unit":
                return row.variant?.unit ?? "-";
            case "stock":
                return row.variant ? String(row.variant.stockQuantity) : "-";
            case "tax":
                return taxLabel(row.variant);
            case "price": {
                const price = baseTierPrice(row.variant, "RETAIL");
                return price != null ? money(price) : "-";
            }
            case "priceRetail":
                return allTiersLabel(row.variant, "RETAIL");
            case "priceWholesale":
                return allTiersLabel(row.variant, "WHOLESALE");
            case "priceDistributor":
                return allTiersLabel(row.variant, "DISTRIBUTOR");
            default:
                return "";
        }
    }

    async function downloadPdf() {
        setGenerating(true);
        try {
            const {default: jsPDF} = await import("jspdf");
            const doc = new jsPDF({orientation: "portrait", unit: "pt"});
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();

            const margin = 32;
            const logoDataUri = await toDataUri(COMPANY_LOGO_URL);

            let headerBottom = 40;
            if (logoDataUri) {
                try {
                    const logoHeight = 34;
                    const logoWidth = logoHeight * (435 / 373); // source logo's natural aspect ratio
                    doc.addImage(logoDataUri, margin, 20, logoWidth, logoHeight);
                } catch {
                    // Unsupported image format - fall through without the logo mark.
                }
            }
            doc.setFont("helvetica", "bold");
            doc.setFontSize(12);
            doc.setTextColor(0, 59, 56);
            doc.text(COMPANY_NAME, pageWidth - margin, 30, {align: "right"});
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8.5);
            doc.setTextColor(130);
            doc.text(COMPANY_ADDRESS, pageWidth - margin, 42, {align: "right"});
            doc.text(`${COMPANY_PHONE}  |  ${COMPANY_EMAIL}`, pageWidth - margin, 53, {align: "right"});
            headerBottom = 62;

            doc.setDrawColor(225, 228, 224);
            doc.setLineWidth(0.75);
            doc.line(margin, headerBottom, pageWidth - margin, headerBottom);

            const heading = title ?? "Catalogue";
            doc.setFont("helvetica", "bold");
            doc.setFontSize(16);
            doc.setTextColor(0, 59, 56);
            doc.text(heading, margin, headerBottom + 22);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.setTextColor(130);
            const unitLabel = isVariantLevel ? "variant" : "product";
            doc.text(`Generated ${new Date().toLocaleDateString("en-CA")} - ${rows.length} ${unitLabel}${rows.length === 1 ? "" : "s"}`, margin, headerBottom + 37);

            const includeImage = fields.image;
            const imageMap = new Map<number, string>();
            if (includeImage) {
                await Promise.all(
                    products.map(async (product) => {
                        const dataUri = await toDataUri(imageUrl(product));
                        if (dataUri) imageMap.set(product.id, dataUri);
                    }),
                );
            }

            const titleField = activeFields.find((f) => f.role === "title");
            const chipFields = activeFields.filter((f) => f.role === "chip");
            const priceFields = activeFields.filter((f) => f.role === "price");
            const metaFields = activeFields.filter((f) => f.role === "meta" && f.key !== "image");

            // Card layout: one full-width card per row. Left is the image (fixed square); the
            // right side stacks a bold title, a row of small chips (category/tax), each selected
            // price emphasized in brand teal, then muted meta lines (SKU/unit/stock). Every text
            // block wraps across as many lines as it needs (measured up front) rather than being
            // truncated to a single line, so long names/tier lists are never cut off.
            const cardWidth = pageWidth - margin * 2;
            const cardPadding = 10;
            const imageSize = includeImage ? 64 : 0;
            const contentX0 = cardPadding + (includeImage ? imageSize + 12 : 0);
            const contentWidth = cardWidth - contentX0 - cardPadding;

            const titleFontSize = 11;
            const titleLineHeight = 13;
            const chipRowHeight = 16;
            const priceLabelWidth = 108;
            const priceLineHeight = 12;
            const metaLineHeight = 11;
            const sectionGap = 5;

            type CardPlan = {
                titleLines: string[];
                priceLines: { label: string; valueLines: string[] }[];
                metaLines: { label: string; valueLines: string[] }[];
                height: number;
            };

            function planCard(row: ExportRow): CardPlan {
                doc.setFont("helvetica", "bold");
                doc.setFontSize(titleFontSize);
                const titleLines: string[] = titleField
                    ? doc.splitTextToSize(cellValue(row, titleField) || "-", contentWidth)
                    : [];

                doc.setFont("helvetica", "normal");
                doc.setFontSize(7.5);
                const priceLines = priceFields.map((field) => {
                    const label = field.label.replace(" (all tiers)", "");
                    const valueLines: string[] = doc.splitTextToSize(
                        cellValue(row, field) || "-",
                        contentWidth - priceLabelWidth,
                    );
                    return {label, valueLines};
                });
                const metaLines = metaFields.map((field) => {
                    const labelText = `${field.label}: `;
                    const labelWidth = doc.getTextWidth(labelText);
                    const valueLines: string[] = doc.splitTextToSize(cellValue(row, field) || "-", contentWidth - labelWidth);
                    return {label: labelText, valueLines};
                });

                const height =
                    cardPadding * 2 +
                    (titleField ? titleLines.length * titleLineHeight + sectionGap : 0) +
                    (chipFields.length > 0 ? chipRowHeight + sectionGap : 0) +
                    priceLines.reduce((sum, p) => sum + p.valueLines.length * priceLineHeight, 0) +
                    (priceLines.length > 0 ? sectionGap : 0) +
                    metaLines.reduce((sum, m) => sum + m.valueLines.length * metaLineHeight, 0);

                return {titleLines, priceLines, metaLines, height: Math.max(height, cardPadding * 2 + imageSize)};
            }

            const footerHeight = 28;
            const contentBottom = pageHeight - margin - footerHeight;

            const gap = 12;
            let y = headerBottom + 22 + 25;

            rows.forEach((row) => {
                const plan = planCard(row);

                if (y + plan.height > contentBottom) {
                    doc.addPage();
                    y = margin;
                }

                const x = margin;

                // Card shell.
                doc.setFillColor(252, 253, 251);
                doc.setDrawColor(225, 228, 224);
                doc.setLineWidth(0.75);
                doc.roundedRect(x, y, cardWidth, plan.height, 6, 6, "FD");

                if (includeImage) {
                    const dataUri = imageMap.get(row.product.id);
                    const imgY = y + cardPadding;
                    doc.setFillColor(241, 245, 235);
                    doc.roundedRect(x + cardPadding, imgY, imageSize, imageSize, 4, 4, "F");
                    if (dataUri) {
                        try {
                            doc.addImage(dataUri, x + cardPadding, imgY, imageSize, imageSize);
                        } catch {
                            // Unsupported image format for jsPDF - leave the placeholder swatch.
                        }
                    }
                }

                const cx = x + contentX0;
                let cursorY = y + cardPadding;

                if (titleField) {
                    doc.setFont("helvetica", "bold");
                    doc.setFontSize(titleFontSize);
                    doc.setTextColor(0, 59, 56);
                    doc.text(plan.titleLines, cx, cursorY + 9);
                    cursorY += plan.titleLines.length * titleLineHeight + sectionGap;
                }

                if (chipFields.length > 0) {
                    doc.setFont("helvetica", "bold");
                    doc.setFontSize(7);
                    let chipX = cx;
                    const chipY = cursorY;
                    for (const field of chipFields) {
                        const text = (cellValue(row, field) || "-").toUpperCase();
                        const textWidth = doc.getTextWidth(text);
                        const chipWidth = textWidth + 12;
                        if (chipX + chipWidth > cx + contentWidth) break; // stop if it would overflow the card
                        doc.setFillColor(241, 245, 235);
                        doc.setTextColor(0, 59, 56);
                        doc.roundedRect(chipX, chipY, chipWidth, 14, 7, 7, "F");
                        doc.text(text, chipX + 6, chipY + 10);
                        chipX += chipWidth + 5;
                    }
                    cursorY += chipRowHeight + sectionGap;
                }

                if (plan.priceLines.length > 0) {
                    for (const {label, valueLines} of plan.priceLines) {
                        doc.setTextColor(130);
                        doc.setFont("helvetica", "normal");
                        doc.setFontSize(7.5);
                        doc.text(label, cx, cursorY + 7);
                        doc.setTextColor(0, 100, 55);
                        doc.setFont("helvetica", "bold");
                        doc.setFontSize(9);
                        doc.text(valueLines, cx + priceLabelWidth, cursorY + 7);
                        cursorY += valueLines.length * priceLineHeight;
                    }
                    cursorY += sectionGap;
                }

                if (plan.metaLines.length > 0) {
                    doc.setFont("helvetica", "normal");
                    doc.setFontSize(7.5);
                    for (const {label, valueLines} of plan.metaLines) {
                        doc.setTextColor(130);
                        doc.text(label, cx, cursorY + 6);
                        const labelWidth = doc.getTextWidth(label);
                        doc.setTextColor(60);
                        doc.text(valueLines, cx + labelWidth, cursorY + 6);
                        cursorY += valueLines.length * metaLineHeight;
                    }
                }

                y += plan.height + gap;
            });

            const pageCount = doc.getNumberOfPages();
            for (let page = 1; page <= pageCount; page++) {
                doc.setPage(page);
                const footerY = pageHeight - margin;
                doc.setDrawColor(225, 228, 224);
                doc.setLineWidth(0.75);
                doc.line(margin, footerY - 16, pageWidth - margin, footerY - 16);
                doc.setFont("helvetica", "normal");
                doc.setFontSize(8);
                doc.setTextColor(130);
                doc.text(`${COMPANY_NAME}  •  ${COMPANY_PHONE}  •  ${COMPANY_EMAIL}`, margin, footerY - 4);
                doc.text(`Page ${page} of ${pageCount}`, pageWidth - margin, footerY - 4, {align: "right"});
            }

            const filename =
                products.length === 1
                    ? `${products[0].slug}-catalogue.pdf`
                    : `catalogue-export-${new Date().toISOString().slice(0, 10)}.pdf`;
            doc.save(filename);
            onClose();
        } finally {
            setGenerating(false);
        }
    }

    return (
        <AnimatePresence>
            {open && (
                <div className="fixed inset-0 z-50 grid place-items-center p-4">
                    <motion.div
                        initial={{opacity: 0}}
                        animate={{opacity: 1}}
                        exit={{opacity: 0}}
                        transition={{duration: sec(motionTokens.fast)}}
                        onClick={onClose}
                        className="absolute inset-0 bg-teal-950/50"
                    />
                    <motion.div
                        role="dialog"
                        aria-modal="true"
                        aria-label="Download catalogue as PDF"
                        initial={{opacity: 0, scale: 0.96, y: 8}}
                        animate={{opacity: 1, scale: 1, y: 0}}
                        exit={{opacity: 0, scale: 0.96, y: 8}}
                        transition={{duration: sec(motionTokens.base), ease: motionTokens.easeOut}}
                        className="relative max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-card"
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <h2 className="text-[18px] font-extrabold text-teal-950">Download as PDF</h2>
                                <p className="mt-1 text-[13px] text-muted">
                                    {title ?? "Catalogue"} · {products.length} product{products.length === 1 ? "" : "s"}
                                </p>
                            </div>
                            <FileText className="size-6 shrink-0 text-lime-600" aria-hidden/>
                        </div>

                        <div className="mt-5">
                            <p className="text-[12px] font-semibold text-muted">Product fields</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                                {FIELD_DEFS.filter((f) => !f.variantLevel).map((f) => {
                                    const on = fields[f.key];
                                    return (
                                        <button
                                            key={f.key}
                                            type="button"
                                            onClick={() => toggleField(f.key)}
                                            aria-pressed={on}
                                            className={`rounded-full border px-3 py-1.5 text-[12px] font-bold transition-colors ${
                                                on
                                                    ? "border-teal-950 bg-teal-950 text-white"
                                                    : "border-black/10 text-muted hover:bg-soft-control"
                                            }`}
                                        >
                                            {f.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="mt-4">
                            <p className="text-[12px] font-semibold text-muted">Variant &amp; pricing tier fields</p>
                            <p className="mt-0.5 text-[11px] text-muted">
                                Selecting any of these adds one row per variant instead of one row per product.
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                                {FIELD_DEFS.filter((f) => f.variantLevel).map((f) => {
                                    const on = fields[f.key];
                                    return (
                                        <button
                                            key={f.key}
                                            type="button"
                                            onClick={() => toggleField(f.key)}
                                            aria-pressed={on}
                                            className={`rounded-full border px-3 py-1.5 text-[12px] font-bold transition-colors ${
                                                on
                                                    ? "border-teal-950 bg-teal-950 text-white"
                                                    : "border-black/10 text-muted hover:bg-soft-control"
                                            }`}
                                        >
                                            {f.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="mt-5">
                            <p className="text-[12px] font-semibold text-muted">Preview</p>
                            {activeFields.length === 0 ? (
                                <p className="mt-2 rounded-xl border border-black/10 px-4 py-6 text-center text-[13px] text-muted">
                                    Select at least one field to preview.
                                </p>
                            ) : (
                                <div className="mt-2 grid grid-cols-1 gap-3">
                                    {rows.slice(0, PREVIEW_LIMIT).map((row, index) => {
                                        const image = defaultImage(row.product);
                                        const titleField = activeFields.find((f) => f.role === "title");
                                        const chipFields = activeFields.filter((f) => f.role === "chip");
                                        const priceFields = activeFields.filter((f) => f.role === "price");
                                        const metaFields = activeFields.filter((f) => f.role === "meta" && f.key !== "image");
                                        return (
                                            <div
                                                key={`${row.product.id}-${row.variant?.id ?? index}`}
                                                className="flex gap-3 rounded-xl border border-black/10 bg-[#fcfdfb] p-3"
                                            >
                                                {fields.image && (
                                                    <div className="shrink-0">
                                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                                        <img
                                                            src={imageUrl(row.product)}
                                                            alt={image?.altText ?? row.product.name}
                                                            className="size-14 rounded-lg object-cover"
                                                        />
                                                    </div>
                                                )}
                                                <div className="min-w-0 flex-1">
                                                    {titleField && (
                                                        <p className="text-[13px] font-bold text-teal-950">
                                                            {cellValue(row, titleField) || "-"}
                                                        </p>
                                                    )}
                                                    {chipFields.length > 0 && (
                                                        <div className="mt-1 flex flex-wrap gap-1">
                                                            {chipFields.map((f) => (
                                                                <span
                                                                    key={f.key}
                                                                    className="rounded-full bg-soft-control px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-teal-950"
                                                                >
                                                                    {cellValue(row, f) || "-"}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {priceFields.length > 0 && (
                                                        <div className="mt-1.5 space-y-0.5">
                                                            {priceFields.map((f) => (
                                                                <p key={f.key} className="text-[11px]">
                                                                    <span className="text-muted">{f.label.replace(" (all tiers)", "")}: </span>
                                                                    <span className="font-bold text-teal-700">{cellValue(row, f) || "-"}</span>
                                                                </p>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {metaFields.length > 0 && (
                                                        <div className="mt-1.5 space-y-0.5">
                                                            {metaFields.map((f) => (
                                                                <p key={f.key} className="text-[10px] text-muted">
                                                                    {f.label}: <span className="text-teal-950/80">{cellValue(row, f) || "-"}</span>
                                                                </p>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                            {rows.length > PREVIEW_LIMIT && (
                                <p className="mt-2 text-[11px] text-muted">
                                    +{rows.length - PREVIEW_LIMIT} more {isVariantLevel ? "variant" : "product"}
                                    {rows.length - PREVIEW_LIMIT === 1 ? "" : "s"} included in the PDF (not shown in this preview).
                                </p>
                            )}
                        </div>

                        <div className="mt-6 flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="h-10 rounded-xl border border-black/10 px-4 text-[13px] font-bold text-teal-950 transition-opacity hover:opacity-80"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={downloadPdf}
                                disabled={generating || activeFields.length === 0 || rows.length === 0}
                                className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-lime-500 px-4 text-[13px] font-bold text-teal-950 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <Download className="size-4 shrink-0" aria-hidden/>
                                {generating ? "Generating..." : "Download PDF"}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
