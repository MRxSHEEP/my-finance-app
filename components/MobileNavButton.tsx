"use client";

import { Menu } from "lucide-react";
import { useMobileNav } from "@/components/MobileNavContext";

// The mobile/tablet nav trigger, rendered directly in the header's normal
// flow (not floating) — visible below lg (1024px), exactly where
// components/Sidebar.tsx's own persistent rail is hidden. Sidebar's own
// floating scroll-triggered crown/hamburger cluster is suppressed at
// these widths too (it would otherwise sit right on top of this same
// header before the page has scrolled) — see that component's
// `headerHidden` comment. h-11/w-11 (44px) meets the minimum touch-target
// size the rest of this pass is checking for.
export default function MobileNavButton() {
  const { open, toggle } = useMobileNav();
  return (
    <button
      type="button"
      data-mobile-nav-trigger
      onClick={toggle}
      aria-label="Open navigation menu"
      aria-expanded={open}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-foreground/70 transition-colors hover:bg-foreground/5 hover:text-foreground lg:hidden"
    >
      <Menu size={20} />
    </button>
  );
}
