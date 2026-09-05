"use client";

import Image from "next/image";
import {useCallback, useRef, useState} from "react";
import {motion, useReducedMotion} from "framer-motion";
import {ChevronLeft, ChevronRight} from "lucide-react";
import {motionTokens, sec} from "@/lib/motion";
import {productImageSrc} from "@/lib/products";
import type {Product} from "@/lib/types";

/** Thumbnails sit on one row of four; a longer gallery folds into the overflow tile. */
const THUMBNAIL_SLOTS = 4;

/** Horizontal distance the incoming slide travels as it settles, in px. */
const SLIDE_OFFSET = 48;

/** A drag past this fraction of the stage advances the carousel. */
const SWIPE_RATIO = 0.2;

/**
 * Product gallery (design.md §8) - stage carousel with a thumbnail row; advances by arrow,
 * swipe, keyboard, or click. Galleries longer than four collapse into a "+N" tile.
 */
export function ProductGallery({product}: { product: Product }) {
    const images = product.gallery?.length ? product.gallery : [productImageSrc(product.image)];
    // `direction` drives which side a slide enters from; it is only read during a transition.
    const [[activeIndex, direction], setSlide] = useState<[number, number]>([0, 0]);
    const stageRef = useRef<HTMLDivElement>(null);
    const reduceMotion = useReducedMotion();

    const viewLabels = ["Front view", "Side view", "Label detail", "Pack view"];
    const labelFor = (index: number) => viewLabels[index] ?? `View ${index + 1}`;

    const goTo = useCallback(
        (next: number) => {
            // Wrap so the arrows stay usable at both ends of the gallery.
            const target = (next + images.length) % images.length;
            setSlide(([current]) => [target, target === current ? 0 : target > current ? 1 : -1]);
        },
        [images.length],
    );

    // Row is fixed at four slots; a longer gallery shows three thumbnails plus an
    // overflow tile, and the rest stay reachable via the carousel.
    const hasOverflow = images.length > THUMBNAIL_SLOTS;
    const visibleThumbnails = hasOverflow
        ? images.slice(0, THUMBNAIL_SLOTS - 1)
        : images;
    const hiddenCount = images.length - (THUMBNAIL_SLOTS - 1);
    /** Overflow tile previews the first hidden image, or the active one if a hidden slide shows. */
    const overflowIndex = Math.max(activeIndex, THUMBNAIL_SLOTS - 1);

    return (
        <div>
            <div
                ref={stageRef}
                role="region"
                aria-roledescription="carousel"
                aria-label={`${product.fullName} images`}
                tabIndex={0}
                onKeyDown={(event) => {
                    if (event.key === "ArrowRight") {
                        event.preventDefault();
                        goTo(activeIndex + 1);
                    } else if (event.key === "ArrowLeft") {
                        event.preventDefault();
                        goTo(activeIndex - 1);
                    }
                }}
                className="relative aspect-square overflow-hidden rounded-[22px] bg-[#f1f3f1] outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2"
            >
                {product.badge && (
                    <span
                        className="pointer-events-none absolute left-4 top-4 z-20 grid size-[70px] place-items-center rounded-full bg-navy p-2 text-center text-[10px] font-bold uppercase leading-tight text-white lg:size-[84px] lg:text-[11px]">
            {product.badge}
                        <span className="block text-[9px] font-semibold text-white/75">
              Palestine
            </span>
          </span>
                )}

                {/* Keyed remount, not AnimatePresence - a draggable slide stays mounted, so its exit
            animation never settles and outgoing images would stack on the new one. */}
                <motion.div
                    key={activeIndex}
                    initial={
                        reduceMotion
                            ? false
                            : {opacity: 0, x: direction * SLIDE_OFFSET, scale: 0.985}
                    }
                    animate={{opacity: 1, x: 0, scale: 1}}
                    transition={{duration: sec(180), ease: motionTokens.easeOut}}
                    drag={images.length > 1 ? "x" : false}
                    dragConstraints={{left: 0, right: 0}}
                    dragSnapToOrigin
                    dragElastic={0.12}
                    onDragEnd={(_, info) => {
                        const threshold = (stageRef.current?.clientWidth ?? 320) * SWIPE_RATIO;
                        if (info.offset.x < -threshold) goTo(activeIndex + 1);
                        else if (info.offset.x > threshold) goTo(activeIndex - 1);
                    }}
                    className="absolute inset-0 grid cursor-grab place-items-center p-8 active:cursor-grabbing"
                >
                    <Image
                        src={images[activeIndex]}
                        alt={`${product.fullName} - ${labelFor(activeIndex).toLowerCase()}`}
                        width={400}
                        height={400}
                        preload={activeIndex === 0}
                        draggable={false}
                        sizes="(max-width: 899px) 90vw, 480px"
                        className="pointer-events-none size-full object-contain"
                    />
                </motion.div>

                {images.length > 1 && (
                    <>
                        <button
                            type="button"
                            onClick={() => goTo(activeIndex - 1)}
                            aria-label="Previous image"
                            className="absolute left-3 top-1/2 z-20 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-navy shadow-sm backdrop-blur transition-colors hover:bg-white focus-visible:ring-2 focus-visible:ring-coral"
                        >
                            <ChevronLeft className="size-5" aria-hidden/>
                        </button>
                        <button
                            type="button"
                            onClick={() => goTo(activeIndex + 1)}
                            aria-label="Next image"
                            className="absolute right-3 top-1/2 z-20 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-navy shadow-sm backdrop-blur transition-colors hover:bg-white focus-visible:ring-2 focus-visible:ring-coral"
                        >
                            <ChevronRight className="size-5" aria-hidden/>
                        </button>

                        <div className="absolute inset-x-0 bottom-4 z-20 flex justify-center gap-1.5">
                            {images.map((image, index) => (
                                <button
                                    key={image}
                                    type="button"
                                    onClick={() => goTo(index)}
                                    aria-label={`Go to ${labelFor(index).toLowerCase()}`}
                                    aria-current={index === activeIndex}
                                    className={`h-1.5 rounded-full transition-all ${
                                        index === activeIndex ? "w-5 bg-navy" : "w-1.5 bg-navy/25"
                                    }`}
                                />
                            ))}
                        </div>
                    </>
                )}
            </div>

            {images.length > 1 && (
                <ul className="mt-5 grid grid-cols-4 gap-3">
                    {visibleThumbnails.map((image, index) => {
                        const selected = index === activeIndex;
                        return (
                            <li key={image}>
                                <button
                                    type="button"
                                    onClick={() => goTo(index)}
                                    aria-label={`Show ${labelFor(index).toLowerCase()} of ${product.name}`}
                                    aria-current={selected}
                                    className="relative block w-full rounded-[14px] bg-[#f1f3f1] p-2 transition-colors hover:bg-[#e9ede9]"
                                >
                                    <Image
                                        src={image}
                                        alt=""
                                        aria-hidden
                                        width={400}
                                        height={400}
                                        sizes="120px"
                                        className="aspect-square w-full object-contain"
                                    />
                                    {selected && (
                                        <motion.span
                                            layoutId={`gallery-underline-${product.id}`}
                                            transition={{
                                                duration: sec(motionTokens.base),
                                                ease: motionTokens.easeOut,
                                            }}
                                            className="absolute inset-x-3 -bottom-1.5 h-[3px] rounded-full bg-coral"
                                        />
                                    )}
                                </button>
                            </li>
                        );
                    })}

                    {hasOverflow && (
                        <li>
                            <button
                                type="button"
                                onClick={() => goTo(overflowIndex)}
                                aria-label={`Show ${labelFor(overflowIndex).toLowerCase()} of ${product.name}, ${hiddenCount} further images`}
                                aria-current={activeIndex >= THUMBNAIL_SLOTS - 1}
                                className="relative block w-full overflow-hidden rounded-[14px] bg-[#f1f3f1] p-2 transition-colors hover:bg-[#e9ede9]"
                            >
                                <Image
                                    src={images[overflowIndex]}
                                    alt=""
                                    aria-hidden
                                    width={400}
                                    height={400}
                                    sizes="120px"
                                    className="aspect-square w-full object-contain"
                                />
                                <span
                                    className="absolute inset-0 grid place-items-center rounded-[14px] bg-navy/55 text-sm font-bold text-white">
                  +{hiddenCount}
                </span>
                                {activeIndex >= THUMBNAIL_SLOTS - 1 && (
                                    <motion.span
                                        layoutId={`gallery-underline-${product.id}`}
                                        transition={{
                                            duration: sec(motionTokens.base),
                                            ease: motionTokens.easeOut,
                                        }}
                                        className="absolute inset-x-3 -bottom-1.5 h-[3px] rounded-full bg-coral"
                                    />
                                )}
                            </button>
                        </li>
                    )}
                </ul>
            )}
        </div>
    );
}
