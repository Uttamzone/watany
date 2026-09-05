const db = require('../db');
const { resolvePrice } = require('../services/pricing');

async function findOrCreateCart(req) {
    const userId = req.user ? req.user.id : null;
    const sessionToken = req.headers['x-cart-token'] || req.headers['x-cart-session'] || req.query.sessionToken || null;

    if (userId) {
        let { rows } = await db.query('SELECT id FROM carts WHERE user_id = $1 AND active = TRUE ORDER BY id DESC LIMIT 1', [userId]);
        if (rows.length > 0) return rows[0].id;

        const insert = await db.query('INSERT INTO carts (user_id, active, created_at, updated_at, version) VALUES ($1, TRUE, NOW(), NOW(), 0) RETURNING id', [userId]);
        return insert.rows[0].id;
    } else if (sessionToken) {
        let { rows } = await db.query('SELECT id FROM carts WHERE session_token = $1 AND active = TRUE ORDER BY id DESC LIMIT 1', [sessionToken]);
        if (rows.length > 0) return rows[0].id;

        const insert = await db.query('INSERT INTO carts (session_token, active, created_at, updated_at, version) VALUES ($1, TRUE, NOW(), NOW(), 0) RETURNING id', [sessionToken]);
        return insert.rows[0].id;
    } else {
        const newSession = 'sess_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
        const insert = await db.query('INSERT INTO carts (session_token, active, created_at, updated_at, version) VALUES ($1, TRUE, NOW(), NOW(), 0) RETURNING id', [newSession]);
        return insert.rows[0].id;
    }
}

async function formatCartResponse(cartId, req) {
    const buyerGroup = req.user ? req.user.pricingGroup : 'RETAIL';

    const { rows: items } = await db.query(`
        SELECT ci.id as item_id, ci.quantity, v.id as variant_id, v.sku, v.unit, v.stock_quantity,
               p.id as product_id, p.name as product_name, p.slug as product_slug,
               COALESCE((SELECT url FROM product_images WHERE product_id = p.id ORDER BY display_order ASC LIMIT 1), '/logo/watany-logo.png') as image_url
        FROM cart_items ci
        JOIN product_variants v ON ci.variant_id = v.id
        JOIN products p ON v.product_id = p.id
        WHERE ci.cart_id = $1
        ORDER BY ci.created_at ASC;
    `, [cartId]);

    let subtotal = 0;
    const formattedItems = [];

    for (const item of items) {
        const priceInfo = await resolvePrice(item.variant_id, buyerGroup, item.quantity);
        const lineTotal = priceInfo.price * item.quantity;
        subtotal += lineTotal;

        const itemImage = item.image_url || '/logo/watany-logo.png';

        formattedItems.push({
            id: item.item_id,
            itemId: item.item_id,
            variantId: item.variant_id,
            productId: item.product_id,
            productName: item.product_name,
            productSlug: item.product_slug,
            sku: item.sku,
            unit: item.unit,
            image: itemImage,
            imageUrl: itemImage,
            productImage: itemImage,
            quantity: item.quantity,
            unitPrice: priceInfo.price,
            lineTotal,
            appliedGroup: priceInfo.pricingRelation.appliedGroup,
            pricing: priceInfo.pricingRelation
        });
    }

    const { rows: cartRows } = await db.query('SELECT session_token FROM carts WHERE id = $1', [cartId]);
    const sessionToken = cartRows.length > 0 ? cartRows[0].session_token : null;

    return {
        id: cartId,
        sessionToken,
        items: formattedItems,
        itemCount: formattedItems.reduce((sum, i) => sum + i.quantity, 0),
        subtotal,
        total: subtotal
    };
}

async function getCart(req, res) {
    try {
        const cartId = await findOrCreateCart(req);
        const cartData = await formatCartResponse(cartId, req);
        return res.json(cartData);
    } catch (err) {
        console.error('[getCart error]:', err);
        return res.status(500).json({ error: 'Internal Server Error', message: err.message });
    }
}

async function addItem(req, res) {
    try {
        const cartId = await findOrCreateCart(req);
        const { variantId, productId, quantity = 1 } = req.body;

        let targetVariantId = variantId;
        if (!targetVariantId && productId) {
            const varRes = await db.query('SELECT id FROM product_variants WHERE product_id = $1 ORDER BY id ASC LIMIT 1', [productId]);
            if (varRes.rows.length > 0) targetVariantId = varRes.rows[0].id;
        }

        if (!targetVariantId) {
            return res.status(400).json({ error: 'Bad Request', message: 'variantId or productId is required' });
        }

        const existing = await db.query('SELECT id, quantity FROM cart_items WHERE cart_id = $1 AND variant_id = $2', [cartId, targetVariantId]);

        if (existing.rows.length > 0) {
            const newQty = existing.rows[0].quantity + parseInt(quantity, 10);
            await db.query('UPDATE cart_items SET quantity = $1, updated_at = NOW() WHERE id = $2', [newQty, existing.rows[0].id]);
        } else {
            await db.query('INSERT INTO cart_items (cart_id, variant_id, quantity, created_at, updated_at, version) VALUES ($1, $2, $3, NOW(), NOW(), 0)', [cartId, targetVariantId, parseInt(quantity, 10)]);
        }

        const cartData = await formatCartResponse(cartId, req);
        return res.json(cartData);
    } catch (err) {
        console.error('[addItem error]:', err);
        return res.status(500).json({ error: 'Internal Server Error', message: err.message });
    }
}

async function updateItem(req, res) {
    try {
        const cartId = await findOrCreateCart(req);
        const { itemId } = req.params;
        const { quantity } = req.body;

        if (parseInt(quantity, 10) <= 0) {
            await db.query('DELETE FROM cart_items WHERE cart_id = $1 AND id = $2', [cartId, itemId]);
        } else {
            await db.query('UPDATE cart_items SET quantity = $1, updated_at = NOW() WHERE cart_id = $2 AND id = $3', [parseInt(quantity, 10), cartId, itemId]);
        }

        const cartData = await formatCartResponse(cartId, req);
        return res.json(cartData);
    } catch (err) {
        console.error('[updateItem error]:', err);
        return res.status(500).json({ error: 'Internal Server Error', message: err.message });
    }
}

async function removeItem(req, res) {
    try {
        const cartId = await findOrCreateCart(req);
        const { itemId } = req.params;

        await db.query('DELETE FROM cart_items WHERE cart_id = $1 AND id = $2', [cartId, itemId]);

        const cartData = await formatCartResponse(cartId, req);
        return res.json(cartData);
    } catch (err) {
        console.error('[removeItem error]:', err);
        return res.status(500).json({ error: 'Internal Server Error', message: err.message });
    }
}

async function mergeCart(req, res) {
    try {
        const { sessionToken } = req.body;
        if (!req.user || !sessionToken) {
            return res.json({ success: true, message: 'Nothing to merge' });
        }

        const guestCart = await db.query('SELECT id FROM carts WHERE session_token = $1 AND active = TRUE', [sessionToken]);
        if (guestCart.rows.length === 0) return res.json({ success: true });

        const userCartId = await findOrCreateCart(req);
        const guestItems = await db.query('SELECT variant_id, quantity FROM cart_items WHERE cart_id = $1', [guestCart.rows[0].id]);

        for (const item of guestItems.rows) {
            const existing = await db.query('SELECT id, quantity FROM cart_items WHERE cart_id = $1 AND variant_id = $2', [userCartId, item.variant_id]);
            if (existing.rows.length > 0) {
                await db.query('UPDATE cart_items SET quantity = $1 WHERE id = $2', [existing.rows[0].quantity + item.quantity, existing.rows[0].id]);
            } else {
                await db.query('INSERT INTO cart_items (cart_id, variant_id, quantity, created_at, updated_at, version) VALUES ($1, $2, $3, NOW(), NOW(), 0)', [userCartId, item.variant_id, item.quantity]);
            }
        }

        await db.query('UPDATE carts SET active = FALSE WHERE id = $1', [guestCart.rows[0].id]);

        const cartData = await formatCartResponse(userCartId, req);
        return res.json(cartData);
    } catch (err) {
        console.error('[mergeCart error]:', err);
        return res.status(500).json({ error: 'Internal Server Error', message: err.message });
    }
}

module.exports = {
    getCart,
    addItem,
    updateItem,
    removeItem,
    mergeCart
};
