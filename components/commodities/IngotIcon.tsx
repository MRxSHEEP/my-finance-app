interface IngotIconProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

// A minimal bullion-bar silhouette — lucide has no dedicated ingot icon,
// so this is a small hand-authored stand-in, used anywhere gold/silver
// (and any other precious metal) need a bar/ingot glyph instead of a
// gem/coin-shaped one: the commodities header background and the
// commodity grid's icon badges both reuse this one component so the two
// stay visually consistent with each other.
export function IngotIcon({ size = 24, className, style }: IngotIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <path
        d="M4.5 16.5 L6.75 7.5 L17.25 7.5 L19.5 16.5 Z"
        fill="currentColor"
        fillOpacity={0.18}
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
      <path d="M8.25 10.8 L15.75 10.8" stroke="currentColor" strokeWidth={0.9} strokeLinecap="round" opacity={0.55} />
    </svg>
  );
}
