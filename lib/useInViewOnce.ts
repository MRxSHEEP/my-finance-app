"use client";

import { useCallback, useRef, useState } from "react";

// Fires once, the first time the ref'd element enters the viewport — shared
// by RevealOnScroll (fade/slide-in) and any component that needs to gate a
// one-shot entrance animation (e.g. chart bars growing from 0) on actual
// visibility rather than on mount/data-load, which for a below-the-fold
// card can happen well before the user ever scrolls to it.
//
// Uses a ref *callback* rather than a plain useRef + useEffect(() => {...},
// []) — the effect-based version only ever checked `ref.current` once, at
// the exact moment this hook's own owning component first mounted. That's
// wrong whenever the ref'd element itself is behind an async, data-gated
// conditional (e.g. EarningsCard/DividendsCard's chart div, which doesn't
// exist in the tree at all until its own fetch resolves): the element was
// still null at that one check, and since the effect's dependency array
// never changes, it never got a second chance to look again once the div
// actually mounted — silently leaving `visible` stuck false forever, with
// no chart ever rendered and no error to notice it by (confirmed live:
// exactly this, on both of those cards). A ref callback instead fires
// every time the underlying DOM node actually attaches, however long
// after this hook's own component first mounted that turns out to be.
export function useInViewOnce<T extends HTMLElement>(threshold = 0.15) {
  const [visible, setVisible] = useState(false);
  const observerRef = useRef<IntersectionObserver | undefined>(undefined);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Once resolved, later remounts of the ref'd element (e.g. a ticker
  // change re-triggering the same async-gated div) shouldn't redo the
  // visibility check — it's already been seen, "fires once" per this
  // hook's own lifetime, not once per remount of what it's attached to.
  const resolvedRef = useRef(false);

  const ref = useCallback(
    (el: T | null) => {
      observerRef.current?.disconnect();
      observerRef.current = undefined;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = undefined;
      }

      if (!el || resolvedRef.current) return;

      // Deferred via setTimeout (not checked synchronously) because
      // viewport metrics/layout aren't guaranteed settled at the exact
      // moment a ref attaches — a requestAnimationFrame defer was tried
      // first, but headless/backgrounded tabs don't reliably run a
      // paint-driven rAF loop right after navigation. The
      // getBoundingClientRect check on top of the observer matters in its
      // own right: some engines don't reliably fire IntersectionObserver's
      // first callback for content already in the viewport when observed.
      timeoutRef.current = setTimeout(() => {
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight * 0.85 && rect.bottom > 0) {
          resolvedRef.current = true;
          setVisible(true);
          return;
        }

        const observer = new IntersectionObserver(
          ([entry]) => {
            if (entry.isIntersecting) {
              resolvedRef.current = true;
              setVisible(true);
              observer.disconnect();
            }
          },
          { threshold }
        );
        observer.observe(el);
        observerRef.current = observer;
      }, 0);
    },
    [threshold]
  );

  return { ref, visible };
}
