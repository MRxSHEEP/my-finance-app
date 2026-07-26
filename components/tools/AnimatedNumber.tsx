"use client";

import { useCountUp } from "@/lib/useCountUp";

// Drop-in replacement for calling `format(value)` directly in a Result
// section — animates the displayed number toward its new target
// (count-up/down) instead of snapping instantly whenever an input changes.
export default function AnimatedNumber({
  value,
  format,
}: {
  value: number;
  format: (value: number) => string;
}) {
  const animated = useCountUp(value);
  return <>{format(animated)}</>;
}
