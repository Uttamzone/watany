const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const db = require('./db');
const apiRouter = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 8080;

// CORS setup matching Spring Boot configuration
const corsOptions = {
    origin: '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Cart-Session', 'X-Requested-With'],
    exposedHeaders: ['Vary', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json({
    limit: '10mb',
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Vary header filter matching requirement.md §3 (Spring config/VaryHeaderFilter)
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

app.get(['/actuator/health', '/health'], (req, res) => {
    res.json({
        status: 'UP',
        service: 'watani-b2c-express-service',
        timestamp: new Date().toISOString()
    });
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('[Global Error]:', err);
    res.status(err.status || 500).json({
        error: err.name || 'Internal Server Error',
        message: err.message || 'An unexpected error occurred'
    });
});

// Initialize database and start listening
async function start() {
    try {
        await db.initDatabase();
        app.listen(PORT, () => {
            console.log(`==================================================`);
            console.log(` Watani Express Backend running on port ${PORT}`);
            console.log(` Health check: http://localhost:${PORT}/api/health`);
            console.log(`==================================================`);
        });
    } catch (err) {
        console.error('Failed to start server:', err);
        process.exit(1);
    }
}

start();
