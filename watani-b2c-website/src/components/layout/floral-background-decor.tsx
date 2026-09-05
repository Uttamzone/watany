"use client";

import React from "react";

/**
 * Non-repeating subtle floral background decorations framing outer page margins.
 * Reduced opacity (15-20%) so they act as faint watermark accents without blocking text visibility or payment forms.
 */

export function FloralBackgroundDecor() {
    return (
        <div
            aria-hidden="true"
            className="pointer-events-none select-none absolute inset-0 z-0 overflow-hidden"
        >
            {/* Floral Motif 1: Sprawling Olive Branch with Olives (Top Outer Left) */}
            <div className="absolute -left-32 top-4 w-[240px] sm:w-[320px] lg:w-[380px] 2xl:-left-20 opacity-20 text-teal-950/40">
                <svg
                    viewBox="0 0 400 400"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-full h-auto transform -rotate-12"
                >
                    <path
                        d="M -20 50 Q 80 120 220 160 T 380 240"
                        stroke="currentColor"
                        strokeWidth="4"
                        strokeLinecap="round"
                    />
                    <path d="M 90 100 Q 140 60 200 40" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    <path d="M 160 135 Q 220 100 280 90" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    <path d="M 230 165 Q 290 190 350 170" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />

                    <path d="M 80 95 C 100 70 140 60 160 70 C 140 90 100 105 80 95 Z" fill="currentColor" opacity="0.9" />
                    <path d="M 140 60 C 170 35 210 30 230 45 C 200 65 160 70 140 60 Z" fill="currentColor" />
                    <path d="M 200 40 C 235 20 270 25 285 45 C 255 60 220 55 200 40 Z" fill="currentColor" opacity="0.95" />

                    <path d="M 160 135 C 190 110 230 100 250 115 C 220 135 180 140 160 135 Z" fill="currentColor" />
                    <path d="M 220 100 C 250 75 290 70 310 85 C 280 105 240 110 220 100 Z" fill="currentColor" opacity="0.9" />

                    <ellipse cx="145" cy="78" rx="10" ry="15" transform="rotate(25 145 78)" fill="currentColor" />
                    <ellipse cx="225" cy="112" rx="11" ry="16" transform="rotate(-15 225 112)" fill="currentColor" opacity="0.95" />
                </svg>
            </div>

            {/* Floral Motif 2: Wildflower Vine with 5-Petal Blossoms (Top Outer Right) */}
            <div className="absolute -right-32 top-36 w-[220px] sm:w-[300px] lg:w-[360px] 2xl:-right-20 opacity-20 text-teal-900/40">
                <svg
                    viewBox="0 0 400 400"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-full h-auto transform rotate-45"
                >
                    <path
                        d="M 380 20 C 300 80 220 40 140 120 C 60 200 100 300 20 380"
                        stroke="currentColor"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                    />

                    <path d="M 320 50 C 300 20 260 30 250 50 C 270 60 300 60 320 50 Z" fill="currentColor" />
                    <path d="M 240 80 C 260 110 290 110 300 90 C 280 70 250 70 240 80 Z" fill="currentColor" opacity="0.9" />
                    <path d="M 180 100 C 150 80 130 100 120 120 C 140 125 170 120 180 100 Z" fill="currentColor" />

                    {/* Flower 1: Top Blossom */}
                    <g transform="translate(280, 55)">
                        <circle cx="0" cy="0" r="8" fill="currentColor" />
                        <path d="M 0 -8 C -7 -22 7 -22 0 -8 Z" fill="currentColor" />
                        <path d="M 8 0 C 22 -7 22 7 8 0 Z" fill="currentColor" />
                        <path d="M 0 8 C 7 22 -7 22 0 8 Z" fill="currentColor" />
                        <path d="M -8 0 C -22 7 -22 -7 -8 0 Z" fill="currentColor" />
                    </g>

                    {/* Flower 2: Mid Blossom */}
                    <g transform="translate(140, 120)">
                        <circle cx="0" cy="0" r="10" fill="currentColor" />
                        <ellipse cx="0" cy="-18" rx="7" ry="11" fill="currentColor" />
                        <ellipse cx="18" cy="0" rx="11" ry="7" fill="currentColor" />
                        <ellipse cx="0" cy="18" rx="7" ry="11" fill="currentColor" />
                        <ellipse cx="-18" cy="0" rx="11" ry="7" fill="currentColor" />
                    </g>
                </svg>
            </div>

            {/* Floral Motif 3: Palestinian Heritage Tatreez Star Emblem (Upper Mid Outer Left) */}
            <div className="absolute -left-36 top-[25%] w-[220px] sm:w-[300px] lg:w-[340px] 2xl:-left-20 opacity-15 text-teal-950/40">
                <svg
                    viewBox="0 0 400 400"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-full h-auto transform -rotate-6"
                >
                    <g transform="translate(200, 200)">
                        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
                            <g key={angle} transform={`rotate(${angle})`}>
                                <path
                                    d="M 0 -30 Q 20 -70 0 -110 Q -20 -70 0 -30 Z"
                                    fill="currentColor"
                                    opacity="0.9"
                                />
                                <circle cx="0" cy="-80" r="5" fill="currentColor" />
                            </g>
                        ))}
                        {[22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5].map((angle) => (
                            <g key={angle} transform={`rotate(${angle})`}>
                                <ellipse cx="0" cy="-45" rx="8" ry="20" fill="currentColor" />
                            </g>
                        ))}
                        <circle cx="0" cy="0" r="24" stroke="currentColor" strokeWidth="3.5" fill="none" />
                        <circle cx="0" cy="0" r="14" fill="currentColor" />
                    </g>
                </svg>
            </div>

            {/* Floral Motif 4: Botanical Laurel & Blossom Stem (Center Outer Right) */}
            <div className="absolute -right-36 top-[42%] w-[240px] sm:w-[320px] lg:w-[380px] 2xl:-left-20 opacity-20 text-teal-900/40">
                <svg
                    viewBox="0 0 400 400"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-full h-auto transform -rotate-25"
                >
                    <path
                        d="M 50 350 C 150 300 220 180 350 50"
                        stroke="currentColor"
                        strokeWidth="4"
                        strokeLinecap="round"
                    />

                    <path d="M 150 250 C 110 230 100 190 130 180 C 150 200 160 230 150 250 Z" fill="currentColor" />
                    <path d="M 180 230 C 220 210 230 170 200 160 C 180 180 170 210 180 230 Z" fill="currentColor" opacity="0.9" />

                    <path d="M 210 180 C 170 160 160 120 190 110 C 210 130 220 160 210 180 Z" fill="currentColor" opacity="0.95" />
                    <path d="M 240 160 C 280 140 290 100 260 90 C 240 110 230 140 240 160 Z" fill="currentColor" />

                    <g transform="translate(260, 90)">
                        <circle cx="0" cy="0" r="8" fill="currentColor" />
                        <ellipse cx="-11" cy="-7" rx="6" ry="9" fill="currentColor" />
                        <ellipse cx="11" cy="-7" rx="6" ry="9" fill="currentColor" />
                        <ellipse cx="0" cy="11" rx="9" ry="6" fill="currentColor" />
                    </g>
                </svg>
            </div>

            {/* Floral Motif 5: Jasmine & Olive Blossom Branch (Lower Mid Outer Left) */}
            <div className="absolute -left-32 top-[60%] w-[230px] sm:w-[310px] lg:w-[370px] 2xl:-left-20 opacity-15 text-teal-950/40">
                <svg
                    viewBox="0 0 400 400"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-full h-auto transform rotate-15"
                >
                    <path
                        d="M -10 200 Q 120 140 260 220 T 390 180"
                        stroke="currentColor"
                        strokeWidth="4"
                        strokeLinecap="round"
                    />

                    <path d="M 70 175 C 90 140 130 130 150 145 C 130 170 95 180 70 175 Z" fill="currentColor" opacity="0.9" />
                    <path d="M 140 115 C 170 85 210 85 225 105 C 195 130 155 130 140 115 Z" fill="currentColor" />

                    <g transform="translate(200, 120)">
                        <circle cx="0" cy="0" r="6" fill="currentColor" />
                        <path d="M 0 -16 L 4 -4 L 16 0 L 4 4 L 0 16 L -4 4 L -16 0 L -4 -4 Z" fill="currentColor" />
                    </g>
                    <g transform="translate(350, 190)">
                        <circle cx="0" cy="0" r="7" fill="currentColor" />
                        <path d="M 0 -18 L 5 -5 L 18 0 L 5 5 L 0 18 L -5 5 L -18 0 L -5 -5 Z" fill="currentColor" opacity="0.95" />
                    </g>
                </svg>
            </div>

            {/* Floral Motif 6: Pomegranate & Leaf Motif (Lower Outer Right) */}
            <div className="absolute -right-32 top-[76%] w-[220px] sm:w-[300px] lg:w-[360px] 2xl:-right-20 opacity-20 text-teal-900/40">
                <svg
                    viewBox="0 0 400 400"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-full h-auto transform -rotate-15"
                >
                    <path d="M 200 40 Q 240 140 300 240 T 360 360" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                    <path d="M 240 140 C 200 110 170 130 180 160 C 210 165 230 150 240 140 Z" fill="currentColor" />
                    <path d="M 270 190 C 230 160 200 180 210 210 C 240 215 260 200 270 190 Z" fill="currentColor" opacity="0.9" />

                    {/* Pomegranate Fruit Profile */}
                    <g transform="translate(200, 260)">
                        <circle cx="0" cy="0" r="35" fill="currentColor" opacity="0.9" />
                        <path d="M -12 -33 L -6 -45 L 0 -35 L 6 -45 L 12 -33 Z" fill="currentColor" />
                    </g>
                </svg>
            </div>

            {/* Floral Motif 7: Twin Olive Leaf Swag (Bottom Outer Left near footer) */}
            <div className="absolute -left-28 top-[90%] w-[210px] sm:w-[290px] lg:w-[350px] 2xl:-left-16 opacity-15 text-teal-950/40">
                <svg
                    viewBox="0 0 400 400"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-full h-auto transform rotate-25"
                >
                    <path d="M 50 200 C 150 150 250 250 350 200" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                    <path d="M 120 180 C 150 140 190 140 200 165 C 180 185 140 190 120 180 Z" fill="currentColor" opacity="0.9" />
                    <path d="M 220 215 C 250 175 290 175 300 200 C 280 220 240 225 220 215 Z" fill="currentColor" />
                    <ellipse cx="205" cy="170" rx="10" ry="15" transform="rotate(30 205 170)" fill="currentColor" />
                </svg>
            </div>
        </div>
    );
}
