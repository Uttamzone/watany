# Watani B2C Website - Requirements

> Status: Draft v0.2 - in progress
> Last updated: 2026-07-27
> Reference site: https://wataniandsons.com/
> Brand: **Watani**

---

## 1. Overview

Watani is an online product shopping platform (storefront + admin back office) serving four
distinct user groups with **group-specific pricing** on the same catalogue. The public storefront
supports guest browsing and registered-account purchasing, with order tracking. Payments are
processed through **Stripe** and shipping/fulfilment through **ClickShip**, both integrated behind
provider-agnostic abstractions so either can be swapped for an alternative provider later without
touching business logic.

The system is expected to serve high traffic volumes, so performance, caching, and horizontal
scalability are first-class requirements rather than later optimisations.

### 1.1 Components

| Component | Description |
|---|---|
| **Storefront (B2C Website)** | Public catalogue, search, cart, checkout, account area, order tracking |
| **Admin Dashboard** | Product, pricing, inventory, order, customer, shipping, content, and report management |
| **Backend Service** | REST API, business rules, pricing engine, integrations, background jobs |
| **Integrations** | Stripe (payments), ClickShip (shipping) - both pluggable |

---

## 2. User Groups & Roles

Four groups. Group determines **which price a user sees** and **what they can access**.

| Group | Access | Pricing |
|---|---|---|
| **Admin** | Full admin dashboard access. Not a purchasing group. | N/A - sees all price tiers |
| **Distributor** | Storefront + own account area | Distributor tier price |
| **Wholesale Customer** | Storefront + own account area | Wholesale tier price |
| **Retail Customer** | Storefront + own account area | Retail price (default / base price) |
| **Guest (unauthenticated)** | Browse + cart; must register or log in to check out | Retail price |

### 2.1 Rules

- **R-UG-1** - A user belongs to exactly one pricing group at a time.
- **R-UG-2** - Retail is the **default and fallback** group. Any user without an assigned group, and any guest, sees retail pricing.
- **R-UG-3** - Distributor and Wholesale accounts require **admin approval** before the elevated tier is applied. Until approved, the account is treated as Retail.
- **R-UG-4** - Admin roles should be sub-divisible (e.g. Super Admin, Catalogue Manager, Order Manager, Support) via a permission model, rather than a single all-powerful admin role.
- **R-UG-5** - All group and role changes are audit-logged (who, what, when, previous value).

> ❓ **Open question OQ-1:** Should Distributor/Wholesale registration collect business details (company name, tax/VAT ID, business licence) and require document upload for approval?

---

## 3. Pricing Engine

This is the most business-critical and non-standard part of the system.

### 3.1 Price Model

Each product (or product variant) stores **multiple prices** - one per purchasing group - plus an
optional **minimum quantity (MOQ)** per tier.

```
Product/Variant
 └── PriceTier[]
      ├── group           (RETAIL | WHOLESALE | DISTRIBUTOR)
      ├── unit_price
      ├── min_quantity    (nullable; null or 1 = no minimum)
      ├── currency
      ├── valid_from      (nullable)
      └── valid_to        (nullable)
```

### 3.2 Resolution Rules

- **R-PR-1** - The price shown and charged is determined by *(logged-in user's group, line quantity)*.
- **R-PR-2** - If the user's group tier exists **and** line quantity ≥ that tier's `min_quantity`, the group price applies.
- **R-PR-3** - If the group tier's `min_quantity` is **not met**, the line falls back to the **retail price**. (Explicitly confirmed requirement.)
- **R-PR-4** - Retail tier must always exist for a sellable product; it is the guaranteed fallback.
- **R-PR-5** - Pricing is evaluated **per cart line**, not per cart total, unless a quantity-break rule says otherwise (see OQ-2).
- **R-PR-6** - Prices are re-resolved **server-side at checkout**. Client-displayed prices are never trusted.
- **R-PR-7** - Cart line prices are re-validated when quantity changes, and the user is shown when a discount tier is gained or lost (e.g. "Add 4 more to unlock wholesale pricing").
- **R-PR-8** - All price changes are audit-logged and versioned; historical orders retain the price actually charged.

### 3.3 Worked Example

Product: *Item A* - Retail $10.00 · Wholesale $7.00 (MOQ 10) · Distributor $5.50 (MOQ 25)

| Logged-in group | Qty | Price applied | Line total |
|---|---|---|---|
| Retail | 50 | $10.00 (retail) | $500.00 |
| Wholesale | 5 | $10.00 (MOQ not met → retail) | $50.00 |
| Wholesale | 10 | $7.00 | $70.00 |
| Distributor | 10 | $10.00 (MOQ 25 not met → retail) | $100.00 |
| Distributor | 25 | $5.50 | $137.50 |
| Guest | 30 | $10.00 (retail) | $300.00 |

> ❓ **Open question OQ-2:** When a distributor's MOQ isn't met, should the system fall back to **retail** (as specified) or to the **next-best tier they qualify for** (e.g. wholesale)? Current spec = retail. Confirm.
>
> ❓ **Open question OQ-3:** Should multiple quantity breaks per group be supported (e.g. Wholesale: 10+ = $7, 50+ = $6.50)? The model above supports this if `PriceTier` allows multiple rows per group.
>
> ❓ **Open question OQ-4:** Are tier prices tax-inclusive or tax-exclusive? B2B tiers are commonly tax-exclusive while retail is tax-inclusive.

---

## 4. Functional Requirements - Storefront

### 4.1 Catalogue & Discovery
- **F-CAT-1** - Product listing with categories, subcategories, and collections.
- **F-CAT-2** - Product detail page: gallery, description, specifications, variants, stock status, group-appropriate price, quantity-break table (for eligible groups).
- **F-CAT-3** - Product variants (size, colour, pack size, etc.) with independent SKU, stock, and price tiers.
- **F-CAT-4** - Full-text search with autocomplete and typo tolerance.
- **F-CAT-5** - Faceted filtering (category, brand, price range, attributes, availability) and sorting.
- **F-CAT-6** - Related / cross-sell / recently-viewed products.
- **F-CAT-7** - Product reviews and ratings (moderated by admin).
- **F-CAT-8** - Wishlist / saved items for logged-in users.
- **F-CAT-9** - SEO: server-rendered pages, canonical URLs, meta tags, structured data (Product, Offer, Breadcrumb), XML sitemap, robots.txt.

### 4.2 Cart & Checkout
- **F-CRT-1** - Persistent cart: session-based for guests, account-bound for logged-in users, merged on login.
- **F-CRT-2** - Live line-level price resolution per §3, with tier-unlock messaging.
- **F-CRT-3** - Stock validation at add-to-cart and again at checkout.
- **F-CRT-4** - Promotion / coupon codes, with rules for which groups they apply to.
- **F-CRT-5** - Multi-step or single-page checkout: shipping address → shipping method → payment → review → place order.
- **F-CRT-6** - Address book with saved shipping/billing addresses; address validation.
- **F-CRT-7** - Live shipping rate quotes from ClickShip based on cart weight/dimensions and destination.
- **F-CRT-8** - Tax calculation by product HS (Harmonized System) code, admin-editable per code (Master data Setup); an item with no configured rate for its HS code falls back to a global default of 13%. Shipping is always taxed at the default rate. (Superseded from destination-based tax.)
- **F-CRT-9** - Guest checkout - **see OQ-5**.
- **F-CRT-10** - Order confirmation page + confirmation email.
- **F-CRT-11** - Idempotent order placement (double-submit and retry safe).

> ❓ **Open question OQ-5:** Is guest checkout allowed, or must all buyers have an account? The brief says "users could create accounts and track orders" - confirm whether account is mandatory to purchase.

### 4.3 Accounts & Order Tracking
- **F-ACC-1** - Registration with email verification; login; logout.
- **F-ACC-2** - Password reset, password change, optional 2FA.
- **F-ACC-3** - Social / SSO login (optional - see OQ-6).
- **F-ACC-4** - Profile management: name, contact, addresses, communication preferences.
- **F-ACC-5** - Order history with full detail, prices charged, and downloadable invoice (PDF).
- **F-ACC-6** - **Order tracking**: order status timeline (Placed → Paid → Processing → Packed → Shipped → Out for Delivery → Delivered) with ClickShip tracking number and carrier link.
- **F-ACC-7** - Reorder from a previous order.
- **F-ACC-8** - Return / refund request initiation from an order.
- **F-ACC-9** - Business-account fields and approval status visible for Distributor/Wholesale users.

> ❓ **Open question OQ-6:** Which social login providers, if any? (Google / Apple / Facebook)

---

## 5. Functional Requirements - Admin Dashboard

### 5.1 Catalogue Management
- **F-ADM-1** - CRUD for products, variants, categories, collections, brands, attributes.
- **F-ADM-2** - Media management: multiple images per product/variant, ordering, alt text, optimisation.
- **F-ADM-3** - **Multi-tier price management**: set retail/wholesale/distributor prices and MOQ per product/variant in one screen.
- **F-ADM-4** - Bulk import/export (CSV/Excel) for products, prices, and stock.
- **F-ADM-5** - Scheduled price changes and sale/promotional pricing.
- **F-ADM-6** - Inventory management: stock levels, low-stock alerts, backorder/pre-order settings.

### 5.2 Order Management
- **F-ADM-7** - Order list with search, filters (status, group, date, value), and detail view.
- **F-ADM-8** - Status transitions, order notes, internal comments.
- **F-ADM-9** - Create shipping labels and book shipments via ClickShip; push tracking numbers to orders.
- **F-ADM-10** - Refunds (full and partial) via Stripe; cancellations.
- **F-ADM-11** - Returns / RMA workflow.
- **F-ADM-12** - Invoice and packing-slip generation.
- **F-ADM-13** - Manual order creation on behalf of a customer (useful for phone B2B orders).

### 5.3 Customer Management
- **F-ADM-14** - Customer list, detail, and order history.
- **F-ADM-15** - **Assign/change pricing group**; approve or reject Distributor/Wholesale applications.
- **F-ADM-16** - Suspend/reactivate accounts; impersonate customer for support (audit-logged).
- **F-ADM-17** - Customer-specific price overrides - **see OQ-7**.

> ❓ **Open question OQ-7:** Beyond the three group tiers, is per-customer negotiated pricing needed (common in distributor relationships)? This materially affects the pricing model.

### 5.4 Marketing, Content & Reporting
- **F-ADM-18** - Coupons, discounts, and campaign rules scoped by group.
- **F-ADM-19** - CMS for homepage banners, static pages, and navigation.
- **F-ADM-20** - Review moderation.
- **F-ADM-21** - Email/notification template management.
- **F-ADM-22** - Reports: sales by period/group/product/category, top sellers, inventory, abandoned carts, customer lifetime value. Exportable.
- **F-ADM-23** - Dashboard home with KPIs (revenue, orders, AOV, conversion, low stock).

### 5.5 System Administration
- **F-ADM-24** - Admin user and role/permission management (RBAC).
- **F-ADM-25** - **Provider configuration**: select and configure the active payment and shipping providers from the admin UI (see §6).
- **F-ADM-26** - Tax, currency, and shipping-zone configuration.
- **F-ADM-27** - Audit log viewer.

---

## 6. Integrations (Pluggable by Design)

### 6.1 Payment - Stripe (initial provider)
- **F-PAY-1** - Card payments via Stripe (Payment Intents / Stripe Elements or Checkout).
- **F-PAY-2** - Wallets: Apple Pay / Google Pay.
- **F-PAY-3** - Saved payment methods for returning customers.
- **F-PAY-4** - Webhooks for payment success, failure, dispute, and refund - signature-verified and idempotent.
- **F-PAY-5** - Full and partial refunds initiated from admin.
- **F-PAY-6** - **PCI scope minimised** - card data never touches Watani servers; tokenised via Stripe only.
- **F-PAY-7** - Invoice / pay-later terms for Distributor and Wholesale - **see OQ-8**.

### 6.2 Shipping - ClickShip (initial provider)
- **F-SHP-1** - Live rate quotes at checkout by destination, weight, and dimensions.
- **F-SHP-2** - Shipment booking and label generation from admin.
- **F-SHP-3** - Tracking number retrieval and status sync back to the order.
- **F-SHP-4** - Multi-carrier options surfaced to the customer with cost and ETA.
- **F-SHP-5** - Shipping zones, free-shipping thresholds (potentially group-specific), and flat-rate fallbacks.

### 6.3 Provider Abstraction - **Non-negotiable design constraint**
- **R-INT-1** - All payment operations go through a `PaymentProvider` interface (authorize, capture, refund, tokenize, webhook-handle). Stripe is one implementation.
- **R-INT-2** - All shipping operations go through a `ShippingProvider` interface (quote, book, label, track, cancel). ClickShip is one implementation.
- **R-INT-3** - The active provider is selected by configuration, not by code change; adding a provider must not require modifying order/checkout logic.
- **R-INT-4** - Provider-specific identifiers are stored in dedicated fields, never leaked into core domain models.
- **R-INT-5** - Every external call must have timeouts, retries with backoff, circuit breaking, and a defined degraded-mode behaviour (e.g. fall back to flat-rate shipping if quoting fails).

> ❓ **Open question OQ-8:** Do Distributor/Wholesale customers need credit terms (net 30, purchase orders, invoicing) rather than upfront card payment? This is common for B2B tiers and adds significant scope.

### 6.4 Other Integrations
- **F-INT-1** - Transactional email (order confirmation, shipping, password reset).
- **F-INT-2** - Analytics (GA4 / equivalent) with e-commerce event tracking.
- **F-INT-3** - Optional: accounting/ERP sync, marketing automation, live chat/support.

---

## 7. Non-Functional Requirements

### 7.1 Performance & Scale - *explicit priority*
- **N-PERF-1** - Storefront page TTFB < 200 ms (cached) / < 500 ms (dynamic) at p95.
- **N-PERF-2** - API response time < 300 ms at p95 for read endpoints.
- **N-PERF-3** - Core Web Vitals: LCP < 2.5 s, INP < 200 ms, CLS < 0.1 on mobile.
- **N-PERF-4** - Support target concurrent users and peak RPS - **see OQ-9** for actual figures.
- **N-PERF-5** - Must sustain flash-sale / campaign traffic spikes of at least 10× baseline without degradation.

### 7.2 Scalability & Architecture
- **N-SCL-1** - All application tiers **stateless and horizontally scalable**; no in-process session state.
- **N-SCL-2** - Auto-scaling on CPU/RPS with sensible min/max instance counts.
- **N-SCL-3** - **CDN** in front of all static assets, images, and cacheable pages.
- **N-SCL-4** - **Multi-layer caching**: CDN edge → application cache (Redis) → database. Catalogue and category pages aggressively cached; cart/checkout never cached.
- **N-SCL-5** - Cache keys must include the **pricing group** - a wholesale-priced page must never be served to a retail user. This is both a correctness and a security requirement.
- **N-SCL-6** - Database: connection pooling, read replicas for catalogue/search reads, indexed query paths, no N+1 queries.
- **N-SCL-7** - Dedicated search index (Elasticsearch/OpenSearch/Meilisearch) rather than SQL `LIKE` scans.
- **N-SCL-8** - Asynchronous processing via queues for email, label generation, webhooks, reports, and index updates - never blocking the request path.
- **N-SCL-9** - Image optimisation: responsive sizes, modern formats (WebP/AVIF), lazy loading.
- **N-SCL-10** - Rate limiting and bot/abuse protection on public endpoints, login, and checkout.
- **N-SCL-11** - Inventory decrement must be **concurrency-safe** (no overselling under simultaneous checkouts).
- **N-SCL-12** - Load and stress testing as part of the release process, with published results against §7.1 targets.

### 7.3 Security
- **N-SEC-1** - HTTPS/TLS everywhere; HSTS.
- **N-SEC-2** - Passwords hashed with a modern KDF (bcrypt/argon2); no plaintext secrets in source or config.
- **N-SEC-3** - Server-side authorisation on every endpoint; **pricing tier is enforced server-side** and never derived from client input.
- **N-SEC-4** - Protection against OWASP Top 10 (injection, XSS, CSRF, SSRF, broken access control).
- **N-SEC-5** - Webhook signature verification for Stripe and ClickShip.
- **N-SEC-6** - Secrets in a managed secret store, not in repo or environment files committed to Git.
- **N-SEC-7** - PII encrypted at rest; access to customer data audit-logged.
- **N-SEC-8** - Admin dashboard access restricted (MFA required, optional IP allow-list).

### 7.4 Reliability & Operations
- **N-OPS-1** - Uptime target 99.9%.
- **N-OPS-2** - Zero-downtime deployments.
- **N-OPS-3** - Automated backups with a tested restore procedure; defined RPO/RTO.
- **N-OPS-4** - Centralised structured logging, metrics, distributed tracing, and alerting.
- **N-OPS-5** - Health/readiness endpoints for all services.
- **N-OPS-6** - Graceful degradation when a third-party provider is unavailable.

### 7.5 Usability, Accessibility & Compliance
- **N-UX-1** - Mobile-first responsive design across phone, tablet, desktop.
- **N-UX-2** - WCAG 2.1 AA accessibility.
- **N-UX-3** - Modern browser support (last 2 versions of major browsers).
- **N-UX-4** - Consistent Watani branding, with logo, palette, and typography from the brand guidelines.
- **N-UX-5** - Cookie consent and privacy policy; GDPR/PIPEDA-appropriate data handling including data export and deletion requests.
- **N-UX-6** - Multi-language / multi-currency - **see OQ-10**.

> ❓ **Open question OQ-9:** What are the expected traffic figures - monthly visitors, peak concurrent users, orders/day, catalogue size (SKU count)? These drive concrete infrastructure sizing.
>
> ❓ **Open question OQ-10:** Which markets, currencies, and languages must be supported at launch? (ClickShip suggests a Canada/US focus - confirm.)

---

## 8. Assumptions

1. Single storefront/brand (Watani) - not a multi-tenant marketplace.
2. Watani is the sole seller; no third-party vendors or seller onboarding.
3. Physical goods only; no digital/downloadable products or subscriptions at launch.
4. Retail price is always defined for every sellable product and serves as the universal fallback.
5. Stripe and ClickShip accounts, API credentials, and any required business verification are provided by the client.
6. Product data, imagery, and copy are supplied by the client or migrated from the existing site.

---

## 9. Out of Scope (v1)

- Marketplace / multi-vendor functionality
- Native mobile apps (the responsive web app covers mobile)
- Subscription or recurring billing
- POS / physical retail integration
- Loyalty points programme _(candidate for v2)_
- Multi-warehouse inventory allocation _(candidate for v2)_

---

## 10. Open Questions - Consolidated

| ID | Question | Impact |
|---|---|---|
| OQ-1 | Business details/documents required for Distributor & Wholesale registration? | Registration & approval flow |
| OQ-2 | MOQ not met → fall back to retail, or to next-best qualifying tier? | Pricing engine core logic |
| OQ-3 | Multiple quantity breaks per group (10+ / 50+ / 100+)? | Pricing data model |
| OQ-4 | Are tier prices tax-inclusive or tax-exclusive? | Pricing & tax calculation |
| OQ-5 | Is guest checkout permitted, or is an account mandatory? | Checkout flow |
| OQ-6 | Which social/SSO login providers? | Auth scope |
| OQ-7 | Per-customer negotiated price overrides needed? | Pricing data model |
| OQ-8 | Credit terms / PO / invoicing for B2B tiers? | Payment scope - significant |
| OQ-9 | Expected traffic, order volume, and SKU count? | Infrastructure sizing |
| OQ-10 | Target markets, currencies, and languages? | i18n scope |

---

## 11. Change Log

| Version | Date | Change |
|---|---|---|
| v0.1 | 2026-07-27 | Initial skeleton |
| v0.2 | 2026-07-27 | Added overview, user groups, tiered pricing engine, storefront & admin functional requirements, Stripe/ClickShip pluggable integrations, performance & scale NFRs, assumptions, out-of-scope, open questions |
