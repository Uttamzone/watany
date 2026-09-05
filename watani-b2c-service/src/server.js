const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const db = require('./db');
const apiRouter = require('./routes/api');
const misc = require('./controllers/miscController');

const app = express();
const PORT = process.env.PORT || 8080;

// Trust reverse proxy (Traefik / Nginx) so req.secure, req.ip, and X-Forwarded-* headers work properly
app.set('trust proxy', 1);

// Cookie parser middleware (lightweight, zero-dependency)
app.use((req, res, next) => {
    req.cookies = {};
    const cookieHeader = req.headers.cookie;
    if (cookieHeader) {
        cookieHeader.split(';').forEach(cookie => {
            const parts = cookie.split('=');
            if (parts.length >= 2) {
                const name = parts[0].trim();
                const val = decodeURIComponent(parts.slice(1).join('=').trim());
                req.cookies[name] = val;
            }
        });
    }
    next();
});

// Helper to set cookies with standard options (supports appending multiple Set-Cookie headers)
app.use((req, res, next) => {
    res.setCookie = (name, val, options = {}) => {
        let cookieStr = `${name}=${encodeURIComponent(val)}`;
        if (options.maxAge) cookieStr += `; Max-Age=${Math.floor(options.maxAge / 1000)}`;
        if (options.expires) cookieStr += `; Expires=${options.expires.toUTCString()}`;
        if (options.httpOnly !== false) cookieStr += '; HttpOnly';
        const isSecure = options.secure !== false && (
            req.secure ||
            req.headers['x-forwarded-proto'] === 'https' ||
            process.env.COOKIE_SECURE === 'true' ||
            process.env.NODE_ENV === 'production'
        );
        if (isSecure) {
            cookieStr += '; Secure';
        }
        cookieStr += `; SameSite=${options.sameSite || 'Lax'}`;
        cookieStr += `; Path=${options.path || '/'}`;

        const existing = res.getHeader('Set-Cookie');
        if (existing) {
            const arr = Array.isArray(existing) ? existing : [existing];
            res.setHeader('Set-Cookie', [...arr, cookieStr]);
        } else {
            res.setHeader('Set-Cookie', cookieStr);
        }
    };
    res.cookie = res.setCookie;
    next();
});

// CORS setup supporting credentials with dynamic origin reflection
app.use(cors({
    origin: (origin, callback) => {
        callback(null, origin || true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Cart-Session', 'X-Cart-Token', 'X-Requested-With', 'stripe-signature'],
    exposedHeaders: ['Vary', 'Authorization', 'Set-Cookie']
}));

// Stripe webhook MUST receive the raw body buffer before JSON parsing.
// Register it first with express.raw() so Stripe signature verification works.
const WEBHOOK_PATHS = ['/api/webhooks/payment', '/webhooks/payment', '/api/webhooks/stripe', '/webhooks/stripe'];
app.post(WEBHOOK_PATHS, express.raw({ type: '*/*', limit: '10mb' }), misc.stripeWebhook);

app.use(express.json({
    limit: '10mb',
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Vary header filter
app.use((req, res, next) => {
    res.setHeader('Vary', 'Authorization');
    next();
});

// Static uploads serving
const uploadsDir = process.env.STORAGE_DIR || path.join(__dirname, '../uploads');
app.use('/uploads', express.static(uploadsDir));

// API Routes
app.use('/api', apiRouter);

// Root & Health
app.get('/', (req, res) => {
    res.json({
        service: 'watani-b2c-express-service',
        status: 'UP',
        version: '1.0.0',
        documentation: '/api/health'
    });
});

app.get(['/actuator/health', '/health', '/api/health'], (req, res) => {
    res.json({
        status: 'UP',
        service: 'watani-b2c-express-service',
        timestamp: new Date().toISOString()
    });
});

async function start() {
    try {
        await db.initDatabase();
    } catch (e) {
        console.error('[Database init error]:', e);
    }
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`========================================`);
        console.log(`Watani Express Backend running on port ${PORT}`);
        console.log(`Health check: http://localhost:${PORT}/api/health`);
        console.log(`Stripe Webhook: http://localhost:${PORT}/api/webhooks/payment`);
        console.log(`========================================`);
    });
}

start();
