"use client";

import {useState} from "react";
import {Star} from "lucide-react";

export function StarRatingInput({
                                    value,
                                    onChange,
                                    disabled,
                                }: {
    value: number;
    onChange: (rating: number) => void;
    disabled?: boolean;
}) {
    const [hovered, setHovered] = useState<number | null>(null);
    const shown = hovered ?? value;

    return (
        <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((star) => (
                <button
                    key={star}
                    type="button"
                    role="radio"
                    aria-checked={value === star}
                    aria-label={`${star} star${star === 1 ? "" : "s"}`}
                    disabled={disabled}
                    onMouseEnter={() => setHovered(star)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => onChange(star)}
                    className="p-0.5 disabled:cursor-not-allowed"
                >
                    <Star
                        className={`size-7 transition-colors ${
                            star <= shown ? "fill-amber-400 text-amber-400" : "fill-transparent text-black/20"
                        }`}
                        aria-hidden
                    />
                </button>
            ))}
        </div>
    );
}
