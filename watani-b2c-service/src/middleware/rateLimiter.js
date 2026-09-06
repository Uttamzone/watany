/**
 * Lightweight in-memory sliding-window rate limiters for security.
 * Zero external dependencies, self-cleaning, and non-intrusive.
 */

function createRateLimiter({ windowMs, maxRequests, message }) {
    const buckets = new Map();

    return function rateLimitMiddleware(req, res, next) {
        // Extract client IP accounting for reverse proxies (Traefik/Nginx)
        const ip = (
            req.headers['x-forwarded-for']?.split(',')[0] ||
            req.socket?.remoteAddress ||
            req.ip ||
            'unknown'
        ).trim();

        const now = Date.now();
        let bucket = buckets.get(ip);

        if (!bucket || now - bucket.startTime > windowMs) {
            bucket = { count: 1, startTime: now };
            buckets.set(ip, bucket);
        } else {
            bucket.count++;
        }

        // Clean up stale IPs periodically to keep memory bounded
        if (buckets.size > 5000) {
            for (const [key, val] of buckets.entries()) {
                if (now - val.startTime > windowMs) {
                    buckets.delete(key);
                }
            }
        }

        if (bucket.count > maxRequests) {
            const retryAfterSec = Math.ceil((bucket.startTime + windowMs - now) / 1000);
            res.setHeader('Retry-After', retryAfterSec);
            return res.status(429).json({
                error: 'Too Many Requests',
                message: message || 'Too many requests. Please try again in a few moments.'
            });
        }

        next();
    };
}

// Limit auth attempts to 40 per 5 minutes per IP (protects against credential stuffing)
const authRateLimiter = createRateLimiter({
    windowMs: 5 * 60 * 1000,
    maxRequests: 40,
    message: 'Too many authentication attempts. Please wait a few minutes before trying again.'
});

// Limit review submissions to 15 per 10 minutes per IP (prevents review spam)
const reviewRateLimiter = createRateLimiter({
    windowMs: 10 * 60 * 1000,
    maxRequests: 15,
    message: 'Too many review submissions. Please wait before submitting another review.'
});

module.exports = {
    authRateLimiter,
    reviewRateLimiter,
};
