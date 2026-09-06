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

            try {
                const { dispatchInvoiceEmailForOrder } = require('../services/emailService');
                dispatchInvoiceEmailForOrder(order.id, db).catch(e => console.warn('[Invoice Email]:', e.message));
            } catch (emailErr) {
                console.warn('[Invoice Email Error]:', emailErr.message);
            }
        }
    } catch (err) {
        console.warn('[Stripe session check error]:', err.message);
    }
}

async function cleanupExpiredPendingOrders() {
    try {
        // Find abandoned checkout orders: status PENDING_PAYMENT, Stripe payment provider, created > 2 hours ago
        // Excludes distributor orders which use AWAITING_PAYMENT_VERIFICATION / E_TRANSFER / CHEQUE
        const { rows: expiredOrders } = await db.query(`
            SELECT id, order_number as "orderNumber", user_id, email,
                   status, payment_status as "paymentStatus",
                   payment_provider as "paymentProvider", payment_provider_ref as "paymentProviderRef"
            FROM orders
            WHERE status = 'PENDING_PAYMENT'
              AND (payment_status IS NULL OR payment_status = 'PENDING')
              AND (payment_provider IS NULL OR UPPER(payment_provider) = 'STRIPE')
              AND created_at < NOW() - INTERVAL '2 hours'
        `);

        if (!expiredOrders || expiredOrders.length === 0) return;

        for (const order of expiredOrders) {
            // Reconcile with Stripe first in case customer paid late and webhook was delayed
            await reconcileStripePaymentIfPending(order);

            // If still pending payment after reconciliation, cancel and purge
            if (order.status === 'PENDING_PAYMENT' && order.paymentStatus !== 'PAID') {
                console.log(`[Order Cleanup] Removing abandoned checkout order #${order.orderNumber} (created > 2 hours ago)`);
                try {
                    await db.query('DELETE FROM order_boxes WHERE order_id = $1', [order.id]);
                } catch (e) {}
                try {
                    await db.query('DELETE FROM order_items WHERE order_id = $1', [order.id]);
                } catch (e) {}
                await db.query('DELETE FROM orders WHERE id = $1', [order.id]);
            }
        }
    } catch (err) {
        console.warn('[cleanupExpiredPendingOrders error]:', err.message);
    }
}

async function getOrders(req, res) {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
        }

        // Clean up any abandoned Stripe checkouts older than 2 hours before fetching
        await cleanupExpiredPendingOrders();

        const userEmail = (req.user.email || '').toLowerCase();

        const { rows: orders } = await db.query(`
            SELECT id, user_id, order_number as "orderNumber", email, status, payment_status as "paymentStatus",
                   payment_provider as "paymentMethod", payment_provider as "paymentProvider",
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
                       image_url as "imageUrl", quantity, unit_price as "unitPrice", line_total as "lineTotal",
                       applied_group as "appliedGroup"
                FROM order_items
                WHERE order_id = $1;
            `, [order.id]);

            order.items = itemsRes.rows.map(item => {
                const uPrice = parseFloat(item.unitPrice) || 0;
                const isWholesale = item.appliedGroup === 'WHOLESALE' || item.appliedGroup === 'DISTRIBUTOR';
                const retailPrice = isWholesale ? Math.round((uPrice / 0.8) * 100) / 100 : uPrice;
                const wholesalePrice = isWholesale ? uPrice : Math.round(uPrice * 0.8 * 100) / 100;

                return {
                    id: item.id,
                    productName: item.productName,
                    productSlug: item.productSlug,
                    sku: item.sku,
                    unit: item.unit || '1 Unit',
                    image: item.imageUrl || '/logo/watany-logo.png',
                    imageUrl: item.imageUrl || '/logo/watany-logo.png',
                    quantity: item.quantity || 1,
                    unitPrice: uPrice,
                    retailPrice,
                    wholesalePrice,
                    lineTotal: parseFloat(item.lineTotal) || 0
                };
            });

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
            SELECT id, user_id, order_number as "orderNumber", email, status, payment_status as "paymentStatus",
                   payment_provider as "paymentMethod", payment_provider as "paymentProvider",
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
                   image_url as "imageUrl", quantity, unit_price as "unitPrice", line_total as "lineTotal",
                   applied_group as "appliedGroup"
            FROM order_items
            WHERE order_id = $1;
        `, [order.id]);

        order.items = itemsRes.rows.map(item => {
            const uPrice = parseFloat(item.unitPrice) || 0;
            const isWholesale = item.appliedGroup === 'WHOLESALE' || item.appliedGroup === 'DISTRIBUTOR';
            const retailPrice = isWholesale ? Math.round((uPrice / 0.8) * 100) / 100 : uPrice;
            const wholesalePrice = isWholesale ? uPrice : Math.round(uPrice * 0.8 * 100) / 100;

            return {
                id: item.id,
                productName: item.productName,
                productSlug: item.productSlug,
                sku: item.sku,
                unit: item.unit || '1 Unit',
                image: item.imageUrl || '/logo/watany-logo.png',
                imageUrl: item.imageUrl || '/logo/watany-logo.png',
                quantity: item.quantity || 1,
                unitPrice: uPrice,
                retailPrice,
                wholesalePrice,
                lineTotal: parseFloat(item.lineTotal) || 0
            };
        });

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
            SELECT id, user_id, order_number as "orderNumber", email, status, payment_status as "paymentStatus",
                   payment_provider as "paymentMethod", payment_provider as "paymentProvider",
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

async function getInvoice(req, res) {
    try {
        const { orderNumber } = req.params;
        const userEmail = req.user ? (req.user.email || '').toLowerCase() : null;
        const userId = req.user ? req.user.id : null;

        const { rows } = await db.query(`
            SELECT id, user_id, order_number as "orderNumber", email, status, payment_status as "paymentStatus",
                   payment_provider as "paymentMethod", payment_provider as "paymentProvider",
                   payment_provider_ref as "paymentProviderRef",
                   subtotal, shipping_total as "shippingTotal", tax_total as "taxTotal",
                   grand_total as "grandTotal", currency, created_at as "createdAt", created_at as "placedAt",
                   ship_full_name as "shipFullName", ship_line1 as "shipLine1", ship_city as "shipCity",
                   ship_region as "shipRegion", ship_postal_code as "shipPostalCode", ship_country as "shipCountry"
            FROM orders
            WHERE UPPER(order_number) = UPPER($1);
        `, [orderNumber]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Not Found', message: 'Order not found' });
        }

        const order = rows[0];
        if (req.user && !req.user.is_admin && order.user_id && order.user_id !== userId && order.email?.toLowerCase() !== userEmail) {
            return res.status(403).json({ error: 'Forbidden', message: 'Access denied' });
        }

        const itemsRes = await db.query(`
            SELECT id, product_name as "productName", sku, unit, quantity, unit_price as "unitPrice", line_total as "lineTotal"
            FROM order_items
            WHERE order_id = $1;
        `, [order.id]);

        order.items = itemsRes.rows.map(item => ({
            id: item.id,
            productName: item.productName,
            sku: item.sku,
            unit: item.unit || '1 Unit',
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

        return res.json(order);
    } catch (err) {
        console.error('[getInvoice error]:', err);
        return res.status(500).json({ error: 'Internal Server Error', message: err.message });
    }
}

async function lookupInvoice(req, res) {
    try {
        const { orderNumber, email } = req.body;
        if (!orderNumber || !email) {
            return res.status(400).json({ error: 'Bad Request', message: 'Order number and email required' });
        }

        const { rows } = await db.query(`
            SELECT id, user_id, order_number as "orderNumber", email, status, payment_status as "paymentStatus",
                   payment_provider as "paymentMethod", payment_provider as "paymentProvider",
                   payment_provider_ref as "paymentProviderRef",
                   subtotal, shipping_total as "shippingTotal", tax_total as "taxTotal",
                   grand_total as "grandTotal", currency, created_at as "createdAt", created_at as "placedAt",
                   ship_full_name as "shipFullName", ship_line1 as "shipLine1", ship_city as "shipCity",
                   ship_region as "shipRegion", ship_postal_code as "shipPostalCode", ship_country as "shipCountry"
            FROM orders
            WHERE UPPER(order_number) = UPPER($1) AND LOWER(email) = LOWER($2);
        `, [orderNumber, email]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Not Found', message: 'Order not found' });
        }

        const order = rows[0];
        const itemsRes = await db.query(`
            SELECT id, product_name as "productName", sku, unit, quantity, unit_price as "unitPrice", line_total as "lineTotal"
            FROM order_items
            WHERE order_id = $1;
        `, [order.id]);

        order.items = itemsRes.rows.map(item => ({
            id: item.id,
            productName: item.productName,
            sku: item.sku,
            unit: item.unit || '1 Unit',
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

        return res.json(order);
    } catch (err) {
        console.error('[lookupInvoice error]:', err);
        return res.status(500).json({ error: 'Internal Server Error', message: err.message });
    }
}

async function payOrder(req, res) {
    try {
        const { orderNumber } = req.params;
        const userEmail = req.user ? (req.user.email || '').toLowerCase() : null;
        const userId = req.user ? req.user.id : null;

        const { rows } = await db.query(`
            SELECT id, user_id, order_number as "orderNumber", email, status, payment_status as "paymentStatus",
                   payment_provider as "paymentProvider", payment_provider_ref as "paymentProviderRef",
                   subtotal, shipping_total as "shippingTotal", tax_total as "taxTotal",
                   grand_total as "grandTotal", currency, ship_region as "shipRegion"
            FROM orders
            WHERE UPPER(order_number) = UPPER($1);
        `, [orderNumber]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Not Found', message: 'Order not found' });
        }

        const order = rows[0];

        // If order belongs to a user and user is logged in, ensure authorized
        if (req.user && !req.user.is_admin && order.user_id && order.user_id !== userId && order.email?.toLowerCase() !== userEmail) {
            return res.status(403).json({ error: 'Forbidden', message: 'Access denied' });
        }

        // First reconcile with Stripe in case it was already paid
        await reconcileStripePaymentIfPending(order, req);

        if (order.status === 'PROCESSING' || order.paymentStatus === 'PAID') {
            return res.json({
                alreadyPaid: true,
                message: 'Order is already paid',
                orderNumber: order.orderNumber
            });
        }

        // Retrieve Stripe key
        let rawKey = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_API_KEY || '';
        let stripeKey = String(rawKey).trim();
        while ((stripeKey.startsWith('"') && stripeKey.endsWith('"')) || (stripeKey.startsWith("'") && stripeKey.endsWith("'"))) {
            stripeKey = stripeKey.slice(1, -1).trim();
        }

        if (!stripeKey || (!stripeKey.startsWith('sk_') && !stripeKey.startsWith('rk_'))) {
            return res.status(500).json({ error: 'Stripe Configuration Error', message: 'Stripe API key is not configured' });
        }

        const stripe = require('stripe')(stripeKey);

        // If there is an existing session, check if it is still open
        if (order.paymentProviderRef && order.paymentProviderRef.startsWith('cs_')) {
            try {
                const existingSession = await stripe.checkout.sessions.retrieve(order.paymentProviderRef);
                if (existingSession && existingSession.status === 'open' && existingSession.url) {
                    return res.json({
                        redirectUrl: existingSession.url,
                        paymentRef: existingSession.id,
                        orderNumber: order.orderNumber
                    });
                }
            } catch (retrieveErr) {
                console.warn('[payOrder] Existing session check failed, creating fresh session:', retrieveErr.message);
            }
        }

        // Fetch line items for fresh session
        const itemsRes = await db.query(`
            SELECT product_name as "productName", quantity, unit_price as "unitPrice", line_total as "lineTotal"
            FROM order_items
            WHERE order_id = $1;
        `, [order.id]);

        const stripeLineItems = itemsRes.rows.map(item => ({
            price_data: {
                currency: 'cad',
                product_data: {
                    name: item.productName || 'Product',
                },
                unit_amount: Math.round(parseFloat(item.unitPrice || 0) * 100),
            },
            quantity: Math.max(1, parseInt(item.quantity || 1, 10)),
        }));

        const shippingTotal = parseFloat(order.shippingTotal || 0);
        if (shippingTotal > 0) {
            stripeLineItems.push({
                price_data: {
                    currency: 'cad',
                    product_data: {
                        name: 'Shipping & Delivery',
                    },
                    unit_amount: Math.round(shippingTotal * 100),
                },
                quantity: 1,
            });
        }

        const taxTotal = parseFloat(order.taxTotal || 0);
        if (taxTotal > 0) {
            stripeLineItems.push({
                price_data: {
                    currency: 'cad',
                    product_data: {
                        name: `Estimated Sales Tax (${order.shipRegion || 'CA'})`,
                    },
                    unit_amount: Math.round(taxTotal * 100),
                },
                quantity: 1,
            });
        }

        const origin = req.headers.origin || req.headers.referer;
        let domain = 'https://watanigroup.org';
        if (origin) {
            try {
                const url = new URL(origin);
                domain = `${url.protocol}//${url.host}`;
            } catch (e) {}
        }

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: stripeLineItems,
            mode: 'payment',
            success_url: `${domain}/checkout/confirmation?order=${encodeURIComponent(order.orderNumber)}`,
            cancel_url: `${domain}/portal/orders/${encodeURIComponent(order.orderNumber)}`,
            client_reference_id: order.orderNumber,
            customer_email: order.email && order.email.includes('@') && !order.email.includes('.local') ? order.email : undefined,
            metadata: {
                orderNumber: order.orderNumber,
                userEmail: order.email || '',
            },
        });

        await db.query(`UPDATE orders SET payment_provider_ref = $1, updated_at = NOW() WHERE id = $2;`, [session.id, order.id]);

        return res.json({
            redirectUrl: session.url,
            paymentRef: session.id,
            orderNumber: order.orderNumber
        });
    } catch (err) {
        console.error('[payOrder error]:', err);
        return res.status(500).json({ error: 'Payment Error', message: err.message });
    }
}

module.exports = {
    getOrders,
    getOrderByNumber,
    lookupOrder,
    cancelOrder,
    returnOrder,
    reconcileStripePaymentIfPending,
    cleanupExpiredPendingOrders,
    getInvoice,
    lookupInvoice,
    payOrder
};
