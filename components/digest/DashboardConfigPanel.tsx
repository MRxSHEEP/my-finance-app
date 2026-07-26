"use client";

import { useEffect, useState } from "react";
import { X, ChevronUp, ChevronDown, ChevronRight } from "lucide-react";
import { DEFAULT_SECTION_ORDER, SECTION_LABELS, type SectionKey } from "@/lib/digest/sections";
import { CATALOG_SECTORS, type CatalogSector } from "@/lib/stockCatalog";

interface Row {
  key: SectionKey;
  visible: boolean;
}

export interface DashboardConfigResult {
  sectionOrder: SectionKey[];
  sectorCardsSectors: CatalogSector[] | null;
}

interface DashboardConfigPanelProps {
  currentSectionOrder: SectionKey[] | null;
  currentSelectedSectors: CatalogSector[] | null;
  onClose: () => void;
  onSaved: (config: DashboardConfigResult) => void;
  onReset: () => void;
}

// All 6 sections are always listed (hidden ones shown dimmed, still
// reorderable) — visibility + position in the final visible-only list is
// what gets persisted; a hidden row's position in this editing list itself
// doesn't matter.
function buildInitialRows(currentSectionOrder: SectionKey[] | null): Row[] {
  const visibleOrder = currentSectionOrder ?? [...DEFAULT_SECTION_ORDER];
  const hidden = DEFAULT_SECTION_ORDER.filter((key) => !visibleOrder.includes(key));
  return [...visibleOrder, ...hidden].map((key) => ({ key, visible: visibleOrder.includes(key) }));
}

// No modal/dialog precedent exists anywhere in this app (confirmed before
// planning) — this is a new, genuinely-needed overlay: fixed inset-0
// backdrop + centered panel, close on backdrop click/Escape (the same
// click-outside/Escape idea already established for dropdowns elsewhere in
// this app, e.g. components/portfolio/SimulatedPortfolioDetailView.tsx's
// StyledSelect, extended here to a full overlay).
export default function DashboardConfigPanel({
  currentSectionOrder,
  currentSelectedSectors,
  onClose,
  onSaved,
  onReset,
}: DashboardConfigPanelProps) {
  const [rows, setRows] = useState<Row[]>(() => buildInitialRows(currentSectionOrder));
  const [selectedSectors, setSelectedSectors] = useState<CatalogSector[]>(
    currentSelectedSectors ?? [...CATALOG_SECTORS]
  );
  const [sectorsExpanded, setSectorsExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  function toggleVisible(index: number) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, visible: !row.visible } : row)));
  }

  function move(index: number, direction: -1 | 1) {
    setRows((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function toggleSector(sector: CatalogSector) {
    setSelectedSectors((prev) => (prev.includes(sector) ? prev.filter((s) => s !== sector) : [...prev, sector]));
  }

  async function handleSave() {
    setError(null);
    const visibleKeys = rows.filter((row) => row.visible).map((row) => row.key);
    if (visibleKeys.length === 0) {
      setError("At least one section must stay visible.");
      return;
    }
    if (selectedSectors.length === 0) {
      setError("Pick at least one sector, or leave them all checked.");
      return;
    }
    const sectorCardsSectors = selectedSectors.length === CATALOG_SECTORS.length ? null : selectedSectors;

    setSaving(true);
    try {
      const response = await fetch("/api/dashboard-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionOrder: visibleKeys, sectorCardsSectors }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setError(body?.error ?? "Failed to save");
        return;
      }
      onSaved({ sectionOrder: visibleKeys, sectorCardsSectors: sectorCardsSectors as CatalogSector[] | null });
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/dashboard-config", { method: "DELETE" });
      if (!response.ok) {
        setError("Failed to reset");
        return;
      }
      onReset();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-lg border border-white/10 bg-neutral-950 p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Configure Dashboard</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-white/50 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          {rows.map((row, index) => (
            <div key={row.key} className="flex flex-col gap-1.5 rounded-md border border-white/10 p-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={row.visible}
                  onChange={() => toggleVisible(index)}
                  className="h-4 w-4 accent-indigo-400"
                />
                <span className={`flex-1 text-sm ${row.visible ? "text-white" : "text-white/40"}`}>
                  {SECTION_LABELS[row.key]}
                </span>
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  aria-label={`Move ${SECTION_LABELS[row.key]} up`}
                  className="rounded p-1 text-white/50 hover:text-white disabled:opacity-20"
                >
                  <ChevronUp size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={index === rows.length - 1}
                  aria-label={`Move ${SECTION_LABELS[row.key]} down`}
                  className="rounded p-1 text-white/50 hover:text-white disabled:opacity-20"
                >
                  <ChevronDown size={14} />
                </button>
                {row.key === "sectorCards" && (
                  <button
                    type="button"
                    onClick={() => setSectorsExpanded((v) => !v)}
                    aria-label="Choose sectors"
                    className="rounded p-1 text-white/50 hover:text-white"
                  >
                    <ChevronRight size={14} className={`transition-transform ${sectorsExpanded ? "rotate-90" : ""}`} />
                  </button>
                )}
              </div>

              {row.key === "sectorCards" && sectorsExpanded && (
                <div className="grid grid-cols-2 gap-1 pl-6 pt-1">
                  {CATALOG_SECTORS.map((sector) => (
                    <label key={sector} className="flex items-center gap-1.5 text-xs text-white/70">
                      <input
                        type="checkbox"
                        checked={selectedSectors.includes(sector)}
                        onChange={() => toggleSector(sector)}
                        className="h-3.5 w-3.5 accent-indigo-400"
                      />
                      {sector}
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex items-center justify-between gap-2 border-t border-white/10 pt-4">
          <button
            type="button"
            onClick={handleReset}
            disabled={saving}
            className="text-xs text-white/50 hover:text-white disabled:opacity-50"
          >
            Reset to Default
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-white/10 px-3 py-1.5 text-sm text-white/70 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-md bg-white px-3 py-1.5 text-sm font-medium text-neutral-950 hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
