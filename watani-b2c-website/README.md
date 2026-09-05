# watani-b2c-website

Next.js storefront for the Watani B2C shopping site.

Implements the Watani & Sons Palestinian marketplace storefront described in
`design.md` - home, all-category, product detail, and cart routes.

- **Next.js** 16.2.12 (App Router, Turbopack) with **React** 19
- **TypeScript**, **Tailwind CSS** v4, **ESLint**
- **Framer Motion** for motion, **lucide-react** for icons
- Source under `src/`, `@/*` import alias

## Routes

| Route             | Rendering | Description                                          |
| ----------------- | --------- | ---------------------------------------------------- |
| `/`               | Static    | Hero, category rail, product grids, offers, tabs, banners, services |
| `/categories`     | Dynamic   | Offer cards, filter toolbar, sorting, product grid    |
| `/product/[slug]` | SSG       | Gallery, purchase panel, related products, JSON-LD    |
| `/cart`           | Static    | Line editing, quantities, order summary               |

## Getting started

```bash
npm install
```

Point the app at the backend by copying the example env file:

```bash
cp .env.example .env.local
```

Then run the dev server:

```bash
npm run dev
```

The site runs at `http://localhost:3000`. The home page calls `watani-b2c-service`
and reports whether it is reachable - start the backend to see a connected status.

## Scripts

| Command         | Description                        |
| --------------- | ---------------------------------- |
| `npm run dev`   | Dev server with hot reload         |
| `npm run build` | Production build                   |
| `npm run start` | Serve the production build         |
| `npm run lint`  | ESLint                             |

## Configuration

| Variable                   | Default                 | Description                    |
| -------------------------- | ----------------------- | ------------------------------ |
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:8080` | Base URL of `watani-b2c-service` |

`NEXT_PUBLIC_`-prefixed values are inlined into the client bundle at build time, so
set this appropriately for each environment you build.

## Layout

```
src/
├── app/
│   ├── layout.tsx           # root layout, fonts, cart provider, header/footer
│   ├── page.tsx             # home
│   ├── globals.css          # design tokens (@theme) and base styles
│   ├── categories/page.tsx  # all-category page
│   ├── product/[slug]/      # product detail
│   ├── cart/page.tsx
│   ├── sitemap.ts / robots.ts
├── components/
│   ├── cart/        # cart context + cart view
│   ├── category/    # filter toolbar, catalogue browser
│   ├── home/        # hero, rails, sections, banners
│   ├── layout/      # site header and footer
│   └── product/     # card, price, quantity control, gallery, purchase panel
└── lib/
    ├── api.ts       # fetch wrapper for the backend
    ├── catalogue.ts # seed product fixtures
    ├── products.ts  # catalogue access layer (swap for API calls)
    ├── motion.ts    # shared motion tokens
    └── types.ts     # Product/Category types and price helpers
```

Product artwork in `public/products` and `public/art` is generated SVG standing in
for real photography; replace it with the client's assets when supplied.

## Data layer

The UI reads the catalogue only through `src/lib/products.ts`, which calls
`watani-b2c-service`. The backend resolves prices for the caller's pricing group
(requirement.md §3), so the storefront renders the price the visitor is entitled
to and never computes one itself.

Start the backend first:

```bash
cd ../watani-b2c-service && ./mvnw spring-boot:run -Dspring-boot.run.profiles=local
```

If the service is unreachable, the seed fixtures in `src/lib/catalogue.ts` are
served instead so the site still renders during frontend-only work. That fallback
logs a warning - it is never silent.

Home and product pages are `force-dynamic` rather than prerendered: baking prices
in at build time would serve retail pricing to wholesale and distributor
customers (N-SCL-5).

The cart's Checkout button is still disabled here - the backend checkout endpoint
exists and is tested, but the payment step needs Stripe credentials before the UI
can complete an order.

## Notes

- `npm audit` reports advisories from transitive **dev** dependencies only
  (`brace-expansion`/`minimatch` under ESLint, `postcss` under the Tailwind
  toolchain). None ship in the runtime bundle; the offered fix is a breaking ESLint
  major, so they are left as-is.
- This Next.js version has breaking changes from earlier releases - notably `params`
  and `searchParams` are Promises. See `AGENTS.md` and `node_modules/next/dist/docs/`.
- Framer Motion cannot interpolate `var(--token)` colours or shadows, and an
  `AnimatePresence mode="wait"` whose exit never settles can leave the outgoing UI
  mounted. Colour/shadow transitions here are therefore plain CSS, and list swaps
  use a keyed remount rather than `AnimatePresence`.
