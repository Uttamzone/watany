import type {MetadataRoute} from "next";

/**
 * Web app manifest for the Android/PWA icon set in `public/logo/favicon`.
 * Icon paths are rewritten here since the generator's own paths don't match.
 */
export default function manifest(): MetadataRoute.Manifest {
    const base = "/logo/favicon";

    return {
        name: "Watany - Palestinian Products",
        short_name: "Watany",
        description:
            "Authentic Palestinian olive oil, pantry products, cheese, and traditional ceramics, delivered across Canada.",
        start_url: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#003b38",
        icons: [36, 48, 72, 96, 144, 192].map((size) => ({
            src: `${base}/android-icon-${size}x${size}.png`,
            sizes: `${size}x${size}`,
            type: "image/png",
        })),
    };
}
