const nodemailer = require('nodemailer');

const SMTP_CONFIG = {
    host: process.env.MAIL_HOST || 'mail.papamail.net',
    port: parseInt(process.env.MAIL_PORT || '587', 10),
    secure: process.env.MAIL_SMTP_SSL_ENABLE === 'true',
    auth: {
        user: process.env.MAIL_USERNAME || 'info@wataniandsons.com',
        pass: process.env.MAIL_PASSWORD || 'Baba1969Mama1977&',
    },
    tls: {
        rejectUnauthorized: false
    }
};

const FROM_EMAIL = process.env.MAIL_FROM || 'info@wataniandsons.com';
const FROM_NAME = process.env.MAIL_FROM_NAME || 'Watani & Sons Corp';
const WATANI_GROUP_EMAIL = process.env.MAIL_BCC || process.env.MAIL_USERNAME || 'info@wataniandsons.com';
const SUPPORT_EMAIL = process.env.MAIL_SUPPORT || 'info@wataniandsons.com';

let transporter = null;

function getTransporter() {
    if (!transporter) {
        try {
            transporter = nodemailer.createTransport(SMTP_CONFIG);
        } catch (err) {
            console.error('[EmailService] Failed to create transporter:', err.message);
        }
    }
    return transporter;
}

function money(val) {
    const num = typeof val === 'number' ? val : parseFloat(val || '0');
    return '$' + num.toFixed(2) + ' CAD';
}

function generateInvoiceHtml(order, items = [], isDistributorPending = false) {
    const orderNumber = order.orderNumber || order.order_number || 'N/A';
    const customerName = order.shipFullName || order.ship_full_name || 'Valued Customer';
    const customerEmail = order.email || 'N/A';
    const customerPhone = order.phone || '';
    const shipLine1 = order.shipLine1 || order.ship_line1 || '';
    const shipCity = order.shipCity || order.ship_city || '';
    const shipRegion = order.shipRegion || order.ship_region || 'ON';
    const shipPostal = order.shipPostalCode || order.ship_postal_code || '';
    const shipCountry = order.shipCountry || order.ship_country || 'CA';

    const subtotal = order.subtotal ?? 0;
    const shippingTotal = order.shippingTotal ?? order.shipping_total ?? 0;
    const taxTotal = order.taxTotal ?? order.tax_total ?? 0;
    const grandTotal = order.grandTotal ?? order.grand_total ?? 0;
    const carrierName = order.carrierName || order.carrier_name || 'Freightcom Direct';
    const shippingMethod = order.shippingMethod || order.shipping_method || 'Standard Shipping';
    const paymentMethod = (order.paymentMethod || order.payment_provider || 'CARD').toUpperCase();
    const paymentStatus = (order.paymentStatus || order.payment_status || 'PENDING').toUpperCase();
    const pricingGroup = (order.pricingGroup || order.pricing_group || 'RETAIL').toUpperCase();

    const isPaid = paymentStatus === 'PAID';

    const dateStr = new Date(order.createdAt || order.created_at || Date.now()).toLocaleDateString('en-CA', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    const rowsHtml = items.map((item, idx) => {
        const name = item.productName || item.product_name || 'Palestinian Product';
        const sku = item.sku || '-';
        const unit = item.unit || '1 unit';
        const qty = item.quantity || 1;
        const price = item.unitPrice ?? item.unit_price ?? 0;
        const total = item.lineTotal ?? item.line_total ?? (price * qty);

        const bg = idx % 2 === 0 ? '#ffffff' : '#f9fafb';
        return `
            <tr style="background-color: ${bg}; border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 12px 14px; font-size: 13px; color: #111827;">
                    <div style="font-weight: 600; color: #022c22;">${name}</div>
                    <div style="font-size: 11px; color: #6b7280;">SKU: ${sku} &bull; Unit: ${unit}</div>
                </td>
                <td style="padding: 12px 14px; font-size: 13px; color: #374151; text-align: center; font-weight: 600;">
                    ${qty}
                </td>
                <td style="padding: 12px 14px; font-size: 13px; color: #374151; text-align: right;">
                    ${money(price)}
                </td>
                <td style="padding: 12px 14px; font-size: 13px; color: #022c22; text-align: right; font-weight: 700;">
                    ${money(total)}
                </td>
            </tr>
        `;
    }).join('');

    let paymentMethodLabel = 'Credit Card (Stripe)';
    if (paymentMethod === 'E_TRANSFER' || paymentMethod === 'ETRANSFER') paymentMethodLabel = 'Interac e-Transfer';
    else if (paymentMethod === 'CHEQUE' || paymentMethod === 'CHECK') paymentMethodLabel = 'Cheque / Corporate Invoice';

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Invoice ${orderNumber} - Watani & Sons</title>
</head>
<body style="margin: 0; padding: 24px 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <div style="max-width: 680px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e5e7eb;">
        
        <!-- Header -->
        <div style="background-color: #022c22; padding: 32px 36px; color: #ffffff;">
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td>
                        <h1 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: 0.05em; color: #a3e635; text-transform: uppercase;">Watani &amp; Sons Corp</h1>
                        <p style="margin: 4px 0 0 0; font-size: 12px; color: #99f6e4; letter-spacing: 0.03em;">Authentic Palestinian Heritage &bull; Wholesale &amp; Retail Provisions</p>
                        <p style="margin: 6px 0 0 0; font-size: 11px; color: #cbd5e1;">300 Greenbank Rd, Ottawa, ON K2H 0B6 &bull; +1 613-854-7777</p>
                    </td>
                    <td style="text-align: right; vertical-align: top;">
                        <span style="display: inline-block; background-color: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.25); border-radius: 8px; padding: 6px 14px; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: #ffffff;">
                            ${isPaid ? 'Official Invoice' : 'Order Invoice'}
                        </span>
                        <div style="margin-top: 8px; font-size: 14px; font-weight: 700; color: #ffffff;">#${orderNumber}</div>
                        <div style="font-size: 12px; color: #cbd5e1;">${dateStr}</div>
                    </td>
                </tr>
            </table>
        </div>

        <!-- Status Alert Banner -->
        <div style="padding: 16px 36px; background-color: ${isPaid ? '#ecfdf5' : '#fffbeb'}; border-bottom: 1px solid ${isPaid ? '#a7f3d0' : '#fde68a'};">
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="font-size: 13px; font-weight: 700; color: ${isPaid ? '#065f46' : '#92400e'};">
                        ${isPaid
                            ? '&check; Payment Confirmed &bull; Your order is confirmed and being prepared for shipment.'
                            : '&#9203; Order Received &bull; Awaiting payment verification by Watani administration.'}
                    </td>
                    <td style="text-align: right; font-size: 12px; font-weight: 800; text-transform: uppercase; color: ${isPaid ? '#047857' : '#b45309'};">
                        Payment: ${paymentStatus}
                    </td>
                </tr>
            </table>
        </div>

        <!-- Addresses & Order Details -->
        <div style="padding: 28px 36px; border-bottom: 1px solid #e5e7eb;">
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="width: 50%; vertical-align: top; padding-right: 18px;">
                        <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #6b7280; letter-spacing: 0.05em; margin-bottom: 6px;">Ship To</div>
                        <div style="font-size: 14px; font-weight: 700; color: #022c22;">${customerName}</div>
                        <div style="font-size: 13px; color: #4b5563; line-height: 1.5; margin-top: 3px;">
                            ${shipLine1}<br>
                            ${shipCity}, ${shipRegion} ${shipPostal}<br>
                            ${shipCountry === 'CA' ? 'Canada' : shipCountry}
                            ${customerPhone ? `<br>Phone: ${customerPhone}` : ''}
                        </div>
                    </td>
                    <td style="width: 50%; vertical-align: top; padding-left: 18px;">
                        <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #6b7280; letter-spacing: 0.05em; margin-bottom: 6px;">Order &amp; Account Details</div>
                        <div style="font-size: 13px; color: #4b5563; line-height: 1.6;">
                            <strong>Customer Email:</strong> ${customerEmail}<br>
                            <strong>Customer Type:</strong> <span style="display: inline-block; background-color: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-weight: 700; color: #0f172a; font-size: 11px;">${pricingGroup}</span><br>
                            <strong>Payment Method:</strong> ${paymentMethodLabel}<br>
                            <strong>Shipping Carrier:</strong> ${carrierName} (${shippingMethod})
                        </div>
                    </td>
                </tr>
            </table>
        </div>

        <!-- Distributor Manual Payment Notice (if e-Transfer or Cheque) -->
        ${(!isPaid && (paymentMethod === 'E_TRANSFER' || paymentMethod === 'CHEQUE')) ? `
        <div style="margin: 20px 36px; padding: 18px; background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px;">
            <div style="font-size: 13px; font-weight: 800; color: #1e3a8a; margin-bottom: 6px;">
                Direct Distributor Payment Instructions:
            </div>
            <div style="font-size: 12px; color: #1e40af; line-height: 1.5;">
                ${paymentMethod === 'E_TRANSFER' 
                    ? `Please send your Interac e-Transfer to <strong>info@wataniandsons.com</strong> (or payments@wataniandsons.com).<br>Include Order Number <strong>${orderNumber}</strong> in the transfer message. Your order will be approved and dispatched once payment is recorded.`
                    : `Please make corporate cheques payable to <strong>Watani &amp; Sons Corp</strong> and mail to:<br><em>300 Greenbank Rd, Ottawa, ON K2H 0B6, Canada</em>.<br>Reference Order #<strong>${orderNumber}</strong> on the cheque stub.`
                }
            </div>
        </div>
        ` : ''}

        <!-- Items Table -->
        <div style="padding: 24px 36px 12px 36px;">
            <div style="font-size: 14px; font-weight: 800; color: #022c22; margin-bottom: 12px;">Order Summary (${items.length} item${items.length === 1 ? '' : 's'})</div>
            <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                <thead>
                    <tr style="background-color: #f3f4f6; border-bottom: 2px solid #e5e7eb;">
                        <th style="padding: 10px 14px; text-align: left; font-size: 11px; font-weight: 800; text-transform: uppercase; color: #4b5563;">Item Description</th>
                        <th style="padding: 10px 14px; text-align: center; font-size: 11px; font-weight: 800; text-transform: uppercase; color: #4b5563;">Qty</th>
                        <th style="padding: 10px 14px; text-align: right; font-size: 11px; font-weight: 800; text-transform: uppercase; color: #4b5563;">Unit Price</th>
                        <th style="padding: 10px 14px; text-align: right; font-size: 11px; font-weight: 800; text-transform: uppercase; color: #4b5563;">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>
        </div>

        <!-- Totals Table -->
        <div style="padding: 12px 36px 28px 36px;">
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="width: 50%;"></td>
                    <td style="width: 50%;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 6px 0; font-size: 13px; color: #4b5563;">Subtotal:</td>
                                <td style="padding: 6px 0; font-size: 13px; font-weight: 600; color: #111827; text-align: right;">${money(subtotal)}</td>
                            </tr>
                            <tr>
                                <td style="padding: 6px 0; font-size: 13px; color: #4b5563;">Shipping (${carrierName}):</td>
                                <td style="padding: 6px 0; font-size: 13px; font-weight: 600; color: #111827; text-align: right;">${shippingTotal === 0 ? 'FREE' : money(shippingTotal)}</td>
                            </tr>
                            <tr>
                                <td style="padding: 6px 0; font-size: 13px; color: #4b5563;">Sales Tax:</td>
                                <td style="padding: 6px 0; font-size: 13px; font-weight: 600; color: #111827; text-align: right;">${money(taxTotal)}</td>
                            </tr>
                            <tr style="border-top: 2px solid #e5e7eb; border-bottom: 2px solid #e5e7eb;">
                                <td style="padding: 12px 0; font-size: 16px; font-weight: 800; color: #022c22;">Grand Total:</td>
                                <td style="padding: 12px 0; font-size: 18px; font-weight: 900; color: #047857; text-align: right;">${money(grandTotal)}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0 0 0; font-size: 12px; color: #6b7280;">Payment Status:</td>
                                <td style="padding: 8px 0 0 0; font-size: 12px; font-weight: 800; color: ${isPaid ? '#047857' : '#b45309'}; text-align: right;">
                                    ${paymentStatus} &bull; ${paymentMethodLabel}
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </div>

        <!-- Footer -->
        <div style="background-color: #f9fafb; border-top: 1px solid #e5e7eb; padding: 24px 36px; text-align: center; font-size: 12px; color: #6b7280; line-height: 1.6;">
            <p style="margin: 0; font-weight: 700; color: #111827;">Thank you for your business and supporting authentic Palestinian trade.</p>
            <p style="margin: 4px 0 0 0;">Watani &amp; Sons Corp &bull; 300 Greenbank Rd, Ottawa, ON K2H 0B6 Canada</p>
            <p style="margin: 2px 0 0 0;">Questions? Contact us at <a href="mailto:info@wataniandsons.com" style="color: #047857; text-decoration: underline;">info@wataniandsons.com</a> or +1 613-854-7777</p>
        </div>

    </div>
</body>
</html>
    `;
}

/**
 * Sends an official invoice email to both the customer and the Watani Group.
 */
async function sendInvoiceEmail(order, items = [], isDistributorPending = false) {
    if (!order) return { success: false, error: 'No order provided' };

    const orderNumber = order.orderNumber || order.order_number;
    const customerEmail = order.email;
    const paymentStatus = (order.paymentStatus || order.payment_status || 'PENDING').toUpperCase();

    const subject = paymentStatus === 'PAID'
        ? `Invoice & Receipt - Order #${orderNumber} | Watani & Sons Corp`
        : `Order Confirmation & Invoice #${orderNumber} | Watani & Sons Corp`;

    const htmlContent = generateInvoiceHtml(order, items, isDistributorPending);

    const mailTransporter = getTransporter();
    if (!mailTransporter) {
        console.warn(`[EmailService] Transporter unavailable. Skipped invoice for #${orderNumber}`);
        return { success: false, error: 'Transporter unavailable' };
    }

    const recipients = [];
    if (customerEmail && customerEmail.includes('@') && !customerEmail.includes('.local')) {
        recipients.push(customerEmail);
    }

    // Always send to Watani Group
    const adminRecipients = [WATANI_GROUP_EMAIL];

    console.log(`[EmailService] Sending invoice for #${orderNumber} to customer (${recipients.join(', ')}) and Watani Group (${adminRecipients.join(', ')})`);

    try {
        const mailOptions = {
            from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
            to: recipients.length > 0 ? recipients.join(', ') : WATANI_GROUP_EMAIL,
            bcc: recipients.includes(WATANI_GROUP_EMAIL) ? undefined : WATANI_GROUP_EMAIL,
            replyTo: SUPPORT_EMAIL,
            subject,
            html: htmlContent
        };

        const info = await mailTransporter.sendMail(mailOptions);
        console.log(`[EmailService] Invoice email successfully dispatched for #${orderNumber}: messageId = ${info.messageId}`);
        return { success: true, messageId: info.messageId };
    } catch (err) {
        console.error(`[EmailService Error] Failed to dispatch invoice email for #${orderNumber}:`, err.message);
        return { success: false, error: err.message };
    }
}

async function dispatchInvoiceEmailForOrder(orderIdOrNumber, db, isDistributorPending = false) {
    try {
        const orderRes = await db.query(
            `SELECT * FROM orders WHERE order_number = $1 OR id::text = $1 LIMIT 1`,
            [String(orderIdOrNumber)]
        );
        if (orderRes.rows.length === 0) return { success: false, error: 'Order not found' };
        const order = orderRes.rows[0];

        // Avoid duplicate emails if already sent and this is a payment invoice
        if (order.invoice_email_sent && !isDistributorPending) {
            console.log(`[EmailService] Invoice already sent for #${order.order_number}`);
            return { success: true, alreadySent: true };
        }

        const itemsRes = await db.query(
            `SELECT * FROM order_items WHERE order_id = $1`,
            [order.id]
        );
        const items = itemsRes.rows;

        const result = await sendInvoiceEmail(order, items, isDistributorPending);
        if (result.success && !isDistributorPending) {
            try {
                await db.query(`UPDATE orders SET invoice_email_sent = TRUE WHERE id = $1`, [order.id]);
            } catch (e) {}
        }
        return result;
    } catch (err) {
        console.error(`[EmailService] Error dispatching invoice for ${orderIdOrNumber}:`, err.message);
        return { success: false, error: err.message };
    }
}

module.exports = {
    sendInvoiceEmail,
    dispatchInvoiceEmailForOrder,
    generateInvoiceHtml
};
