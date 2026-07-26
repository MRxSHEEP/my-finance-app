// The "legacy" Node-targeted build of pdfjs-dist — the standard build
// assumes DOM APIs (Worker, Path2D, etc.) that don't exist in a server
// route; the legacy build is Mozilla's own supported entry point for
// exactly this (Node.js, no DOM).
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

export interface ExtractedPage {
  pageNumber: number;
  lines: string[];
  // True when a page has a nonzero size but ~no extractable text — the
  // signature of a scanned image embedded in the PDF rather than real
  // text content, meaning OCR (lib/trackers/ocrFallback.ts) is the only
  // way to read it.
  looksScanned: boolean;
}

// A page with fewer than this many extracted characters (for a
// non-trivial page) is treated as scanned rather than "just a short
// page" — PTR cover pages can legitimately be sparse, but a genuinely
// scanned filing has effectively zero real text, not just a little.
const SCANNED_TEXT_THRESHOLD = 20;
// Text items within this many PDF points of each other vertically are
// treated as being on the same visual line — reconstructs column layout
// (mirroring `pdftotext -layout`) from pdf.js's item-by-item positions,
// since pdf.js's own getTextContent() has no built-in layout mode.
const LINE_Y_TOLERANCE = 3;

export async function extractPdfPages(pdfBytes: Uint8Array): Promise<ExtractedPage[]> {
  const doc = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
  const pages: ExtractedPage[] = [];

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();

    interface PositionedItem {
      x: number;
      y: number;
      text: string;
    }
    const items: PositionedItem[] = content.items
      .filter((item): item is typeof item & { str: string; transform: number[] } => "transform" in item && item.str.trim().length > 0)
      .map((item) => ({
        x: item.transform[4],
        y: item.transform[5],
        text: item.str,
      }));

    // Group into lines by y-coordinate (PDF y increases upward, so sort
    // descending to read top-to-bottom), then sort each line's items by x
    // (left-to-right) before joining — this is what recovers column
    // structure from pdf.js's otherwise-unordered-by-visual-position item
    // stream.
    const sortedByY = [...items].sort((a, b) => b.y - a.y);
    const lineGroups: PositionedItem[][] = [];
    for (const item of sortedByY) {
      const currentLine = lineGroups[lineGroups.length - 1];
      if (currentLine && Math.abs(currentLine[0].y - item.y) <= LINE_Y_TOLERANCE) {
        currentLine.push(item);
      } else {
        lineGroups.push([item]);
      }
    }

    const lines = lineGroups.map((line) =>
      [...line]
        .sort((a, b) => a.x - b.x)
        .map((item) => item.text)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim()
    );

    const totalChars = lines.reduce((sum, line) => sum + line.length, 0);
    pages.push({ pageNumber: pageNum, lines, looksScanned: totalChars < SCANNED_TEXT_THRESHOLD });
  }

  return pages;
}
