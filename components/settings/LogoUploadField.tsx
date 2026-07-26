"use client";

import { useRef, useState } from "react";

interface LogoUploadFieldProps {
  logoUrl: string | null;
  onUploaded: (logoUrl: string) => void;
}

// Plain <img>, not next/image — matches components/stocks/StockLogo.tsx's
// established pattern for a dynamically-sourced logo URL, deliberately
// avoiding a next.config.ts images.remotePatterns change for a Vercel Blob
// hostname.
export default function LogoUploadField({ logoUrl, onUploaded }: LogoUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("logo", file);
      const res = await fetch("/api/org/logo", { method: "POST", body: formData });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? "Failed to upload logo");
        return;
      }
      onUploaded(body.logoUrl);
    } catch {
      setError("Failed to upload logo");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-md border border-black/10 bg-foreground/5 dark:border-white/15">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" width={56} height={56} className="h-full w-full object-contain" />
        ) : (
          <span className="text-[10px] text-foreground/40">No logo</span>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <label className="w-fit cursor-pointer rounded-md border border-black/10 px-3 py-1.5 text-xs font-medium text-foreground/70 hover:text-foreground dark:border-white/15">
          {uploading ? "Uploading…" : "Upload logo"}
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            onChange={handleFileChange}
            disabled={uploading}
            className="hidden"
          />
        </label>
        {error && <span className="text-xs text-red-500">{error}</span>}
      </div>
    </div>
  );
}
