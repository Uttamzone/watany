const db = require('../db');

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

    let event = req.body;

    if (sig && process.env.STRIPE_SECRET_KEY) {
        try {
            const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
            const payload = req.rawBody || JSON.stringify(req.body);
            event = stripe.webhooks.constructEvent(payload, sig, webhookSecret);
            console.log(`[Stripe Webhook] Verified signature for event: ${event.type}`);
        } catch (err) {
            console.warn(`[Stripe Webhook Warning] Signature verification issue: ${err.message}. Processing event payload directly.`);
        }
    } else {
        console.log(`[Stripe Webhook] Received unverified/development webhook: ${event?.type || 'unknown'}`);
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
            } else if (paymentRef) {
                await db.query(`
                    UPDATE orders
                    SET status = 'PROCESSING',
                        payment_status = 'PAID',
                        updated_at = NOW()
                    WHERE payment_provider_ref = $1;
                `, [paymentRef]);
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
            }
        }

        return res.status(200).json({ received: true });
    } catch (err) {
        console.error('[Stripe Webhook DB Error]:', err);
        return res.status(500).json({ error: 'Webhook processing error', message: err.message });
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
    stripeWebhook,
    health
};
