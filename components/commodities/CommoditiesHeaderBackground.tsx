import { Flame, Wheat } from "lucide-react";
import { IngotIcon } from "./IngotIcon";

// Physical/raw-materials background for the Commodities section banner —
// a warm amber/bronze/gold gradient wash, slow-drifting topographic
// contour lines, a fine drifting grain/particle texture, faint drifting
// ticker symbols, and a few faint oil/metals/agriculture icon silhouettes
// (gold and silver use the shared bar/ingot glyph, not a gem/coin shape —
// see components/commodities/IngotIcon.tsx). Pure CSS/SVG, nothing to
// lazy-load.
//
// Contour paths are generated once at module load from a fixed sine
// formula (not Math.random), so the server-rendered and client-hydrated
// markup always match — same determinism reasoning as the stocks header's
// candlestick heights. All values embedded in inline styles below are
// either whole integers or fixed strings for the same reason: a prior
// hydration bug traced back to an un-rounded Math.sin()-derived float in
// an inline style being formatted differently server vs. client (see the
// comment in components/stocks/StocksHeaderBackground.tsx).
function buildContourPath(baseline: number, amplitude: number, freq: number, phase: number): string {
  const points: string[] = [];
  for (let x = 0; x <= 800; x += 40) {
    const y = baseline + Math.sin(x * freq + phase) * amplitude;
    points.push(`${x === 0 ? "M" : "L"}${x},${y.toFixed(1)}`);
  }
  return points.join(" ");
}

const CONTOURS: Array<{ path: string; opacity: number }> = [
  { path: buildContourPath(30, 10, 0.012, 0), opacity: 0.16 },
  { path: buildContourPath(55, 14, 0.01, 1.1), opacity: 0.2 },
  { path: buildContourPath(85, 11, 0.014, 2.3), opacity: 0.16 },
  { path: buildContourPath(115, 16, 0.009, 0.6), opacity: 0.2 },
  { path: buildContourPath(145, 9, 0.013, 1.8), opacity: 0.14 },
];

// Fine drifting particles suggestive of dust/grain/ore — fixed positions,
// varying size/duration/delay for a naturally uneven drift.
const GRAIN_PARTICLES: Array<{ top: string; left: string; size: number; duration: string; delay: string }> = [
  { top: "20%", left: "8%", size: 3, duration: "9s", delay: "0s" },
  { top: "65%", left: "15%", size: 2, duration: "11s", delay: "1.1s" },
  { top: "35%", left: "22%", size: 4, duration: "7.5s", delay: "0.4s" },
  { top: "75%", left: "34%", size: 2, duration: "10s", delay: "2s" },
  { top: "15%", left: "44%", size: 3, duration: "8.5s", delay: "0.8s" },
  { top: "55%", left: "55%", size: 2, duration: "12s", delay: "1.6s" },
  { top: "28%", left: "63%", size: 4, duration: "9.5s", delay: "0.3s" },
  { top: "70%", left: "72%", size: 2, duration: "10.5s", delay: "2.4s" },
  { top: "18%", left: "80%", size: 3, duration: "8s", delay: "1.3s" },
  { top: "60%", left: "88%", size: 2, duration: "11.5s", delay: "0.6s" },
  { top: "42%", left: "94%", size: 3, duration: "9.2s", delay: "1.9s" },
];

// Gold and silver both use the ingot glyph (tinted per metal); oil/gas and
// agriculture keep their existing, already-good icon choices.
const MATERIAL_ICONS: Array<{
  kind: "ingot" | "lucide";
  Icon?: typeof Flame;
  top: string;
  left: string;
  size: number;
  duration: string;
  delay: string;
  className: string;
}> = [
  { kind: "ingot", top: "24%", left: "18%", size: 28, duration: "10s", delay: "0.2s", className: "text-amber-300/25" },
  { kind: "ingot", top: "68%", left: "12%", size: 24, duration: "9s", delay: "1.4s", className: "text-zinc-300/20" },
  { kind: "lucide", Icon: Flame, top: "62%", left: "50%", size: 34, duration: "11s", delay: "1s", className: "text-orange-400/20" },
  { kind: "lucide", Icon: Wheat, top: "30%", left: "80%", size: 28, duration: "9.5s", delay: "1.6s", className: "text-yellow-500/25" },
];

// Faint commodity ticker symbols — the futures-style codes traders
// actually use (GC=gold, SI=silver, CL=WTI crude, NG=natural gas,
// HG=copper), drifting the same way the material icons do so the two
// layers read as one consistent texture rather than two unrelated ones.
const TICKER_SYMBOLS: Array<{ symbol: string; top: string; left: string; size: string; duration: string; delay: string }> = [
  { symbol: "GC", top: "16%", left: "28%", size: "13px", duration: "10s", delay: "0.3s" },
  { symbol: "SI", top: "46%", left: "6%", size: "12px", duration: "11.5s", delay: "1.2s" },
  { symbol: "CL", top: "72%", left: "22%", size: "13px", duration: "9s", delay: "0.7s" },
  { symbol: "NG", top: "20%", left: "60%", size: "12px", duration: "10.5s", delay: "1.9s" },
  { symbol: "HG", top: "58%", left: "40%", size: "13px", duration: "9.5s", delay: "0.5s" },
  { symbol: "GC", top: "34%", left: "90%", size: "12px", duration: "11s", delay: "1.1s" },
  { symbol: "SI", top: "78%", left: "68%", size: "13px", duration: "10s", delay: "2.1s" },
];

export default function CommoditiesHeaderBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Slowly shifting warm amber/bronze gradient wash */}
      <div className="absolute inset-0 animate-crypto-gradient bg-gradient-to-br from-neutral-950 via-amber-950 to-neutral-950 bg-[length:200%_200%] motion-reduce:animate-none" />

      {/* Slow-drifting topographic contour lines */}
      <div className="absolute inset-0 flex h-full w-max animate-contour-drift motion-reduce:animate-none">
        {[0, 1].map((copy) => (
          <svg key={copy} viewBox="0 0 800 176" width={800} height="100%" className="shrink-0 text-amber-200">
            {CONTOURS.map((contour, i) => (
              <path
                key={i}
                d={contour.path}
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                style={{ opacity: contour.opacity }}
              />
            ))}
          </svg>
        ))}
      </div>

      {/* Drifting grain/dust particles */}
      <div className="absolute inset-0" aria-hidden="true">
        {GRAIN_PARTICLES.map((particle, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-amber-200/40 motion-reduce:animate-none animate-crypto-float"
            style={{
              top: particle.top,
              left: particle.left,
              width: particle.size,
              height: particle.size,
              animationDuration: particle.duration,
              animationDelay: particle.delay,
            }}
          />
        ))}
      </div>

      {/* Faint drifting ticker symbols */}
      <div className="absolute inset-0" aria-hidden="true">
        {TICKER_SYMBOLS.map((ticker, i) => (
          <span
            key={i}
            className="absolute font-mono font-semibold tracking-wide text-amber-200/20 motion-reduce:animate-none animate-crypto-float"
            style={{
              top: ticker.top,
              left: ticker.left,
              fontSize: ticker.size,
              animationDuration: ticker.duration,
              animationDelay: ticker.delay,
            }}
          >
            {ticker.symbol}
          </span>
        ))}
      </div>

      {/* Faint metals / oil-gas / agriculture silhouettes */}
      <div className="absolute inset-0" aria-hidden="true">
        {MATERIAL_ICONS.map((item, i) => {
          const commonStyle = {
            top: item.top,
            left: item.left,
            width: item.size,
            height: item.size,
            animationDuration: item.duration,
            animationDelay: item.delay,
          };
          return item.kind === "ingot" ? (
            <IngotIcon
              key={i}
              size={item.size}
              className={`absolute animate-crypto-float motion-reduce:animate-none ${item.className}`}
              style={commonStyle}
            />
          ) : (
            item.Icon && (
              <item.Icon
                key={i}
                aria-hidden="true"
                className={`absolute animate-crypto-float motion-reduce:animate-none ${item.className}`}
                style={commonStyle}
              />
            )
          );
        })}
      </div>
    </div>
  );
}
