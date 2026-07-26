"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationControlsProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const ARROW_BUTTON_CLASS =
  "flex h-11 w-11 items-center justify-center rounded-md border border-black/10 text-foreground/70 transition-all duration-200 ease-out hover:border-black/25 hover:text-foreground active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-black/10 disabled:active:scale-100 dark:border-white/15 dark:hover:border-white/30 dark:disabled:hover:border-white/15";

// Shared prev/next + "Page X of Y" control — used by both the Stock
// Catalog and the crypto market-cap rankings table so paginated lists
// across the app behave identically rather than each screen growing its
// own slightly different Load More/pagination convention.
export default function PaginationControls({ page, totalPages, onPageChange }: PaginationControlsProps) {
  const canGoPrev = page > 1;
  const canGoNext = page < totalPages;

  return (
    <div className="flex items-center justify-center gap-4">
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={!canGoPrev}
        aria-label="Previous page"
        className={ARROW_BUTTON_CLASS}
      >
        <ChevronLeft size={16} />
      </button>
      <span className="min-w-[6.5rem] text-center text-sm text-foreground/60">
        Page {page} of {totalPages}
      </span>
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={!canGoNext}
        aria-label="Next page"
        className={ARROW_BUTTON_CLASS}
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
