"use client";

import ScrollExpandMedia from "@/components/ui/scroll-expansion-hero";
import { CorporateHero } from "@/components/home/corporate-hero";
import { ShoppingPaths } from "@/components/home/shopping-paths";
import { ProductDiscovery } from "@/components/home/product-discovery";
import { CraftedInPalestine } from "@/components/home/crafted-in-palestine";
import { SupplyCapability } from "@/components/home/supply-capability";
import { AmanatRoute } from "@/components/home/amanat-route";
import { ShippingCoverage } from "@/components/home/shipping-coverage";
import { SiteSwitch } from "@/components/home/site-switch";
import { HomeFaq } from "@/components/home/home-faq";

export function ScrollHeroLanding() {
  return (
    <ScrollExpandMedia
      mediaType="image"
      mediaSrc="/art/hero-olive-scene.jpeg"
      bgImageSrc="/art/hero-olive-scene.jpeg"
      title="Watani & Sons"
      date="Palestinian Wholesale & Bulk"
      scrollToExpand="Scroll to Expand"
      textBlend
    >
      <div className="shell pt-2 pb-16 sm:pb-24 space-y-12">
        <CorporateHero />
        <ShoppingPaths />
        <ProductDiscovery />
        <CraftedInPalestine />
        <SupplyCapability />
        <AmanatRoute />
        <ShippingCoverage />
        <SiteSwitch />
        <HomeFaq />
      </div>
    </ScrollExpandMedia>
  );
}
