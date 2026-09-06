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
const upload = require('../middleware/upload');

/* Helper to map routes to multiple paths and methods */
function mapRoute(methods, paths, ...handlers) {
    const methodList = Array.isArray(methods) ? methods : [methods];
    for (const m of methodList) {
        for (const p of paths) {
            router[m](p, ...handlers);
        }
    }
}

/* Auth Routes */
mapRoute('post', ['/v1/auth/login', '/auth/login'], auth.login);
mapRoute('post', ['/v1/auth/google', '/auth/google'], auth.googleLogin);
mapRoute('post', ['/v1/auth/register', '/auth/register'], auth.register);
mapRoute('get', ['/v1/auth/me', '/auth/me'], verifyToken, auth.me);
mapRoute('put', ['/v1/auth/me', '/auth/me'], verifyToken, auth.updateProfile);
mapRoute('post', ['/v1/auth/upgrade-request', '/auth/upgrade-request'], verifyToken, auth.upgradeRequest);
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
mapRoute('get', ['/v1/orders/:orderNumber/invoice', '/orders/:orderNumber/invoice'], optionalAuth, order.getInvoice);
mapRoute('post', ['/v1/orders/:orderNumber/invoice/lookup', '/orders/:orderNumber/invoice/lookup', '/v1/orders/invoice/lookup', '/orders/invoice/lookup'], order.lookupInvoice);
mapRoute('get', ['/v1/orders/:orderNumber', '/orders/:orderNumber'], optionalAuth, order.getOrderByNumber);
mapRoute('post', ['/v1/orders/lookup', '/orders/lookup'], order.lookupOrder);
mapRoute('post', ['/v1/orders/:orderNumber/pay', '/orders/:orderNumber/pay'], optionalAuth, order.payOrder);
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
mapRoute('get', ['/v1/admin/customers/pending-approvals', '/admin/customers/pending-approvals'], verifyToken, requireAdmin, admin.pendingApprovals);
mapRoute('post', ['/v1/admin/customers/:id/approval', '/admin/customers/:id/approval'], verifyToken, requireAdmin, admin.decideApproval);
mapRoute('put', ['/v1/admin/customers/:id/pricing-group', '/admin/customers/:id/pricing-group'], verifyToken, requireAdmin, admin.assignPricingGroup);
mapRoute('put', ['/v1/admin/customers/:id/approval-status', '/admin/customers/:id/approval-status'], verifyToken, requireAdmin, admin.setApprovalStatus);
mapRoute('put', ['/v1/admin/customers/:id/enabled', '/admin/customers/:id/enabled'], verifyToken, requireAdmin, admin.setCustomerEnabled);
mapRoute('post', ['/v1/admin/customers/:id/approve', '/admin/customers/:id/approve'], verifyToken, requireAdmin, admin.approveCustomerGroup);
mapRoute('post', ['/v1/admin/customers/:id/reject', '/admin/customers/:id/reject'], verifyToken, requireAdmin, admin.rejectCustomerGroup);

/* Categories */
mapRoute('get', ['/v1/admin/catalogue/categories', '/admin/catalogue/categories', '/v1/admin/categories', '/admin/categories'], verifyToken, requireAdmin, admin.listCategories);
mapRoute('post', ['/v1/admin/catalogue/categories', '/admin/catalogue/categories', '/v1/admin/categories', '/admin/categories'], verifyToken, requireAdmin, admin.createCategory);
mapRoute('put', ['/v1/admin/catalogue/categories/:id', '/admin/catalogue/categories/:id', '/v1/admin/categories/:id', '/admin/categories/:id'], verifyToken, requireAdmin, admin.updateCategory);
mapRoute('delete', ['/v1/admin/catalogue/categories/:id', '/admin/catalogue/categories/:id', '/v1/admin/categories/:id', '/admin/categories/:id'], verifyToken, requireAdmin, admin.deleteCategory);

/* Products CRUD & Media */
mapRoute('get', ['/v1/admin/catalogue/products', '/admin/catalogue/products'], verifyToken, requireAdmin, admin.listAdminProducts);
mapRoute('post', ['/v1/admin/catalogue/products', '/admin/catalogue/products'], verifyToken, requireAdmin, admin.createProduct);
mapRoute('get', ['/v1/admin/catalogue/products/export', '/admin/catalogue/products/export'], verifyToken, requireAdmin, admin.exportProductsCsv);
mapRoute('get', ['/v1/admin/catalogue/products/bulk-upload-template', '/admin/catalogue/products/bulk-upload-template'], verifyToken, requireAdmin, admin.downloadBulkUploadTemplate);
mapRoute('post', ['/v1/admin/catalogue/products/bulk-upload', '/admin/catalogue/products/bulk-upload'], verifyToken, requireAdmin, upload.single('file'), admin.bulkUploadProducts);
mapRoute('post', ['/v1/admin/catalogue/products/bulk-upload-images', '/admin/catalogue/products/bulk-upload-images'], verifyToken, requireAdmin, upload.single('file'), admin.bulkUploadProductImages);
mapRoute('get', ['/v1/admin/catalogue/low-stock', '/admin/catalogue/low-stock'], verifyToken, requireAdmin, admin.getLowStockVariants);
mapRoute('get', ['/v1/admin/catalogue/products/:slug', '/admin/catalogue/products/:slug'], verifyToken, requireAdmin, admin.getAdminProduct);
mapRoute('put', ['/v1/admin/catalogue/products/:slug', '/admin/catalogue/products/:slug'], verifyToken, requireAdmin, admin.updateProduct);
mapRoute('delete', ['/v1/admin/catalogue/products/:slug', '/admin/catalogue/products/:slug'], verifyToken, requireAdmin, admin.deleteProduct);
mapRoute('post', ['/v1/admin/catalogue/products/:slug/images', '/admin/catalogue/products/:slug/images'], verifyToken, requireAdmin, upload.single('file'), admin.uploadProductImage);
mapRoute('delete', ['/v1/admin/catalogue/products/:slug/images/:imageId', '/admin/catalogue/products/:slug/images/:imageId'], verifyToken, requireAdmin, admin.deleteProductImage);
mapRoute('put', ['/v1/admin/catalogue/products/:slug/images/:imageId/default', '/admin/catalogue/products/:slug/images/:imageId/default'], verifyToken, requireAdmin, admin.setDefaultProductImage);
mapRoute('put', ['/v1/admin/catalogue/variants/:sku/stock', '/admin/catalogue/variants/:sku/stock', '/v1/admin/catalogue/stock', '/admin/catalogue/stock'], verifyToken, requireAdmin, admin.updateStock);

/* Orders */
mapRoute('get', ['/v1/admin/orders', '/admin/orders'], verifyToken, requireAdmin, admin.listAdminOrders);
mapRoute('get', ['/v1/admin/orders/:orderNumber', '/admin/orders/:orderNumber'], verifyToken, requireAdmin, admin.getAdminOrderDetail);
mapRoute(['put', 'post'], ['/v1/admin/orders/:orderNumber/status', '/admin/orders/:orderNumber/status', '/v1/admin/orders/:orderNumber/transition', '/admin/orders/:orderNumber/transition'], verifyToken, requireAdmin, admin.updateOrderStatus);
mapRoute('post', ['/v1/admin/orders/:orderNumber/paid', '/admin/orders/:orderNumber/paid', '/v1/admin/orders/:orderNumber/mark-paid', '/admin/orders/:orderNumber/mark-paid'], verifyToken, requireAdmin, admin.markOrderPaid);
mapRoute('post', ['/v1/admin/orders/:orderNumber/refund', '/admin/orders/:orderNumber/refund'], verifyToken, requireAdmin, admin.refundOrder);
mapRoute('delete', ['/v1/admin/orders/:orderNumber', '/admin/orders/:orderNumber'], verifyToken, requireAdmin, admin.deleteOrder);
mapRoute('get', ['/v1/admin/orders/:orderNumber/boxes', '/admin/orders/:orderNumber/boxes'], verifyToken, requireAdmin, admin.getOrderBoxes);
mapRoute('put', ['/v1/admin/orders/:orderNumber/boxes', '/admin/orders/:orderNumber/boxes'], verifyToken, requireAdmin, admin.updateOrderBoxes);
mapRoute('post', ['/v1/admin/orders/:orderNumber/rates', '/admin/orders/:orderNumber/rates'], verifyToken, requireAdmin, admin.getOrderRates);
mapRoute('post', ['/v1/admin/orders/:orderNumber/shipment', '/admin/orders/:orderNumber/shipment'], verifyToken, requireAdmin, admin.bookOrderShipment);
mapRoute('delete', ['/v1/admin/orders/:orderNumber/shipment', '/admin/orders/:orderNumber/shipment'], verifyToken, requireAdmin, admin.cancelOrderShipment);

/* Coupons */
mapRoute('get', ['/v1/admin/coupons', '/admin/coupons'], verifyToken, requireAdmin, admin.listCoupons);
mapRoute('post', ['/v1/admin/coupons', '/admin/coupons'], verifyToken, requireAdmin, admin.createCoupon);
mapRoute('put', ['/v1/admin/coupons/:id', '/admin/coupons/:id'], verifyToken, requireAdmin, admin.updateCoupon);
mapRoute('delete', ['/v1/admin/coupons/:id', '/admin/coupons/:id'], verifyToken, requireAdmin, admin.deleteCoupon);

/* Reviews */
mapRoute('get', ['/v1/admin/reviews', '/admin/reviews'], verifyToken, requireAdmin, admin.listReviews);
mapRoute('post', ['/v1/admin/reviews/:id/moderate', '/admin/reviews/:id/moderate'], verifyToken, requireAdmin, admin.moderateReview);

/* Content Blocks */
mapRoute('get', ['/v1/admin/content', '/admin/content'], verifyToken, requireAdmin, admin.listContent);
mapRoute('post', ['/v1/admin/content', '/admin/content'], verifyToken, requireAdmin, admin.createContent);
mapRoute('put', ['/v1/admin/content/:id', '/admin/content/:id'], verifyToken, requireAdmin, admin.updateContent);

/* Settings & Master Data */
mapRoute('get', ['/v1/admin/settings/hs-code-tax-rates', '/admin/settings/hs-code-tax-rates'], verifyToken, requireAdmin, admin.listHsCodeTaxRates);
mapRoute(['post', 'put'], ['/v1/admin/settings/hs-code-tax-rates', '/admin/settings/hs-code-tax-rates'], verifyToken, requireAdmin, admin.createHsCodeTaxRate);
mapRoute('delete', ['/v1/admin/settings/hs-code-tax-rates/:id', '/admin/settings/hs-code-tax-rates/:id'], verifyToken, requireAdmin, admin.deleteHsCodeTaxRate);
mapRoute('get', ['/v1/admin/settings/shipping-rates', '/admin/settings/shipping-rates'], verifyToken, requireAdmin, admin.listShippingRates);
mapRoute(['post', 'put'], ['/v1/admin/settings/shipping-rates', '/admin/settings/shipping-rates'], verifyToken, requireAdmin, admin.saveShippingRate);
mapRoute('get', ['/v1/admin/settings/shipping-origin', '/admin/settings/shipping-origin'], verifyToken, requireAdmin, admin.getShippingOrigin);
mapRoute(['post', 'put'], ['/v1/admin/settings/shipping-origin', '/admin/settings/shipping-origin'], verifyToken, requireAdmin, admin.saveShippingOrigin);
mapRoute('get', ['/v1/admin/settings/currency-rates', '/admin/settings/currency-rates'], verifyToken, requireAdmin, admin.listCurrencyRates);
mapRoute(['post', 'put'], ['/v1/admin/settings/currency-rates', '/admin/settings/currency-rates'], verifyToken, requireAdmin, admin.saveCurrencyRate);
mapRoute('delete', ['/v1/admin/settings/currency-rates/:id', '/admin/settings/currency-rates/:id'], verifyToken, requireAdmin, admin.deleteCurrencyRate);
mapRoute('get', ['/v1/admin/settings/pallet-shipping', '/admin/settings/pallet-shipping'], verifyToken, requireAdmin, admin.getPalletShippingSettings);
mapRoute(['post', 'put'], ['/v1/admin/settings/pallet-shipping', '/admin/settings/pallet-shipping'], verifyToken, requireAdmin, admin.savePalletShippingSettings);

/* Reports & KPIs */
mapRoute('get', ['/v1/admin/dashboard', '/admin/dashboard', '/v1/admin/reports/kpis', '/admin/reports/kpis'], verifyToken, requireAdmin, admin.getKpis);
mapRoute('get', ['/v1/admin/reports/sales', '/admin/reports/sales'], verifyToken, requireAdmin, admin.getSalesReport);

/* Staff Management */
mapRoute('get', ['/v1/admin/staff', '/admin/staff'], verifyToken, requireAdmin, admin.listStaff);
mapRoute('get', ['/v1/admin/staff/roles', '/admin/staff/roles'], verifyToken, requireAdmin, admin.listStaffRoles);
mapRoute('post', ['/v1/admin/staff', '/admin/staff'], verifyToken, requireAdmin, admin.createStaff);
mapRoute('put', ['/v1/admin/staff/:userId/role', '/admin/staff/:userId/role'], verifyToken, requireAdmin, admin.assignStaffRole);
mapRoute('put', ['/v1/admin/staff/:userId/enabled', '/admin/staff/:userId/enabled'], verifyToken, requireAdmin, admin.setStaffEnabled);
mapRoute('delete', ['/v1/admin/staff/:userId', '/admin/staff/:userId'], verifyToken, requireAdmin, admin.deleteStaff);

/* Audit Log */
mapRoute('get', ['/v1/admin/audit', '/admin/audit'], verifyToken, requireAdmin, admin.getAuditLog);

/* Webhook */
mapRoute('post', ['/v1/webhooks/stripe', '/webhooks/stripe', '/webhooks/payment', '/api/webhooks/payment'], misc.stripeWebhook);

/* Health */
router.get('/health', misc.health);
router.get('/actuator/health', misc.health);

module.exports = router;
