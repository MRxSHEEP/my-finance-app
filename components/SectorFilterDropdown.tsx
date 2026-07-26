"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, LayoutGrid } from "lucide-react";
import { SCROLLBAR_THIN_CLASS } from "@/lib/scrollbarStyles";
import {
  CATALOG_SECTORS,
  CATALOG_SECTOR_ICONS,
  CATALOG_SECTOR_COLORS,
  CATALOG_INPUT_BG,
  DEFAULT_SECTOR_COLOR,
  type CatalogSector,
  type SectorColorClasses,
} from "@/lib/stockCatalog";

export type SectorFilter = CatalogSector | "All";

// Extracted from components/stocks/StockCatalogSection.tsx (its original,
// only caller) so the Earnings Calendar's own sector filter reuses the
// exact same control — same options, same per-sector colors, same
// open/close/keyboard behavior — rather than a second, independently
// drifting copy.
function sectorColorsFor(sector: SectorFilter): SectorColorClasses {
  return sector === "All" ? DEFAULT_SECTOR_COLOR : CATALOG_SECTOR_COLORS[sector];
}

function SectorIcon({ sector, className }: { sector: SectorFilter; className?: string }) {
  const Icon = sector === "All" ? LayoutGrid : CATALOG_SECTOR_ICONS[sector];
  return <Icon className={className} aria-hidden="true" />;
}

export default function SectorFilterDropdown({
  sector,
  onChange,
  label = "Sector",
}: {
  sector: SectorFilter;
  onChange: (next: SectorFilter) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const options: SectorFilter[] = ["All", ...CATALOG_SECTORS];
  const activeColors = sectorColorsFor(sector);

  return (
    <div ref={containerRef} className="relative flex flex-col gap-1 text-xs text-foreground/60">
      {label}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm text-foreground outline-none transition-colors duration-200 ease-out ${activeColors.border} ${CATALOG_INPUT_BG} ${activeColors.borderHover} ${activeColors.borderFocus}`}
      >
        <SectorIcon sector={sector} className={`h-4 w-4 shrink-0 ${activeColors.icon}`} />
        <span className="min-w-[7rem] text-left">{sector === "All" ? "All Sectors" : sector}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-foreground/40 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          className={`absolute left-0 top-full z-20 mt-1 max-h-80 w-56 overflow-auto rounded-md border bg-background py-1 text-sm shadow-lg ${activeColors.border} ${SCROLLBAR_THIN_CLASS}`}
        >
          {options.map((option) => {
            const optionColors = sectorColorsFor(option);
            const isSelected = option === sector;
            return (
              <li key={option}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(option);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left transition-colors duration-150 ease-out ${
                    isSelected
                      ? `${optionColors.selectedBg} ${optionColors.selectedText}`
                      : `text-foreground ${optionColors.optionHover}`
                  }`}
                >
                  <SectorIcon sector={option} className={`h-4 w-4 shrink-0 ${optionColors.icon}`} />
                  {option === "All" ? "All Sectors" : option}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
