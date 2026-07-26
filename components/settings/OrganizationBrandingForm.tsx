"use client";

import { useState } from "react";
import { cardClass } from "@/lib/cardStyles";
import LogoUploadField from "@/components/settings/LogoUploadField";

interface OrganizationInfo {
  id: string;
  name: string;
  logoUrl: string | null;
  brandColor: string | null;
  billingActive: boolean;
}

interface OrganizationBrandingFormProps {
  organization: OrganizationInfo;
  onUpdated: (organization: OrganizationInfo) => void;
}

const DEFAULT_BRAND_COLOR = "#6366f1";

export default function OrganizationBrandingForm({ organization, onUpdated }: OrganizationBrandingFormProps) {
  const [name, setName] = useState(organization.name);
  const [brandColor, setBrandColor] = useState(organization.brandColor ?? DEFAULT_BRAND_COLOR);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setSubmitting(true);
    try {
      const res = await fetch("/api/org/organization", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, brandColor }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) return setError(body?.error ?? "Failed to save");
      onUpdated(body.organization);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSubmitting(false);
    }
  }

  function handleLogoUploaded(logoUrl: string) {
    onUpdated({ ...organization, logoUrl });
  }

  return (
    <form onSubmit={handleSubmit} className={cardClass("indigo", { extra: "flex flex-col gap-4 p-4" })}>
      <h3 className="text-sm font-semibold text-foreground">Firm branding</h3>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-foreground">Firm name</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full max-w-sm rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-400/50 dark:border-white/15 dark:focus:border-blue-400/50"
        />
      </label>

      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-foreground">Logo</span>
        <LogoUploadField logoUrl={organization.logoUrl} onUploaded={handleLogoUploaded} />
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-foreground">Brand color</span>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={brandColor}
            onChange={(e) => setBrandColor(e.target.value)}
            className="h-9 w-9 cursor-pointer rounded-md border border-black/10 bg-transparent p-0.5 dark:border-white/15"
          />
          <input
            type="text"
            value={brandColor}
            onChange={(e) => setBrandColor(e.target.value)}
            className="w-28 rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-400/50 dark:border-white/15 dark:focus:border-blue-400/50"
          />
        </div>
        <span className="text-xs text-foreground/50">Applied to white-label reports once that feature ships.</span>
      </label>

      {error && <p className="text-sm text-red-500">{error}</p>}
      {saved && <p className="text-sm text-green-500">Saved.</p>}

      <button
        type="submit"
        disabled={submitting}
        className="self-start rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
