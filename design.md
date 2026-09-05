# Watani & Sons Palestinian Marketplace - Implementation Specification

## 1. Goal

Recreate the shopping website shown in `original-c81c56245856e105c75424cf9a958366.mp4` as closely as possible, rebranded for **Watani & Sons Corp** and populated with authentic Palestinian products sold in Canada. Match the reference video’s visual hierarchy, proportions, colors, imagery style, spacing, page states, and motion. The result must feel like the same polished commerce product-not a generic store template.

Content and catalog facts in this specification were adapted from:

- `https://wataniandsons.com/`
- `https://wataniandsons.com/palestinian-products-in-canada/`

Use **Watani & Sons Corp** for the website identity. Preserve **WATANY** capitalization where it forms part of an official product name. Product availability and prices must ultimately come from the commerce backend; the values below are reference fixtures captured from the source website and may change.

The reference is a 35-second design showcase containing these website states:

1. Desktop home page and full-page overview
2. Header, hero, categories, and product grid
3. Product add/remove quantity interactions
4. Product detail page with gallery and purchasing actions
5. Promotional banners and best-selling/just-for-you sections
6. Services strip and footer
7. All-category page with promotional cards, filters, sorting, and products

The opening split-screen and some later zooms are presentation/camera effects. Implement them only as an optional showcase mode; the normal website must remain directly usable.

## 2. Recommended stack

- Next.js 15+ with App Router and TypeScript
- Tailwind CSS or CSS Modules with CSS custom properties for tokens
- Framer Motion for route/section transitions and the optional showcase sequence
- Lucide React icons, replacing only icons for which an exact custom SVG is not supplied
- Zustand or React Context for cart state
- `next/image` for product and promotional imagery
- Local fixture data initially; keep the data layer replaceable by an API

Required routes:

- `/` - home
- `/categories` - all-category/catalog page
- `/product/[slug]` - product detail
- `/cart` - functional cart shell or drawer

## 3. Visual direction

The interface is bright, soft, clean, and product-led. Large amounts of warm off-white space surround white cards. Deep teal anchors the header and headings. Acid/lime green is reserved for primary actions and selected cart controls. Product photography is isolated on white or pale-gray backgrounds.

Do not add gradients, glassmorphism, heavy drop shadows, or blue default-link styling. Borders are faint; separation comes primarily from spacing and background changes.

## 4. Design tokens

Use these tokens as the starting point, then tune against screenshots from the reference:

```css
:root {
  --color-teal-950: #003b38;
  --color-teal-900: #004f4b;
  --color-teal-800: #075b56;
  --color-lime-500: #a9eb5a;
  --color-lime-400: #b7f36a;
  --color-canvas: #f3f6f4;
  --color-warm-canvas: #fffaf0;
  --color-surface: #ffffff;
  --color-soft-control: #f1f5eb;
  --color-text: #062f2d;
  --color-muted: #7d8380;
  --color-coral: #df665b;
  --color-gold: #f3bb36;
  --color-navy: #0b4b83;
  --color-burgundy: #761047;
  --color-rust: #b8401d;
  --color-purple: #66246d;
  --radius-sm: 10px;
  --radius-md: 16px;
  --radius-lg: 24px;
  --radius-xl: 32px;
  --shadow-card: 0 8px 24px rgba(0, 48, 45, 0.045);
  --content-width: 1228px;
}
```

Typography:

- Use `Inter`, `Manrope`, or the closest provided geometric sans-serif.
- Body weight: 400–500.
- Navigation and buttons: 600.
- Section titles: 700–800.
- Prices: 700–800 with deliberately compact decimal/currency formatting.
- Desktop section title: 34–42 px depending on viewport.
- Product title: 20–24 px.
- Product price: 36–44 px.
- Body: 15–17 px.

Use slightly tight heading letter spacing (`-0.02em`) and normal body spacing.

## 5. Global layout

- Desktop reference viewport is approximately 1376 px wide for the webpage content shown inside the video.
- Main content maximum width: 1228 px.
- Center the site with 24–32 px outer gutters.
- Header top offset: 16 px on desktop.
- Major section spacing: 72–104 px.
- Product-grid gap: 16–20 px.
- Home and catalog grids: five columns on wide desktop.
- Background: pale cool gray on the main home/catalog views; some merchandising sections use warm cream.

Breakpoints:

- `>= 1200`: five product columns; full header; two-column banners and product detail.
- `900–1199`: four product columns; reduce header message width.
- `640–899`: two product columns; collapse menu/search; stack product detail.
- `< 640`: two compact product columns where usable, otherwise one; edge gutters 16 px; horizontal scroll for category chips and thumbnail rails.

Never scale the entire desktop canvas down on mobile. Reflow components while preserving their identity.

## 6. Persistent header

Create a rounded deep-teal header with approximately 16–18 px corner radius and 70–84 px desktop height.

Left to right:

1. Hamburger icon
2. Watani & Sons logo/wordmark; do not redraw or alter an official supplied logo
3. Long white pill search field with placeholder `Search olive oil, zaatar, cheese, ceramics…`
4. Yellow olive-leaf or delivery icon and message `Authentic Palestinian products across Canada`
5. White circular cart button with a small coral count badge
6. Circular profile image with a decorative green/yellow rim

Behavior:

- Header becomes sticky after scrolling past the hero.
- Sticky transition: 240 ms, background remains opaque, subtle `0 8px 24px rgba(0,40,38,.08)` shadow appears.
- Search expands/focuses with a 180 ms border/color transition.
- Cart badge uses a small spring scale when quantity changes.
- Hamburger opens a left drawer with categories and account links.
- On tablet/mobile, hide the delivery sentence first, then move search to a full-width row below the top controls.

## 7. Home page

### 7.1 Hero

Large deep-teal rounded rectangle beneath the header. Its bottom edge has a subtle shallow concave/wave cut rather than a perfectly straight line.

Left side:

- Heading: `A taste of Palestine\ndelivered in Canada`
- Supporting copy: `Shop seasonal Palestinian olive oil, olives, zaatar, grains, cheese, ceramics, and more-sourced through trusted farmers and producers.`
- Lime button: `Shop Palestinian products`

Right side:

- Large branded shipping crate or reusable bag filled with olive-oil tins, zaatar, olives, grains, cheese, and Palestinian pantry products.
- Faint line-art food illustrations decorate the teal background.

Desktop proportions:

- Hero height: 380–420 px.
- Copy occupies 42%; artwork occupies 48%.
- Heading: 48–58 px, white, bold.
- Button: roughly 160 × 50 px, 8–10 px radius.

Hero entrance:

- Container fades from opacity 0 and `translateY(18px)` over 500 ms.
- Copy children stagger by 70 ms.
- Product hamper enters from `translateX(40px) scale(.96)` over 650 ms with `cubic-bezier(.16,1,.3,1)`.
- Decorative line art fades in last.

### 7.2 Category shortcut rail

One row of five white category cards plus a narrow lime `See all` card:

- Olive Oil - `Palestinian harvest`
- Olives - `Jenin & regional varieties`
- Zaatar - `Herbs and blends`
- Cheese - `Nabulsi selection`
- Ceramics - `Palestinian craft`
- `See all` with a white circular arrow

Cards contain text on the left and a colorful flat food illustration on the right. Height is about 120 px. Use 12–14 px radii and no noticeable shadow.

On narrow screens, make this rail horizontally scrollable with snap points.

### 7.3 “You might need” product grid

Header row:

- Left: `You might need`
- Right: coral `See more  →`

Use five equal product cards per desktop row. Each card contains:

1. Centered cutout product image
2. Two-line centered title
3. Muted pack-size label from product data, such as `750ML`, `1.2kg × 6`, `5KG`, or `16L`
4. Large dark-teal price
5. Full-width soft-green add control at the bottom

Verified Watani & Sons reference products/copy:

| Display name | Category / pack | Reference price (CAD) |
|---|---|---:|
| WATANY Olive Oil - Tulkarm | Olive Oil · 16L | $379.50 |
| Zaatar Hyssop (Balat) | Herb · 100g × 6 | $31.74 |
| Palestinian Zaatar Sampler Combo | Zataar · 500RM × 6 | $64.17 |
| WATANY “A Taste of Palestine” Combo | Olive Oil · 1L × 6 tins | $169.05 |
| Asliah Nabulsi Cheese | Cheese · 5KG | $103.50 sale |
| Palestinian Farmers Community Virgin Olive Oil | Olive Oil · 16L | $293.25 |
| WATANY Olive Oil - Tulkarm | Olive Oil · 1L | $23.46 sale |
| Baladia Nabulsi Cheese | Cheese · 10KG | $158.70 sale |
| Green Baladi Olives - Jenin | Olives · 1.2kg × 6 | $124.20 |
| Palestinian Zaatar Mix Extra - Qalqilya | Zataar · 500g × 6 | $68.10 |

Use the shortened display names above to preserve the two-line card composition. Store and expose the complete official product title in the product record, product detail page, tooltip, and accessible name.

Preserve the reference’s unusual price hierarchy while using Canadian convention: a small `$` prefix, large whole number, baseline dot, and smaller raised cents. Mark sale prices with the original price struck through above or beside the current price.

Product-card behavior:

- Hover: image moves up 6 px and scales to 1.035 over 220 ms; card shadow subtly strengthens.
- Initial control: centered plus icon on a softly curved/wavy pale panel.
- Clicking plus morphs the panel to bright lime and replaces it with circular minus, quantity, and circular plus controls.
- Morph duration: 260 ms; quantity changes scale `1 → 1.16 → 1` with a short spring.
- Cart badge updates simultaneously.
- When quantity reaches zero, return to the single-plus state.
- Images and titles navigate to the detail page.

### 7.4 Promotional offer cards

Create four tall cards in one desktop row:

1. Pink/burgundy - `Save $29`
2. Peach/rust - `Discount 30%`
3. Light blue/navy - `Up to 50%`
4. Lavender/purple - `Free SHIP`

Each is split into a pale top copy region and a richly colored lower image region with a soft curved boundary. Add a thin line icon in the top-right. Use product cutouts and decorative botanical/food line art below.

Cards lift 5 px on hover. Product images shift upward 4 px with a 260 ms ease-out.

### 7.5 Weekly best-selling items

Section heading: `Weekly best selling items`, with `See more →` on the right.

Below it, a horizontally scrollable pill tab list:

- Olive Oil
- Olives
- Cheese
- Zaatar
- Spices & Grains
- Ghee
- Ceramics
- Beauty Care

Selected tab is deep teal with white text; unselected tabs are white. Tab transition is 180 ms. Changing tabs crossfades and slightly raises the five-card product grid (`opacity 0 → 1`, `y: 8 → 0`, 240 ms). Default to `Olive Oil`, showing regional and pack-size variants such as Al Quds, Jenin, Ramallah, Tulkarm, and Palestinian Farmers Community oils.

### 7.6 Delivery/membership banners

Two landscape cards in a two-column layout:

- Navy: label `Free delivery`; copy `Get up to 50% off / Delivery by 12:15pm / Fast and free`; gift-box artwork.
- Rust: label `Membership Card`; copy `You can enjoy a 5% / discount using our / health card`; alarm-clock artwork.

Use 24–28 px radii and large colored typography. Stack the cards on mobile.

### 7.7 “Just for you”

Same five-column product-card system on a warm-cream section background.

Verified reference products include:

- Al Quds olive oil - one bottle 750 ml - $36.57
- Jenin olive oil - one bottle 750 ml - $26.22
- Bowl, medium size - $26.91
- Oil Bottle, Olives Design - $37.26
- Oil Bottle, Tree Design - $41.40

### 7.8 App/download banner

Large burgundy rounded banner with white headline `Stay Home and Get All Your Essentials From Our Market!`, app-store buttons, and a masked delivery worker carrying groceries on the right. It should feel embedded in the page, not like a modal.

### 7.9 Services strip

Full-width lime backdrop with a row of deep-teal tall cards. The visible reference cards are:

- `Pre-season olive oil orders`
- `Pickup across Canada`
- `Wholesale enquiries`
- `Direct from Palestinian farmers`

Use lime outline illustrations centered in the lower portions. Desktop cards form a broad horizontal rail; mobile should scroll horizontally.

### 7.10 Footer

Warm-cream footer with four/five columns.

Brand column:

- Watani & Sons mark
- Short paragraph: `Your trusted Canadian source for authentic Palestinian olive oil, pantry products, cheese, and traditional ceramics.`
- `Accepted Payments`
- Credit card and e-transfer marks; use the current official payment asset supplied by Watani & Sons rather than inventing unsupported providers

Link columns:

- Products: Olive Oil, Olives, Cheese, Ghee, Zaatar, Spices & Grains, Ceramics, Beauty Care
- Company: About Us, Community, Blog, Contact Us
- Services: Wholesale, Door-to-Door, Pickup, Pre-season Orders
- Help: Shop Help, Shipping Options, Order Status, Contact Us

Add the verified business details: `300 Greenbank Rd, Ottawa, ON K2H 0B6`, `+1 613-854-7777`, and `Info@wataniandsons.com`. Finish with a thin bottom utility row containing Terms, Privacy, and `© 2026 Watani and Sons Corp. All rights reserved.`

## 8. Product detail page

Keep the global header. Place the detail content in a large white rounded panel with generous padding and a two-column layout.

### Left/gallery column

- Pale-gray square image stage.
- Blue circular badge overlapping the top-left: use `EXTRA VIRGIN` / `PALESTINE`, or show a numeric discount only when supplied by product data.
- Large Ramallah extra-virgin olive-oil bottle/tin or case image.
- Four thumbnail buttons below, showing front, side/back, label detail, and pack/case variants.
- Active thumbnail has a coral underline/indicator.

Gallery behavior:

- Thumbnail click crossfades old/new image for 180 ms and scales the incoming image from `.985` to `1`.
- Active underline slides using layout animation.
- Desktop hover may provide a subtle 1.4× cursor-following product zoom inside the image stage; disable on touch.

### Right/information column

Top to bottom:

- Coral seasonal-arrival countdown with clock icon; hide it when there is no active pre-order deadline
- Muted vendor: `Watani & Sons Corp`
- Title: `Ramallah Olive Oil – 750ML × 12 Pack`
- Supporting line: `Authentic Extra Virgin Olive Oil from Palestine - WATANY`
- Gold star, `5.0 Rating`, and a linked review count only when returned by the backend
- Price: `$269.10 CAD`
- Divider
- Pale button with cart icon: `Add to cart`
- Lime button: `Buy now`
- Underlined actions: `ADD TO WISHLIST` and `Wholesale inquiry`
- Divider
- Three small circular attribute icons
- Flame icon and recent-sales text only when the backend provides a verified sales signal; otherwise omit this row without leaving empty space
- SKU from product data; never hard-code a fictitious value
- Underlined category links: `Olive Oil`, `olive oil 750ML`
- Short description emphasizing Palestinian origin, extra-virgin quality, regional harvest, and pack size; do not invent certifications or awards

Buttons should be approximately 190–210 px wide and 46–50 px high on desktop, with pill/soft-pill rounding.

Route transition from a product card:

- Keep duration under 420 ms.
- Fade the new page in while the product image uses a shared-layout transition where practical.
- Respect reduced-motion preferences by using a simple 120 ms fade.

## 9. All-category page

The final reference state is a catalog page with the same header.

Order of content:

1. Four promotional offer cards from section 7.4
2. Heading `Watani & Sons / All products`
3. Filter toolbar
4. Five-column product grid

Filter toolbar, left to right:

- Green filled `All Categories` dropdown
- Price dropdown
- Review dropdown
- Color dropdown
- Material dropdown
- Offer dropdown
- `All Filters` with sliders icon
- Flexible spacer
- Outlined `Sort by` dropdown

Interactions:

- Dropdowns open a white 16 px-radius popover with a subtle shadow and 8 px internal spacing.
- `All Filters` opens a right-side sheet on desktop and a bottom sheet on mobile.
- Filter changes update results with a 200 ms crossfade; selected filters become removable chips.
- `Sort by` remains right-aligned on desktop.
- The toolbar may become sticky below the header when the product grid reaches the top.

## 10. Optional showcase animation matching the video

Normal users should see the functional site. Add showcase mode only when `?showcase=1` is present or via a clearly separate demo route.

Approximate 35-second sequence:

| Time | Showcase state |
|---:|---|
| 0–2 s | Two tall desktop page mockups appear side by side over a dark teal/purple vignette; slow 2% scale-in |
| 2–4 s | Smooth zoom/crossfade into the full-width home hero |
| 4–8 s | Camera pans/scrolls down from categories into `You might need` |
| 8–13 s | Product controls animate: avocado becomes quantity 1; another product reaches quantity 2; cart badge grows to 5 |
| 13–15 s | Crossfade/shared-image transition to product detail |
| 15–21 s | Product thumbnails change the main flour image; slight gallery scale emphasis |
| 21–28 s | Crossfade back into home merchandising sections; smooth scroll through weekly best sellers, banners, and `Just for you` |
| 28–31 s | Scroll to lime services rail and footer |
| 31–35 s | Tilt/zoom transition into all-category page with four offer cards and filter toolbar |

Implementation guidance:

- Use transforms and opacity for camera movement; do not animate layout properties on every frame.
- Use `requestAnimationFrame`/Framer Motion timelines.
- Route-sized panels should stay sharp: avoid scaling above 1.08.
- Showcase scroll must be cancellable by wheel, touch, pointer, or keyboard input.
- Never autoplay the showcase for ordinary shoppers.

## 11. General motion system

Use one coherent motion language:

```ts
export const motion = {
  fast: 160,
  base: 240,
  slow: 480,
  easeOut: [0.16, 1, 0.3, 1],
  easeInOut: [0.65, 0, 0.35, 1],
  spring: { type: "spring", stiffness: 420, damping: 30 }
};
```

- Page/section reveal: opacity + 12–20 px vertical movement.
- Buttons: 2 px upward hover, 1 px press, 160 ms.
- Cards: 4–6 px upward hover, 220 ms.
- Avoid continuous floating, bouncing, or excessive parallax.
- Apply `will-change` only during active animations.
- With `prefers-reduced-motion: reduce`, remove transforms, parallax, auto-scroll, and shared-layout animation.

## 12. Component model

Suggested reusable components:

```text
AppShell
├─ SiteHeader
│  ├─ Brand
│  ├─ SearchBox
│  ├─ DeliveryPrompt
│  ├─ CartButton
│  └─ ProfileButton
├─ HomePage
│  ├─ HeroBanner
│  ├─ CategoryRail
│  ├─ ProductSection
│  │  └─ ProductCard
│  │     └─ QuantityControl
│  ├─ OfferCardGrid
│  ├─ BestSellerTabs
│  ├─ PromoBannerPair
│  ├─ AppDownloadBanner
│  └─ ServiceCardRail
├─ ProductDetailPage
│  ├─ ProductGallery
│  └─ ProductPurchasePanel
├─ CategoryPage
│  ├─ FilterToolbar
│  └─ ProductGrid
└─ SiteFooter
```

Product data shape:

```ts
type Product = {
  id: string;
  slug: string;
  name: string;
  subtitle: string;
  unit: string;
  priceMajor: string;
  priceMinor: string;
  image: string;
  gallery?: string[];
  category: string;
  badge?: string;
  rating?: number;
  reviewCount?: number;
};
```

## 13. Assets

Use isolated high-resolution PNG/WebP product cutouts with transparent backgrounds. Required visual families:

- Olive-oil bottles, tins, jugs, and 12-pack/16L case imagery from Al Quds, Jenin, Ramallah, Tulkarm, and community-farmer products
- Zaatar Hyssop, Palestinian zaatar samplers, Qalqilya zaatar mix, grains, herbs, and spices
- Green Baladi Olives from Jenin, Nabulsi cheese, ghee, and Palestinian ceramics
- Product-detail gallery with multiple package angles for the selected WATANY olive oil
- Branded hamper filled with olive oil, zaatar, olives, grains, cheese, and pantry products
- Olive harvest, pickup, wholesale, community-farmer, and payment/service illustrations
- User avatar
- Brand/cart mark and payment logos

If exact source assets are unavailable, match silhouette, color, angle, and whitespace before matching brand text. Keep every product image on a consistent optical baseline.

## 14. Accessibility and usability

- All controls must be keyboard reachable and have visible focus rings.
- Product images need useful alt text.
- Quantity controls require accessible labels such as `Increase Zaatar Hyssop quantity`.
- Cart badge must have a screen-reader summary.
- Filter popovers use proper menu/listbox semantics and Escape handling.
- Minimum touch target: 44 × 44 px.
- Maintain WCAG AA contrast for text and interactive states.
- Do not rely on color alone for selected tabs or quantity states.

## 15. Performance

- LCP hero image should preload only on the home route.
- Use responsive `srcset`/`sizes`; product thumbnails should not load full-resolution files.
- Lazy-load below-fold sections.
- Keep initial route JavaScript lean; load showcase animation code only in showcase mode.
- Target Lighthouse: Performance >= 90, Accessibility >= 95 on a production build.

## 16. Definition of done

The implementation is accepted when:

- Desktop composition matches the reference at 1440 × 900 within a reasonable visual tolerance.
- Header, hero, category rail, product grids, offers, tabs, banners, services strip, and footer are present.
- Home, product detail, and all-category states are implemented as real routes.
- Add, increment, decrement, cart badge, product thumbnails, filters, sorting, search, and navigation work.
- Product-card controls morph smoothly between plus-only and quantity states.
- Product gallery transitions match the reference behavior.
- Layout is polished at 375, 768, 1024, and 1440 px widths.
- Reduced-motion mode is supported.
- No placeholder gradients, broken images, layout jumps, or generic template sections remain.
- Optional showcase mode reproduces the reference’s high-level 35-second camera/scroll sequence without interfering with the normal site.
