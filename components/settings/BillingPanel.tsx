"use client";

import { useState } from "react";
import { cardClass } from "@/lib/cardStyles";

interface BillingPanelProps {
  billingActive: boolean;
  seatCount: number;
}

export default function BillingPanel({ billingActive, seatCount }: BillingPanelProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStartSubscription() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/org/billing/checkout", { method: "POST" });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? "Failed to start checkout");
        return;
      }
      window.location.href = body.url;
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={cardClass("neutral", { extra: "flex flex-col gap-3 p-4" })}>
      <h3 className="text-sm font-semibold text-foreground">Billing</h3>
      <p className="text-sm text-foreground/70">
        {seatCount} seat{seatCount === 1 ? "" : "s"} — {billingActive ? "billed per-seat, monthly" : "not yet billed"}
      </p>
      {billingActive ? (
        <p className="text-xs text-foreground/50">
          Adding or removing a member automatically adjusts the subscription&apos;s billed quantity.
        </p>
      ) : (
        <>
          <button
            type="button"
            disabled={submitting}
            onClick={handleStartSubscription}
            className="self-start rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Redirecting…" : "Start subscription"}
          </button>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </>
      )}
    </div>
  );
}
