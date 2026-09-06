const db = require('../db');
const { logAudit } = require('../services/auditService');

/* Addresses */
async function getAddresses(req, res) {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const { rows } = await db.query(`
        SELECT id, full_name as "fullName", line1, line2, city, region, postal_code as "postalCode",
               country, phone, is_default_shipping as "isDefaultShipping", is_default_billing as "isDefaultBilling"
        FROM addresses WHERE user_id = $1 ORDER BY id DESC;
    `, [req.user.id]);
    return res.json(rows);
}

async function createAddress(req, res) {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const { fullName, line1, line2, city, region, postalCode, country, phone, isDefaultShipping, isDefaultBilling } = req.body;

    const { rows } = await db.query(`
        INSERT INTO addresses (user_id, full_name, line1, line2, city, region, postal_code, country, phone, is_default_shipping, is_default_billing, created_at, updated_at, version)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW(), 0)
        RETURNING id;
    `, [req.user.id, fullName, line1, line2, city, region, postalCode, country || 'CA', phone, !!isDefaultShipping, !!isDefaultBilling]);

    return res.json({ id: rows[0].id, success: true });
}

/* Wishlist */
async function getWishlist(req, res) {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const { rows } = await db.query(`
        SELECT p.id, p.slug, p.name, p.full_name as "fullName",
               (SELECT url FROM product_images WHERE product_id = p.id ORDER BY display_order ASC LIMIT 1) as image
        FROM wishlists w
        JOIN products p ON w.product_id = p.id
        WHERE w.user_id = $1;
    `, [req.user.id]);
    return res.json(rows);
}

async function addWishlist(req, res) {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const { productId } = req.params;
    await db.query(`INSERT INTO wishlists (user_id, product_id, created_at) VALUES ($1, $2, NOW()) ON CONFLICT DO NOTHING;`, [req.user.id, productId]);
    return res.json({ success: true });
}

async function removeWishlist(req, res) {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const { productId } = req.params;
    await db.query(`DELETE FROM wishlists WHERE user_id = $1 AND product_id = $2;`, [req.user.id, productId]);
    return res.json({ success: true });
}

/* Settings & Currencies */
async function getCurrencies(req, res) {
    return res.json([
        { code: 'CAD', symbol: '$', name: 'Canadian Dollar', rate: 1.0, isDefault: true },
        { code: 'USD', symbol: '$', name: 'US Dollar', rate: 0.74, isDefault: false }
    ]);
}

async function getSettings(req, res) {
    const { rows } = await db.query('SELECT key, value FROM settings');
    const settings = {};
    for (const r of rows) settings[r.key] = r.value;
    return res.json(settings);
}

/* Webhooks */
async function stripeWebhook(req, res) {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_aLPGTG4hhKB1dElq8qBgrIJmM6sUTNio';

    // req.body is a raw Buffer when the route uses express.raw() (registered before express.json())
    // This is required for Stripe signature verification.
    const rawPayload = Buffer.isBuffer(req.body) ? req.body : (req.rawBody || Buffer.from(JSON.stringify(req.body)));

    let rawKey = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_API_KEY || '';
    let stripeKey = String(rawKey).trim();
    while ((stripeKey.startsWith('"') && stripeKey.endsWith('"')) || (stripeKey.startsWith("'") && stripeKey.endsWith("'"))) {
        stripeKey = stripeKey.slice(1, -1).trim();
    }

    let event;

    if (sig && stripeKey) {
        try {
            const stripe = require('stripe')(stripeKey);
            event = stripe.webhooks.constructEvent(rawPayload, sig, webhookSecret);
            console.log(`[Stripe Webhook] ✓ Signature verified for event: ${event.type}`);
        } catch (err) {
            console.error(`[Stripe Webhook] ✗ Signature verification FAILED: ${err.message}`);
            // Reject events with bad signatures to prevent replay attacks
            return res.status(400).json({ error: 'Webhook signature verification failed', message: err.message });
        }
    } else if (!sig) {
        // No signature header - reject in production, warn in development
        if (process.env.NODE_ENV === 'production') {
            console.error('[Stripe Webhook] Rejected: missing stripe-signature header in production');
            return res.status(400).json({ error: 'Missing stripe-signature header' });
        }
        // Development / local testing: parse body manually
        try {
            event = typeof req.body === 'object' && !Buffer.isBuffer(req.body)
                ? req.body
                : JSON.parse(rawPayload.toString());
        } catch {
            return res.status(400).json({ error: 'Invalid webhook payload' });
        }
        console.warn(`[Stripe Webhook] ⚠ Unverified development webhook: ${event?.type || 'unknown'}`);
    } else {
        // Has signature but no Stripe key - cannot verify
        console.error('[Stripe Webhook] Cannot verify: STRIPE_SECRET_KEY not configured');
        return res.status(400).json({ error: 'Stripe not configured on server' });
    }

    const eventType = event?.type;
    const dataObject = event?.data?.object || event;

    if (!eventType) {
        return res.status(400).json({ error: 'Invalid webhook payload' });
    }

    try {
        if (
            eventType === 'charge.succeeded' ||
            eventType === 'payment_intent.succeeded' ||
            eventType === 'checkout.session.completed'
        ) {
            const orderNumber =
                dataObject?.metadata?.orderNumber ||
                dataObject?.client_reference_id ||
                dataObject?.metadata?.order_number;

            const paymentRef = dataObject?.id || dataObject?.payment_intent;

            console.log(`[Stripe Webhook] Payment succeeded for orderNumber: ${orderNumber}, paymentRef: ${paymentRef}`);

            if (orderNumber) {
                await db.query(`
                    UPDATE orders
                    SET status = 'PROCESSING',
                        payment_status = 'PAID',
                        payment_provider_ref = COALESCE($2, payment_provider_ref),
                        updated_at = NOW()
                    WHERE UPPER(order_number) = UPPER($1);
                `, [orderNumber, paymentRef]);

                await logAudit({
                    actor: 'stripe_webhook',
                    action: 'PAYMENT_RECEIVED',
                    entityType: 'ORDER',
                    entityId: orderNumber,
                    newValue: { status: 'PROCESSING', paymentStatus: 'PAID', paymentRef },
                    req
                });

                try {
                    const { dispatchInvoiceEmailForOrder } = require('../services/emailService');
                    dispatchInvoiceEmailForOrder(orderNumber, db).catch(e => console.warn('[Invoice Email Webhook]:', e.message));
                } catch (emailErr) {
                    console.warn('[Invoice Email Webhook Error]:', emailErr.message);
                }
            } else if (paymentRef) {
                const updatedRes = await db.query(`
                    UPDATE orders
                    SET status = 'PROCESSING',
                        payment_status = 'PAID',
                        updated_at = NOW()
                    WHERE payment_provider_ref = $1
                    RETURNING order_number;
                `, [paymentRef]);

                await logAudit({
                    actor: 'stripe_webhook',
                    action: 'PAYMENT_RECEIVED',
                    entityType: 'ORDER',
                    entityId: paymentRef,
                    newValue: { status: 'PROCESSING', paymentStatus: 'PAID' },
                    req
                });

                if (updatedRes.rows.length > 0) {
                    try {
                        const { dispatchInvoiceEmailForOrder } = require('../services/emailService');
                        dispatchInvoiceEmailForOrder(updatedRes.rows[0].order_number, db).catch(e => console.warn('[Invoice Email Webhook]:', e.message));
                    } catch (e) {}
                }
            }
        } else if (
            eventType === 'charge.failed' ||
            eventType === 'payment_intent.payment_failed'
        ) {
            const orderNumber =
                dataObject?.metadata?.orderNumber ||
                dataObject?.client_reference_id ||
                dataObject?.metadata?.order_number;

            if (orderNumber) {
                await db.query(`
                    UPDATE orders
                    SET payment_status = 'FAILED',
                        updated_at = NOW()
                    WHERE UPPER(order_number) = UPPER($1);
                `, [orderNumber]);

                await logAudit({
                    actor: 'stripe_webhook',
                    action: 'PAYMENT_FAILED',
                    entityType: 'ORDER',
                    entityId: orderNumber,
                    newValue: { paymentStatus: 'FAILED', reason: dataObject?.last_payment_error?.message || 'Charge failed' },
                    req
                });
            }
        }

        return res.status(200).json({ received: true });
    } catch (err) {
        console.error('[Stripe Webhook DB Error]:', err);
        return res.status(500).json({ error: 'Webhook processing error', message: err.message });
    }
}

/* Order Reviews */
async function getOrderReviewSummary(req, res) {
    try {
        const { orderNumber } = req.params;
        const oRes = await db.query(`
            SELECT id, order_number as "orderNumber", created_at as "placedAt"
            FROM orders
            WHERE order_number = $1 OR id::text = $1
            LIMIT 1;
        `, [orderNumber]);

        if (oRes.rows.length === 0) {
            return res.status(404).json({ error: 'Not Found', message: 'Order not found' });
        }
        const order = oRes.rows[0];

        const itemsRes = await db.query(`
            SELECT oi.id as "orderItemId", oi.product_name as "productName",
                   oi.product_slug as "productSlug", oi.sku, oi.image_url as "image",
                   oi.quantity,
                   r.rating as "existingRating", r.title as "existingTitle", r.body as "existingBody"
            FROM order_items oi
            LEFT JOIN reviews r ON r.product_id = oi.variant_id OR (r.product_name = oi.product_name AND r.author_name LIKE '%' || $1 || '%')
            WHERE oi.order_id = $2;
        `, [order.orderNumber, order.id]);

        return res.json({
            orderNumber: order.orderNumber,
            placedAt: order.placedAt,
            items: itemsRes.rows
        });
    } catch (err) {
        console.error('[getOrderReviewSummary error]:', err);
        return res.status(500).json({ error: 'Internal Server Error', message: err.message });
    }
}

async function submitOrderReview(req, res) {
    try {
        const { orderNumber, orderItemId } = req.params;
        const { rating, title, body } = req.body || {};
        const numRating = Math.max(1, Math.min(5, parseInt(rating, 10) || 5));

        const oiRes = await db.query(`
            SELECT oi.id, oi.order_id, oi.product_name, oi.product_slug, oi.variant_id, o.email, o.order_number
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            WHERE (o.order_number = $1 OR o.id::text = $1) AND oi.id = $2
            LIMIT 1;
        `, [orderNumber, orderItemId]);

        if (oiRes.rows.length === 0) {
            return res.status(404).json({ error: 'Not Found', message: 'Order item not found' });
        }
        const item = oiRes.rows[0];

        let productId = item.variant_id;
        if (!productId) {
            const pRes = await db.query('SELECT id FROM products WHERE slug = $1 LIMIT 1', [item.product_slug]);
            if (pRes.rows.length > 0) productId = pRes.rows[0].id;
        }

        const authorName = item.email ? item.email.split('@')[0] : `Customer (${orderNumber})`;

        await db.query(`
            INSERT INTO reviews (product_id, product_name, author_name, rating, title, body, status, created_at, updated_at, version)
            VALUES ($1, $2, $3, $4, $5, $6, 'APPROVED', NOW(), NOW(), 0);
        `, [productId, item.product_name, authorName, numRating, (title || '').trim() || null, (body || '').trim() || null]);

        if (productId) {
            try {
                const statRes = await db.query(`
                    SELECT COALESCE(AVG(rating), 5.0) as avg, COUNT(*) as cnt
                    FROM reviews
                    WHERE product_id = $1 AND status = 'APPROVED';
                `, [productId]);
                if (statRes.rows.length > 0) {
                    await db.query(`UPDATE products SET rating_average = $1, review_count = $2 WHERE id = $3`, [
                        parseFloat(statRes.rows[0].avg).toFixed(1),
                        parseInt(statRes.rows[0].cnt, 10),
                        productId
                    ]);
                }
            } catch (e) {}
        }

        return res.json({
            orderItemId: parseInt(orderItemId, 10),
            rating: numRating,
            title: title || null,
            body: body || null
        });
    } catch (err) {
        console.error('[submitOrderReview error]:', err);
        return res.status(500).json({ error: 'Internal Server Error', message: err.message });
    }
}

/* Health */
async function health(req, res) {
    return res.json({ status: 'UP', service: 'watani-b2c-express-service', timestamp: new Date().toISOString() });
}

module.exports = {
    getAddresses,
    createAddress,
    getWishlist,
    addWishlist,
    removeWishlist,
    getCurrencies,
    getSettings,
    getOrderReviewSummary,
    submitOrderReview,
    stripeWebhook,
    health
};
