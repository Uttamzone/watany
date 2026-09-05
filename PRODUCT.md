# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js 15+ (App Router, TypeScript) storefront and admin frontend (`watani-b2c-website/`), backed by a Spring Boot 3.5 / Java 21 / PostgreSQL service (`watani-b2c-service/`) exposing a REST API. Established by the existing codebase, not chosen during this init.

## Users

Two audiences on the same catalogue, distinguished by pricing group rather than by separate products or apps:

- **Retail consumer shoppers** - individual/household Canadian customers browsing and buying authentic Palestinian pantry products (olive oil, zaatar, olives, cheese, ceramics) online. May check out as guests or as a registered Retail account. This is the default group and the one the current storefront visual design (DESIGN.md) is built around.
- **B2B buyers (Distributor / Wholesale accounts)** - registered business accounts that see group-specific tiered pricing and minimum-order-quantity (MOQ) breaks on the same catalogue, typically ordering in bulk.
- **Admin / back-office staff** - manage catalogue, pricing tiers, inventory, orders, customers, and content through the admin dashboard (`/admin`). Not a purchasing group; admin roles are permission-based (`PERM_*`) rather than a single all-powerful role, so responsibilities can be sub-divided (Super Admin, Catalogue Manager, Order Manager, Support, etc.).

Both retail and B2B audiences are equally primary - the storefront is not "B2C with a B2B afterthought" or vice versa; it is one catalogue serving both under a single pricing engine.

## Product Purpose

Watani & Sons Corp's online storefront for authentic Palestinian products sold in Canada (olive oil, olives, zaatar, grains, cheese, ceramics, and related pantry goods), replacing/extending `wataniandsons.com` with a modern storefront plus an admin back office. Success means retail shoppers can browse and buy easily, while Distributor and Wholesale accounts get correctly tiered pricing automatically enforced server-side, and staff can run catalogue, pricing, inventory, orders, and content without engineering involvement.

## Positioning

A single-seller (Watani is the sole vendor; no marketplace/third-party sellers) storefront whose pricing engine resolves price as a function of *(buyer's group, line quantity)* per cart line, evaluated and re-validated server-side - not a generic storefront template with a flat price list. The same catalogue simultaneously serves retail consumers and B2B distributor/wholesale buyers without duplicating product data.

## Operating Context

- Storefront routes (Next.js, route group `(storefront)`): home, categories, product detail, cart, checkout (+ confirmation/cancelled), login, account.
- Buyer portal (`/portal`): profile and order history/detail for logged-in customers.
- Admin dashboard (`/admin`): catalogue (create/edit), master data, pricing, stock, orders (list/detail), customers, coupons, reviews, content (CMS), audit log.
- Payments via **Stripe**, shipping via **ClickShip**, both accessed only through provider-agnostic interfaces (`PaymentProvider`, `ShippingProvider`) so either can be swapped by configuration, not code change.
- Backend enforces group pricing, stock concurrency, and idempotent checkout; the frontend must never be trusted to compute or display a price the backend hasn't re-resolved.

## Capabilities and Constraints

Confirmed pricing/business rules (resolved in requirement.md and implemented in the backend - treated as final product decisions, not open questions):

- A user belongs to exactly one pricing group at a time: Admin (no purchasing), Distributor, Wholesale, Retail, or Guest (unauthenticated, treated as Retail).
- Retail is the default and mandatory fallback tier for every sellable product.
- Distributor/Wholesale pricing requires admin approval; until approved, the account is treated as Retail.
- If a buyer's tier minimum order quantity (MOQ) is not met for a cart line, the line falls back to **retail** pricing - not to an intermediate tier.
- Multiple quantity-break rows per group are supported (e.g. Wholesale 10+ / 50+); the cheapest qualifying row wins.
- Tier prices are **tax-exclusive**; tax is applied at checkout.
- An **account is required to place an order**; guests may browse and build a cart but must register/log in to check out.
- Prices are always re-resolved server-side, including at checkout - client-displayed prices are never trusted.
- Cart line prices are re-validated on quantity change, with tier-unlock messaging (e.g. "Add 4 more to unlock wholesale pricing").
- Stock decrements are concurrency-safe (pessimistic locking) to prevent overselling under simultaneous checkouts.
- Cache keys must include pricing group - a wholesale-priced page must never be served to a retail user.

Still explicitly undecided / out of current scope (per requirement.md, not to be invented):
- OQ-1: whether Distributor/Wholesale registration requires business-document upload for approval.
- OQ-6: which social/SSO login providers, if any.
- OQ-7: per-customer negotiated price overrides beyond the three group tiers - **not implemented** (model change).
- OQ-8: credit terms / PO / net-30 invoicing for B2B tiers - **not implemented**.
- OQ-9: expected traffic/order volume/SKU count figures (infrastructure sizing).
- OQ-10: target markets/currencies/languages beyond the assumed Canada/CAD focus.
- Out of scope for v1: multi-vendor marketplace, native mobile apps, subscriptions/recurring billing, POS integration, loyalty points, multi-warehouse allocation.

Physical goods only; Watani is the sole seller (no third-party vendor onboarding).

## Brand Commitments

- Brand name: **Watani & Sons Corp**. Preserve "WATANY" capitalization where it forms part of an official product name (e.g. WATANY Olive Oil).
- Visual identity, product catalogue fixtures, and page-by-page design spec are recorded in `watani-b2c-website/DESIGN.md` (bright/warm off-white canvas, deep teal header/hero, lime-green primary actions, product photography on white/pale-gray). That file remains the visual authority; this document does not restate or override it.
- Reference/legacy source for content and brand facts: `https://wataniandsons.com/` and `https://wataniandsons.com/palestinian-products-in-canada/`.
- Business contact details (verified): 300 Greenbank Rd, Ottawa, ON K2H 0B6 · +1 613-854-7777 · Info@wataniandsons.com.

## Evidence on Hand

- `requirement.md` (repo root) - full v0.2 draft requirements: user groups, pricing engine spec with worked example, storefront/admin functional requirements, integration contracts, non-functional requirements, assumptions, and consolidated open questions.
- `watani-b2c-service/README.md` - implemented backend architecture, resolved open-question table, provider configuration, endpoint reference, and explicit "Not implemented" list.
- `watani-b2c-website/DESIGN.md` - full visual/implementation spec for the storefront (tokens, layout, page-by-page component behavior, motion system), including reference product/price fixtures scraped from wataniandsons.com. Prices and availability there are fixtures only; the commerce backend is the source of truth.
- Backend seed data: `V4__seed_catalogue.sql` - the 24 products the storefront currently renders.
- No confirmed testimonials, case studies, or press exist; do not fabricate them.

## Product Principles

1. One catalogue, one pricing engine - retail and B2B buyers are served from the same product data, differentiated only by server-resolved group pricing, never by client logic or duplicated content.
2. Never trust the client for price or tier - every price is re-resolved and re-validated server-side, at cart-change and again at checkout.
3. Providers are swappable by configuration - payment (Stripe) and shipping (ClickShip) integrations stay behind their interfaces; provider-specific concerns never leak into checkout/order logic.
4. Retail is the safety net - every sellable product must have a retail price, and any unmet B2B condition (MOQ, unapproved tier) falls back to it rather than blocking the purchase.
5. The storefront visual world (DESIGN.md) is the default, retail-facing presentation; B2B/admin surfaces are functional and permission-gated but are not required to match the consumer storefront's visual spec.

## Accessibility & Inclusion

WCAG 2.1 AA required across the storefront (mobile-first, responsive phone/tablet/desktop). Admin dashboard access is restricted per-permission with audit logging on sensitive actions (role/group changes, price changes, customer impersonation).
