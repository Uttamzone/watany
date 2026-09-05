"use client";

import {createContext, useContext, useEffect, useMemo, useState,} from "react";
import {useAuth} from "@/components/auth/auth-store";
import {getAllProducts} from "@/lib/products";
import type {Product} from "@/lib/types";

type CataloguePricingContextValue = {
    productFor: (fallback: Product) => Product;
};

const CataloguePricingContext = createContext<CataloguePricingContextValue>({
    productFor: (fallback) => fallback,
});

/** Server-rendered catalogue requests are anonymous; refresh once in-browser after AuthProvider
 * restores the session, so cards get wholesale/distributor pricing. */
export function CataloguePricingProvider({
                                             children,
                                         }: {
    children: React.ReactNode;
}) {
    const {status, user} = useAuth();
    const [pricedCatalogue, setPricedCatalogue] = useState<{
        userId: number;
        productsBySlug: Map<string, Product>;
    } | null>(null);

    useEffect(() => {
        let cancelled = false;

        if (status !== "authenticated" || !user) return;

        const userId = user.id;

        async function refreshPricing() {
            const products = await getAllProducts();
            if (!cancelled) {
                setPricedCatalogue({
                    userId,
                    productsBySlug: new Map(
                        products.map((product) => [product.slug, product]),
                    ),
                });
            }
        }

        void refreshPricing();
        return () => {
            cancelled = true;
        };
    }, [status, user]);

    const value = useMemo<CataloguePricingContextValue>(
        () => ({
            productFor: (fallback) =>
                status === "authenticated" &&
                user &&
                pricedCatalogue?.userId === user.id
                    ? pricedCatalogue.productsBySlug.get(fallback.slug) ?? fallback
                    : fallback,
        }),
        [pricedCatalogue, status, user],
    );

    return (
        <CataloguePricingContext.Provider value={value}>
            {children}
        </CataloguePricingContext.Provider>
    );
}

export function useCataloguePricedProduct(product: Product): Product {
    return useContext(CataloguePricingContext).productFor(product);
}
