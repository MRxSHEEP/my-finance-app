"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Newspaper,
  TrendingUp,
  CalendarClock,
  Bitcoin,
  Fuel,
  GraduationCap,
  Calculator,
  Wallet,
  UserSearch,
  ShieldCheck,
  Menu,
} from "lucide-react";
import { useMobileNav } from "@/components/MobileNavContext";
import { TICKER_BAR_HEIGHT_PX } from "@/components/TickerBar";

// Watchlist no longer has its own nav entry — it's embedded directly in
// the /stocks page instead (the underlying /api/watchlist routes and
// /watchlist page itself are unchanged, just not linked from here).
// Screener likewise no longer has its own nav entry — it moved to
// /tools/screener as another card alongside the other calculators (the
// underlying /api/screener route is unchanged).
const NAV_ITEMS = [
  { label: "News", href: "/news", icon: Newspaper },
  { label: "Earnings", href: "/earnings", icon: CalendarClock },
  { label: "Stocks", href: "/stocks", icon: TrendingUp },
  { label: "Crypto", href: "/crypto", icon: Bitcoin },
  { label: "Commodities", href: "/commodities", icon: Fuel },
  { label: "Tools", href: "/tools", icon: Calculator },
  { label: "Learning", href: "/learning", icon: GraduationCap },
  { label: "Trackers", href: "/trackers", icon: UserSearch },
  { label: "Simulated Portfolio", href: "/portfolio", icon: Wallet },
  { label: "Compliance", href: "/compliance", icon: ShieldCheck },
];

// Gap between each flyout item's fade-in — kept snappy (not the more
// leisurely 100ms+ stagger used for e.g. Deep Dive bar charts) since this
// is a click-triggered menu reveal, not a scroll-triggered one; it should
// read as "quick and polished," not as something to wait out.
const FLYOUT_STAGGER_MS = 40;

function isActiveHref(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

// Shared between the full sidebar and the collapsed flyout so both list
// the same items, in the same order, with the same icons and active-
// state highlighting, from one source rather than two copies that could
// drift apart. `onNavigate` is only passed by the flyout (to close itself
// once a destination is picked); `staggered` is only set by the flyout
// (the full sidebar's items shouldn't replay a fade-in on every render).
function NavLinks({
  pathname,
  onNavigate,
  staggered = false,
}: {
  pathname: string;
  onNavigate?: () => void;
  staggered?: boolean;
}) {
  return (
    <>
      {NAV_ITEMS.map(({ label, href, icon: Icon }, index) => {
        const active = isActiveHref(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors ${
              active
                ? "bg-foreground/10 font-semibold text-foreground"
                : "text-foreground/60 hover:bg-foreground/5 hover:text-foreground"
            } ${staggered ? "animate-nav-item-fade-in" : ""}`}
            style={staggered ? { animationDelay: `${index * FLYOUT_STAGGER_MS}ms` } : undefined}
          >
            <Icon size={18} />
            {label}
          </Link>
        );
      })}
    </>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const navRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const { open: flyoutOpen, toggle, close: closeFlyout } = useMobileNav();
  // Collapsed only once the *entire* sidebar nav — every item down to
  // Portfolio, not just its top edge — has scrolled out of the shared
  // page scroll container (#app-scroll-region, set up in app/layout.tsx —
  // this page no longer uses the raw document/window scroll, so the
  // observer has to root against that container specifically rather than
  // the viewport default). Observing the whole <nav> rather than a thin
  // top sentinel means `isIntersecting` stays true as long as even the
  // last item is still partly on screen, so the desktop floating cluster
  // never appears while the full sidebar is still reachable. Below lg,
  // `<nav>` is permanently display:none (see its own comment), so a
  // hidden element never intersects and this reads permanently true —
  // harmless, since that cluster is also hidden below lg (the header's
  // MobileNavButton is the trigger there instead).
  const [collapsed, setCollapsed] = useState(false);
  // Tracks the header (the one with the real "Noble" wordmark/logo)
  // separately from `collapsed` above — used only to gate the floating
  // cluster's own duplicate crown-logo link (see below), not anything
  // mobile-facing.
  const [headerHidden, setHeaderHidden] = useState(false);
  // Bumped on every desktop-cluster hamburger click to force the icon to
  // remount (see the render below) — a fresh element restarts the
  // one-shot spin from scratch, so rapid repeated clicks each get their
  // own clean 360° turn instead of fighting an already-running animation
  // on the same node. Purely cosmetic on that one button — the header's
  // MobileNavButton doesn't have this spin effect.
  const [spinToken, setSpinToken] = useState(0);
  // Bumped whenever the panel newly opens (from either trigger) — forces
  // the item list to remount so its per-item stagger animation replays
  // every time, rather than only ever firing once (a plain CSS `animation`
  // on an element that's never unmounted only plays on its original mount).
  const [revealToken, setRevealToken] = useState(0);
  const wasOpenRef = useRef(flyoutOpen);

  useEffect(() => {
    if (flyoutOpen && !wasOpenRef.current) setRevealToken((token) => token + 1);
    wasOpenRef.current = flyoutOpen;
  }, [flyoutOpen]);

  // A route change should always close the flyout, whether that came from
  // clicking inside it (already handled by onNavigate) or from scrolling
  // back up while it happened to be open. Reset during render (React's
  // documented pattern for "adjusting state when a prop changes") rather
  // than in an effect — an effect here would commit the still-open flyout
  // for one extra frame before closing it.
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    closeFlyout();
  }

  useEffect(() => {
    const root = document.getElementById("app-scroll-region");
    const nav = navRef.current;
    if (!root || !nav) return;

    const observer = new IntersectionObserver(([entry]) => setCollapsed(!entry.isIntersecting), {
      root,
      threshold: 0,
    });
    observer.observe(nav);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const root = document.getElementById("app-scroll-region");
    const header = document.getElementById("app-header");
    if (!root || !header) return;

    const observer = new IntersectionObserver(([entry]) => setHeaderHidden(!entry.isIntersecting), {
      root,
      threshold: 0,
    });
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!flyoutOpen) return;

    // Clicks on either trigger button (the desktop cluster's hamburger, or
    // the header's MobileNavButton below lg) are excluded via this data
    // attribute rather than a ref, since those two buttons live in
    // different components — without this, a mousedown on a trigger while
    // the panel is already open would close it here before the trigger's
    // own click handler re-opens it, effectively making the button unable
    // to close its own panel.
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Element | null;
      if (panelRef.current?.contains(target)) return;
      if (target?.closest("[data-mobile-nav-trigger]")) return;
      closeFlyout();
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") closeFlyout();
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [flyoutOpen, closeFlyout]);

  function handleDesktopHamburgerClick() {
    setSpinToken((token) => token + 1);
    toggle();
  }

  return (
    <>
      {/* Hidden below lg (1024px) — a persistent 224px rail leaves too
          little content width on phones and even 768px tablets (confirmed
          live: card grids and the header banner were getting clipped with
          no scrollbar to reveal it, since app/layout.tsx's body is
          overflow-hidden). Below lg, the panel at the bottom of this file
          is the only nav, opened via the header's MobileNavButton instead
          of anything in this component. */}
      <nav className="hidden w-56 shrink-0 flex-col gap-1 border-r border-black/10 p-4 lg:flex dark:border-white/15">
        {/* Observed instead of <nav> itself — <nav> is a row-flex sibling
            next to the (often much taller) main content column, so with
            the default align-items: stretch it vertically stretches to
            match that column's full height. Live-confirmed: nav's own
            bounding height was 2804px on a page where the actual last nav
            item ("Portfolio") sat at just 468px — observing <nav> directly
            meant "fully scrolled out of view" only fired near the very
            bottom of the whole page. This inner div isn't stretched (only
            <nav>'s direct flex-item cross-axis is), so its height matches
            the real, visible item list. */}
        <div ref={navRef}>
          <NavLinks pathname={pathname} />
        </div>
      </nav>

      {/* Floating crown/hamburger cluster — desktop only (lg+), appearing
          once the persistent rail above has scrolled out of view. Below
          lg the rail is already permanently hidden and the header's own
          MobileNavButton is the trigger instead; this cluster would
          otherwise sit right on top of that header before any scrolling
          happened, so it's suppressed entirely at those widths (`hidden
          lg:flex`) rather than just deferring to headerHidden the way the
          crown link inside it does. Always mounted (never conditionally
          rendered) so collapsed's fade/slide is a CSS transition on one
          persistent element, not an abrupt mount/unmount swap —
          pointer-events-none while hidden keeps it from intercepting
          clicks meant for the page underneath despite being `fixed`. */}
      <div
        className={`fixed left-4 z-30 hidden flex-col items-center gap-2 transition-all duration-300 ease-out lg:flex ${
          collapsed ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-2 opacity-0"
        }`}
        style={{ top: TICKER_BAR_HEIGHT_PX + 16 }}
      >
        {/* Duplicates the header's own logo link, so it's only rendered
            once that header has actually scrolled out of view — otherwise
            it would render right on top of the header's real one. */}
        {headerHidden && (
          <Link
            href="/"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-background shadow-md dark:border-white/15"
          >
            <Image
              src="/crown(1).webp.webp"
              alt="Noble"
              width={24}
              height={24}
              style={{ width: "auto", height: "24px" }}
            />
          </Link>
        )}

        <button
          type="button"
          data-mobile-nav-trigger
          onClick={handleDesktopHamburgerClick}
          aria-label="Open navigation menu"
          aria-expanded={flyoutOpen}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-background text-foreground/70 shadow-md transition-colors duration-150 ease-out hover:text-foreground dark:border-white/15"
        >
          <Menu key={spinToken} size={18} className="animate-hamburger-spin" />
        </button>
      </div>

      {/* The dropdown panel itself — a separate fixed element (not nested
          inside the desktop-only cluster above) so it renders regardless
          of which trigger opened it: that cluster's hamburger (lg+, once
          scrolled) or the header's MobileNavButton (below lg, always).
          left-16 (64px) lines up with both: the cluster's button sits at
          left-4+w-10+gap ≈ 64px, and the header's MobileNavButton sits at
          a near-identical vertical position (ticker + header padding ≈ the
          same TICKER_BAR_HEIGHT_PX+16 used below) just left-aligned in the
          header's own flow instead. */}
      <div
        ref={panelRef}
        className={`fixed left-16 z-30 w-56 origin-top-left rounded-md border border-black/10 bg-background p-2 shadow-lg transition-all duration-200 ease-out dark:border-white/15 ${
          flyoutOpen ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0"
        }`}
        style={{ top: TICKER_BAR_HEIGHT_PX + 16 }}
      >
        <div key={revealToken} className="flex flex-col gap-1">
          <NavLinks pathname={pathname} onNavigate={closeFlyout} staggered />
        </div>
      </div>
    </>
  );
}
