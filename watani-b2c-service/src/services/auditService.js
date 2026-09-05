const db = require('../db');

/**
 * Centrally writes structured records into the audit_logs table.
 */
async function logAudit({
    actor = 'system',
    action,
    entityType,
    entityId = null,
    previousValue = null,
    newValue = null,
    ipAddress = null,
    req = null
}) {
    try {
        let finalActor = actor;
        let finalIp = ipAddress;

        if (req) {
            if (req.user && req.user.email) {
                finalActor = req.user.email;
            } else if (req.headers && req.headers['x-forwarded-user']) {
                finalActor = req.headers['x-forwarded-user'];
            }

            if (!finalIp && req.headers) {
                finalIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null;
                if (finalIp && finalIp.includes(',')) {
                    finalIp = finalIp.split(',')[0].trim();
                }
            }
        }

        const prevStr = previousValue && typeof previousValue === 'object'
            ? JSON.stringify(previousValue)
            : (previousValue != null ? String(previousValue) : null);

        const newStr = newValue && typeof newValue === 'object'
            ? JSON.stringify(newValue)
            : (newValue != null ? String(newValue) : null);

        await db.query(`
            INSERT INTO audit_logs (actor, action, entity_type, entity_id, previous_value, new_value, ip_address, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW());
        `, [
            finalActor || 'system',
            action,
            entityType,
            entityId != null ? String(entityId) : null,
            prevStr,
            newStr,
            finalIp
        ]);
    } catch (err) {
        console.error('[AuditService Error]: Failed to write audit log:', err.message);
    }
}

/**
 * Seeds initial audit log entries if the table is completely empty.
 */
async function seedInitialAuditLogsIfEmpty() {
    try {
        const { rows } = await db.query('SELECT COUNT(*) FROM audit_logs');
        if (parseInt(rows[0].count, 10) === 0) {
            console.log('[AuditService] Seeding baseline audit log events...');
            const seedLogs = [
                {
                    actor: 'system_initializer',
                    action: 'SYSTEM_BOOT',
                    entityType: 'SYSTEM',
                    entityId: 'cluster',
                    newValue: 'Watani B2C services initialized and online',
                    ipAddress: '127.0.0.1'
                },
                {
                    actor: 'admin@wataniandsons.ca',
                    action: 'CATALOGUE_SYNC',
                    entityType: 'CATALOGUE',
                    entityId: 'live_seed',
                    newValue: 'Authentic 226 Palestinian catalogue products synchronized',
                    ipAddress: '10.42.0.1'
                },
                {
                    actor: 'system',
                    action: 'SECURITY_AUDIT_ENABLED',
                    entityType: 'CONFIG',
                    entityId: 'audit_logs',
                    newValue: 'Automated audit trail active for orders, pricing, customers, and inventory',
                    ipAddress: '127.0.0.1'
                }
            ];

            for (const log of seedLogs) {
                await logAudit(log);
            }
        }
    } catch (e) {
        // Table might not be ready on initial cold start; ignored
    }
}

module.exports = {
    logAudit,
    seedInitialAuditLogsIfEmpty
};
