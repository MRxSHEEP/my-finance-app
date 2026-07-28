"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import SimulatedPortfolioSection from "@/components/portfolio/SimulatedPortfolioSection";
import SimulatedPortfolioWalkthrough from "@/components/portfolio/preview/SimulatedPortfolioWalkthrough";

// The manual real-holdings tracker previously lived behind a Real/Simulated
// toggle on this page — it's been relocated to app/portfolio/real (kept
// intact, just unlinked from navigation) now that Simulated is the only
// mode shown here, per the "gate it off, don't delete it" approach used
// elsewhere in this app for features pending a decision.
export default function PortfolioPage() {
  const { status } = useSession();

  if (status === "loading") {
    return (
      <main className="flex flex-1 flex-col items-center gap-6 p-8 pt-16">
        <h1 className="text-3xl font-bold text-foreground">Simulated Portfolio</h1>
      </main>
    );
  }

  if (status !== "authenticated") {
    return (
      <main className="flex flex-1 flex-col items-center gap-6 p-8 pt-16 text-center">
        <div className="flex flex-col items-center gap-1">
          <h1 className="text-3xl font-bold text-foreground">Simulated Portfolio</h1>
          <p className="text-foreground/60">See how paper trading, performance tracking, and multi-asset holdings work before you sign in.</p>
        </div>
        <SimulatedPortfolioWalkthrough />
        <p className="text-sm text-foreground/60">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-foreground hover:underline">
            Sign in
          </Link>
        </p>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col items-center gap-6 p-8 pt-16">
      <h1 className="text-3xl font-bold text-foreground">Simulated Portfolio</h1>

      <div className="flex w-full max-w-5xl flex-col gap-8">
        <Suspense fallback={<div className="h-24 w-full animate-pulse rounded-md bg-foreground/10" />}>
          <SimulatedPortfolioSection />
        </Suspense>
      </div>
    </main>
  );
}
