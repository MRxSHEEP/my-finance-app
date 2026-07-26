"use client";

import { useInViewOnce } from "@/lib/useInViewOnce";

interface RevealOnScrollProps {
  children: React.ReactNode;
  className?: string;
  delayMs?: number;
}

// A one-shot fade-in + slide-up when the element first enters the
// viewport. Disconnects after the first reveal rather than re-triggering on
// every scroll past — re-fading a section every time feels gimmicky, not
// premium. Visibility detection itself lives in lib/useInViewOnce.ts,
// shared with any component that needs to gate its own entrance animation
// (e.g. a chart's bars growing from 0) on the same "actually on screen" signal.
export default function RevealOnScroll({ children, className = "", delayMs = 0 }: RevealOnScrollProps) {
  const { ref, visible } = useInViewOnce<HTMLDivElement>();

  return (
    <div
      ref={ref}
      className={`transition-all duration-300 ease-out ${
        visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
      } ${className}`}
      style={delayMs ? { transitionDelay: `${delayMs}ms` } : undefined}
    >
      {children}
    </div>
  );
}
