"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import type { ComplianceRole } from "@/lib/compliance/roles";
import CreateOrgCard from "@/components/compliance/CreateOrgCard";
import ComplianceDashboard from "@/components/compliance/ComplianceDashboard";
import EmployeeComplianceView from "@/components/compliance/EmployeeComplianceView";

interface OrgState {
  organization: { id: string; name: string } | null;
  role: ComplianceRole | null;
}

export default function CompliancePage() {
  const { status } = useSession();
  const [orgState, setOrgState] = useState<OrgState | null>(null);
  const [loadingOrg, setLoadingOrg] = useState(true);
  // Bumped after CreateOrgCard successfully creates an org, to re-run the
  // effect below — matches components/portfolio/SimulatedPortfolioDetailView.tsx's
  // refreshToken idiom rather than exposing a directly-callable reload
  // function (which the React Compiler's set-state-in-effect check flags).
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;

    async function loadOrg() {
      setLoadingOrg(true);
      try {
        const res = await fetch("/api/compliance/organization");
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
  }, [status, refreshToken]);

  if (status === "loading") {
    return (
      <main className="flex flex-1 flex-col items-center gap-6 p-8 pt-16">
        <h1 className="text-3xl font-bold text-foreground">Compliance</h1>
      </main>
    );
  }

  if (status !== "authenticated") {
    return (
      <main className="flex flex-1 flex-col items-center gap-4 p-8 pt-16 text-center">
        <h1 className="text-3xl font-bold text-foreground">Compliance</h1>
        <p className="text-foreground/60">Sign in to access your organization&apos;s compliance tools.</p>
        <Link href="/login" className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90">
          Sign In
        </Link>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col items-center gap-6 p-8 pt-16">
      <div className="flex flex-col items-center gap-1 text-center">
        <h1 className="text-3xl font-bold text-foreground">Compliance</h1>
        {orgState?.organization && <p className="text-sm text-foreground/50">{orgState.organization.name}</p>}
      </div>

      {loadingOrg || !orgState ? (
        <div className="h-24 w-full max-w-md animate-pulse rounded-md bg-foreground/10" />
      ) : !orgState.organization || !orgState.role ? (
        <CreateOrgCard onCreated={() => setRefreshToken((t) => t + 1)} />
      ) : orgState.role === "employee" ? (
        <EmployeeComplianceView />
      ) : (
        <ComplianceDashboard />
      )}
    </main>
  );
}
