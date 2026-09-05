const db = require('../db');
const { logAudit } = require('../services/auditService');

async function reconcileStripePaymentIfPending(order, req) {
    if (!order || order.status === 'PROCESSING' || order.paymentStatus === 'PAID') return;
    const ref = order.paymentProviderRef;
    if (!ref || !ref.startsWith('cs_')) return;

    let rawKey = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_API_KEY || '';
    let stripeKey = String(rawKey).trim();
    while ((stripeKey.startsWith('"') && stripeKey.endsWith('"')) || (stripeKey.startsWith("'") && stripeKey.endsWith("'"))) {
        stripeKey = stripeKey.slice(1, -1).trim();
    }
    if (!stripeKey || (!stripeKey.startsWith('sk_') && !stripeKey.startsWith('rk_'))) return;

    try {
        const stripe = require('stripe')(stripeKey);
        const session = await stripe.checkout.sessions.retrieve(ref);
        if (session && session.payment_status === 'paid') {
            await db.query(`
                UPDATE orders
                SET status = 'PROCESSING', payment_status = 'PAID', updated_at = NOW()
                WHERE id = $1;
            `, [order.id]);
            order.status = 'PROCESSING';
            order.paymentStatus = 'PAID';

            if (order.user_id) {
                try {
                    await db.query('UPDATE carts SET active = FALSE WHERE user_id = $1', [order.user_id]);
                } catch (e) {}
            }

            await logAudit({
                actor: order.email || 'customer',
                action: 'PAYMENT_CONFIRMED',
                entityType: 'ORDER',
                entityId: order.orderNumber,
                newValue: { status: 'PROCESSING', paymentStatus: 'PAID', stripeSession: session.id },
                req
            });
        }
    } catch (err) {
        console.warn('[Stripe session check error]:', err.message);
    }
}

async function getOrders(req, res) {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
        }

        const userEmail = (req.user.email || '').toLowerCase();

        const { rows: orders } = await db.query(`
            SELECT id, order_number as "orderNumber", email, status, payment_status as "paymentStatus",
                   payment_provider_ref as "paymentProviderRef",
                   subtotal, shipping_total as "shippingTotal", tax_total as "taxTotal",
                   grand_total as "grandTotal", currency, created_at as "createdAt", created_at as "placedAt",
                   ship_full_name as "shipFullName", ship_line1 as "shipLine1", ship_city as "shipCity",
                   ship_region as "shipRegion", ship_postal_code as "shipPostalCode", ship_country as "shipCountry",
                   carrier_name as "carrierName", shipping_method as "shippingMethod",
                   tracking_number as "trackingNumber", tracking_url as "trackingUrl"
            FROM orders
            WHERE user_id = $1 OR (email IS NOT NULL AND LOWER(email) = $2)
            ORDER BY created_at DESC;
        `, [req.user.id, userEmail]);

        for (const order of orders) {
            await reconcileStripePaymentIfPending(order, req);

            const itemsRes = await db.query(`
                SELECT id, product_name as "productName", product_slug as "productSlug", sku, unit,
                       image_url as "imageUrl", quantity, unit_price as "unitPrice", line_total as "lineTotal"
                FROM order_items
                WHERE order_id = $1;
            `, [order.id]);

            order.items = itemsRes.rows.map(item => ({
                id: item.id,
                productName: item.productName,
                productSlug: item.productSlug,
                sku: item.sku,
                unit: item.unit || '1 Unit',
                image: item.imageUrl || '/logo/watany-logo.png',
                imageUrl: item.imageUrl || '/logo/watany-logo.png',
                quantity: item.quantity || 1,
                unitPrice: parseFloat(item.unitPrice) || 0,
                lineTotal: parseFloat(item.lineTotal) || 0
            }));

            order.shippingAddress = {
                fullName: order.shipFullName || 'Customer',
                line1: order.shipLine1 || '',
                city: order.shipCity || '',
                region: order.shipRegion || '',
                postalCode: order.shipPostalCode || '',
                country: order.shipCountry || 'Canada'
            };

            order.timeline = [
                {
                    status: order.status || 'PLACED',
                    message: `Order is currently ${order.status || 'PLACED'}`,
                    at: order.createdAt || new Date().toISOString()
                }
            ];
        }

        return res.json(orders);
    } catch (err) {
        console.error('[getOrders error]:', err);
        return res.status(500).json({ error: 'Internal Server Error', message: err.message });
    }
}

async function getOrderByNumber(req, res) {
    try {
        const { orderNumber } = req.params;

        const { rows } = await db.query(`
            SELECT id, order_number as "orderNumber", email, status, payment_status as "paymentStatus",
                   payment_provider_ref as "paymentProviderRef",
                   pricing_group as "pricingGroup", subtotal, shipping_total as "shippingTotal",
                   tax_total as "taxTotal", grand_total as "grandTotal", currency,
                   tracking_number as "trackingNumber", tracking_url as "trackingUrl",
                   carrier_name as "carrierName", shipping_method as "shippingMethod",
                   ship_full_name as "shipFullName", ship_line1 as "shipLine1", ship_city as "shipCity",
                   ship_region as "shipRegion", ship_postal_code as "shipPostalCode", ship_country as "shipCountry",
                   created_at as "createdAt"
            FROM orders
            WHERE UPPER(order_number) = UPPER($1);
        `, [orderNumber]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Not Found', message: 'Order not found' });
        }

        const order = rows[0];
        await reconcileStripePaymentIfPending(order, req);

        // Build shippingAddress object
        order.shippingAddress = {
            fullName: order.shipFullName || 'Customer',
            line1: order.shipLine1 || '',
            line2: null,
            city: order.shipCity || '',
            region: order.shipRegion || '',
            postalCode: order.shipPostalCode || '',
            country: order.shipCountry || 'Canada'
        };

        order.timeline = [
            {
                status: order.status || 'PLACED',
                message: `Order is currently ${order.status || 'PLACED'}`,
                at: order.createdAt || new Date().toISOString()
            }
        ];

        const itemsRes = await db.query(`
            SELECT id, product_name as "productName", product_slug as "productSlug", sku, unit,
                   image_url as "imageUrl", quantity, unit_price as "unitPrice", line_total as "lineTotal"
            FROM order_items
            WHERE order_id = $1;
        `, [order.id]);

        order.items = itemsRes.rows.map(item => ({
            id: item.id,
            productName: item.productName,
            productSlug: item.productSlug,
            sku: item.sku,
            unit: item.unit || '1 Unit',
            image: item.imageUrl || '/logo/watany-logo.png',
            imageUrl: item.imageUrl || '/logo/watany-logo.png',
            quantity: item.quantity || 1,
            unitPrice: parseFloat(item.unitPrice) || 0,
            lineTotal: parseFloat(item.lineTotal) || 0
        }));

        order.placedAt = order.createdAt;

        return res.json(order);
    } catch (err) {
        console.error('[getOrderByNumber error]:', err);
        return res.status(500).json({ error: 'Internal Server Error', message: err.message });
    }
}

async function cancelOrder(req, res) {
    try {
        const { orderNumber } = req.params;
        await db.query(`UPDATE orders SET status = 'CANCELLED', updated_at = NOW() WHERE UPPER(order_number) = UPPER($1)`, [orderNumber]);
        await logAudit({
            req,
            action: 'ORDER_CANCELLED',
            entityType: 'ORDER',
            entityId: orderNumber,
            newValue: { status: 'CANCELLED' }
        });
        return res.json({ success: true, message: 'Order cancelled successfully' });
    } catch (err) {
        return res.status(500).json({ error: 'Internal Server Error', message: err.message });
    }
}

async function returnOrder(req, res) {
    try {
        const { orderNumber } = req.params;
        const { reason } = req.body;

        const { rows } = await db.query('SELECT id FROM orders WHERE UPPER(order_number) = UPPER($1)', [orderNumber]);
        if (rows.length === 0) return res.status(404).json({ error: 'Order not found' });

        const rmaNumber = 'RMA-' + Date.now().toString(36).toUpperCase();
        await db.query(`
            INSERT INTO return_requests (rma_number, order_id, reason, status, created_at, updated_at, version)
            VALUES ($1, $2, $3, 'PENDING', NOW(), NOW(), 0);
        `, [rmaNumber, rows[0].id, reason]);

        await logAudit({
            req,
            action: 'ORDER_RETURN_REQUESTED',
            entityType: 'ORDER',
            entityId: orderNumber,
            newValue: { rmaNumber, reason }
        });

        return res.json({ success: true, rmaNumber, message: 'Return request submitted' });
    } catch (err) {
        return res.status(500).json({ error: 'Internal Server Error', message: err.message });
    }
}

async function lookupOrder(req, res) {
    try {
        const { orderNumber, email } = req.body;
        if (!orderNumber) {
            return res.status(400).json({ error: 'Bad Request', message: 'orderNumber is required' });
        }

        let query = `
            SELECT id, order_number as "orderNumber", email, status, payment_status as "paymentStatus",
                   payment_provider_ref as "paymentProviderRef",
                   pricing_group as "pricingGroup", subtotal, shipping_total as "shippingTotal",
                   tax_total as "taxTotal", grand_total as "grandTotal", currency,
                   tracking_number as "trackingNumber", tracking_url as "trackingUrl",
                   carrier_name as "carrierName", shipping_method as "shippingMethod",
                   ship_full_name as "shipFullName", ship_line1 as "shipLine1", ship_city as "shipCity",
                   ship_region as "shipRegion", ship_postal_code as "shipPostalCode", ship_country as "shipCountry",
                   created_at as "createdAt"
            FROM orders
            WHERE UPPER(order_number) = UPPER($1)
        `;
        let params = [orderNumber];

        if (email) {
            query += ` AND LOWER(email) = LOWER($2)`;
            params.push(email);
        }

        const { rows } = await db.query(query, params);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Not Found', message: 'Order not found' });
        }

        const order = rows[0];
        await reconcileStripePaymentIfPending(order, req);

        order.shippingAddress = {
            fullName: order.shipFullName || 'Customer',
            line1: order.shipLine1 || '',
            line2: null,
            city: order.shipCity || '',
            region: order.shipRegion || '',
            postalCode: order.shipPostalCode || '',
            country: order.shipCountry || 'Canada'
        };

        order.timeline = [
            {
                status: order.status || 'PLACED',
                message: `Order is currently ${order.status || 'PLACED'}`,
                at: order.createdAt || new Date().toISOString()
            }
        ];

        const itemsRes = await db.query(`
            SELECT id, product_name as "productName", product_slug as "productSlug", sku, unit,
                   image_url as "imageUrl", quantity, unit_price as "unitPrice", line_total as "lineTotal"
            FROM order_items
            WHERE order_id = $1;
        `, [order.id]);

        order.items = itemsRes.rows.map(item => ({
            id: item.id,
            productName: item.productName,
            productSlug: item.productSlug,
            sku: item.sku,
            unit: item.unit || '1 Unit',
            image: item.imageUrl || '/logo/watany-logo.png',
            imageUrl: item.imageUrl || '/logo/watany-logo.png',
            quantity: item.quantity || 1,
            unitPrice: parseFloat(item.unitPrice) || 0,
            lineTotal: parseFloat(item.lineTotal) || 0
        }));

        order.placedAt = order.createdAt;

        return res.json(order);
    } catch (err) {
        console.error('[lookupOrder error]:', err);
        return res.status(500).json({ error: 'Internal Server Error', message: err.message });
    }
}

module.exports = {
    getOrders,
    getOrderByNumber,
    lookupOrder,
    cancelOrder,
    returnOrder,
    reconcileStripePaymentIfPending
};
