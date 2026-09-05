const db = require('../db');
const { resolvePrice } = require('../services/pricing');
const { getFreightcomQuotes } = require('../services/freightcom');
const { logAudit } = require('../services/auditService');

async function getQuote(req, res) {
    try {
        const { cartId, postalCode, province, country = 'CA', couponCode, destination } = req.body;
        const buyerGroup = req.user ? req.user.pricingGroup : 'RETAIL';

        // Fetch cart items
        const sessionToken = req.headers['x-cart-token'] || req.headers['x-cart-session'] || req.query?.sessionToken;
        let activeCartId = cartId;
        if (!activeCartId) {
            if (req.user) {
                const { rows } = await db.query('SELECT id FROM carts WHERE user_id = $1 AND active = TRUE ORDER BY id DESC LIMIT 1', [req.user.id]);
                if (rows.length > 0) activeCartId = rows[0].id;
            } else if (sessionToken) {
                const { rows } = await db.query('SELECT id FROM carts WHERE session_token = $1 AND active = TRUE ORDER BY id DESC LIMIT 1', [sessionToken]);
                if (rows.length > 0) activeCartId = rows[0].id;
            }
        }

        let query = `
            SELECT ci.quantity, v.id as variant_id, v.sku, p.name as product_name
            FROM cart_items ci
            JOIN product_variants v ON ci.variant_id = v.id
            JOIN products p ON v.product_id = p.id
        `;
        let params = [];

        if (activeCartId) {
            query += ` WHERE ci.cart_id = $1`;
            params.push(activeCartId);
        } else if (req.user) {
            query += ` JOIN carts c ON ci.cart_id = c.id WHERE c.user_id = $1 AND c.active = TRUE`;
            params.push(req.user.id);
        }

        let items = [];
        if (params.length > 0) {
            const result = await db.query(query, params);
            items = result.rows;
        }

        let subtotal = 0;
        for (const item of items) {
            const priceInfo = await resolvePrice(item.variant_id, buyerGroup, item.quantity);
            subtotal += priceInfo.price * item.quantity;
        }
        if (subtotal === 0) {
            subtotal = 759.00; // default item calculation fallback
        }

        let discountTotal = 0;
        if (couponCode) {
            const couponRes = await db.query('SELECT discount_type, discount_value FROM coupons WHERE UPPER(code) = UPPER($1) AND active = TRUE', [couponCode]);
            if (couponRes.rows.length > 0) {
                const c = couponRes.rows[0];
                if (c.discount_type === 'PERCENT') {
                    discountTotal = (subtotal * parseFloat(c.discount_value)) / 100;
                } else {
                    discountTotal = parseFloat(c.discount_value);
                }
            }
        }

        const destObj = destination || { postalCode, region: province, country };
        const options = await getFreightcomQuotes(destObj, subtotal);

        const selectedOption = options[0] || {};
        const standardCost = selectedOption.cost || 30.00;
        const taxRate = selectedOption.taxRate || 0.13;

        const taxableAmount = Math.max(0, subtotal - discountTotal);
        const taxTotal = Math.round(taxableAmount * taxRate * 100) / 100;
        const grandTotal = Math.round((taxableAmount + standardCost + taxTotal) * 100) / 100;

        if (req.path.includes('/shipping-quotes')) {
            return res.json(options);
        }

        return res.json({
            subtotal,
            discountTotal,
            shippingTotal: standardCost,
            taxTotal,
            grandTotal,
            currency: 'CAD',
            shippingOptions: options
        });
    } catch (err) {
        console.error('[getQuote error]:', err);
        return res.status(500).json({ error: 'Internal Server Error', message: err.message });
    }
}

async function createIntent(req, res) {
    try {
        const {
            cartId,
            email,
            shippingAddress,
            billingAddress,
            paymentMethod = 'stripe',
            couponCode,
            shippingServiceCode = 'FREIGHTCOM_STANDARD'
        } = req.body;

        const userId = req.user ? req.user.id : null;
        const buyerGroup = (req.user && req.user.pricingGroup) || 'RETAIL';

        // Extract customer email with robust fallbacks:
        // 1. Direct email field from request body (sent by checkout page)
        // 2. Authenticated user profile email
        // 3. Email within shipping or billing address object
        // 4. Default guest email as final safeguard against NOT NULL constraint
        const rawEmail = (
            (typeof email === 'string' && email.trim()) ||
            (req.user && typeof req.user.email === 'string' && req.user.email.trim()) ||
            (shippingAddress && typeof shippingAddress.email === 'string' && shippingAddress.email.trim()) ||
            (billingAddress && typeof billingAddress.email === 'string' && billingAddress.email.trim()) ||
            'guest@wataniandsons.ca'
        );
        const userEmail = rawEmail.toLowerCase();

        const sessionToken = req.headers['x-cart-token'] || req.headers['x-cart-session'] || req.query?.sessionToken;
        let activeCartId = cartId;
        if (!activeCartId) {
            if (req.user) {
                const { rows } = await db.query('SELECT id FROM carts WHERE user_id = $1 AND active = TRUE ORDER BY id DESC LIMIT 1', [req.user.id]);
                if (rows.length > 0) activeCartId = rows[0].id;
            } else if (sessionToken) {
                const { rows } = await db.query('SELECT id FROM carts WHERE session_token = $1 AND active = TRUE ORDER BY id DESC LIMIT 1', [sessionToken]);
                if (rows.length > 0) activeCartId = rows[0].id;
            }
        }

        // Fetch items
        let items = [];
        if (activeCartId) {
            const { rows } = await db.query(`
                SELECT ci.quantity, v.id as variant_id, v.sku, v.unit, p.name as product_name, p.slug as product_slug,
                       MIN(pi.url) as image_url
                FROM cart_items ci
                JOIN product_variants v ON ci.variant_id = v.id
                JOIN products p ON v.product_id = p.id
                LEFT JOIN product_images pi ON pi.product_id = p.id
                WHERE ci.cart_id = $1
                GROUP BY ci.id, ci.quantity, v.id, v.sku, v.unit, p.id, p.name, p.slug;
            `, [activeCartId]);
            items = rows;
        }

        if (items.length === 0 && Array.isArray(req.body.items) && req.body.items.length > 0) {
            for (const it of req.body.items) {
                const vId = it.variantId || it.id;
                const { rows: vRows } = await db.query(`
                    SELECT v.id as variant_id, v.sku, v.unit, p.name as product_name, p.slug as product_slug,
                           MIN(pi.url) as image_url
                    FROM product_variants v
                    JOIN products p ON v.product_id = p.id
                    LEFT JOIN product_images pi ON pi.product_id = p.id
                    WHERE v.id = $1
                    GROUP BY v.id, v.sku, v.unit, p.name, p.slug
                `, [vId]);
                if (vRows.length > 0) {
                    items.push({ ...vRows[0], quantity: it.quantity || 1 });
                }
            }
        }

        if (items.length === 0) {
            return res.status(400).json({ error: 'Bad Request', message: 'Cart is empty' });
        }

        let subtotal = 0;
        const orderItems = [];

        for (const item of items) {
            const priceInfo = await resolvePrice(item.variant_id, buyerGroup, item.quantity);
            const lineTotal = priceInfo.price * item.quantity;
            subtotal += lineTotal;

            orderItems.push({
                variantId: item.variant_id,
                productName: item.product_name,
                productSlug: item.product_slug,
                sku: item.sku,
                unit: item.unit,
                imageUrl: item.image_url || '/logo/watany-logo.png',
                quantity: item.quantity,
                unitPrice: priceInfo.price,
                lineTotal,
                appliedGroup: priceInfo.pricingRelation.appliedGroup,
                requestedGroup: buyerGroup
            });
        }

        // Determine shipping cost and method dynamically based on shippingServiceCode and configured flat rate ($30.00)
        const baseRate = parseFloat(process.env.SHIPPING_FLAT_RATE || '30.00');
        let shippingTotal = baseRate;
        let carrierName = 'Freightcom Direct';
        let shippingMethod = 'Freightcom Standard Shipping';

        if (shippingServiceCode === 'FREIGHTCOM_EXPRESS') {
            shippingTotal = Math.round(baseRate * 1.5 * 100) / 100;
            carrierName = 'Freightcom Express Priority';
            shippingMethod = 'Freightcom Express Shipping';
        } else if (shippingServiceCode === 'PICKUP') {
            shippingTotal = 0;
            carrierName = 'Watani Hub';
            shippingMethod = 'Warehouse Pickup';
        } else {
            // FREIGHTCOM_STANDARD
            shippingTotal = subtotal > 150 ? 0 : baseRate;
            carrierName = 'Freightcom Direct';
            shippingMethod = 'Freightcom Standard Shipping';
        }

        const region = shippingAddress ? (shippingAddress.region || 'ON').toUpperCase() : 'ON';
        let taxRate = 0.13;
        if (region === 'QC') taxRate = 0.14975;
        else if (region === 'BC') taxRate = 0.12;
        else if (region === 'AB') taxRate = 0.05;

        const taxTotal = Math.round(subtotal * taxRate * 100) / 100;
        const grandTotal = Math.round((subtotal + shippingTotal + taxTotal) * 100) / 100;

        const orderNumber = 'WAT-' + Date.now().toString(36).toUpperCase() + '-' + Math.floor(Math.random() * 1000);

        const isStripe = (paymentMethod || '').toUpperCase() === 'STRIPE';
        const initialStatus = isStripe ? 'PENDING_PAYMENT' : 'AWAITING_PAYMENT_VERIFICATION';
        const initialPaymentStatus = 'PENDING';

        // Create order in PostgreSQL
        const orderInsert = await db.query(`
            INSERT INTO orders (
                order_number, user_id, email, status, payment_status, pricing_group,
                subtotal, shipping_total, tax_total, grand_total, currency, payment_provider,
                ship_full_name, ship_line1, ship_city, ship_region, ship_postal_code, ship_country,
                carrier_name, shipping_method,
                created_at, updated_at, version
            ) VALUES (
                $1, $2, $3, $4, $5, $6,
                $7, $8, $9, $10, 'CAD', $11,
                $12, $13, $14, $15, $16, $17,
                $18, $19,
                NOW(), NOW(), 0
            ) RETURNING id;
        `, [
            orderNumber, userId, userEmail, initialStatus, initialPaymentStatus, buyerGroup,
            subtotal, shippingTotal, taxTotal, grandTotal, paymentMethod,
            shippingAddress ? shippingAddress.fullName : 'Customer',
            shippingAddress ? shippingAddress.line1 : '300 Greenbank Rd',
            shippingAddress ? shippingAddress.city : 'Ottawa',
            shippingAddress ? shippingAddress.region : 'ON',
            shippingAddress ? shippingAddress.postalCode : 'K2H 0B6',
            shippingAddress ? shippingAddress.country : 'CA',
            carrierName, shippingMethod
        ]);

        const orderId = orderInsert.rows[0].id;

        // Insert order items
        for (const item of orderItems) {
            await db.query(`
                INSERT INTO order_items (
                    order_id, variant_id, product_name, product_slug, sku, unit, image_url,
                    quantity, unit_price, line_total, applied_group, requested_group,
                    created_at, updated_at, version
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW(), 0);
            `, [
                orderId, item.variantId, item.productName, item.productSlug, item.sku, item.unit,
                item.imageUrl, item.quantity, item.unitPrice, item.lineTotal, item.appliedGroup, item.requestedGroup
            ]);
        }

        // Deactivate cart immediately for non-Stripe orders; for Stripe, cart is deactivated once payment is confirmed
        if (paymentMethod.toUpperCase() !== 'STRIPE' && activeCartId) {
            await db.query('UPDATE carts SET active = FALSE WHERE id = $1', [activeCartId]);
        }

        await logAudit({
            req,
            actor: userEmail,
            action: 'ORDER_PLACED',
            entityType: 'ORDER',
            entityId: orderNumber,
            newValue: { grandTotal, paymentMethod, status: initialStatus, itemsCount: orderItems.length }
        });

        const orderObj = {
            id: orderId,
            orderNumber,
            email: userEmail,
            status: initialStatus,
            paymentStatus: initialPaymentStatus,
            paymentMethod,
            pricingGroup: buyerGroup,
            subtotal,
            shippingTotal,
            taxTotal,
            grandTotal,
            currency: 'CAD',
            carrierName,
            shippingMethod,
            items: orderItems,
            placedAt: new Date().toISOString()
        };

        let rawKey = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_API_KEY || '';
        let stripeKey = String(rawKey).trim();
        while ((stripeKey.startsWith('"') && stripeKey.endsWith('"')) || (stripeKey.startsWith("'") && stripeKey.endsWith("'"))) {
            stripeKey = stripeKey.slice(1, -1).trim();
        }

        if (isStripe) {
            if (!stripeKey || stripeKey.includes('YOUR_STRIPE') || stripeKey === '') {
                return res.status(400).json({
                    error: 'Payment Configuration Error',
                    message: 'Stripe Secret Key is not configured on the server. Please run: ./set-stripe-key.sh sk_live_... on the server.'
                });
            }

            if (stripeKey.startsWith('pk_')) {
                return res.status(400).json({
                    error: 'Invalid Stripe Key Type',
                    message: `Invalid Stripe key: You configured a Publishable Key (${stripeKey.slice(0, 10)}...). Server checkout requires your Stripe Secret Key (starts with sk_live_ or sk_test_) or Restricted Key (rk_...). Update it on the server using: ./set-stripe-key.sh sk_live_...`
                });
            }

            if (stripeKey.startsWith('whsec_')) {
                return res.status(400).json({
                    error: 'Invalid Stripe Key Type',
                    message: `Invalid Stripe key: You configured a Webhook Signing Secret (${stripeKey.slice(0, 10)}...). Webhook secrets are only for verifying incoming webhooks. Checkout requires your Stripe Secret Key (starts with "sk_live_" or "sk_test_"). Please find it in Stripe Dashboard -> Developers -> API keys and update it on the server using: ./set-stripe-key.sh sk_live_...`
                });
            }

            if (!stripeKey.startsWith('sk_') && !stripeKey.startsWith('rk_')) {
                return res.status(400).json({
                    error: 'Invalid Stripe Key Format',
                    message: `Invalid Stripe key format: Key starts with "${stripeKey.slice(0, 7)}...". Stripe Secret Keys must start with "sk_live_" or "sk_test_". Update it on the server using: ./set-stripe-key.sh sk_live_...`
                });
            }

            try {
                const stripe = require('stripe')(stripeKey);
                const domain = process.env.STOREFRONT_BASE_URL || process.env.FRONTEND_URL || 'https://wataniandsons.ca';
                
                const stripeLineItems = orderItems.map(item => ({
                    price_data: {
                        currency: 'cad',
                        product_data: {
                            name: item.productName,
                        },
                        unit_amount: Math.round(item.unitPrice * 100),
                    },
                    quantity: item.quantity,
                }));

                if (shippingTotal > 0) {
                    stripeLineItems.push({
                        price_data: {
                            currency: 'cad',
                            product_data: {
                                name: `Shipping (${carrierName} - ${shippingMethod})`,
                            },
                            unit_amount: Math.round(shippingTotal * 100),
                        },
                        quantity: 1,
                    });
                }

                if (taxTotal > 0) {
                    stripeLineItems.push({
                        price_data: {
                            currency: 'cad',
                            product_data: {
                                name: `Estimated Sales Tax (${region})`,
                            },
                            unit_amount: Math.round(taxTotal * 100),
                        },
                        quantity: 1,
                    });
                }

                const session = await stripe.checkout.sessions.create({
                    payment_method_types: ['card'],
                    line_items: stripeLineItems,
                    mode: 'payment',
                    success_url: `${domain}/checkout/confirmation?order=${encodeURIComponent(orderNumber)}`,
                    cancel_url: `${domain}/checkout?step=shipping&canceled=1`,
                    client_reference_id: orderNumber,
                    customer_email: userEmail && userEmail.includes('@') && !userEmail.includes('.local') ? userEmail : undefined,
                    metadata: {
                        orderNumber,
                        userEmail,
                    },
                });

                await db.query(
                    `UPDATE orders SET payment_provider_ref = $1 WHERE id = $2;`,
                    [session.id, orderId]
                );

                return res.json({
                    orderNumber,
                    redirectUrl: session.url,
                    paymentProvider: 'STRIPE',
                    paymentRef: session.id,
                    order: orderObj
                });
            } catch (stripeErr) {
                console.error('[Stripe Session Error]:', stripeErr);
                let userMsg = stripeErr.message || 'Failed to initiate Stripe Checkout session. Please try again.';
                if (userMsg.toLowerCase().includes('invalid api key') || userMsg.toLowerCase().includes('invalid key')) {
                    userMsg = `Stripe rejected the secret key (${stripeKey.slice(0, 8)}...): ${stripeErr.message}. Please verify the key in Stripe Dashboard -> Developers -> API keys and update it on the server using: ./set-stripe-key.sh sk_live_...`;
                }
                return res.status(400).json({
                    error: 'Stripe Checkout Error',
                    message: userMsg
                });
            }
        }

        return res.json({
            orderNumber,
            orderId,
            grandTotal,
            currency: 'CAD',
            paymentMethod,
            order: orderObj
        });
    } catch (err) {
        console.error('[createIntent error]:', err);
        return res.status(500).json({ error: 'Internal Server Error', message: err.message });
    }
}

module.exports = {
    getQuote,
    createIntent
};
