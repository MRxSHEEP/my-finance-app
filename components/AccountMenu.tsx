"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { Star, Wallet, Award, LogOut } from "lucide-react";

export default function AccountMenu() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  if (status === "loading") {
    return <div className="h-8 w-8 animate-pulse rounded-full bg-foreground/10" />;
  }

  if (!session?.user) {
    return (
      <Link
        href="/login"
        className="rounded-md border border-black/10 px-3 py-1.5 text-sm font-medium text-foreground/70 transition-colors hover:text-foreground dark:border-white/15"
      >
        Sign In
      </Link>
    );
  }

  const initial = (session.user.name || session.user.email || "?").charAt(0).toUpperCase();

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-foreground/10 text-sm font-semibold text-foreground transition-colors hover:bg-foreground/20"
        aria-label="Account menu"
        aria-expanded={open}
      >
        {initial}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-2 w-56 overflow-hidden rounded-md border border-black/10 bg-background text-sm shadow-lg dark:border-white/15">
          <Link
            href="/watchlist"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-foreground/70 hover:bg-foreground/5 hover:text-foreground"
          >
            <Star size={14} /> Watchlist
          </Link>
          <Link
            href="/portfolio"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-foreground/70 hover:bg-foreground/5 hover:text-foreground"
          >
            <Wallet size={14} /> Simulated Portfolio
          </Link>
          <Link
            href="/learning/certifications"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-foreground/70 hover:bg-foreground/5 hover:text-foreground"
          >
            <Award size={14} /> My Certifications
          </Link>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              signOut();
            }}
            className="flex w-full items-center gap-2 border-t border-black/10 px-3 py-2 text-left text-foreground/70 hover:bg-foreground/5 hover:text-foreground dark:border-white/15"
          >
            <LogOut size={14} /> Log out
          </button>
        </div>
      )}
    </div>
  );
}
