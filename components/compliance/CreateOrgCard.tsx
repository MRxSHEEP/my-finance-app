"use client";

import { useState } from "react";
import { cardClass } from "@/lib/cardStyles";

interface CreateOrgCardProps {
  onCreated: () => void;
}

export default function CreateOrgCard({ onCreated }: CreateOrgCardProps) {
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError("Organization name is required");

    setSubmitting(true);
    try {
      const res = await fetch("/api/compliance/organization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) return setError(body?.error ?? "Failed to create organization");
      onCreated();
    } catch {
      setError("Failed to create organization");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={cardClass("indigo", { extra: "flex w-full max-w-md flex-col gap-4 p-6" })}>
      <div>
        <h2 className="text-lg font-semibold text-foreground">Create your organization</h2>
        <p className="text-sm text-foreground/50">
          You&apos;ll become its first Admin. Have an invite link instead? Open it directly to join an existing
          organization.
        </p>
      </div>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Organization name"
        className="w-full rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-400/50 dark:border-white/15 dark:focus:border-blue-400/50"
      />
      {error && <p className="text-sm text-red-500">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="self-start rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? "Creating…" : "Create organization"}
      </button>
    </form>
  );
}
