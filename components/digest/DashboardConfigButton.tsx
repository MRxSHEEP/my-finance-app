"use client";

import { useState } from "react";
import { Settings } from "lucide-react";
import DashboardConfigPanel, { type DashboardConfigResult } from "@/components/digest/DashboardConfigPanel";
import type { SectionKey } from "@/lib/digest/sections";
import type { CatalogSector } from "@/lib/stockCatalog";

interface DashboardConfigButtonProps {
  currentSectionOrder: SectionKey[] | null;
  currentSelectedSectors: CatalogSector[] | null;
  onSaved: (config: DashboardConfigResult) => void;
  onReset: () => void;
}

// Signed-in only (the parent, app/page.tsx, only renders this when
// status === "authenticated") — hidden entirely for signed-out visitors
// rather than shown-then-blocked, matching every other personalization-only
// affordance on this page (e.g. the Watchlist section itself just doesn't
// render when signed out).
export default function DashboardConfigButton({
  currentSectionOrder,
  currentSelectedSectors,
  onSaved,
  onReset,
}: DashboardConfigButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Configure dashboard"
        className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.02] px-3 py-1.5 text-xs font-medium text-white/70 transition-colors duration-150 ease-out hover:text-white"
      >
        <Settings size={14} />
        Configure
      </button>

      {open && (
        <DashboardConfigPanel
          currentSectionOrder={currentSectionOrder}
          currentSelectedSectors={currentSelectedSectors}
          onClose={() => setOpen(false)}
          onSaved={(config) => {
            onSaved(config);
            setOpen(false);
          }}
          onReset={() => {
            onReset();
            setOpen(false);
          }}
        />
      )}
    </>
  );
}
