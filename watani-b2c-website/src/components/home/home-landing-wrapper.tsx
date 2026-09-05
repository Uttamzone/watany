"use client";

import { motion, useReducedMotion, Variants } from "framer-motion";
import { CorporateHero } from "@/components/home/corporate-hero";
import { ShoppingPaths } from "@/components/home/shopping-paths";
import { ProductDiscovery } from "@/components/home/product-discovery";
import { CraftedInPalestine } from "@/components/home/crafted-in-palestine";
import { SupplyCapability } from "@/components/home/supply-capability";
import { AmanatRoute } from "@/components/home/amanat-route";
import { ShippingCoverage } from "@/components/home/shipping-coverage";
import { SiteSwitch } from "@/components/home/site-switch";
import { HomeFaq } from "@/components/home/home-faq";

/**
 * HomeLandingWrapper provides a smooth, staggered entrance animation
 * for the entire website when landing on the home page.
 */
export function HomeLandingWrapper() {
  const reduceMotion = useReducedMotion();

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.05,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 28, scale: 0.985 },
    show: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.65,
        ease: "easeOut",
      },
    },
  };

  return (
    <motion.div
      initial={reduceMotion ? "show" : "hidden"}
      animate="show"
      variants={containerVariants}
      className="w-full"
    >
      <motion.div variants={itemVariants}>
        <CorporateHero />
      </motion.div>

      <div className="shell pt-10 pb-16 sm:pb-24 space-y-10 sm:space-y-14">
        <motion.div variants={itemVariants}>
          <ShoppingPaths />
        </motion.div>
        <motion.div variants={itemVariants}>
          <ProductDiscovery />
        </motion.div>
        <motion.div variants={itemVariants}>
          <CraftedInPalestine />
        </motion.div>
        <motion.div variants={itemVariants}>
          <SupplyCapability />
        </motion.div>
        <motion.div variants={itemVariants}>
          <AmanatRoute />
        </motion.div>
        <motion.div variants={itemVariants}>
          <ShippingCoverage />
        </motion.div>
        <motion.div variants={itemVariants}>
          <SiteSwitch />
        </motion.div>
        <motion.div variants={itemVariants}>
          <HomeFaq />
        </motion.div>
      </div>
    </motion.div>
  );
}
