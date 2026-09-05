const db = require('../db');

async function getOrders(req, res) {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
        }

        const userEmail = (req.user.email || '').toLowerCase();

        const { rows: orders } = await db.query(`
            SELECT id, order_number as "orderNumber", email, status, payment_status as "paymentStatus",
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
                   pricing_group as "pricingGroup", subtotal, shipping_total as "shippingTotal",
                   tax_total as "taxTotal", grand_total as "grandTotal", currency,
                   tracking_number as "trackingNumber", tracking_url as "trackingUrl",
                   carrier_name as "carrierName", shipping_method as "shippingMethod",
                   ship_full_name as "shipFullName", ship_line1 as "shipLine1", ship_city as "shipCity",
                   ship_region as "shipRegion", ship_postal_code as "shipPostalCode", ship_country as "shipCountry",
                   created_at as "createdAt"
            FROM orders
            WHERE order_number = $1;
        `, [orderNumber]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Not Found', message: 'Order not found' });
        }

        const order = rows[0];

        // Access check
        if (req.user && req.user.id !== order.user_id && !req.user.roles.includes('SUPER_ADMIN') && !req.user.roles.includes('ADMIN')) {
            // allow access if email matches or admin
        }

        const itemsRes = await db.query(`
            SELECT id, product_name as "productName", product_slug as "productSlug", sku, unit,
                   image_url as "imageUrl", quantity, unit_price as "unitPrice", line_total as "lineTotal"
            FROM order_items
            WHERE order_id = $1;
        `, [order.id]);

        order.items = itemsRes.rows;

        return res.json(order);
    } catch (err) {
        console.error('[getOrderByNumber error]:', err);
        return res.status(500).json({ error: 'Internal Server Error', message: err.message });
    }
}

async function cancelOrder(req, res) {
    try {
        const { orderNumber } = req.params;
        await db.query(`UPDATE orders SET status = 'CANCELLED', updated_at = NOW() WHERE order_number = $1`, [orderNumber]);
        return res.json({ success: true, message: 'Order cancelled successfully' });
    } catch (err) {
        return res.status(500).json({ error: 'Internal Server Error', message: err.message });
    }
}

async function returnOrder(req, res) {
    try {
        const { orderNumber } = req.params;
        const { reason } = req.body;

        const { rows } = await db.query('SELECT id FROM orders WHERE order_number = $1', [orderNumber]);
        if (rows.length === 0) return res.status(404).json({ error: 'Order not found' });

        const rmaNumber = 'RMA-' + Date.now().toString(36).toUpperCase();
        await db.query(`
            INSERT INTO return_requests (rma_number, order_id, reason, status, created_at, updated_at, version)
            VALUES ($1, $2, $3, 'PENDING', NOW(), NOW(), 0);
        `, [rmaNumber, rows[0].id, reason]);

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
        const itemsRes = await db.query(`
            SELECT id, product_name as "productName", product_slug as "productSlug", sku, unit,
                   image_url as "imageUrl", quantity, unit_price as "unitPrice", line_total as "lineTotal"
            FROM order_items
            WHERE order_id = $1;
        `, [order.id]);

        order.items = itemsRes.rows;
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
    returnOrder
};
