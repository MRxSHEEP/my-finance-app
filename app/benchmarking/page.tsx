"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import BenchmarkingWorkspace from "@/components/benchmarking/BenchmarkingWorkspace";

interface OrganizationInfo {
  id: string;
  name: string;
  logoUrl: string | null;
  brandColor: string | null;
}

interface OrgState {
  organization: OrganizationInfo | null;
  role: string | null;
}

// Mirrors app/reporting/page.tsx's exact gate structure. Fetches org info
// once here (including the newly-added logoUrl/brandColor fields) and
// passes it down, rather than having BenchmarkDashboard re-fetch the same
// route just for branding.
export default function BenchmarkingPage() {
  const { status } = useSession();
  const [orgState, setOrgState] = useState<OrgState | null>(null);
  const [loadingOrg, setLoadingOrg] = useState(true);

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;

    async function loadOrg() {
      setLoadingOrg(true);
      try {
        const res = await fetch("/api/reporting/organization");
        const body = await res.json().catch(() => null);
        if (cancelled) return;
        setOrgState({ organization: body?.organization ?? null, role: body?.role ?? null });
      } finally {
        if (!cancelled) setLoadingOrg(false);
      }
    }

    loadOrg();
    return () => {
      cancelled = true;
    };
  }, [status]);

  if (status === "loading") {
    return (
      <main className="flex flex-1 flex-col items-center gap-6 p-8 pt-16">
        <h1 className="text-3xl font-bold text-foreground">Peer Benchmarking</h1>
      </main>
    );
  }

  if (status !== "authenticated") {
    return (
      <main className="flex flex-1 flex-col items-center gap-4 p-8 pt-16 text-center">
        <h1 className="text-3xl font-bold text-foreground">Peer Benchmarking</h1>
        <p className="text-foreground/60">Sign in to view your firm&apos;s benchmarking dashboard.</p>
        <Link href="/login" className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90">
          Sign In
        </Link>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col items-center gap-6 p-8 pt-16">
      <div className="flex flex-col items-center gap-1 text-center">
        <h1 className="text-3xl font-bold text-foreground">Peer Benchmarking</h1>
        {orgState?.organization && <p className="text-sm text-foreground/50">{orgState.organization.name}</p>}
      </div>

      {loadingOrg || !orgState ? (
        <div className="h-24 w-full max-w-md animate-pulse rounded-md bg-foreground/10" />
      ) : !orgState.organization ? (
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-foreground/60">You don&apos;t belong to an organization yet.</p>
          <Link href="/compliance" className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90">
            Go to Compliance
          </Link>
        </div>
      ) : !orgState.role ? (
        <p className="text-foreground/60">Ask your organization&apos;s Admin to grant you Reporting access.</p>
      ) : (
        <BenchmarkingWorkspace organization={orgState.organization} />
      )}
    </main>
  );
}
