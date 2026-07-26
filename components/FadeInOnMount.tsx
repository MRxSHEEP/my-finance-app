"use client";

import { useEffect, useState } from "react";

interface FadeInOnMountProps {
  children: React.ReactNode;
  className?: string;
  delayMs?: number;
}

// Like RevealOnScroll, but triggers shortly after mount instead of on
// viewport entry — RevealOnScroll's IntersectionObserver is the right
// tool for scroll-triggered hero/section reveals, but for a dense grid
// (e.g. 12 course cards) where most items start below the fold, relying
// on each card's own observer firing independently proved unreliable in
// practice (some cards never crossed the threshold and stayed invisible
// forever). A grid's cards should all be visible shortly after the page
// loads regardless of scroll position, just staggered via delayMs.
export default function FadeInOnMount({ children, className = "", delayMs = 0 }: FadeInOnMountProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timeoutId = setTimeout(() => setVisible(true), 0);
    return () => clearTimeout(timeoutId);
  }, []);

  return (
    <div
      className={`transition-all duration-300 ease-out ${
        visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
      } ${className}`}
      style={delayMs ? { transitionDelay: `${delayMs}ms` } : undefined}
    >
      {children}
    </div>
  );
}
