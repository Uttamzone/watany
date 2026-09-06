"use client";

import {useEffect, useRef, useState} from "react";
import Image from "next/image";
import {Star, Trash2, Upload} from "lucide-react";
import * as adminApi from "@/lib/admin/api";
import type {AdminImageResponse} from "@/lib/admin/types";
import {ApiError} from "@/lib/api";
import {useNotifications} from "@/components/notifications/notification-store";

export type StagedImage = {
    file: File;
    previewUrl: string;
};

type ProductImageManagerProps = {
    slug?: string; // undefined until the product has been created
    images: AdminImageResponse[];
    onImagesChange: (images: AdminImageResponse[]) => void;
    // Pre-save staging: lets a new product pick images before it has a slug.
    stagedImages?: StagedImage[];
    onStagedImagesChange?: (images: StagedImage[]) => void;
};

/**
 * Once a product exists, upload/delete/set-default commit immediately via their own API calls.
 * Before that, files are held in `stagedImages` for the parent to upload after create.
 */
export function ProductImageManager({
                                        slug,
                                        images,
                                        onImagesChange,
                                        stagedImages,
                                        onStagedImagesChange,
                                    }: ProductImageManagerProps) {
    const notifications = useNotifications();
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        return () => {
            stagedImages?.forEach((image) => URL.revokeObjectURL(image.previewUrl));
        };
        // Revoke only on unmount, not on every staged-list change.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (!slug) {
        const staged = stagedImages ?? [];

        function handleStagedFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file || !onStagedImagesChange) return;
            onStagedImagesChange([...staged, {file, previewUrl: URL.createObjectURL(file)}]);
        }

        function removeStaged(index: number) {
            if (!onStagedImagesChange) return;
            URL.revokeObjectURL(staged[index].previewUrl);
            onStagedImagesChange(staged.filter((_, i) => i !== index));
        }

        return (
            <div className="rounded-2xl bg-white p-5 shadow-card">
                <div className="flex items-center justify-between">
                    <h2 className="text-[15px] font-bold text-teal-950">Images</h2>
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-1 rounded-full bg-soft-control px-3 py-1.5 text-[12px] font-bold text-teal-950"
                    >
                        <Upload className="size-3.5"/> Add image
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={handleStagedFileSelected}
                    />
                </div>
                <p className="mt-2 text-[13px] text-muted">
                    Images added here upload automatically once you create the product.
                </p>
                {staged.length > 0 && (
                    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {staged.map((image, index) => (
                            <div key={image.previewUrl}
                                 className="group relative overflow-hidden rounded-xl border border-black/10">
                                <div className="relative aspect-square bg-soft-control">
                                    <Image src={image.previewUrl} alt="" fill sizes="200px" className="object-cover"/>
                                </div>
                                {index === 0 && (
                                    <span
                                        className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-lime-500 px-2 py-0.5 text-[10px] font-bold text-teal-950">
                    <Star className="size-3 fill-current"/> Default
                  </span>
                                )}
                                <div className="flex items-center justify-end gap-2 bg-white p-2">
                                    <button
                                        type="button"
                                        onClick={() => removeStaged(index)}
                                        className="text-coral"
                                        aria-label="Remove image"
                                    >
                                        <Trash2 className="size-4"/>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    async function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file || !slug) return;

        setUploading(true);
        try {
            const uploaded = await adminApi.uploadProductImage(slug, file);
            onImagesChange([...images, uploaded]);
        } catch (err) {
            notifications.error("Upload failed", err instanceof ApiError ? err.message : "Upload failed.");
        } finally {
            setUploading(false);
        }
    }

    async function handleSetDefault(imageId: number) {
        if (!slug) return;
        const currentList = Array.isArray(images) ? images : [];
        try {
            const response = await adminApi.setDefaultProductImage(slug, imageId);
            if (response && Array.isArray((response as any).images) && (response as any).images.length > 0) {
                onImagesChange((response as any).images);
            } else {
                onImagesChange(
                    currentList.map((img) => ({
                        ...img,
                        isDefault: img.id === imageId,
                    }))
                );
            }
            notifications.success("Image set as default", "The primary product image has been updated.");
        } catch (err) {
            onImagesChange(
                currentList.map((img) => ({
                    ...img,
                    isDefault: img.id === imageId,
                }))
            );
            notifications.error(
                "Failed to set default image",
                err instanceof ApiError ? err.message : "Failed to set default image.",
            );
        }
    }

    async function handleDelete(imageId: number) {
        if (!slug) return;
        if (!window.confirm("Delete this image?")) return;
        const currentList = Array.isArray(images) ? images : [];
        try {
            await adminApi.deleteProductImage(slug, imageId);
            onImagesChange(currentList.filter((image) => image.id !== imageId));
        } catch (err) {
            notifications.error(
                "Failed to delete image",
                err instanceof ApiError ? err.message : "Failed to delete image.",
            );
        }
    }

    const safeImages = Array.isArray(images) ? images : [];

    return (
        <div className="rounded-2xl bg-white p-5 shadow-card">
            <div className="flex items-center justify-between">
                <h2 className="text-[15px] font-bold text-teal-950">Images</h2>
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center gap-1 rounded-full bg-soft-control px-3 py-1.5 text-[12px] font-bold text-teal-950 disabled:opacity-60"
                >
                    <Upload className="size-3.5"/> {uploading ? "Uploading…" : "Upload image"}
                </button>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleFileSelected}
                />
            </div>

            {safeImages.length === 0 ? (
                <p className="mt-3 text-[13px] text-muted">No images yet.</p>
            ) : (
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {safeImages.map((image) => (
                        <div key={image.id}
                             className="group relative overflow-hidden rounded-xl border border-black/10">
                            <div className="relative aspect-square bg-soft-control">
                                <Image
                                    src={image.url}
                                    alt={image.altText ?? ""}
                                    fill
                                    sizes="200px"
                                    className="object-cover"
                                />
                            </div>
                            {image.isDefault && (
                                <span
                                    className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-lime-500 px-2 py-0.5 text-[10px] font-bold text-teal-950">
                  <Star className="size-3 fill-current"/> Default
                </span>
                            )}
                            <div className="flex items-center justify-between gap-2 bg-white p-2">
                                <button
                                    type="button"
                                    onClick={() => handleSetDefault(image.id)}
                                    disabled={image.isDefault}
                                    className="text-[11px] font-bold text-teal-800 disabled:text-muted"
                                >
                                    {image.isDefault ? "Default" : "Set default"}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleDelete(image.id)}
                                    className="text-coral"
                                    aria-label="Delete image"
                                >
                                    <Trash2 className="size-4"/>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
