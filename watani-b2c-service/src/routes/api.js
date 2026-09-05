const express = require('express');
const router = express.Router();
const { verifyToken, optionalAuth, requireAdmin } = require('../middleware/auth');

const auth = require('../controllers/authController');
const catalogue = require('../controllers/catalogueController');
const cart = require('../controllers/cartController');
const checkout = require('../controllers/checkoutController');
const order = require('../controllers/orderController');
const admin = require('../controllers/adminController');
const misc = require('../controllers/miscController');

/* Helper to map routes to multiple paths */
function mapRoute(method, paths, ...handlers) {
    for (const p of paths) {
        router[method](p, ...handlers);
    }
}

/* Auth Routes */
mapRoute('post', ['/v1/auth/login', '/auth/login'], auth.login);
mapRoute('post', ['/v1/auth/google', '/auth/google'], auth.googleLogin);
mapRoute('post', ['/v1/auth/register', '/auth/register'], auth.register);
mapRoute('get', ['/v1/auth/me', '/auth/me'], verifyToken, auth.me);
mapRoute('post', ['/v1/auth/refresh', '/auth/refresh'], auth.refreshToken);
mapRoute('post', ['/v1/auth/logout', '/auth/logout'], auth.logout);

/* Catalogue Routes */
mapRoute('get', ['/v1/categories', '/catalogue/categories'], catalogue.getCategories);
mapRoute('get', ['/v1/products', '/catalogue/products'], optionalAuth, catalogue.getProducts);
mapRoute('get', ['/v1/products/:slug', '/catalogue/products/:slug'], optionalAuth, catalogue.getProductBySlug);

/* Cart Routes */
mapRoute('get', ['/v1/cart', '/cart'], optionalAuth, cart.getCart);
mapRoute('post', ['/v1/cart/items', '/cart/items'], optionalAuth, cart.addItem);
mapRoute('put', ['/v1/cart/items/:itemId', '/cart/items/:itemId'], optionalAuth, cart.updateItem);
mapRoute('delete', ['/v1/cart/items/:itemId', '/cart/items/:itemId'], optionalAuth, cart.removeItem);
mapRoute('post', ['/v1/cart/merge', '/cart/merge'], optionalAuth, cart.mergeCart);

/* Checkout Routes */
mapRoute('post', ['/v1/checkout/quote', '/checkout/quote', '/v1/checkout/shipping-quotes', '/checkout/shipping-quotes'], optionalAuth, checkout.getQuote);
mapRoute('post', ['/v1/checkout', '/checkout', '/v1/checkout/create-intent', '/checkout/create-intent'], optionalAuth, checkout.createIntent);

/* Orders Routes */
mapRoute('get', ['/v1/orders', '/orders'], verifyToken, order.getOrders);
mapRoute('get', ['/v1/orders/:orderNumber', '/orders/:orderNumber'], optionalAuth, order.getOrderByNumber);
mapRoute('post', ['/v1/orders/lookup', '/orders/lookup'], order.lookupOrder);
mapRoute('post', ['/v1/orders/:orderNumber/cancel', '/orders/:orderNumber/cancel'], verifyToken, order.cancelOrder);
mapRoute('post', ['/v1/orders/:orderNumber/return', '/orders/:orderNumber/return'], verifyToken, order.returnOrder);

/* User Addresses & Wishlist */
mapRoute('get', ['/v1/addresses', '/addresses'], verifyToken, misc.getAddresses);
mapRoute('post', ['/v1/addresses', '/addresses'], verifyToken, misc.createAddress);
mapRoute('get', ['/v1/wishlist', '/wishlist'], verifyToken, misc.getWishlist);
mapRoute('post', ['/v1/wishlist/:productId', '/wishlist/:productId'], verifyToken, misc.addWishlist);
mapRoute('delete', ['/v1/wishlist/:productId', '/wishlist/:productId'], verifyToken, misc.removeWishlist);

/* Currencies & Settings */
mapRoute('get', ['/v1/currencies', '/currencies'], misc.getCurrencies);
mapRoute('get', ['/v1/settings', '/settings'], misc.getSettings);

/* Admin Routes */
mapRoute('get', ['/v1/admin/customers', '/admin/customers'], verifyToken, requireAdmin, admin.listCustomers);
mapRoute('post', ['/v1/admin/customers/:id/approve', '/admin/customers/:id/approve'], verifyToken, requireAdmin, admin.approveCustomerGroup);
mapRoute('post', ['/v1/admin/customers/:id/reject', '/admin/customers/:id/reject'], verifyToken, requireAdmin, admin.rejectCustomerGroup);
mapRoute('get', ['/v1/admin/catalogue/products', '/admin/catalogue/products'], verifyToken, requireAdmin, admin.listAdminProducts);
mapRoute('put', ['/v1/admin/catalogue/variants/:sku/stock', '/admin/catalogue/variants/:sku/stock', '/v1/admin/catalogue/stock', '/admin/catalogue/stock'], verifyToken, requireAdmin, admin.updateStock);
mapRoute('get', ['/v1/admin/orders', '/admin/orders'], verifyToken, requireAdmin, admin.listAdminOrders);
mapRoute('get', ['/v1/admin/orders/:orderNumber', '/admin/orders/:orderNumber'], verifyToken, requireAdmin, admin.getAdminOrderDetail);
mapRoute('put', ['/v1/admin/orders/:orderNumber/status', '/admin/orders/:orderNumber/status', '/v1/admin/orders/:orderNumber/transition', '/admin/orders/:orderNumber/transition'], verifyToken, requireAdmin, admin.updateOrderStatus);
mapRoute('post', ['/v1/admin/orders/:orderNumber/paid', '/admin/orders/:orderNumber/paid'], verifyToken, requireAdmin, admin.markOrderPaid);
mapRoute('post', ['/v1/admin/orders/:orderNumber/refund', '/admin/orders/:orderNumber/refund'], verifyToken, requireAdmin, admin.refundOrder);
mapRoute('get', ['/v1/admin/reports/kpis', '/admin/reports/kpis'], verifyToken, requireAdmin, admin.getKpis);
mapRoute('get', ['/v1/admin/staff', '/admin/staff'], verifyToken, requireAdmin, admin.listStaff);

/* Webhook */
mapRoute('post', ['/v1/webhooks/stripe', '/webhooks/stripe', '/webhooks/payment', '/api/webhooks/payment'], misc.stripeWebhook);

/* Health */
router.get('/health', misc.health);
router.get('/actuator/health', misc.health);

module.exports = router;
