"use client";

import {useRef, useState} from "react";
import {Download, FileArchive, FileSpreadsheet, Upload} from "lucide-react";
import * as adminApi from "@/lib/admin/api";
import type {BulkImageUploadResponse, BulkUploadResponse} from "@/lib/admin/types";
import {AdminModal} from "@/components/admin/admin-modal";
import {ApiError} from "@/lib/api";
import {useNotifications} from "@/components/notifications/notification-store";

type BulkUploadModalProps = {
    open: boolean;
    onClose: () => void;
    /** Called after a successful upload so the caller can refresh the product list. */
    onUploaded: () => void;
};

type SelectedFile =
    | { kind: "products"; file: File }
    | { kind: "images"; file: File };

export function BulkUploadModal({open, onClose, onUploaded}: BulkUploadModalProps) {
    const notifications = useNotifications();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selected, setSelected] = useState<SelectedFile | null>(null);
    const [uploading, setUploading] = useState(false);
    const [result, setResult] = useState<BulkUploadResponse | null>(null);
    const [imageResult, setImageResult] = useState<BulkImageUploadResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [downloadingTemplate, setDownloadingTemplate] = useState(false);
    const [dragActive, setDragActive] = useState(false);

    function reset() {
        setSelected(null);
        setResult(null);
        setImageResult(null);
        setError(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    }

    function selectFile(candidate: File) {
        const name = candidate.name.toLowerCase();
        if (name.endsWith(".xlsx")) {
            setSelected({kind: "products", file: candidate});
        } else if (name.endsWith(".zip")) {
            setSelected({kind: "images", file: candidate});
        } else {
            setError("Please choose an .xlsx workbook or a .zip of product images.");
            return;
        }
        setResult(null);
        setImageResult(null);
        setError(null);
    }

    function handleDrop(event: React.DragEvent<HTMLDivElement>) {
        event.preventDefault();
        setDragActive(false);
        const dropped = event.dataTransfer.files?.[0];
        if (dropped) selectFile(dropped);
    }

    function handleClose() {
        reset();
        onClose();
    }

    async function handleDownloadTemplate() {
        setDownloadingTemplate(true);
        try {
            await adminApi.downloadBulkUploadTemplate();
        } catch (err) {
            notifications.error(
                "Download failed",
                err instanceof ApiError ? err.message : "Could not download the template.",
            );
        } finally {
            setDownloadingTemplate(false);
        }
    }

    async function handleUpload() {
        if (!selected) return;
        setUploading(true);
        setError(null);
        setResult(null);
        setImageResult(null);
        try {
            if (selected.kind === "products") {
                const response = await adminApi.bulkUploadProducts(selected.file);
                setResult(response);
                if (response.succeeded > 0) {
                    onUploaded();
                }
            } else {
                const response = await adminApi.bulkUploadProductImages(selected.file);
                setImageResult(response);
                if (response.succeeded > 0) {
                    onUploaded();
                }
            }
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Bulk upload failed.");
        } finally {
            setUploading(false);
        }
    }

    return (
        <AdminModal open={open} onClose={handleClose} title="Bulk upload products" widthClassName="max-w-2xl">
            <h2 className="text-[18px] font-extrabold text-teal-950">Bulk upload products</h2>
            <p className="mt-1 text-[13px] text-muted">
                Upload an .xlsx workbook to create many products at once, or a .zip of images named
                {" "}
                <code className="rounded bg-soft-control px-1 py-0.5 text-[12px]">
                    &lt;product-slug&gt;_&lt;order&gt;.jpg
                </code>{" "}
                to bulk-import product images - <code
                className="rounded bg-soft-control px-1 py-0.5 text-[12px]">_0</code>
                {" "}becomes each product&apos;s default image.
            </p>

            <button
                type="button"
                onClick={handleDownloadTemplate}
                disabled={downloadingTemplate}
                className="mt-4 flex h-9 items-center gap-1.5 rounded-xl border border-black/10 px-3 text-[13px] font-semibold text-teal-950 transition-opacity hover:opacity-80 disabled:opacity-50"
            >
                <Download className="size-4" aria-hidden/>
                Download template
            </button>

            <div
                role="button"
                tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        fileInputRef.current?.click();
                    }
                }}
                onDragOver={(event) => {
                    event.preventDefault();
                    setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                className={`mt-4 flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center transition-colors ${
                    dragActive ? "border-teal-800 bg-teal-800/5" : "border-black/15 hover:border-black/30"
                }`}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.zip"
                    onChange={(event) => {
                        const picked = event.target.files?.[0];
                        if (picked) selectFile(picked);
                    }}
                    className="sr-only"
                />
                {selected?.kind === "images" ? (
                    <FileArchive className="size-8 text-muted" aria-hidden/>
                ) : (
                    <FileSpreadsheet className="size-8 text-muted" aria-hidden/>
                )}
                {selected ? (
                    <p className="text-[13px] font-semibold text-teal-950">{selected.file.name}</p>
                ) : (
                    <>
                        <p className="text-[13px] font-semibold text-teal-950">
                            Drag and drop your .xlsx or .zip file here, or{" "}
                            <span className="text-teal-800 underline">choose a file</span>
                        </p>
                        <p className="text-[12px] text-muted">.xlsx workbooks and .zip image archives are accepted</p>
                    </>
                )}
            </div>

            {error && (
                <p className="mt-4 rounded-xl bg-coral/10 px-4 py-3 text-[14px] font-medium text-coral">{error}</p>
            )}

            {result && (
                <div className="mt-4">
                    <div className="flex flex-wrap items-center gap-3 text-[13px] font-semibold">
            <span className="rounded-full bg-soft-control px-3 py-1 text-teal-950">
              Total: {result.totalRows}
            </span>
                        <span className="rounded-full bg-lime-500/25 px-3 py-1 text-teal-950">
              Succeeded: {result.succeeded}
            </span>
                        <span className="rounded-full bg-coral/15 px-3 py-1 text-coral">Failed: {result.failed}</span>
                        {result.failedRowsWorkbookBase64 && (
                            <button
                                type="button"
                                onClick={() => adminApi.downloadFailedRowsWorkbook(result.failedRowsWorkbookBase64!)}
                                className="flex h-8 items-center gap-1.5 rounded-xl border border-black/10 px-3 text-[12px] font-semibold text-teal-950 transition-opacity hover:opacity-80"
                            >
                                <Download className="size-3.5" aria-hidden/>
                                Download failed rows
                            </button>
                        )}
                    </div>

                    {result.results.length > 0 && (
                        <div className="mt-3 max-h-64 overflow-auto rounded-xl border border-black/10">
                            <table className="w-full min-w-[520px] text-left text-[12px]">
                                <thead className="sticky top-0 bg-soft-control text-muted">
                                <tr>
                                    <th className="px-3 py-2 font-semibold">Row</th>
                                    <th className="px-3 py-2 font-semibold">Slug</th>
                                    <th className="px-3 py-2 font-semibold">SKU</th>
                                    <th className="px-3 py-2 font-semibold">Status</th>
                                    <th className="px-3 py-2 font-semibold">Message</th>
                                </tr>
                                </thead>
                                <tbody>
                                {result.results.map((row) => (
                                    <tr key={`${row.rowNumber}-${row.sku ?? ""}`} className="border-t border-black/5">
                                        <td className="px-3 py-2 text-muted">{row.rowNumber}</td>
                                        <td className="px-3 py-2 text-teal-950">{row.slug ?? "-"}</td>
                                        <td className="px-3 py-2 text-teal-950">{row.sku ?? "-"}</td>
                                        <td className={`px-3 py-2 font-semibold ${row.success ? "text-teal-800" : "text-coral"}`}>
                                            {row.success ? "Success" : "Failed"}
                                        </td>
                                        <td className="px-3 py-2 text-muted">{row.message}</td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {imageResult && (
                <div className="mt-4">
                    <div className="flex flex-wrap items-center gap-3 text-[13px] font-semibold">
            <span className="rounded-full bg-soft-control px-3 py-1 text-teal-950">
              Total: {imageResult.totalFiles}
            </span>
                        <span className="rounded-full bg-lime-500/25 px-3 py-1 text-teal-950">
              Succeeded: {imageResult.succeeded}
            </span>
                        <span
                            className="rounded-full bg-coral/15 px-3 py-1 text-coral">Failed: {imageResult.failed}</span>
                    </div>

                    {imageResult.results.length > 0 && (
                        <div className="mt-3 max-h-64 overflow-auto rounded-xl border border-black/10">
                            <table className="w-full min-w-[520px] text-left text-[12px]">
                                <thead className="sticky top-0 bg-soft-control text-muted">
                                <tr>
                                    <th className="px-3 py-2 font-semibold">File</th>
                                    <th className="px-3 py-2 font-semibold">Slug</th>
                                    <th className="px-3 py-2 font-semibold">Order</th>
                                    <th className="px-3 py-2 font-semibold">Status</th>
                                    <th className="px-3 py-2 font-semibold">Message</th>
                                </tr>
                                </thead>
                                <tbody>
                                {imageResult.results.map((row) => (
                                    <tr key={row.fileName} className="border-t border-black/5">
                                        <td className="px-3 py-2 text-muted">{row.fileName}</td>
                                        <td className="px-3 py-2 text-teal-950">{row.slug ?? "-"}</td>
                                        <td className="px-3 py-2 text-teal-950">{row.order ?? "-"}</td>
                                        <td className={`px-3 py-2 font-semibold ${row.success ? "text-teal-800" : "text-coral"}`}>
                                            {row.success ? "Success" : "Failed"}
                                        </td>
                                        <td className="px-3 py-2 text-muted">{row.message}</td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            <div className="mt-6 flex justify-end gap-2">
                <button
                    type="button"
                    onClick={handleClose}
                    className="h-10 rounded-xl border border-black/10 px-4 text-[13px] font-bold text-teal-950 transition-opacity hover:opacity-80"
                >
                    Close
                </button>
                <button
                    type="button"
                    onClick={handleUpload}
                    disabled={!selected || uploading}
                    className="flex h-10 items-center gap-1.5 rounded-xl bg-lime-500 px-4 text-[13px] font-bold text-teal-950 transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                    <Upload className="size-4" aria-hidden/>
                    {uploading ? "Uploading…" : "Upload"}
                </button>
            </div>
        </AdminModal>
    );
}
