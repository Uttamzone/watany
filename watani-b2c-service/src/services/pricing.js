const db = require('../db');

function formatCurrency(amount) {
    if (amount === null || amount === undefined) return { major: null, minor: null, number: null };
    const num = typeof amount === 'number' ? amount : parseFloat(amount);
    const fixed = num.toFixed(2);
    const parts = fixed.split('.');
    return {
        major: parts[0],
        minor: parts[1],
        number: num
    };
}

/**
 * Resolves price for a variant given a buyer's pricing group and quantity.
 * Requirement.md §3:
 * - Pricing groups: ADMIN (no purchase / same as distributor), DISTRIBUTOR, WHOLESALE, RETAIL.
 * - Minimum order quantity (MOQ) fallback: if MOQ not met, falls back to RETAIL, not intermediate.
 * - Multiple quantity breaks per group supported.
 */
async function resolvePrice(variantId, group = 'RETAIL', quantity = 1) {
    const buyerGroup = (group === 'ADMIN' ? 'DISTRIBUTOR' : group) || 'RETAIL';

    // Fetch price tiers for variant
    const { rows: tiers } = await db.query(
        `SELECT id, variant_id, pricing_group, unit_price, min_quantity, compare_at_price, currency
         FROM price_tiers
         WHERE variant_id = $1
         ORDER BY min_quantity DESC`,
        [variantId]
    );

    if (tiers.length === 0) {
        return {
            price: 0,
            priceMajor: '0',
            priceMinor: '00',
            compareAtPrice: null,
            compareAtMajor: null,
            compareAtMinor: null,
            pricingRelation: {
                appliedGroup: 'RETAIL',
                yourGroup: buyerGroup,
                fellBackToRetail: false,
                retailPrice: 0,
                wholesalePrice: 0,
                minQuantity: 1,
                minimumOrderQuantity: 1,
                unlockMessage: null,
                unlockAtQuantity: null,
                unlockUnitPrice: null,
                tiers: []
            }
        };
    }

    // Tiers for buyer's group
    const buyerTiers = tiers.filter(t => t.pricing_group === buyerGroup);

    let selectedTier = null;
    let fellBackToRetail = false;

    if (buyerTiers.length > 0) {
        selectedTier = buyerTiers.find(t => (t.min_quantity || 1) <= quantity);
    }

    if (!selectedTier && buyerGroup !== 'RETAIL') {
        fellBackToRetail = true;
        const retailTiers = tiers.filter(t => t.pricing_group === 'RETAIL');
        selectedTier = retailTiers.find(t => (t.min_quantity || 1) <= quantity) || retailTiers[retailTiers.length - 1];
    }

    if (!selectedTier) {
        selectedTier = tiers[0];
    }

    const unitPrice = parseFloat(selectedTier.unit_price);
    const compareAt = selectedTier.compare_at_price ? parseFloat(selectedTier.compare_at_price) : null;

    let unlockMessage = null;
    let unlockAtQuantity = null;
    let unlockUnitPrice = null;

    const targetTiers = tiers.filter(t => t.pricing_group === buyerGroup);
    const nextTier = targetTiers.reverse().find(t => (t.min_quantity || 1) > quantity);
    if (nextTier) {
        unlockAtQuantity = nextTier.min_quantity;
        unlockUnitPrice = parseFloat(nextTier.unit_price);
        const qtyDiff = unlockAtQuantity - quantity;
        unlockMessage = `Buy ${qtyDiff} more to get $${unlockUnitPrice.toFixed(2)}/unit`;
    }

    const formattedPrice = formatCurrency(unitPrice);
    const formattedCompare = formatCurrency(compareAt);

    const relevantTiers = buyerTiers.length > 0 ? buyerTiers : tiers.filter(t => t.pricing_group === 'RETAIL');
    const baseTier = relevantTiers.length > 0
        ? relevantTiers.reduce((lowest, t) => ((t.min_quantity || 1) < (lowest.min_quantity || 1) ? t : lowest), relevantTiers[0])
        : selectedTier;
    const moq = baseTier && baseTier.min_quantity ? baseTier.min_quantity : 1;

    const retailTier = tiers.find(t => t.pricing_group === 'RETAIL');
    const wholesaleTier = tiers.find(t => t.pricing_group === 'WHOLESALE');
    const resolvedRetailPrice = retailTier ? parseFloat(retailTier.unit_price) : unitPrice;
    const resolvedWholesalePrice = wholesaleTier ? parseFloat(wholesaleTier.unit_price) : Math.round(resolvedRetailPrice * 0.8 * 100) / 100;

    return {
        price: unitPrice,
        priceMajor: formattedPrice.major,
        priceMinor: formattedPrice.minor,
        compareAtPrice: compareAt,
        compareAtMajor: formattedCompare.major,
        compareAtMinor: formattedCompare.minor,
        pricingRelation: {
            appliedGroup: selectedTier.pricing_group,
            yourGroup: buyerGroup,
            fellBackToRetail,
            retailPrice: resolvedRetailPrice,
            wholesalePrice: resolvedWholesalePrice,
            minQuantity: moq,
            minimumOrderQuantity: moq,
            unlockMessage,
            unlockAtQuantity,
            unlockUnitPrice,
            tiers: (relevantTiers.length > 0 ? relevantTiers : tiers).map(t => ({
                id: t.id,
                pricingGroup: t.pricing_group,
                unitPrice: parseFloat(t.unit_price),
                minQuantity: t.min_quantity || 1,
                compareAtPrice: t.compare_at_price ? parseFloat(t.compare_at_price) : null
            })).sort((a, b) => a.minQuantity - b.minQuantity)
        }
    };
}

module.exports = {
    resolvePrice,
    formatCurrency
};
