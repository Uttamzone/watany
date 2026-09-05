const fs = require('fs');
const path = require('path');

/**
 * Robust live catalogue seeder that imports all 226 authentic products from wataniandsons.ca
 */
async function seedLiveCatalogue(queryFn) {
    console.log('[Catalogue Seeder] Starting live catalogue seed...');

    const categoriesList = [
        { slug: 'olive-oil', name: 'Olive Oil', tagline: 'Palestinian harvest' },
        { slug: 'olives', name: 'Olives', tagline: 'Jenin & regional varieties' },
        { slug: 'zaatar', name: 'Zaatar', tagline: 'Herbs and blends' },
        { slug: 'cheese', name: 'Cheese', tagline: 'Nabulsi selection' },
        { slug: 'nabulsi-cheese', name: 'Nabulsi Cheese', tagline: 'Traditional Nabulsi Cheese' },
        { slug: 'ceramics', name: 'Ceramics', tagline: 'Palestinian craft' },
        { slug: 'spices-grains', name: 'Spices & Grains', tagline: 'Pantry staples' },
        { slug: 'ghee', name: 'Ghee', tagline: 'Traditional samneh' },
        { slug: 'beauty-care', name: 'Beauty Care', tagline: 'Olive oil soap & care' },
        { slug: 'natural-soap', name: 'Natural Soap', tagline: 'Traditional Soap' },
        { slug: 'cross-body-bags', name: 'Cross Body Bags', tagline: 'Palestinian Embroidery' },
        { slug: 'card-cases', name: 'Card Cases', tagline: 'Palestinian Crafts' },
        { slug: 'tablecloths', name: 'Tablecloths', tagline: 'Palestinian Patterns' },
        { slug: 'scarves-shawls', name: 'Scarves & Shawls', tagline: 'Traditional Shawls' },
        { slug: 'shopper-bags', name: 'Shopper Bags', tagline: 'Handmade Bags' },
        { slug: 'chair-sofa-cushion-covers', name: 'Cushion Covers', tagline: 'Embroidery Covers' },
        { slug: 'spoon-rests', name: 'Spoon Rests', tagline: 'Handpainted Ceramic' },
        { slug: 'kunafa-pan', name: 'Kunafa Pan', tagline: 'Traditional Pan' },
        { slug: 'aprons', name: 'Aprons', tagline: 'Kitchen Aprons' }
    ];

    const categoryMap = new Map();

    for (let i = 0; i < categoriesList.length; i++) {
        const cat = categoriesList[i];
        try {
            const res = await queryFn(
                `SELECT id FROM categories WHERE slug = $1;`,
                [cat.slug]
            );
            if (res.rows && res.rows.length > 0) {
                categoryMap.set(cat.slug, res.rows[0].id);
            } else {
                const insert = await queryFn(
                    `INSERT INTO categories (slug, name, tagline, description, display_order, active, created_at, updated_at, version)
                     VALUES ($1, $2, $3, $4, $5, TRUE, NOW(), NOW(), 0)
                     RETURNING id;`,
                    [cat.slug, cat.name, cat.tagline, cat.name, i]
                );
                categoryMap.set(cat.slug, insert.rows[0].id);
            }
        } catch (err) {
            console.error(`[Seeder Error] Failed seeding category ${cat.slug}:`, err.message);
        }
    }

    // Default Brand
    let brandId = 1;
    try {
        const bRes = await queryFn(`SELECT id FROM brands WHERE slug = 'watani';`);
        if (bRes.rows && bRes.rows.length > 0) {
            brandId = bRes.rows[0].id;
        } else {
            const bInsert = await queryFn(
                `INSERT INTO brands (slug, name, created_at, updated_at, version) VALUES ('watani', 'Watani & Sons', NOW(), NOW(), 0) RETURNING id;`
            );
            brandId = bInsert.rows[0].id;
        }
    } catch (e) {}

    // Read catalogue.ts products dataset
    const cataloguePath = path.join(__dirname, '../../../watani-b2c-website/src/lib/catalogue.ts');
    let productsData = [];

    if (fs.existsSync(cataloguePath)) {
        const content = fs.readFileSync(cataloguePath, 'utf8');
        const match = content.match(/export const products: Product\[\] = (\[[\s\S]*?\]);/);
        if (match) {
            try {
                productsData = JSON.parse(match[1]);
            } catch (e) {
                console.error('[Seeder Error] Failed to parse catalogue.ts JSON:', e.message);
            }
        }
    }

    console.log(`[Catalogue Seeder] Extracted ${productsData.length} authentic products for database insertion.`);

    let insertedCount = 0;

    for (const p of productsData) {
        try {
            const catId = categoryMap.get(p.category) || categoryMap.get('olive-oil') || 1;
            const price = parseFloat(`${p.priceMajor || '0'}.${p.priceMinor || '00'}`) || 25.00;

            const existingP = await queryFn(`SELECT id FROM products WHERE slug = $1;`, [p.slug]);
            let productId;

            if (existingP.rows && existingP.rows.length > 0) {
                productId = existingP.rows[0].id;
            } else {
                const insertP = await queryFn(
                    `INSERT INTO products (slug, name, full_name, subtitle, description, category_id, brand_id, active, rating_average, review_count, created_at, updated_at, version)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, $8, $9, NOW(), NOW(), 0)
                     RETURNING id;`,
                    [
                        p.slug,
                        p.name.substring(0, 195),
                        (p.fullName || p.name).substring(0, 290),
                        (p.subtitle || '').substring(0, 290),
                        p.description || p.name,
                        catId,
                        brandId,
                        p.rating || 5.0,
                        p.reviewCount || 10
                    ]
                );
                productId = insertP.rows[0].id;
            }

            // Product Image
            const imgUrl = p.image || '/logo/watany-logo.png';
            const imgRes = await queryFn(`SELECT id FROM product_images WHERE product_id = $1;`, [productId]);
            if (!imgRes.rows || imgRes.rows.length === 0) {
                await queryFn(
                    `INSERT INTO product_images (product_id, url, alt_text, display_order, created_at, updated_at, version)
                     VALUES ($1, $2, $3, 0, NOW(), NOW(), 0);`,
                    [productId, imgUrl, p.name]
                );
            }

            // Product Variant
            const sku = p.sku || `SKU-${p.slug.substring(0, 20).toUpperCase()}`;
            const unit = p.unit || '1 Unit';
            let variantId;

            const vRes = await queryFn(`SELECT id FROM product_variants WHERE product_id = $1;`, [productId]);
            if (vRes.rows && vRes.rows.length > 0) {
                variantId = vRes.rows[0].id;
            } else {
                const vInsert = await queryFn(
                    `INSERT INTO product_variants (product_id, sku, unit, stock_quantity, low_stock_threshold, backorder_allowed, active, created_at, updated_at, version)
                     VALUES ($1, $2, $3, 100, 5, FALSE, TRUE, NOW(), NOW(), 0)
                     RETURNING id;`,
                    [productId, sku, unit]
                );
                variantId = vInsert.rows[0].id;
            }

            // Price Tiers (Retail, Wholesale, Distributor)
            const tRes = await queryFn(`SELECT id FROM price_tiers WHERE variant_id = $1;`, [variantId]);
            if (!tRes.rows || tRes.rows.length === 0) {
                // RETAIL
                await queryFn(
                    `INSERT INTO price_tiers (variant_id, pricing_group, unit_price, min_quantity, currency, created_at, updated_at, version)
                     VALUES ($1, 'RETAIL', $2, 1, 'CAD', NOW(), NOW(), 0);`,
                    [variantId, price]
                );
                // WHOLESALE (15% off)
                await queryFn(
                    `INSERT INTO price_tiers (variant_id, pricing_group, unit_price, min_quantity, currency, created_at, updated_at, version)
                     VALUES ($1, 'WHOLESALE', $2, 1, 'CAD', NOW(), NOW(), 0);`,
                    [variantId, Math.round(price * 0.85 * 100) / 100]
                );
                // DISTRIBUTOR (25% off)
                await queryFn(
                    `INSERT INTO price_tiers (variant_id, pricing_group, unit_price, min_quantity, currency, created_at, updated_at, version)
                     VALUES ($1, 'DISTRIBUTOR', $2, 1, 'CAD', NOW(), NOW(), 0);`,
                    [variantId, Math.round(price * 0.75 * 100) / 100]
                );
            }

            insertedCount++;
        } catch (err) {
            console.error(`[Seeder Error] Product ${p.slug}:`, err.message);
        }
    }

    console.log(`[Catalogue Seeder] Successfully seeded ${insertedCount} authentic products into database!`);
}

module.exports = {
    seedLiveCatalogue
};
