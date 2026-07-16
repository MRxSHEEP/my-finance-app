"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Newspaper,
  TrendingUp,
  Bitcoin,
  Fuel,
  LineChart,
  GraduationCap,
  Calculator,
  SlidersHorizontal,
  Star,
  Wallet,
} from "lucide-react";

const NAV_ITEMS = [
  { label: "News", href: "/news", icon: Newspaper },
  { label: "Stocks", href: "/stocks", icon: TrendingUp },
  { label: "Crypto", href: "/crypto", icon: Bitcoin },
  { label: "Commodities", href: "/commodities", icon: Fuel },
  { label: "Research", href: "/research", icon: LineChart },
  { label: "Learning", href: "/learning", icon: GraduationCap },
  { label: "Tools", href: "/tools", icon: Calculator },
  { label: "Screener", href: "/screener", icon: SlidersHorizontal },
  { label: "Watchlist", href: "/watchlist", icon: Star },
  { label: "Portfolio", href: "/portfolio", icon: Wallet },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <nav className="flex w-56 shrink-0 flex-col gap-1 border-r border-black/10 p-4 dark:border-white/15">
      {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
              active
                ? "bg-foreground/10 font-semibold text-foreground"
                : "text-foreground/60 hover:bg-foreground/5 hover:text-foreground"
            }`}
          >
            <Icon size={18} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
