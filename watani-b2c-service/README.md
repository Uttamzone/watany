# watani-b2c-service

Spring Boot 3 backend for the Watani B2C shopping site - catalogue, group-tiered
pricing, cart, checkout, orders, and the admin surface described in
`requirement.md`.

- **Spring Boot** 3.5.3 (Java 21, Maven)
- **Spring Security** with JWT bearer tokens and Argon2id password hashing
- **Spring Data JPA + PostgreSQL**, schema managed by **Flyway**
- **Stripe** (payments) and **ClickShip** (shipping) behind provider interfaces
- **Resilience4j** retries and circuit breakers on external calls
- **springdoc-openapi** - Swagger UI at `/swagger-ui.html`

## Running

**Local development against PostgreSQL** - migrations and seed data run normally:

```bash
./mvnw spring-boot:run -Dspring-boot.run.profiles=local
```

> If startup fails with `IOException: Unable to establish loopback connection`,
> another instance is already holding port 8080 - check before starting a second
> one, since the error names the socket rather than the port conflict.

**Against PostgreSQL** (the default profile) - create the database if it does not exist:

```sql
CREATE DATABASE watani_b2c;
```

```bash
./mvnw spring-boot:run
```

The defaults target a local `postgres` / `admin` login. Any other environment should
override them rather than rely on those values - for example, in PowerShell:

```bash
$env:SPRING_DATASOURCE_PASSWORD = "<password>"; ./mvnw spring-boot:run
```

The service listens on `http://localhost:8080`.

## Tests

```bash
./mvnw test
```

Tests run against the dedicated PostgreSQL database `watani_b2c_test` with
Flyway enabled. Create it before the first run; never point tests at `watani_b2c`.

- `PricingEngineTest` - the §3.3 worked example plus MOQ fallback, quantity
  breaks, and scheduled pricing
- `CatalogueApiTest` - group-resolved pricing, tier isolation between groups, caching headers
- `CheckoutFlowTest` - cart totals, stock decrement, idempotent placement, order access control
- `StorefrontContractTest` - guards the JSON field names the Next.js site maps

## Pricing engine

The most business-critical part of the service (`service/pricing/PricingEngine`).
Resolution follows requirement.md §3:

- Price is a function of *(buyer's group, line quantity)*, evaluated **per cart line**.
- If the buyer's tier minimum quantity is not met, the line falls back to **retail** -
  not to an intermediate tier (R-PR-3, resolving OQ-2).
- Multiple rows per group express quantity breaks such as 10+ / 50+ (OQ-3); the
  cheapest qualifying row wins.
- A retail tier is mandatory and validated on write (R-PR-4).
- Prices are always re-resolved server-side, including at checkout (R-PR-6).

Open questions were resolved with the spec defaults and are marked in code:

| ID   | Resolution                                                                       |
|------|----------------------------------------------------------------------------------|
| OQ-1 | Business fields collected at registration; approval gates the tier               |
| OQ-2 | Unmet MOQ falls back to **retail**                                               |
| OQ-3 | Multiple quantity breaks per group **supported**                                 |
| OQ-4 | Tier prices are **tax-exclusive**; tax applied at checkout                       |
| OQ-5 | An **account is required** to place an order; guests may browse and build a cart |
| OQ-7 | Not implemented - per-customer negotiated pricing is a model change              |
| OQ-8 | Not implemented - credit terms / PO invoicing for B2B                            |

## Providers

Payment and shipping are used only through `PaymentProvider` and
`ShippingProvider` (R-INT-1, R-INT-2). The active implementation is chosen by
configuration, never by code change (R-INT-3):

```yaml
watani:
  payment:
    provider: stripe  # use `stub` only for explicit tests
  shipping:
    provider: stub    # or `clickship`
```

Stripe is the payment default so a missing setting can never silently approve an
unpaid order. The local `.env` file is imported automatically and must contain a
secret API key plus a webhook signing secret. The `stub` provider remains
available only when explicitly selected for tests.

If live rate quoting fails, checkout degrades to a flat rate rather than blocking
the customer (R-INT-5).

## Email

Transactional email goes through one seam, `service/notification/EmailService`,
rather than each feature touching `JavaMailSender`. It builds the message
(plain-text plus HTML alternative, optional attachments), applies the configured
sender identity, and sends on a bounded pool off the request thread.

`OrderEmailService` composes the customer-facing order mail on top of it:

- **Order confirmation with the invoice PDF attached** (F-ACC-5), sent once per
  order at the moment it is actually placed. That is the Stripe `CAPTURED`
  webhook for the redirect flow, and inline in `CheckoutService` for providers
  that capture immediately or for E-Transfer/Cheque - exactly one of those paths
  fires per order, and only on the transition into `PAID`, so a replayed webhook
  cannot email a second invoice.
- **Payment received**, the shorter note sent when an admin manually verifies an
  E-Transfer/cheque (F-ADM-8). Deliberately not a second copy of the invoice.

Sends are queued for *after* the placing transaction commits, so mail is never
sent for an order a later failure rolls back. A send failure is logged and
swallowed: a mail host being down must never fail or roll back a paid order, the
same degrade-rather-than-block posture the payment and shipping providers take
(R-INT-5). With `MAIL_ENABLED=false`, or no mail host configured, every send
becomes a logged no-op - that is how the test suite runs.

SMTP settings live on Spring's own `spring.mail.*`; only sender identity and the
switches are under `watani.notification.email.*`. Port 465 is implicit SSL
(SSL-on-connect), not STARTTLS - moving to 587 also means flipping
`MAIL_SMTP_SSL_ENABLE`/`MAIL_SMTP_STARTTLS_ENABLE` (env vars overriding
`mail.smtp.ssl.enable`/`starttls.enable` in `application.yml`). Needed on
Hetzner: outbound 465 is blocked at the network level (confirmed against two
unrelated hosts), 587 works.

> Do **not** quote values in `.env`. Spring imports it via
> `config.import: optional:file:.env[.properties]`, and Java `.properties`
> parsing keeps the quotes as part of the value - a quoted password authenticates
> with the quotes attached and fails with a misleading `535`. Special characters
> such as `&` need no quoting there. (Sourcing the same file into a shell *does*
> need quotes, so prefer letting Spring read it rather than `source .env`.)

## Configuration

Overridable via environment variables (see `src/main/resources/application.yml`):

| Variable                     | Default                                       |
|------------------------------|-----------------------------------------------|
| `SERVER_PORT`                | `8080`                                        |
| `SPRING_DATASOURCE_URL`      | `jdbc:postgresql://localhost:5432/watani_b2c` |
| `SPRING_DATASOURCE_USERNAME` | `postgres`                                    |
| `SPRING_DATASOURCE_PASSWORD` | `admin`                                       |
| `CORS_ALLOWED_ORIGINS`       | `http://localhost:3000`                       |
| `JWT_SECRET`                 | development value - **must** be overridden    |
| `PAYMENT_PROVIDER`           | `stub`                                        |
| `STRIPE_API_KEY`             | empty                                         |
| `STRIPE_WEBHOOK_SECRET`      | empty                                         |
| `SHIPPING_PROVIDER`          | `stub`                                        |
| `CLICKSHIP_API_KEY`          | empty                                         |
| `SHIPPING_FLAT_RATE`         | `30.00`                                       |
| `MAIL_ENABLED`               | `true` (forced off in tests)                  |
| `MAIL_HOST`                  | `mail.webtraining.cloud`                      |
| `MAIL_PORT`                  | `465` (implicit SSL)                          |
| `MAIL_SMTP_SSL_ENABLE`       | `true` - set `false` when using 587           |
| `MAIL_SMTP_STARTTLS_ENABLE`  | `false` - set `true` when using 587           |
| `MAIL_USERNAME`              | `info@wataniandsons.com`                      |
| `MAIL_PASSWORD`              | empty - set in `.env`, quote if it has `&`    |
| `MAIL_FROM` / `MAIL_FROM_NAME` | `info@wataniandsons.com` / `Watani & Sons Corp`  |
| `STOREFRONT_BASE_URL`        | `http://localhost:3000`                       |

> The committed datasource and JWT defaults are local development values. Override
> them in every deployed environment and keep real secrets in a managed secret
> store (N-SEC-6).

## Endpoints

Full reference at `/swagger-ui.html`. Storefront surface:

| Method | Path                                    | Description                           |
|--------|-----------------------------------------|---------------------------------------|
| `POST` | `/api/auth/register`, `/api/auth/login` | Account creation and sign-in          |
| `GET`  | `/api/catalogue/products`               | Search, filter, sort; group-priced    |
| `GET`  | `/api/catalogue/products/{slug}`        | Product detail                        |
| `GET`  | `/api/cart`, `POST /api/cart/items`     | Cart with live price resolution       |
| `POST` | `/api/checkout`                         | Idempotent order placement            |
| `GET`  | `/api/orders`, `/api/orders/{number}`   | Order history and tracking            |
| `POST` | `/api/webhooks/payment`, `/shipping`    | Signature-verified provider callbacks |

Admin surface under `/api/admin/**`, authorised per-permission (`PERM_*`) rather
than by role name, so roles are data rather than code (R-UG-4).

## Layout

```
src/main/java/com/watani/b2c/
├── domain/          # JPA entities: catalogue, pricing, cart, order, user, promo
├── repository/      # Spring Data repositories
├── service/
│   ├── pricing/     # PricingEngine - requirement.md §3
│   ├── catalogue/   # storefront reads and DTO mapping
│   ├── cart/        # cart lifecycle and guest-cart merge
│   ├── order/       # checkout, fulfilment, shipping, tax
│   ├── admin/       # catalogue and price administration
│   └── report/      # dashboard KPIs and sales reports
├── integration/     # PaymentProvider / ShippingProvider + implementations
├── security/        # JWT, principal, authority mapping
├── config/          # security, CORS, JPA auditing, Vary header
└── web/             # storefront and admin controllers, DTOs, error handling
src/main/resources/db/migration/
├── V1__init.sql, V2__core_schema.sql
├── V3__seed_roles.sql       # roles and permissions
└── V4__seed_catalogue.sql   # the 24 products the storefront renders
```

## Notes on non-obvious decisions

- **Collections are `Set`, not `List`.** Hibernate cannot join-fetch two bag
  (List) collections in one query, and a bag join silently multiplies rows - a
  cart line was being counted once per price tier and charged four times over.
- **`Vary: Authorization` is applied by a filter** (`config/VaryHeaderFilter`),
  because Spring's CORS handling writes `Vary` after the controller returns and
  would otherwise overwrite it. Without it a shared cache could serve wholesale
  pricing to a retail shopper (N-SCL-5).
- **BouncyCastle is a required runtime dependency** - `Argon2PasswordEncoder`
  delegates to it, and password hashing fails at runtime without it.
- **Stock decrements take a pessimistic write lock** so two concurrent checkouts
  cannot both claim the last unit (N-SCL-11).
- `spring.jpa.hibernate.ddl-auto` is `validate`; schema changes belong in Flyway
  migrations.

## Not implemented

Scope from `requirement.md` deliberately left out, and why:

- Real Stripe/ClickShip traffic needs client credentials (§8 assumption 5).
- Email delivery, 2FA, social login (OQ-6), and email verification flows.
- Dedicated search index (N-SCL-7) - filtering is SQL-backed, adequate at this
  catalogue size and isolated behind `ProductSpecifications`.
- Redis caching, CDN, autoscaling and load testing (§7.2) - infrastructure
  concerns rather than application code.
- Per-customer negotiated pricing (OQ-7) and B2B credit terms (OQ-8).
