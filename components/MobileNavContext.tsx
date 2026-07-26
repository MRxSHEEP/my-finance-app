"use client";

import { createContext, useCallback, useContext, useState } from "react";

interface MobileNavContextValue {
  open: boolean;
  toggle: () => void;
  close: () => void;
}

const MobileNavContext = createContext<MobileNavContextValue | null>(null);

// Shared between the header's mobile-only hamburger button (rendered in
// app/layout.tsx, next to the logo) and the flyout nav panel it opens
// (components/Sidebar.tsx) — the two live in separate components (the
// header isn't a descendant of Sidebar), so this open/close state can't
// just be local state owned by either one.
export function MobileNavProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((o) => !o), []);
  const close = useCallback(() => setOpen(false), []);
  return <MobileNavContext.Provider value={{ open, toggle, close }}>{children}</MobileNavContext.Provider>;
}

export function useMobileNav(): MobileNavContextValue {
  const ctx = useContext(MobileNavContext);
  if (!ctx) throw new Error("useMobileNav must be used within a MobileNavProvider");
  return ctx;
}
