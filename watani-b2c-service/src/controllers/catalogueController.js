const db = require('../db');
const { resolvePrice } = require('../services/pricing');

async function getCategories(req, res) {
    try {
        const { rows } = await db.query(`
            SELECT id, slug, name, tagline, description, display_order as "displayOrder"
            FROM categories
            WHERE active = TRUE
            ORDER BY display_order ASC, name ASC;
        `);
        return res.json(rows);
    } catch (err) {
        console.error('[getCategories error]:', err);
        return res.status(500).json({ error: 'Internal Server Error', message: err.message });
    }
}

async function getProducts(req, res) {
    try {
        const { category, material, color, q, sort, page = 0, size = 24 } = req.query;
        const buyerGroup = req.user ? req.user.pricingGroup : 'RETAIL';

        let whereClauses = ['products.active = TRUE'];
        let params = [];
        let paramIdx = 1;

        if (category) {
            whereClauses.push(`categories.slug = $${paramIdx}`);
            params.push(category);
            paramIdx++;
        }

        if (material) {
            whereClauses.push(`products.material = $${paramIdx}`);
            params.push(material);
            paramIdx++;
        }

        if (color) {
            whereClauses.push(`products.color = $${paramIdx}`);
            params.push(color);
            paramIdx++;
        }

        if (q) {
            whereClauses.push(`(products.name ILIKE $${paramIdx} OR products.full_name ILIKE $${paramIdx} OR products.description ILIKE $${paramIdx} OR products.region ILIKE $${paramIdx})`);
            params.push(`%${q}%`);
            paramIdx++;
        }

        let orderBy = 'products.id ASC';
        if (sort === 'price_asc') orderBy = 'products.id ASC';
        else if (sort === 'price_desc') orderBy = 'products.id DESC';
        else if (sort === 'rating') orderBy = 'products.rating_average DESC NULLS LAST';
        else if (sort === 'newest') orderBy = 'products.created_at DESC';

        const countQuery = `
            SELECT COUNT(DISTINCT products.id) as total
            FROM products
            LEFT JOIN categories ON products.category_id = categories.id
            WHERE ${whereClauses.join(' AND ')};
        `;
        const countRes = await db.query(countQuery, params);
        const totalElements = parseInt(countRes.rows[0] ? countRes.rows[0].total : 0, 10);

        const limit = parseInt(size, 10);
        const offset = parseInt(page, 10) * limit;

        const mainQuery = `
            SELECT products.id, products.slug, products.name, products.full_name as "fullName",
                   products.subtitle, products.description, categories.slug as category,
                   products.badge, products.rating_average as rating, products.review_count as "reviewCount",
                   products.region, products.material, products.color
            FROM products
            LEFT JOIN categories ON products.category_id = categories.id
            WHERE ${whereClauses.join(' AND ')}
            ORDER BY ${orderBy}
            LIMIT $${paramIdx} OFFSET $${paramIdx + 1};
        `;

        const queryParams = [...params, limit, offset];
        const { rows: productRows } = await db.query(mainQuery, queryParams);

        // Fetch variants & images for each product
        const content = [];
        for (const p of productRows) {
            const varRes = await db.query('SELECT id, sku, unit, stock_quantity as "stockQuantity" FROM product_variants WHERE product_id = $1 AND active = TRUE LIMIT 1', [p.id]);
            const defaultVariant = varRes.rows[0] || { id: p.id, sku: `SKU-${p.id}`, unit: 'unit', stockQuantity: 10 };

            const imgRes = await db.query('SELECT url FROM product_images WHERE product_id = $1 ORDER BY display_order ASC LIMIT 1', [p.id]);
            const image = imgRes.rows[0] ? imgRes.rows[0].url : '/logo/watany-logo.png';

            const priceInfo = await resolvePrice(defaultVariant.id, buyerGroup, 1);

            const priceVal = typeof priceInfo.price === 'number' ? priceInfo.price : 25.00;
            const priceMajor = String(priceInfo.priceMajor || Math.floor(priceVal));
            const priceMinor = String(priceInfo.priceMinor || '00');

            content.push({
                id: p.id,
                defaultVariantId: defaultVariant.id,
                slug: p.slug,
                name: p.name,
                fullName: p.fullName || p.name,
                subtitle: p.subtitle,
                unit: defaultVariant.unit || 'unit',
                sku: defaultVariant.sku || `SKU-${p.id}`,
                category: p.category || 'olive-oil',
                badge: p.badge,
                image,
                description: p.description,
                priceMajor,
                priceMinor,
                compareAtMajor: priceInfo.compareAtMajor,
                compareAtMinor: priceInfo.compareAtMinor,
                price: priceInfo.price,
                rating: p.rating ? parseFloat(p.rating) : 5.0,
                reviewCount: p.reviewCount || 0,
                region: p.region,
                material: p.material,
                color: p.color,
                inStock: (defaultVariant.stockQuantity !== null && defaultVariant.stockQuantity !== undefined) ? defaultVariant.stockQuantity > 0 : true,
                pricing: priceInfo.pricingRelation
            });
        }

        // Fetch facets for filters
        let colors = [];
        let materials = [];
        let categories = [];
        try {
            const colorRes = await db.query('SELECT DISTINCT color FROM products WHERE color IS NOT NULL AND active = TRUE');
            colors = colorRes.rows.map(r => r.color);
            const materialRes = await db.query('SELECT DISTINCT material FROM products WHERE material IS NOT NULL AND active = TRUE');
            materials = materialRes.rows.map(r => r.material);
            const catRes = await db.query('SELECT slug, name, tagline FROM categories WHERE active = TRUE ORDER BY display_order');
            categories = catRes.rows;
        } catch (e) {}

        return res.json({
            content,
            totalElements,
            totalPages: Math.ceil(totalElements / limit),
            page: parseInt(page, 10),
            size: limit,
            facets: {
                colors,
                materials,
                categories
            }
        });
    } catch (err) {
        console.error('[getProducts error]:', err);
        return res.status(500).json({ error: 'Internal Server Error', message: err.message });
    }
}

async function getProductBySlug(req, res) {
    try {
        const { slug } = req.params;
        const buyerGroup = req.user ? req.user.pricingGroup : 'RETAIL';

        const { rows } = await db.query(`
            SELECT products.id, products.slug, products.name, products.full_name as "fullName",
                   products.subtitle, products.description, categories.slug as category,
                   categories.name as "categoryName", brands.name as brand,
                   products.badge, products.rating_average as rating, products.review_count as "reviewCount",
                   products.region, products.material, products.color
            FROM products
            LEFT JOIN categories ON products.category_id = categories.id
            LEFT JOIN brands ON products.brand_id = brands.id
            WHERE products.slug = $1 AND products.active = TRUE;
        `, [slug]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Not Found', message: 'Product not found' });
        }

        const p = rows[0];

        const varRes = await db.query(`
            SELECT id, sku, unit, stock_quantity as "stockQuantity", low_stock_threshold as "lowStockThreshold",
                   backorder_allowed as "backorderAllowed", weight_grams as "weightGrams",
                   length_cm as "lengthCm", width_cm as "widthCm", height_cm as "heightCm"
            FROM product_variants
            WHERE product_id = $1 AND active = TRUE
            ORDER BY id ASC;
        `, [p.id]);

        const variants = varRes.rows;
        const defaultVariant = variants[0] || { id: p.id, sku: `SKU-${p.id}`, unit: 'unit', stockQuantity: 10 };

        const imgRes = await db.query(`
            SELECT url FROM product_images WHERE product_id = $1 ORDER BY display_order ASC;
        `, [p.id]);
        const gallery = imgRes.rows.map(r => r.url);
        const mainImage = gallery[0] || '/logo/watany-logo.png';

        const priceInfo = await resolvePrice(defaultVariant.id, buyerGroup, 1);

        const revRes = await db.query(`
            SELECT id, author_name as "authorName", rating, title, body, created_at as "createdAt"
            FROM reviews WHERE product_id = $1 AND status = 'APPROVED'
            ORDER BY created_at DESC;
        `, [p.id]);

        return res.json({
            id: p.id,
            defaultVariantId: defaultVariant.id,
            slug: p.slug,
            name: p.name,
            fullName: p.fullName || p.name,
            subtitle: p.subtitle,
            unit: defaultVariant.unit || 'unit',
            sku: defaultVariant.sku,
            category: p.category,
            badge: p.badge,
            image: mainImage,
            gallery: gallery.length > 0 ? gallery : [mainImage],
            description: p.description,
            longDescription: p.description,
            priceMajor: priceInfo.priceMajor,
            priceMinor: priceInfo.priceMinor,
            compareAtMajor: priceInfo.compareAtMajor,
            compareAtMinor: priceInfo.compareAtMinor,
            price: priceInfo.price,
            rating: p.rating ? parseFloat(p.rating) : 5.0,
            reviewCount: p.reviewCount || revRes.rows.length,
            region: p.region,
            material: p.material,
            color: p.color,
            inStock: defaultVariant.stockQuantity > 0,
            pricing: priceInfo.pricingRelation,
            specifications: {
                weightGrams: defaultVariant.weightGrams,
                dimensions: defaultVariant.lengthCm ? `${defaultVariant.lengthCm}x${defaultVariant.widthCm}x${defaultVariant.heightCm} cm` : null,
                unit: defaultVariant.unit,
                sku: defaultVariant.sku,
                region: p.region,
                material: p.material,
                color: p.color,
                brand: p.brand,
                categoryName: p.categoryName
            },
            variants,
            reviews: revRes.rows
        });
    } catch (err) {
        console.error('[getProductBySlug error]:', err);
        return res.status(500).json({ error: 'Internal Server Error', message: err.message });
    }
}

module.exports = {
    getCategories,
    getProducts,
    getProductBySlug
};
