import { Bitcoin } from "lucide-react";

// Blockchain-coin background for the Crypto section banner — a
// purple/blue/teal gradient wash (the section's own identity, kept
// distinct from Commodities' warm amber/bronze wash even though this
// header's *coin motif* borrows gold/bronze tones for material realism),
// two large slowly-rotating engraved-coin motifs (concentric rings, a
// milled/reeded edge, and radiating engine-turned rays — evoking the
// embossed face of a physical Bitcoin token), faint ticker symbols
// layered over the coins, a couple of minimal coin-logo glyphs, and an
// optional subtle sentiment-tinted glow. Pure CSS/SVG: no JS computation,
// no network cost, nothing to lazy-load.
//
// Every generated position/coordinate below is a fixed, deterministic
// value (hand-picked or computed once from a fixed formula, never
// Math.random()) and pre-rounded to at most 2 decimals — a prior bug
// traced a real hydration mismatch to an un-rounded Math.sin()-derived
// float in an inline style being formatted differently server vs. client
// (see the comment in components/stocks/StocksHeaderBackground.tsx); this
// file rounds every computed coordinate at generation time for the same
// reason, whether it ends up in a `style` prop or a plain SVG attribute.

// Faint ticker symbols layered over the coin motifs — fading in/out
// (plain opacity, no scale) so they read as signals flickering across the
// engraving rather than competing with the coins' own slow rotation.
const TICKER_SYMBOLS: Array<{ symbol: string; top: number; left: number; size: string; duration: string; delay: string }> = [
  { symbol: "BTC", top: 38, left: 20, size: "13px", duration: "4s", delay: "0s" },
  { symbol: "ETH", top: 66, left: 56, size: "13px", duration: "4.5s", delay: "1.2s" },
  { symbol: "SOL", top: 20, left: 76, size: "12px", duration: "5s", delay: "0.6s" },
  { symbol: "XRP", top: 82, left: 40, size: "12px", duration: "4.2s", delay: "1.8s" },
];

// Lucide has a Bitcoin glyph but nothing for Ethereum — this is a small
// hand-authored stand-in for its classic rotated-square/diamond mark,
// deliberately plain (no brand blue) so it blends into the pattern rather
// than reading as a literal logo.
function EthereumGlyph({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style} aria-hidden="true">
      <path d="M12 2 L19 12.5 L12 16.5 L5 12.5 Z" stroke="currentColor" strokeWidth={1.3} strokeLinejoin="round" />
      <path d="M12 16.5 L19 12.5 L12 22 L5 12.5 Z" stroke="currentColor" strokeWidth={1.3} strokeLinejoin="round" />
    </svg>
  );
}

// The coin motif's radiating engine-turned rays and milled edge ticks are
// generated once at module load from a fixed trig formula, centered on a
// local 0-100 viewBox (so the whole motif can be freely sized/positioned
// with ordinary CSS width/height/top/left) — same determinism reasoning
// as the node positions above, and every coordinate is rounded to 2
// decimals right here rather than left as a raw Math.cos/sin float.
const RAY_COUNT = 16;
const RAYS = Array.from({ length: RAY_COUNT }, (_, i) => {
  const angle = (i / RAY_COUNT) * Math.PI * 2;
  return {
    x1: Number((50 + Math.cos(angle) * 15).toFixed(2)),
    y1: Number((50 + Math.sin(angle) * 15).toFixed(2)),
    x2: Number((50 + Math.cos(angle) * 34).toFixed(2)),
    y2: Number((50 + Math.sin(angle) * 34).toFixed(2)),
  };
});

const EDGE_TICK_COUNT = 40;
const EDGE_TICKS = Array.from({ length: EDGE_TICK_COUNT }, (_, i) => {
  const angle = (i / EDGE_TICK_COUNT) * Math.PI * 2;
  return {
    x1: Number((50 + Math.cos(angle) * 46).toFixed(2)),
    y1: Number((50 + Math.sin(angle) * 46).toFixed(2)),
    x2: Number((50 + Math.cos(angle) * 49).toFixed(2)),
    y2: Number((50 + Math.sin(angle) * 49).toFixed(2)),
  };
});

interface CoinMotifProps {
  size: number;
  top: string;
  left: string;
  duration: string;
  reverse?: boolean;
  opacity: number;
}

// A large abstract "physical coin" texture — outer rim, a milled/reeded
// edge (short radial ticks just inside the rim), two inner concentric
// rings, and a sunburst of engine-turned rays — rendered in warm
// gold/bronze so it reads as metal engraving even against this section's
// purple/teal base wash. Rotation is the "light catching the etching"
// effect: transform-only, so it stays cheap and motion_reduce-friendly.
function CoinMotif({ size, top, left, duration, reverse, opacity }: CoinMotifProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      className="absolute animate-coin-rotate text-amber-400 motion-reduce:animate-none"
      style={{
        top,
        left,
        width: size,
        height: size,
        opacity,
        animationDuration: duration,
        animationDirection: reverse ? "reverse" : "normal",
      }}
      aria-hidden="true"
    >
      <circle cx={50} cy={50} r={49} fill="none" stroke="currentColor" strokeWidth={0.6} />
      <circle cx={50} cy={50} r={40} fill="none" stroke="currentColor" strokeWidth={0.4} />
      <circle cx={50} cy={50} r={14} fill="none" stroke="currentColor" strokeWidth={0.4} />
      {EDGE_TICKS.map((tick, i) => (
        <line key={`tick-${i}`} x1={tick.x1} y1={tick.y1} x2={tick.x2} y2={tick.y2} stroke="currentColor" strokeWidth={0.5} />
      ))}
      {RAYS.map((ray, i) => (
        <line key={`ray-${i}`} x1={ray.x1} y1={ray.y1} x2={ray.x2} y2={ray.y2} stroke="currentColor" strokeWidth={0.4} />
      ))}
    </svg>
  );
}

interface CryptoHeaderBackgroundProps {
  // 24h global market-cap % change, already fetched by the crypto page's
  // own shared data (see app/api/crypto/global) — passed through rather
  // than fetched again here, so this stays a pure presentational
  // background with no data dependency of its own. Undefined/null just
  // skips the tint (plain purple/blue/teal base only).
  sentiment?: number | null;
}

export default function CryptoHeaderBackground({ sentiment = null }: CryptoHeaderBackgroundProps) {
  const sentimentClass =
    sentiment != null && sentiment > 0
      ? "from-amber-500/25"
      : sentiment != null && sentiment < 0
        ? "from-cyan-500/25"
        : null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Slowly shifting purple/blue/teal gradient wash — this section's
          own identity, kept distinct from Commodities' amber wash even
          though the coin motifs below borrow gold tones. */}
      <div className="absolute inset-0 animate-crypto-gradient bg-gradient-to-br from-neutral-950 via-purple-950 to-neutral-950 bg-[length:200%_200%] motion-reduce:animate-none" />
      <div className="absolute inset-0 bg-gradient-to-tl from-teal-500/10 via-transparent to-blue-500/10" />

      {/* Optional sentiment glow — a soft radial blob, warm on a positive
          24h market move, cool on a negative one. Subtle and slow so it
          reads as ambient mood, not a data callout. */}
      {sentimentClass && (
        <div
          className={`absolute -top-1/4 left-1/2 h-[140%] w-[70%] -translate-x-1/2 animate-pulse-glow rounded-full bg-[radial-gradient(circle,var(--tw-gradient-stops))] to-transparent opacity-40 blur-3xl motion-reduce:animate-none ${sentimentClass}`}
          style={{ animationDuration: "6s" }}
        />
      )}

      {/* Large engraved-coin motifs — one big one bleeding off the bottom-
          left corner, a smaller one top-right, rotating in opposite
          directions at different speeds so they don't read as one
          synchronized shape. */}
      <CoinMotif size={340} top="-38%" left="-14%" duration="110s" opacity={0.12} />
      <CoinMotif size={190} top="-14%" left="74%" duration="75s" reverse opacity={0.1} />

      {/* Faint ticker symbols fading in/out over the coin motifs */}
      <div className="absolute inset-0" aria-hidden="true">
        {TICKER_SYMBOLS.map((ticker, i) => (
          <span
            key={i}
            className="absolute -translate-x-1/2 -translate-y-1/2 animate-pulse font-mono font-semibold tracking-wide text-purple-200/25 motion-reduce:animate-none"
            style={{
              top: `${ticker.top}%`,
              left: `${ticker.left}%`,
              fontSize: ticker.size,
              animationDuration: ticker.duration,
              animationDelay: ticker.delay,
            }}
          >
            {ticker.symbol}
          </span>
        ))}
      </div>

      {/* Minimal coin-logo glyphs — tinted to match the palette rather
          than brand colors, sized small so they read as part of the
          texture, not literal logos. */}
      <div className="absolute inset-0" aria-hidden="true">
        <Bitcoin
          aria-hidden="true"
          className="absolute -translate-x-1/2 -translate-y-1/2 animate-crypto-float text-amber-200/20 motion-reduce:animate-none"
          style={{ top: "48%", left: "34%", width: 26, height: 26, animationDuration: "10s", animationDelay: "0.4s" }}
        />
        <EthereumGlyph
          className="absolute -translate-x-1/2 -translate-y-1/2 animate-crypto-float text-teal-200/20 motion-reduce:animate-none"
          style={{ top: "26%", left: "58%", width: 24, height: 24, animationDuration: "11s", animationDelay: "1.1s" }}
        />
      </div>
    </div>
  );
}
