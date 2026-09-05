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

    // Ensure standard roles exist in DB
    const standardRoles = [
        { id: 1, name: 'SUPER_ADMIN', description: 'Full administrative access' },
        { id: 2, name: 'CATALOGUE_MANAGER', description: 'Manage products and pricing' },
        { id: 3, name: 'ORDER_MANAGER', description: 'Manage customer orders and shipping' },
        { id: 4, name: 'SUPPORT', description: 'Customer support agent' },
        { id: 5, name: 'RETAIL_CUSTOMER', description: 'Standard consumer' },
    ];
    for (const r of standardRoles) {
        try {
            await queryFn(`
                INSERT INTO roles (id, name, description, created_at, updated_at, version)
                VALUES ($1, $2, $3, NOW(), NOW(), 0)
                ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;
            `, [r.id, r.name, r.description]);
        } catch (e) {}
    }

    // Read catalogueData.json products dataset
    let productsData = [];
    const localDataPath = path.join(__dirname, 'catalogueData.json');
    if (fs.existsSync(localDataPath)) {
        try {
            productsData = JSON.parse(fs.readFileSync(localDataPath, 'utf8'));
        } catch (e) {
            console.error('[Seeder Error] Failed to parse local catalogueData.json:', e.message);
        }
    }

    if (productsData.length === 0) {
        const cataloguePath = path.join(__dirname, '../../../watani-b2c-website/src/lib/catalogue.ts');
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
    }

    console.log(`[Catalogue Seeder] Extracted ${productsData.length} authentic products for database insertion.`);

    let insertedCount = 0;

    for (const p of productsData) {
        try {
            const catId = categoryMap.get(p.category) || categoryMap.get('olive-oil') || 1;
            const price = parseFloat(`${p.priceMajor || '0'}.${p.priceMinor || '00'}`) || 25.00;

            const existingP = await queryFn(`SELECT id FROM products WHERE slug = $1 OR name = $2 LIMIT 1;`, [p.slug, p.name]);
            let productId;

            if (existingP.rows && existingP.rows.length > 0) {
                productId = existingP.rows[0].id;
                await queryFn(
                    `UPDATE products SET name = $1, full_name = $2, subtitle = $3, description = $4, category_id = $5, active = TRUE, updated_at = NOW() WHERE id = $6;`,
                    [
                        p.name.substring(0, 195),
                        (p.fullName || p.name).substring(0, 290),
                        (p.subtitle || '').substring(0, 290),
                        p.description || p.name,
                        catId,
                        productId
                    ]
                );
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

            // Product Image - always ensure the authentic image URL is set
            const imgUrl = p.image || '/logo/watany-logo.png';
            const imgRes = await queryFn(`SELECT id, url FROM product_images WHERE product_id = $1 ORDER BY display_order ASC;`, [productId]);
            if (!imgRes.rows || imgRes.rows.length === 0) {
                await queryFn(
                    `INSERT INTO product_images (product_id, url, alt_text, display_order, created_at, updated_at, version)
                     VALUES ($1, $2, $3, 0, NOW(), NOW(), 0);`,
                    [productId, imgUrl, p.name]
                );
            } else if (p.image && (!imgRes.rows[0].url || imgRes.rows[0].url === '/logo/watany-logo.png' || imgRes.rows[0].url.includes('placeholder') || imgRes.rows[0].url !== p.image)) {
                await queryFn(
                    `UPDATE product_images SET url = $1, alt_text = $2, updated_at = NOW() WHERE id = $3;`,
                    [p.image, p.name, imgRes.rows[0].id]
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
