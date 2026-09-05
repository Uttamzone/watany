"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { LayoutDashboard, Menu, Search, ShoppingCart, User, X } from "lucide-react";
import { CartDrawer } from "@/components/cart/cart-drawer";
import {
  SearchHistoryPanel,
  SearchSuggestions,
  useSearchSuggestions,
} from "@/components/layout/search-suggestions";
import {
  clearSearchHistory,
  pushSearchHistory,
  readSearchHistory,
  removeSearchHistory,
} from "@/lib/search-history";
import type { Product } from "@/lib/types";
import { useCart } from "@/components/cart/cart-store";
import { useAuth } from "@/components/auth/auth-store";
import { AccountMenu } from "@/components/auth/account-menu";
import { CurrencySelector } from "@/components/currency/currency-selector";
import { isAdminRole } from "@/lib/admin/permissions";
import { categories } from "@/lib/catalogue";
import { motionTokens, sec } from "@/lib/motion";
import { getUserInitials } from "@/lib/auth";

/** Persistent rounded deep-teal header (design.md §6); sticky past the hero, collapses on narrow viewports. */
export function SiteHeader() {
  const [stuck, setStuck] = useState(false);
  const [visible, setVisible] = useState(true);
  const lastScrollY = useRef(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [query, setQuery] = useState("");
  // Which of the two always-mounted search fields is active - the dropdown must
  // render for only one, or assistive tech sees every suggestion twice.
  const [searchField, setSearchField] = useState<"desktop" | "mobile" | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  // Recent keywords; filled from localStorage on focus (see `openField`), never
  // during render - the server has no storage to render the same list from.
  const [history, setHistory] = useState<string[]>([]);
  const router = useRouter();
  const pathname = usePathname();
  const { count, hydrated } = useCart();
  const { status, user } = useAuth();
  const reduceMotion = useReducedMotion();

  // Sticky state flips once the header clears the top of the hero; scroll direction toggles visibility.
  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;
          setStuck(currentScrollY > 120);

          if (currentScrollY <= 100) {
            setVisible(true);
          } else {
            const diff = currentScrollY - lastScrollY.current;
            if (diff > 180) {
              setVisible(false);
            } else if (diff < -180) {
              setVisible(true);
            }
          }
          lastScrollY.current = currentScrollY;
          ticking = false;
        });
        ticking = true;
      }
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Clear search on logout (authenticated -> guest only) so the next visitor
  // never inherits the previous session's query - same as the wishlist store.
  const previousStatus = useRef(status);
  useEffect(() => {
    if (previousStatus.current === "authenticated" && status === "guest") {
      setQuery("");
      setSearchField(null);
      setActiveIndex(-1);
    }
    previousStatus.current = status;
  }, [status]);

  // The field is a launcher, not a filter - once navigation lands anywhere it
  // resets, so a stale term never trails the buyer from page to page. Adjusted
  // during render rather than in an effect (React's "adjust state when a prop
  // changes" pattern) so the cleared field paints in the same commit as the new
  // page, with no flash of the old query. Keyed on pathname only: the results
  // page re-reads `?q=` into its own toolbar, and watching the full URL would
  // wipe the field mid-typing on query-only changes.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setQuery("");
    setSearchField(null);
    setActiveIndex(-1);
    setVisible(true);
  }

  const suggestions = useSearchSuggestions(query);
  const options = suggestions.items;
  const hasQuery = query.trim().length > 0;
  // Empty field + focus shows history instead; the two panels never coexist.
  const historyOpen = searchField !== null && !hasQuery && history.length > 0;
  // Arrow keys walk whichever list is on screen.
  const navigableLength = historyOpen ? history.length : options.length;

  function closeSuggestions() {
    setSearchField(null);
    setActiveIndex(-1);
  }

  /**
   * Opens a field and pulls the stored keywords in. Read on focus rather than on
   * mount so the server-rendered markup has nothing to disagree with, and so a
   * search run in another tab is reflected the next time the field is used.
   */
  function openField(field: "desktop" | "mobile") {
    setSearchField(field);
    setHistory(readSearchHistory());
  }

  function remember(term: string) {
    setHistory(pushSearchHistory(term));
  }

  function goToProduct(product: Product) {
    // Selecting a suggestion is a completed search - keep what was typed, since
    // that is the term the buyer would repeat, not the product name.
    remember(query);
    setQuery("");
    closeSuggestions();
    router.push(`/product/${product.slug}`);
  }

  function runSearch(term: string) {
    const trimmed = term.trim();
    if (trimmed) remember(trimmed);
    setQuery("");
    closeSuggestions();
    router.push(trimmed ? `/categories?q=${encodeURIComponent(trimmed)}` : "/categories");
  }

  // Shared by the form's onSubmit and the input's own Enter handling below -
  // native implicit submission on Enter needs a lone text field and no other
  // submittable control, which doesn't reliably hold once a suggestions/history
  // panel with its own buttons is mounted inside the form. Handling Enter
  // directly makes search-by-Enter work regardless of that.
  function resolveSearchSubmit() {
    if (activeIndex >= 0) {
      // Enter on a highlighted row takes that row: a history term re-runs the
      // search, a product opens directly - the list is the more specific answer.
      if (historyOpen && history[activeIndex]) {
        runSearch(history[activeIndex]);
        return;
      }
      if (!historyOpen && options[activeIndex]) {
        goToProduct(options[activeIndex]);
        return;
      }
    }
    runSearch(query);
  }

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    resolveSearchSubmit();
  }

  /** Manual reset - clears the field but keeps focus so typing can continue. */
  function clearQuery(field: "desktop" | "mobile") {
    setQuery("");
    setActiveIndex(-1);
    openField(field);
    document
      .getElementById(field === "desktop" ? "site-search" : "site-search-mobile")
      ?.focus();
  }

  function onSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      closeSuggestions();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      resolveSearchSubmit();
      return;
    }
    if (!searchField || navigableLength === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % navigableLength);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) =>
        index <= 0 ? navigableLength - 1 : index - 1,
      );
    }
  }

  const isHeaderVisible =
    visible || drawerOpen || cartDrawerOpen || searchField !== null || accountOpen;

  if (pathname === "/login" || pathname?.startsWith("/login")) {
    return null;
  }

  return (
    <>
      <motion.div
        className="sticky top-0 z-40 pt-4"
        initial={reduceMotion ? false : { y: -20, opacity: 0 }}
        animate={{
          y: isHeaderVisible ? 0 : "-115%",
          opacity: isHeaderVisible ? 1 : 0.85,
        }}
        transition={{
          duration: reduceMotion ? 0 : 0.75,
          ease: [0.16, 1, 0.3, 1],
        }}
      >
        <div className="shell">
          {/* Sticky shadow is a CSS transition - Framer cannot interpolate a
              `var(--token)` shadow value. */}
          <header
            className={`flex h-[70px] items-center gap-3 rounded-[18px] bg-teal-950 px-4 text-white transition-shadow duration-[240ms] lg:h-[84px] lg:gap-5 lg:px-6 ${
              stuck ? "shadow-header" : "shadow-none"
            }`}
          >
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
              className="grid size-10 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 md:hidden shrink-0"
            >
              <Menu className="size-5" aria-hidden />
            </button>

            <Link href="/" className="shrink-0" aria-label="Watany - Palestinian Products - home">
              <Image
                src="/logo/watany-logo-light.png"
                alt="Watany - Palestinian Products"
                width={435}
                height={373}
                priority
                /* Near-square lockup (435x373) - sized by width to keep the wordmark legible. */
                className="h-auto w-[70px] lg:w-[86px]"
              />
            </Link>

            {/* Search - hidden below md, where it moves to its own row. */}
            <form
              onSubmit={submitSearch}
              role="search"
              className="relative hidden min-w-0 flex-1 md:block"
            >
              <label htmlFor="site-search" className="sr-only">
                Search products
              </label>
              <div className="search-field flex h-12 items-center gap-3 rounded-full bg-white px-5">
                <Search
                  className="search-icon size-5 shrink-0 text-muted transition-colors"
                  aria-hidden
                />
                <input
                  id="site-search"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    openField("desktop");
                    setActiveIndex(-1);
                  }}
                  onFocus={() => openField("desktop")}
                  onBlur={closeSuggestions}
                  onKeyDown={onSearchKeyDown}
                  autoComplete="off"
                  role="combobox"
                  aria-expanded={
                    searchField === "desktop" &&
                    (historyOpen || (hasQuery && options.length > 0))
                  }
                  aria-controls="site-search-listbox"
                  aria-autocomplete="list"
                  aria-activedescendant={
                    activeIndex >= 0
                      ? `site-search-listbox-option-${activeIndex}`
                      : undefined
                  }
                  placeholder="Search olive oil, zaatar, cheese, ceramics…"
                  className="min-w-0 flex-1 bg-transparent text-[15px] text-text outline-none placeholder:text-muted"
                />
                {hasQuery && (
                  <button
                    type="button"
                    aria-label="Clear search"
                    // Mouse-down beats the input's blur, which would otherwise
                    // close the panel and swallow the click.
                    onMouseDown={(event) => {
                      event.preventDefault();
                      clearQuery("desktop");
                    }}
                    className="grid size-7 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-soft-control hover:text-teal-950"
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                )}
              </div>

              {searchField === "desktop" && hasQuery && (
                <SearchSuggestions
                  id="site-search-listbox"
                  state={suggestions}
                  query={query}
                  activeIndex={activeIndex}
                  onSelect={goToProduct}
                />
              )}

              {searchField === "desktop" && historyOpen && (
                <SearchHistoryPanel
                  id="site-search-listbox"
                  terms={history}
                  activeIndex={activeIndex}
                  onSelect={runSearch}
                  onRemove={(term) => setHistory(removeSearchHistory(term))}
                  onClear={() => {
                    clearSearchHistory();
                    setHistory([]);
                  }}
                />
              )}
            </form>

            <div className="ml-auto flex shrink-0 items-center gap-3 md:ml-0">

              <CurrencySelector />

              <button
                type="button"
                onClick={() => setCartDrawerOpen(true)}
                aria-label={
                  hydrated
                    ? `Cart, ${count} ${count === 1 ? "item" : "items"}`
                    : "Cart"
                }
                className="relative grid size-11 place-items-center rounded-full bg-white text-teal-950 transition-transform hover:-translate-y-0.5"
              >
                <ShoppingCart className="size-5" aria-hidden />
                <AnimatePresence>
                  {hydrated && count > 0 && (
                    <motion.span
                      key={count}
                      initial={reduceMotion ? false : { scale: 0.6 }}
                      animate={{ scale: 1 }}
                      transition={motionTokens.spring}
                      className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-coral px-1.5 text-[11px] font-bold text-white"
                    >
                      {count}
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>

              <div className="relative block">
                {status === "authenticated" && user ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setAccountOpen((value) => !value)}
                      aria-haspopup="menu"
                      aria-expanded={accountOpen}
                      aria-label={`Account menu - signed in as ${user.firstName ?? user.email}`}
                      className="grid size-11 shrink-0 place-items-center rounded-full bg-lime-500 text-[15px] font-bold text-teal-950 ring-2 ring-gold"
                    >
                      {getUserInitials(user)}
                    </button>
                    <AccountMenu open={accountOpen} onClose={() => setAccountOpen(false)} />
                  </>
                ) : status === "guest" ? (
                  <Link
                    href={`/login?next=${encodeURIComponent(pathname)}`}
                    aria-label="Log in"
                    className="grid size-11 shrink-0 place-items-center rounded-full bg-white/10 text-white ring-2 ring-white/40 transition-colors hover:bg-white/20"
                  >
                    <User className="size-5" aria-hidden />
                  </Link>
                ) : (
                  <span
                    aria-label="Loading account"
                    className="block size-11 shrink-0 animate-pulse rounded-full bg-white/10 ring-2 ring-white/20"
                  />
                )}
              </div>
            </div>
          </header>

          {/* Full-width search row below the header on small screens. */}
          <form
            onSubmit={submitSearch}
            role="search"
            className="relative mt-3 md:hidden"
          >
            <label htmlFor="site-search-mobile" className="sr-only">
              Search products
            </label>
            <div className="search-field flex h-12 items-center gap-3 rounded-full bg-white px-5">
              <Search
                className="search-icon size-5 shrink-0 text-muted transition-colors"
                aria-hidden
              />
              <input
                id="site-search-mobile"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  openField("mobile");
                  setActiveIndex(-1);
                }}
                onFocus={() => openField("mobile")}
                onBlur={closeSuggestions}
                onKeyDown={onSearchKeyDown}
                autoComplete="off"
                role="combobox"
                aria-expanded={
                  searchField === "mobile" &&
                  (historyOpen || (hasQuery && options.length > 0))
                }
                aria-controls="site-search-mobile-listbox"
                aria-autocomplete="list"
                aria-activedescendant={
                  activeIndex >= 0
                    ? `site-search-mobile-listbox-option-${activeIndex}`
                    : undefined
                }
                placeholder="Search olive oil, zaatar…"
                className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted"
              />
              {hasQuery && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    clearQuery("mobile");
                  }}
                  className="grid size-7 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-soft-control hover:text-teal-950"
                >
                  <X className="size-4" aria-hidden />
                </button>
              )}
            </div>

            {searchField === "mobile" && hasQuery && (
              <SearchSuggestions
                id="site-search-mobile-listbox"
                state={suggestions}
                query={query}
                activeIndex={activeIndex}
                onSelect={goToProduct}
              />
            )}

            {searchField === "mobile" && historyOpen && (
              <SearchHistoryPanel
                id="site-search-mobile-listbox"
                terms={history}
                activeIndex={activeIndex}
                onSelect={runSearch}
                onRemove={(term) => setHistory(removeSearchHistory(term))}
                onClear={() => {
                  clearSearchHistory();
                  setHistory([]);
                }}
              />
            )}
          </form>
        </div>
      </motion.div>

      <NavDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <CartDrawer open={cartDrawerOpen} onClose={() => setCartDrawerOpen(false)} />
    </>
  );
}

/** Left slide-in drawer with categories and account links - design.md §6. */
function NavDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  // Escape closes; focus moves into the panel; body scroll is locked while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: sec(motionTokens.fast) }}
            onClick={onClose}
            className="absolute inset-0 bg-teal-950/45"
          />
          <motion.div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label="Site menu"
            initial={reduceMotion ? { opacity: 0 } : { x: "-100%" }}
            animate={reduceMotion ? { opacity: 1 } : { x: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { x: "-100%" }}
            transition={{
              duration: sec(motionTokens.base),
              ease: motionTokens.easeOut,
            }}
            className="absolute inset-y-0 left-0 flex w-[min(340px,86vw)] flex-col overflow-y-auto bg-warm-canvas p-6"
          >
            <div className="flex items-center justify-between">
              <span className="text-lg font-extrabold text-teal-950">Menu</span>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close menu"
                className="grid size-10 place-items-center rounded-full bg-white"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>

            <nav aria-label="Categories" className="mt-8">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">
                Shop by category
              </p>
              <ul className="mt-3 space-y-1">
                {categories.map((category) => (
                  <li key={category.slug}>
                    <Link
                      href={`/categories?category=${category.slug}`}
                      onClick={onClose}
                      className="flex items-center justify-between rounded-xl px-3 py-3 text-[15px] font-semibold text-teal-950 transition-colors hover:bg-white"
                    >
                      {category.name}
                      <span className="text-xs font-medium text-muted">
                        {category.tagline}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <nav aria-label="Account" className="mt-8">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">
                Account
              </p>
              <ul className="mt-3 space-y-1">
                {[
                  { href: "/categories", label: "All products" },
                  { href: "/cart", label: "Your cart" },
                  { href: "/categories?offer=1", label: "Offers" },
                ].map((item) => (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      onClick={onClose}
                      className="block rounded-xl px-3 py-3 text-[15px] font-semibold text-teal-950 transition-colors hover:bg-white"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
              <MobileAccountLinks onNavigate={onClose} />
            </nav>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/** Auth-aware entries appended to the drawer's Account section. */
function MobileAccountLinks({ onNavigate }: { onNavigate: () => void }) {
  const { status, user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  if (status === "loading") return null;

  if (status === "guest") {
    return (
      <ul className="mt-1 space-y-1">
        <li>
          <Link
            href={`/login?next=${encodeURIComponent(pathname)}`}
            onClick={onNavigate}
            className="block rounded-xl px-3 py-3 text-[15px] font-semibold text-teal-950 transition-colors hover:bg-white"
          >
            Log in / Create account
          </Link>
        </li>
      </ul>
    );
  }

  return (
    <ul className="mt-1 space-y-1">
      <li className="px-3 py-1 text-xs text-muted">{user?.email}</li>
      <li>
        <Link
          href="/portal/profile"
          onClick={onNavigate}
          className="block rounded-xl px-3 py-3 text-[15px] font-semibold text-teal-950 transition-colors hover:bg-white"
        >
          My Profile
        </Link>
      </li>
      <li>
        <Link
          href="/portal/orders"
          onClick={onNavigate}
          className="block rounded-xl px-3 py-3 text-[15px] font-semibold text-teal-950 transition-colors hover:bg-white"
        >
          My Orders
        </Link>
      </li>
      <li>
        <Link
          href="/wishlist"
          onClick={onNavigate}
          className="block rounded-xl px-3 py-3 text-[15px] font-semibold text-teal-950 transition-colors hover:bg-white"
        >
          My Wishlist
        </Link>
      </li>
      {isAdminRole(user?.roles ?? []) && (
        <li>
          <Link
            href="/admin"
            onClick={onNavigate}
            className="flex items-center gap-2 rounded-xl px-3 py-3 text-[15px] font-semibold text-teal-950 transition-colors hover:bg-white"
          >
            <LayoutDashboard className="size-4" aria-hidden />
            Dashboard
          </Link>
        </li>
      )}
      <li>
        <button
          type="button"
          onClick={async () => {
            onNavigate();
            await logout();
            router.push("/");
          }}
          className="block w-full rounded-xl px-3 py-3 text-left text-[15px] font-semibold text-coral transition-colors hover:bg-white"
        >
          Log out
        </button>
      </li>
    </ul>
  );
}
