const db = require('../db');

/* ------------------------------------------------------------- Customers */

async function listCustomers(req, res) {
    try {
        const { search, group, status, page = 0, size = 50 } = req.query;
        let where = [];
        let params = [];
        let pIdx = 1;

        if (search) {
            where.push(`(email ILIKE $${pIdx} OR first_name ILIKE $${pIdx} OR last_name ILIKE $${pIdx} OR company_name ILIKE $${pIdx})`);
            params.push(`%${search}%`);
            pIdx++;
        }
        if (group) {
            where.push(`pricing_group = $${pIdx}`);
            params.push(group);
            pIdx++;
        }
        if (status) {
            where.push(`approval_status = $${pIdx}`);
            params.push(status);
            pIdx++;
        }

        const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
        const limit = parseInt(size, 10);
        const offset = parseInt(page, 10) * limit;

        const countRes = await db.query(`SELECT COUNT(*) FROM users ${whereSql}`, params);
        const totalElements = parseInt(countRes.rows[0].count, 10);

        const { rows } = await db.query(`
            SELECT id, email, first_name as "firstName", last_name as "lastName", phone,
                   pricing_group as "pricingGroup", approval_status as "approvalStatus",
                   requested_group as "requestedGroup", company_name as "companyName",
                   tax_id as "taxId", business_licence_ref as "businessLicenceRef",
                   created_at as "createdAt"
            FROM users
            ${whereSql}
            ORDER BY created_at DESC
            LIMIT $${pIdx} OFFSET $${pIdx + 1};
        `, [...params, limit, offset]);

        return res.json({ content: rows, totalElements, totalPages: Math.ceil(totalElements / limit) });
    } catch (err) {
        return res.status(500).json({ error: 'Internal Server Error', message: err.message });
    }
}

async function approveCustomerGroup(req, res) {
    try {
        const { id } = req.params;
        const { approvedGroup } = req.body;

        const targetGroup = approvedGroup || 'DISTRIBUTOR';
        await db.query(`
            UPDATE users
            SET pricing_group = $1, approval_status = 'APPROVED', updated_at = NOW()
            WHERE id = $2;
        `, [targetGroup, id]);

        return res.json({ success: true, message: `Customer approved for group ${targetGroup}` });
    } catch (err) {
        return res.status(500).json({ error: 'Internal Server Error', message: err.message });
    }
}

async function rejectCustomerGroup(req, res) {
    try {
        const { id } = req.params;
        await db.query(`
            UPDATE users
            SET approval_status = 'REJECTED', updated_at = NOW()
            WHERE id = $1;
        `, [id]);
        return res.json({ success: true, message: 'Customer request rejected' });
    } catch (err) {
        return res.status(500).json({ error: 'Internal Server Error', message: err.message });
    }
}

/* ------------------------------------------------------------- Catalogue */

async function listAdminProducts(req, res) {
    try {
        const { rows } = await db.query(`
            SELECT p.id, p.slug, p.name, p.full_name as "fullName", c.name as category,
                   p.badge, p.active, v.stock_quantity as "stockQuantity"
            FROM products p
            JOIN categories c ON p.category_id = c.id
            LEFT JOIN product_variants v ON v.product_id = p.id
            ORDER BY p.id DESC;
        `);
        return res.json(rows);
    } catch (err) {
        return res.status(500).json({ error: 'Internal Server Error', message: err.message });
    }
}

async function updateStock(req, res) {
    try {
        const { variantId, stockQuantity } = req.body;
        await db.query('UPDATE product_variants SET stock_quantity = $1, updated_at = NOW() WHERE id = $2', [stockQuantity, variantId]);
        return res.json({ success: true, message: 'Stock updated successfully' });
    } catch (err) {
        return res.status(500).json({ error: 'Internal Server Error', message: err.message });
    }
}

/* ---------------------------------------------------------------- Orders */

async function listAdminOrders(req, res) {
    try {
        const { rows } = await db.query(`
            SELECT id, order_number as "orderNumber", email, status, payment_status as "paymentStatus",
                   pricing_group as "pricingGroup", grand_total as "grandTotal", currency,
                   ship_full_name as "customerName", created_at as "createdAt"
            FROM orders
            ORDER BY created_at DESC;
        `);
        return res.json(rows);
    } catch (err) {
        return res.status(500).json({ error: 'Internal Server Error', message: err.message });
    }
}

async function updateOrderStatus(req, res) {
    try {
        const { id } = req.params;
        const { status, trackingNumber, carrierName } = req.body;

        await db.query(`
            UPDATE orders
            SET status = $1, tracking_number = COALESCE($2, tracking_number), carrier_name = COALESCE($3, carrier_name), updated_at = NOW()
            WHERE id = $4 OR order_number = $4::text;
        `, [status, trackingNumber, carrierName, id]);

        return res.json({ success: true, message: 'Order status updated' });
    } catch (err) {
        return res.status(500).json({ error: 'Internal Server Error', message: err.message });
    }
}

/* --------------------------------------------------------------- Reports */

async function getKpis(req, res) {
    try {
        const salesRes = await db.query("SELECT COALESCE(SUM(grand_total), 0) as total FROM orders WHERE payment_status = 'PAID'");
        const orderRes = await db.query("SELECT COUNT(*) as total FROM orders");
        const customerRes = await db.query("SELECT COUNT(*) as total FROM users WHERE pricing_group != 'ADMIN'");
        const pendingRes = await db.query("SELECT COUNT(*) as total FROM users WHERE approval_status = 'PENDING'");

        return res.json({
            totalRevenue: parseFloat(salesRes.rows[0].total),
            totalOrders: parseInt(orderRes.rows[0].total, 10),
            totalCustomers: parseInt(customerRes.rows[0].total, 10),
            pendingApprovals: parseInt(pendingRes.rows[0].total, 10)
        });
    } catch (err) {
        return res.status(500).json({ error: 'Internal Server Error', message: err.message });
    }
}

/* ----------------------------------------------------------------- Staff */

async function listStaff(req, res) {
    try {
        const { rows } = await db.query(`
            SELECT u.id, u.email, u.first_name as "firstName", u.last_name as "lastName",
                   ARRAY_AGG(r.name) as roles
            FROM users u
            JOIN user_roles ur ON u.id = ur.user_id
            JOIN roles r ON ur.role_id = r.id
            WHERE r.name IN ('SUPER_ADMIN', 'CATALOGUE_MANAGER', 'ORDER_MANAGER', 'SUPPORT')
            GROUP BY u.id, u.email, u.first_name, u.last_name;
        `);
        return res.json(rows);
    } catch (err) {
        return res.status(500).json({ error: 'Internal Server Error', message: err.message });
    }
}

module.exports = {
    listCustomers,
    approveCustomerGroup,
    rejectCustomerGroup,
    listAdminProducts,
    updateStock,
    listAdminOrders,
    updateOrderStatus,
    getKpis,
    listStaff
};
