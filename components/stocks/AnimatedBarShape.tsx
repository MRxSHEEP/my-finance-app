// A custom recharts `shape` renderer (used by both EarningsCard and
// DividendsCard) that draws a rounded-top-only bar — recharts' own
// `radius` prop can do this too, but only with its default (instant)
// rectangle; going custom lets each bar also carry a per-index CSS
// `animation-delay` (via the shared `animate-bar-grow` keyframe declared
// in globals.css) for the cascading grow-in, which recharts' own
// `isAnimationActive` has no per-bar-stagger equivalent for.
const MAX_RADIUS = 6;
const STAGGER_MS = 60;

interface AnimatedBarShapeProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
  index?: number;
}

function topRoundedRectPath(x: number, y: number, width: number, height: number, radius: number): string {
  const r = Math.max(0, Math.min(radius, height, width / 2));
  return `M${x},${y + height} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + width - r},${y} Q${x + width},${y} ${x + width},${y + r} L${x + width},${y + height} Z`;
}

export function AnimatedBarShape({ x = 0, y = 0, width = 0, height = 0, fill, index = 0 }: AnimatedBarShapeProps) {
  if (width <= 0 || height <= 0) return null;

  return (
    <path
      d={topRoundedRectPath(x, y, width, height, MAX_RADIUS)}
      fill={fill}
      className="animate-bar-grow"
      style={{
        transformBox: "fill-box",
        transformOrigin: "bottom",
        animationDelay: `${index * STAGGER_MS}ms`,
      }}
    />
  );
}
