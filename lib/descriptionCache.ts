import fs from "fs";
import path from "path";

const CACHE_DIR = path.join(process.cwd(), "data");
const CACHE_FILE = path.join(CACHE_DIR, "company-descriptions.json");

type DescriptionCache = Record<string, string>;

function readCache(): DescriptionCache {
  try {
    const raw = fs.readFileSync(CACHE_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function getCachedDescription(ticker: string): string | null {
  const cache = readCache();
  return cache[ticker.toUpperCase()] ?? null;
}

export function setCachedDescription(ticker: string, description: string): void {
  const cache = readCache();
  cache[ticker.toUpperCase()] = description;

  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}
