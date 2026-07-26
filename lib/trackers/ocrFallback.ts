import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { createCanvas } from "@napi-rs/canvas";
import { createWorker } from "tesseract.js";

// Fallback path for scanned/image-based PTR pages (older filings, or a
// filer who submitted a paper form that was later scanned) — detected by
// lib/trackers/pdfExtract.ts's `looksScanned` flag (a page with real
// content but ~no extractable text). Renders the page to a raster image
// via pdfjs-dist + @napi-rs/canvas (a prebuilt-binary canvas
// implementation — no native build step, unlike node-canvas, which
// matters for a serverless deploy target), then runs it through
// Tesseract. This is a real fallback path, not a stub — but OCR output on
// a scanned government form is inherently less reliable than the
// text-based path, so callers should treat lines from here as lower
// confidence and log liberally rather than assume clean structure.
const OCR_RENDER_SCALE = 2.5; // higher than 1:1 improves OCR accuracy on small print

export async function ocrPdfPage(pdfBytes: Uint8Array, pageNumber: number): Promise<string[]> {
  const doc = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale: OCR_RENDER_SCALE });

  const canvas = createCanvas(viewport.width, viewport.height);
  const context = canvas.getContext("2d");

  await page.render({
    // pdfjs-dist's render() types are written against DOM canvas types;
    // @napi-rs/canvas's implementation is API-compatible but not the same
    // TS type, hence the casts.
    canvasContext: context as unknown as CanvasRenderingContext2D,
    canvas: canvas as unknown as HTMLCanvasElement,
    viewport,
  }).promise;

  const pngBuffer = canvas.toBuffer("image/png");
  // A base64 data URL, not the raw Buffer, is passed to tesseract.js —
  // confirmed live that passing the Buffer directly crashes with "Cannot
  // transfer object of unsupported type" specifically when running inside
  // Next's dev server (the same code ran fine standalone in plain Node),
  // consistent with a realm/worker_threads structured-clone mismatch
  // introduced by Next's dev-mode module bundling. A string input sidesteps
  // that transfer mechanism entirely.
  const dataUrl = `data:image/png;base64,${pngBuffer.toString("base64")}`;

  const worker = await createWorker("eng");
  try {
    const { data } = await worker.recognize(dataUrl);
    return data.text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  } finally {
    await worker.terminate();
  }
}
