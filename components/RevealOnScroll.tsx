"use client";

import { useEffect, useRef, useState } from "react";

interface RevealOnScrollProps {
  children: React.ReactNode;
  className?: string;
  delayMs?: number;
}

// A one-shot fade-in + slide-up when the element first enters the
// viewport (via IntersectionObserver, no animation library needed).
// Disconnects after the first reveal rather than re-triggering on every
// scroll past — re-fading a section every time feels gimmicky, not premium.
export default function RevealOnScroll({ children, className = "", delayMs = 0 }: RevealOnScrollProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let observer: IntersectionObserver | undefined;

    // Deferred via a timer rather than checked synchronously in the
    // effect body: viewport metrics (window.innerHeight) and layout
    // aren't guaranteed settled at that exact point, and checking too
    // early raced intermittently. A requestAnimationFrame defer was
    // tried first, but headless/backgrounded tabs don't reliably run a
    // paint-driven rAF loop right after navigation — observed live, its
    // callback sometimes silently never fired at all. setTimeout is
    // driven by the JS event loop instead of the compositor, so it's not
    // subject to that. The IntersectionObserver fallback matters in its
    // own right too: some engines don't reliably fire its first callback
    // for content already in the viewport at mount time (observed live:
    // an above-the-fold hero stuck at opacity-0 until a scroll event
    // forced a recompute), so this still needs its own explicit up-front
    // check rather than relying solely on the observer.
    const timeoutId = setTimeout(() => {
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.85 && rect.bottom > 0) {
        setVisible(true);
        return;
      }

      observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setVisible(true);
            observer?.disconnect();
          }
        },
        { threshold: 0.15 }
      );
      observer.observe(el);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      observer?.disconnect();
    };
  }, []);

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
