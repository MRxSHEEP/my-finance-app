import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @napi-rs/canvas ships a prebuilt native .node binding (used by
  // lib/trackers/ocrFallback.ts to rasterize PDF pages for OCR) — Next's
  // default Server Components bundling doesn't know how to handle a native
  // addon it isn't already aware of (unlike e.g. `canvas`, `sharp`, which
  // are on Next's own built-in externals list) and fails at runtime with
  // "Cannot find native binding" once bundled. Opting it out here makes
  // Next use a plain Node `require` for it instead, matching how the
  // already-externalized `canvas`/`sharp` packages are handled.
  // pdfjs-dist's own worker-loading logic (a dynamic import resolving its
  // pdf.worker.mjs relative to its own package location) breaks the same
  // way once Turbopack bundles it into a chunk under a different physical
  // path ("Setting up fake worker failed: Cannot find module
  // '...pdf.worker.mjs'", confirmed live) — externalizing it too lets
  // Node's own module resolution find the real file next to the real
  // package instead.
  // tesseract.js spawns its own worker_threads-based OCR worker and needs
  // real filesystem paths to locate its worker script + WASM/language data
  // — this reproduced cleanly in plain Node but broke under Turbopack's
  // bundling with "Cannot transfer object of unsupported type" (confirmed
  // live), the same class of problem as the two packages above.
  serverExternalPackages: ["@napi-rs/canvas", "pdfjs-dist", "tesseract.js"],
};

export default nextConfig;
