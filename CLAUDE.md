# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

This is a monorepo with two independently-run projects and no root build orchestration (no root `package.json`/Makefile - always `cd` into the relevant project first):

- `watani-b2c-service/` - Spring Boot 3.5 (Java 21, Maven) REST API: catalogue, group-tiered pricing, cart, checkout, orders, admin. See `watani-b2c-service/README.md` for the full picture - layout, endpoint table, provider config, and non-obvious decisions. Don't duplicate it from memory; read it.
- `watani-b2c-website/` - Next.js 16 (App Router, Turbopack, React 19, TypeScript, Tailwind v4) storefront + admin + B2B portal frontend. See `watani-b2c-website/README.md` and `watani-b2c-website/AGENTS.md` (this Next.js version has breaking changes from what you may know - `params`/`searchParams` are Promises; check `node_modules/next/dist/docs/` before assuming an API).
- `requirement.md` (root) - the authoritative v0.2 requirement spec (user groups, pricing engine rules `R-*`/`F-*`/`N-*`, open questions `OQ-*`). Code comments reference these IDs directly.
- `PRODUCT.md` (root) - condensed product framing: audiences, scope, resolved vs. still-open questions. Useful for "why does this rule exist" context.
- `design.md` (root) - the storefront's visual/motion implementation spec (tokens, layout, page-by-page component behavior). This is what `PRODUCT.md` refers to as `DESIGN.md`; that file doesn't exist under `watani-b2c-website/` - the root `design.md` is the real one.

There is no CI config, Dockerfile, or deploy script currently checked into the repo - deploy tooling was removed on `main`; don't assume containerized deploy exists unless you re-add it.

## Commands

### Backend (`watani-b2c-service/`)

```bash
# Local dev (requires local PostgreSQL; creates/uses `watani_b2c` DB, Flyway migrates automatically)
./mvnw spring-boot:run -Dspring-boot.run.profiles=local

# Default profile (targets a local postgres/admin login unless overridden)
./mvnw spring-boot:run

# All tests (needs a separate `watani_b2c_test` DB - never point tests at `watani_b2c`)
./mvnw test

# Single test class / method
./mvnw test -Dtest=PricingEngineTest
./mvnw test -Dtest=PricingEngineTest#someMethodName

# Build
./mvnw package
```

Swagger UI at `/swagger-ui.html` once running (`http://localhost:8080/swagger-ui.html`). Health at `/api/health` and `/actuator/health`.

Key env vars (see `watani-b2c-service/README.md` for the full table): `SPRING_DATASOURCE_URL/USERNAME/PASSWORD`, `CORS_ALLOWED_ORIGINS`, `JWT_SECRET`, `PAYMENT_PROVIDER` (`stripe`/`stub`), `STRIPE_API_KEY`, `STRIPE_WEBHOOK_SECRET`, `SHIPPING_PROVIDER` (`freightcom`/`clickship`/`stub`), `SEED_ADMIN` (seeds `admin@watani.local` - dev/local only, must be off in production).

### Frontend (`watani-b2c-website/`)

```bash
npm install
cp .env.example .env.local   # sets NEXT_PUBLIC_API_BASE_URL, default http://localhost:8080

npm run dev     # dev server with hot reload, http://localhost:3000
npm run build   # production build
npm run start   # serve production build
npm run lint    # ESLint
```

There is no frontend test runner configured (no `test` script, no Jest/Vitest/Playwright dependency) - don't invent one; verify frontend changes by running the dev server and checking the browser.

The frontend falls back to fixture data in `src/lib/catalogue.ts` if the backend is unreachable (logs a warning, never silent) - so it renders standalone, but real pricing/cart/checkout behavior needs the backend running.

## Architecture

### The pricing engine is the core domain concept

Nearly every other decision in this codebase (caching, page rendering mode, cart validation, DTO shape) exists to protect one rule: **price is always resolved server-side as a function of (buyer's pricing group, line quantity), never trusted from the client.**

- Pricing groups: `ADMIN` (no purchasing), `DISTRIBUTOR`, `WHOLESALE`, `RETAIL` (default/fallback for everyone, including guests).
- Each product/variant has a `PriceTier` per group, optionally multiple rows per group for quantity breaks (e.g. Wholesale 10+/50+); the cheapest qualifying row wins.
- If a buyer's tier minimum-order-quantity isn't met, the line falls back to **retail**, not an intermediate tier - this is an explicit, confirmed rule (`R-PR-3` / `OQ-2`), not a bug.
- Tier prices are tax-exclusive; tax is applied at checkout, everything is priced/charged in CAD regardless of destination.
- Distributor/Wholesale accounts are treated as Retail until admin-approved.
- Implementation lives in `watani-b2c-service/src/main/java/com/watani/b2c/service/pricing/` - read `PricingEngineTest` for the worked example before changing this code.
- Because of this rule, catalogue/home pages in the Next.js app are `force-dynamic` rather than statically generated (baking in a price at build time could leak wholesale pricing to a retail visitor), and backend cache keys must include the pricing group (`Vary: Authorization` is set by a dedicated filter, `config/VaryHeaderFilter`, since Spring's own CORS handling writes `Vary` too late and would otherwise overwrite it).

### Backend structure (`watani-b2c-service/src/main/java/com/watani/b2c/`)

```
domain/          # JPA entities, grouped by bounded concept (catalogue, pricing, cart, order, user, promo, ...)
repository/      # Spring Data repositories
service/
  pricing/       # PricingEngine - requirement.md §3
  catalogue/     # storefront reads and DTO mapping
  cart/          # cart lifecycle, guest-cart merge on login
  order/         # checkout, fulfilment, shipping, tax
  admin/         # catalogue/price administration, bulk Excel import
  report/        # dashboard KPIs and sales reports
integration/     # PaymentProvider / ShippingProvider interfaces + implementations (Stripe, Freightcom, ClickShip, stub)
security/        # JWT auth, principal, authority mapping
config/          # security, CORS, JPA auditing, Vary header, storage
web/             # storefront + admin controllers, DTOs, error handling
```

Notable, easy-to-relitigate decisions (don't undo without re-reading why):

- **Entity collections are `Set`, not `List`.** Hibernate can't join-fetch two bag (List) collections in one query, and a bag join silently multiplies rows - this previously caused a cart line to be charged multiple times over.
- **Payment/shipping only ever go through `PaymentProvider`/`ShippingProvider`** (`integration/`). The active implementation is chosen by config (`watani.payment.provider`, `watani.shipping.provider`), never by code change - adding a provider must not touch checkout/order logic.
- **`spring.jpa.hibernate.ddl-auto` is `validate`** - schema changes belong in a new Flyway migration (`src/main/resources/db/migration/V{n}__*.sql`), never in entity annotations alone.
- **BouncyCastle is a required runtime dependency** for `Argon2PasswordEncoder` (password hashing); don't remove it as an apparently-unused transitive dep.
- **Stock decrements take a pessimistic write lock** so concurrent checkouts can't oversell the same unit.
- Admin authorization is permission-based (`PERM_*` via `@PreAuthorize`), not role-name-based, so admin responsibilities can be sub-divided by data rather than by code.
- `SecurityConfig` denies by default; a new endpoint is private unless explicitly permitted - check `authorizeHttpRequests` when adding routes.

### Frontend structure (`watani-b2c-website/src/`)

```
app/
  (storefront)/    # home, categories, product/[slug], cart, checkout, login, account, wishlist
  admin/            # catalogue, master-data, stock, orders, customers, coupons, reviews, content, audit
  portal/           # logged-in buyer profile + order history/detail
  review/[orderNumber]/
components/         # grouped by feature area (cart, category, home, layout, product, admin, checkout, auth, wishlist, dashboard, notifications)
lib/
  api.ts            # fetch wrapper for the backend
  products.ts       # catalogue access layer - the only place UI should read catalogue data from
  catalogue.ts       # offline seed fixtures (fallback only, see above)
  cart.ts, checkout.ts, auth.ts, wishlist.ts, rich-text.ts, motion.ts, types.ts
  admin/, portal/, review/  # feature-scoped API/data helpers
```

Note: `watani-b2c-website/README.md`'s route table only lists the original four public routes (`/`, `/categories`, `/product/[slug]`, `/cart`); the app has since grown admin, portal, checkout, login, account, wishlist, and review routes not reflected there - trust the `app/` directory over that table.

- All catalogue reads go through `src/lib/products.ts`, which calls the backend so prices are always the ones the backend resolved for the caller's pricing group - never compute or cache a price client-side.
- Framer Motion can't interpolate `var(--token)` CSS custom properties for colors/shadows, and `AnimatePresence mode="wait"` can leave outgoing UI mounted if the exit animation never settles - color/shadow transitions use plain CSS, and list swaps use a keyed remount instead of `AnimatePresence`.
- The cart's Checkout button completion currently depends on Stripe credentials being configured - the backend endpoint exists and is tested even when the UI path isn't fully wired end-to-end locally.

## Cross-cutting

- `requirement.md` IDs (`R-PR-3`, `F-ADM-3`, `N-SCL-5`, `OQ-2`, etc.) are referenced directly in code comments and commit messages in this repo - when a change touches a rule with an ID, keep referencing it so intent stays traceable.
- Both services independently fall back gracefully when their counterpart or a third-party provider is unavailable - the frontend serves fixture data, and shipping/payment providers degrade rather than block checkout (e.g. flat-rate shipping if live quoting fails). Preserve this pattern rather than introducing hard failures.
