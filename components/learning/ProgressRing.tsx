export type TopicStatus = "not-started" | "in-progress" | "completed";

interface ProgressRingProps {
  percent: number;
  // A full Tailwind stroke-color class (e.g. "stroke-blue-400") rather
  // than a status enum — each topic card supplies its own accent color
  // so the ring ties into that card's identity instead of a universal
  // status color.
  strokeClassName: string;
  size?: number;
  strokeWidth?: number;
  children?: React.ReactNode;
}

export default function ProgressRing({
  percent,
  strokeClassName,
  size = 56,
  strokeWidth = 4,
  children,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, percent));
  const offset = circumference * (1 - clamped / 100);

  return (
    <div className="relative flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          fill="none"
          className="stroke-black/10 dark:stroke-white/15"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={`transition-[stroke-dashoffset] duration-500 ease-out ${strokeClassName}`}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}
