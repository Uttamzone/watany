const { Pool } = require('pg');
const { newDb } = require('pg-mem');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { seedLiveCatalogue } = require('./seedLiveCatalogue');
require('dotenv').config();

function parseJdbcUrl(urlStr) {
    if (!urlStr) return null;
    const match = urlStr.match(/jdbc:postgresql:\/\/(?:([^:]+):([^@]+)@)?([^:/]+)(?::(\d+))?\/([^?]+)/);
    if (match) {
        return {
            user: match[1],
            password: match[2],
            host: match[3],
            port: match[4] ? parseInt(match[4], 10) : 5432,
            database: match[5]
        };
    }
    return null;
}

const jdbcParsed = parseJdbcUrl(process.env.SPRING_DATASOURCE_URL);

const config = {
    host: process.env.PGHOST || (jdbcParsed && jdbcParsed.host) || 'localhost',
    port: process.env.PGPORT || (jdbcParsed && jdbcParsed.port) || 5432,
    user: process.env.SPRING_DATASOURCE_USERNAME || process.env.PGUSER || (jdbcParsed && jdbcParsed.user) || 'postgres',
    password: process.env.SPRING_DATASOURCE_PASSWORD || process.env.PGPASSWORD || (jdbcParsed && jdbcParsed.password) || 'postgres',
    database: process.env.PGDATABASE || (jdbcParsed && jdbcParsed.database) || 'watani_b2c',
    ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : false
};

let activeDb = null;
let isPgMem = false;

async function query(text, params = []) {
    if (isPgMem) {
        let formattedSql = text;
        if (params && params.length > 0) {
            // Sort parameter indices in descending order ($11, $10, $9 ... $1)
            // so replacing higher index placeholders like $10 does not mutate
            // strings inserted by lower index placeholders (e.g. bcrypt hashes containing $2a$10$)
            const indices = params.map((_, i) => i).sort((a, b) => b - a);
            indices.forEach((idx) => {
                const param = params[idx];
                const placeholder = new RegExp(`\\$${idx + 1}\\b`, 'g');
                let val;
                if (param === null || param === undefined) val = 'NULL';
                else if (typeof param === 'number' || typeof param === 'boolean') val = String(param);
                else val = `'${String(param).replace(/'/g, "''")}'`;
                formattedSql = formattedSql.replace(placeholder, val);
            });
        }
        return activeDb.public.query(formattedSql);
    }
    return activeDb.query(text, params);
}

async function initDatabase() {
    try {
        console.log('[Database] Connecting to PostgreSQL database:', config.host, config.port, config.database);
        const realPool = new Pool(config);
        const testClient = await realPool.connect();

        console.log('[Database] Connected to PostgreSQL server!');
        activeDb = realPool;
        isPgMem = false;
        await runMigrationsRealPg(testClient);
        testClient.release();
    } catch (err) {
        console.warn('[Database] PostgreSQL daemon not running on port 5432. Starting in-memory database engine...');
        const memInstance = newDb();

        memInstance.public.registerFunction({
            name: 'now',
            returns: memInstance.public.getType('timestamp'),
            implementation: () => new Date(),
        });

        activeDb = memInstance;
        isPgMem = true;
        await runMigrationsPgMem(memInstance);
    }
}

async function createTablesPgMem(memDb) {
    const schemas = [
        `CREATE TABLE users (
            id SERIAL PRIMARY KEY,
            email VARCHAR(255) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            first_name VARCHAR(255),
            last_name VARCHAR(255),
            phone VARCHAR(255),
            pricing_group VARCHAR(32) NOT NULL DEFAULT 'RETAIL',
            approval_status VARCHAR(32) NOT NULL DEFAULT 'NOT_REQUESTED',
            requested_group VARCHAR(32),
            email_verified BOOLEAN NOT NULL DEFAULT FALSE,
            enabled BOOLEAN NOT NULL DEFAULT TRUE,
            company_name VARCHAR(255),
            tax_id VARCHAR(255),
            business_licence_ref VARCHAR(255),
            created_at TIMESTAMP NOT NULL,
            updated_at TIMESTAMP NOT NULL,
            version BIGINT NOT NULL DEFAULT 0
        );`,
        `CREATE TABLE roles (
            id SERIAL PRIMARY KEY,
            name VARCHAR(64) NOT NULL UNIQUE,
            description VARCHAR(255),
            created_at TIMESTAMP NOT NULL,
            updated_at TIMESTAMP NOT NULL,
            version BIGINT NOT NULL DEFAULT 0
        );`,
        `CREATE TABLE role_permissions (
            role_id INT NOT NULL,
            permission VARCHAR(64) NOT NULL,
            PRIMARY KEY (role_id, permission)
        );`,
        `CREATE TABLE user_roles (
            user_id INT NOT NULL,
            role_id INT NOT NULL,
            PRIMARY KEY (user_id, role_id)
        );`,
        `CREATE TABLE categories (
            id SERIAL PRIMARY KEY,
            slug VARCHAR(128) NOT NULL UNIQUE,
            name VARCHAR(128) NOT NULL,
            tagline VARCHAR(255),
            description TEXT,
            parent_id INT,
            display_order INT NOT NULL DEFAULT 0,
            active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMP NOT NULL,
            updated_at TIMESTAMP NOT NULL,
            version BIGINT NOT NULL DEFAULT 0
        );`,
        `CREATE TABLE brands (
            id SERIAL PRIMARY KEY,
            slug VARCHAR(128) NOT NULL UNIQUE,
            name VARCHAR(128) NOT NULL,
            created_at TIMESTAMP NOT NULL,
            updated_at TIMESTAMP NOT NULL,
            version BIGINT NOT NULL DEFAULT 0
        );`,
        `CREATE TABLE products (
            id SERIAL PRIMARY KEY,
            slug VARCHAR(200) NOT NULL UNIQUE,
            name VARCHAR(200) NOT NULL,
            full_name VARCHAR(300) NOT NULL,
            subtitle VARCHAR(300),
            description TEXT,
            category_id INT NOT NULL,
            brand_id INT,
            region VARCHAR(128),
            material VARCHAR(64),
            color VARCHAR(64),
            badge VARCHAR(64),
            active BOOLEAN NOT NULL DEFAULT TRUE,
            rating_average DOUBLE PRECISION,
            review_count INT NOT NULL DEFAULT 0,
            created_at TIMESTAMP NOT NULL,
            updated_at TIMESTAMP NOT NULL,
            version BIGINT NOT NULL DEFAULT 0
        );`,
        `CREATE TABLE product_images (
            id SERIAL PRIMARY KEY,
            product_id INT NOT NULL,
            url VARCHAR(500) NOT NULL,
            alt_text VARCHAR(300),
            display_order INT NOT NULL DEFAULT 0,
            created_at TIMESTAMP NOT NULL,
            updated_at TIMESTAMP NOT NULL,
            version BIGINT NOT NULL DEFAULT 0
        );`,
        `CREATE TABLE product_variants (
            id SERIAL PRIMARY KEY,
            product_id INT NOT NULL,
            sku VARCHAR(64) NOT NULL UNIQUE,
            unit VARCHAR(64) NOT NULL,
            stock_quantity INT NOT NULL DEFAULT 0,
            low_stock_threshold INT NOT NULL DEFAULT 5,
            backorder_allowed BOOLEAN NOT NULL DEFAULT FALSE,
            weight_grams INT,
            length_cm NUMERIC(12, 2),
            width_cm NUMERIC(12, 2),
            height_cm NUMERIC(12, 2),
            active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMP NOT NULL,
            updated_at TIMESTAMP NOT NULL,
            version BIGINT NOT NULL DEFAULT 0
        );`,
        `CREATE TABLE price_tiers (
            id SERIAL PRIMARY KEY,
            variant_id INT NOT NULL,
            pricing_group VARCHAR(32) NOT NULL,
            unit_price NUMERIC(12, 2) NOT NULL,
            min_quantity INT,
            compare_at_price NUMERIC(12, 2),
            currency VARCHAR(3) NOT NULL DEFAULT 'CAD',
            valid_from TIMESTAMP,
            valid_to TIMESTAMP,
            created_at TIMESTAMP NOT NULL,
            updated_at TIMESTAMP NOT NULL,
            version BIGINT NOT NULL DEFAULT 0
        );`,
        `CREATE TABLE carts (
            id SERIAL PRIMARY KEY,
            user_id INT,
            session_token VARCHAR(64),
            active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMP NOT NULL,
            updated_at TIMESTAMP NOT NULL,
            version BIGINT NOT NULL DEFAULT 0
        );`,
        `CREATE TABLE cart_items (
            id SERIAL PRIMARY KEY,
            cart_id INT NOT NULL,
            variant_id INT NOT NULL,
            quantity INT NOT NULL,
            created_at TIMESTAMP NOT NULL,
            updated_at TIMESTAMP NOT NULL,
            version BIGINT NOT NULL DEFAULT 0
        );`,
        `CREATE TABLE orders (
            id SERIAL PRIMARY KEY,
            order_number VARCHAR(32) NOT NULL UNIQUE,
            user_id INT,
            email VARCHAR(255) NOT NULL,
            status VARCHAR(32) NOT NULL,
            payment_status VARCHAR(32) NOT NULL,
            pricing_group VARCHAR(32) NOT NULL,
            subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
            discount_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
            shipping_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
            tax_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
            grand_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
            currency VARCHAR(3) NOT NULL DEFAULT 'CAD',
            payment_provider VARCHAR(32),
            payment_provider_ref VARCHAR(255),
            carrier_name VARCHAR(255),
            shipping_method VARCHAR(255),
            tracking_number VARCHAR(255),
            tracking_url VARCHAR(500),
            ship_full_name VARCHAR(255),
            ship_line1 VARCHAR(255),
            ship_city VARCHAR(255),
            ship_region VARCHAR(255),
            ship_postal_code VARCHAR(255),
            ship_country VARCHAR(255),
            created_at TIMESTAMP NOT NULL,
            updated_at TIMESTAMP NOT NULL,
            version BIGINT NOT NULL DEFAULT 0
        );`,
        `CREATE TABLE order_items (
            id SERIAL PRIMARY KEY,
            order_id INT NOT NULL,
            variant_id INT,
            product_name VARCHAR(300) NOT NULL,
            product_slug VARCHAR(200),
            sku VARCHAR(64) NOT NULL,
            unit VARCHAR(64),
            image_url VARCHAR(500),
            quantity INT NOT NULL,
            unit_price NUMERIC(12, 2) NOT NULL,
            line_total NUMERIC(12, 2) NOT NULL,
            applied_group VARCHAR(32) NOT NULL,
            requested_group VARCHAR(32) NOT NULL,
            created_at TIMESTAMP NOT NULL,
            updated_at TIMESTAMP NOT NULL,
            version BIGINT NOT NULL DEFAULT 0
        );`,
        `CREATE TABLE reviews (
            id SERIAL PRIMARY KEY,
            product_id INT NOT NULL,
            user_id INT,
            author_name VARCHAR(128) NOT NULL,
            rating INT NOT NULL,
            title VARCHAR(200),
            body TEXT,
            status VARCHAR(32) NOT NULL,
            created_at TIMESTAMP NOT NULL,
            updated_at TIMESTAMP NOT NULL,
            version BIGINT NOT NULL DEFAULT 0
        );`,
        `CREATE TABLE wishlists (
            id SERIAL PRIMARY KEY,
            user_id INT NOT NULL,
            product_id INT NOT NULL,
            created_at TIMESTAMP NOT NULL
        );`,
        `CREATE TABLE settings (
            key VARCHAR(128) PRIMARY KEY,
            value TEXT
        );`
    ];

    for (const sql of schemas) {
        try {
            memDb.public.none(sql);
        } catch (e) {}
    }
}

async function runMigrationsRealPg(client) {
    await client.query(`
        CREATE TABLE IF NOT EXISTS flyway_schema_history (
            installed_rank INT PRIMARY KEY,
            version VARCHAR(50),
            description VARCHAR(200),
            type VARCHAR(20),
            script VARCHAR(1000),
            checksum INT,
            installed_by VARCHAR(100),
            installed_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            execution_time INT,
            success BOOLEAN
        );
    `);

    const migrationDir = path.join(__dirname, '../main/resources/db/migration');
    if (fs.existsSync(migrationDir)) {
        const files = fs.readdirSync(migrationDir)
            .filter(f => f.endsWith('.sql'))
            .sort((a, b) => {
                const numA = parseInt(a.split('__')[0].replace('V', ''), 10);
                const numB = parseInt(b.split('__')[0].replace('V', ''), 10);
                return numA - numB;
            });

        const { rows } = await client.query('SELECT script FROM flyway_schema_history');
        const executedScripts = new Set(rows.map(r => r.script));

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (!executedScripts.has(file)) {
                console.log(`[Migration] Executing ${file}...`);
                const sqlPath = path.join(migrationDir, file);
                const sql = fs.readFileSync(sqlPath, 'utf8');

                try {
                    await client.query(sql);
                    await client.query(
                        'INSERT INTO flyway_schema_history (installed_rank, version, description, type, script, installed_by, success) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                        [i + 1, file.split('__')[0], file.split('__')[1] || '', 'SQL', file, 'node_express', true]
                    );
                } catch (err) {
                    console.error(`[Migration Warning] ${file}:`, err.message);
                }
            }
        }
    }

    try {
        await client.query(`
            ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_provider_ref VARCHAR(255);
            ALTER TABLE orders ADD COLUMN IF NOT EXISTS carrier_name VARCHAR(255);
            ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_method VARCHAR(255);
            ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_number VARCHAR(255);
            ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_url VARCHAR(500);
        `);
    } catch (e) {}

    await seedAdminAccount();
    await seedLiveCatalogue(query);
}

async function runMigrationsPgMem(memDb) {
    await createTablesPgMem(memDb);

    const migrationDir = path.join(__dirname, '../main/resources/db/migration');
    if (fs.existsSync(migrationDir)) {
        const files = fs.readdirSync(migrationDir)
            .filter(f => f.endsWith('.sql'))
            .sort((a, b) => {
                const numA = parseInt(a.split('__')[0].replace('V', ''), 10);
                const numB = parseInt(b.split('__')[0].replace('V', ''), 10);
                return numA - numB;
            });

        for (const file of files) {
            if (file.startsWith('V1__') || file.startsWith('V2__')) continue;
            const sqlPath = path.join(migrationDir, file);
            let sql = fs.readFileSync(sqlPath, 'utf8');
            sql = sql.replace(/ON CONFLICT \([^)]+\) DO NOTHING/gi, '');
            sql = sql.replace(/DROP TABLE IF EXISTS schema_placeholder;/gi, '');

            try {
                memDb.public.none(sql);
            } catch (err) {}
        }
    }

    await seedAdminAccount();
    await seedLiveCatalogue(query);
}

async function seedAdminAccount() {
    const hashedPassword = await bcrypt.hash('wataniadmin', 10);

    try {
        await query(`
            INSERT INTO roles (id, name, description, created_at, updated_at, version)
            VALUES (1, 'SUPER_ADMIN', 'Super Administrator', NOW(), NOW(), 0);
        `);
    } catch (e) {}

    try {
        const userRes = await query(`
            SELECT id FROM users WHERE LOWER(email) = 'watani@admin' OR LOWER(email) = 'wataniadmin@watani.local' OR LOWER(email) = 'wataniadmin';
        `);

        let userId;
        if (userRes.rows && userRes.rows.length > 0) {
            userId = userRes.rows[0].id;
            await query(`
                UPDATE users SET email = 'watani@admin', password_hash = $1, pricing_group = 'ADMIN', approval_status = 'APPROVED', enabled = TRUE, updated_at = NOW()
                WHERE id = $2;
            `, [hashedPassword, userId]);
        } else {
            const insertRes = await query(`
                INSERT INTO users (email, password_hash, first_name, last_name, phone, pricing_group, approval_status, email_verified, enabled, created_at, updated_at, version)
                VALUES ('watani@admin', $1, 'Watani', 'Admin', '16138547777', 'ADMIN', 'APPROVED', TRUE, TRUE, NOW(), NOW(), 0)
                RETURNING id;
            `, [hashedPassword]);
            userId = insertRes.rows[0].id;
        }

        const roleRes = await query(`SELECT id FROM roles WHERE name = 'SUPER_ADMIN'`);
        if (roleRes.rows && roleRes.rows.length > 0) {
            const roleId = roleRes.rows[0].id;
            await query(`
                INSERT INTO user_roles (user_id, role_id)
                VALUES ($1, $2);
            `, [userId, roleId]);
        }

        console.log('[Seed] Account watani@admin with password wataniadmin initialized successfully.');
    } catch (err) {
        console.error('[Seed Error]:', err.message);
    }
}

module.exports = {
    query,
    initDatabase
};
