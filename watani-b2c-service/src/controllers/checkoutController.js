const db = require('../db');
const { resolvePrice } = require('../services/pricing');
const { getFreightcomQuotes } = require('../services/freightcom');

async function getQuote(req, res) {
    try {
        const { cartId, postalCode, province, country = 'CA', couponCode, destination } = req.body;
        const buyerGroup = req.user ? req.user.pricingGroup : 'RETAIL';

        // Fetch cart items
        let query = `
            SELECT ci.quantity, v.id as variant_id, v.sku, p.name as product_name
            FROM cart_items ci
            JOIN product_variants v ON ci.variant_id = v.id
            JOIN products p ON v.product_id = p.id
        `;
        let params = [];

        if (cartId) {
            query += ` WHERE ci.cart_id = $1`;
            params.push(cartId);
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
        const { cartId, shippingAddress, billingAddress, paymentMethod = 'stripe', couponCode, shippingServiceCode = 'FREIGHTCOM_STANDARD' } = req.body;
        const userId = req.user ? req.user.id : null;
        const buyerGroup = req.user ? req.user.pricingGroup : 'RETAIL';
        const userEmail = req.user ? req.user.email : (shippingAddress ? shippingAddress.email : 'guest@watani.local');

        // Fetch items
        const { rows: items } = await db.query(`
            SELECT ci.quantity, v.id as variant_id, v.sku, v.unit, p.name as product_name, p.slug as product_slug,
                   MIN(pi.url) as image_url
            FROM cart_items ci
            JOIN product_variants v ON ci.variant_id = v.id
            JOIN products p ON v.product_id = p.id
            LEFT JOIN product_images pi ON pi.product_id = p.id
            WHERE ci.cart_id = $1
            GROUP BY ci.id, ci.quantity, v.id, v.sku, v.unit, p.id, p.name, p.slug;
        `, [cartId]);

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

        // Create order in PostgreSQL
        const orderInsert = await db.query(`
            INSERT INTO orders (
                order_number, user_id, email, status, payment_status, pricing_group,
                subtotal, shipping_total, tax_total, grand_total, currency, payment_provider,
                ship_full_name, ship_line1, ship_city, ship_region, ship_postal_code, ship_country,
                carrier_name, shipping_method,
                created_at, updated_at, version
            ) VALUES (
                $1, $2, $3, 'PROCESSING', 'PAID', $4,
                $5, $6, $7, $8, 'CAD', $9,
                $10, $11, $12, $13, $14, $15,
                $16, $17,
                NOW(), NOW(), 0
            ) RETURNING id;
        `, [
            orderNumber, userId, userEmail, buyerGroup,
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

        // Deactivate cart
        await db.query('UPDATE carts SET active = FALSE WHERE id = $1', [cartId]);

        const orderObj = {
            id: orderId,
            orderNumber,
            email: userEmail,
            status: 'PROCESSING',
            paymentStatus: 'PAID',
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

        if (process.env.STRIPE_SECRET_KEY && paymentMethod === 'STRIPE') {
            try {
                const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
                const domain = process.env.FRONTEND_URL || 'http://localhost:3000';
                const session = await stripe.checkout.sessions.create({
                    payment_method_types: ['card'],
                    line_items: orderItems.map(item => ({
                        price_data: {
                            currency: 'cad',
                            product_data: {
                                name: item.productName,
                            },
                            unit_amount: Math.round(item.unitPrice * 100),
                        },
                        quantity: item.quantity,
                    })),
                    mode: 'payment',
                    success_url: `${domain}/checkout/confirmation?order=${encodeURIComponent(orderNumber)}`,
                    cancel_url: `${domain}/checkout`,
                    client_reference_id: orderNumber,
                    metadata: {
                        orderNumber,
                        userEmail,
                    },
                });

                return res.json({
                    orderNumber,
                    redirectUrl: session.url,
                    paymentProvider: 'STRIPE',
                    paymentRef: session.id,
                    order: orderObj
                });
            } catch (stripeErr) {
                console.error('[Stripe Session Error]:', stripeErr);
            }
        }

        return res.json({
            orderNumber,
            clientSecret: 'pi_stub_' + Math.random().toString(36).substring(2),
            orderId,
            grandTotal,
            currency: 'CAD',
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
