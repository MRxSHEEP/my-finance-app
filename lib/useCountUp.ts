import { useEffect, useRef, useState } from "react";

const DEFAULT_DURATION_MS = 500;

// Animates a displayed number from its previous value to a new target
// whenever the target changes, via requestAnimationFrame (not a timer
// loop) — used by every calculator's Result section so a recalculated
// figure counts up/down smoothly instead of snapping instantly, per the
// "richer result presentation" pass. Returns the raw animated number; the
// caller formats it (currency/percent/ratio) same as it always did with
// the static value, so swapping this in is a drop-in change.
export function useCountUp(target: number, durationMs = DEFAULT_DURATION_MS): number {
  const [displayValue, setDisplayValue] = useState(target);
  const fromRef = useRef(target);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!Number.isFinite(target)) return;

    // Animating from whatever's currently on screen (not the previous
    // target) means a second rapid change interrupts smoothly instead of
    // jumping back to the old target first.
    fromRef.current = displayValue;
    startRef.current = null;
    const from = fromRef.current;

    function step(timestamp: number) {
      if (startRef.current === null) startRef.current = timestamp;
      const elapsed = timestamp - startRef.current;
      const progress = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setDisplayValue(from + (target - from) * eased);
      if (progress < 1) rafRef.current = requestAnimationFrame(step);
    }

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // `displayValue` is intentionally omitted — it's read once above (via
    // fromRef) at the moment `target` changes, not tracked continuously;
    // including it would restart the animation on every single frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, durationMs]);

  return Number.isFinite(target) ? displayValue : target;
}
