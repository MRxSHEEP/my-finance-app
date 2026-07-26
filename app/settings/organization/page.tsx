"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import OrganizationBrandingForm from "@/components/settings/OrganizationBrandingForm";
import TeamManagementPanel from "@/components/settings/TeamManagementPanel";
import BillingPanel from "@/components/settings/BillingPanel";

interface OrganizationInfo {
  id: string;
  name: string;
  logoUrl: string | null;
  brandColor: string | null;
  billingActive: boolean;
}

export default function OrganizationSettingsPage() {
  const { status } = useSession();
  const [organization, setOrganization] = useState<OrganizationInfo | null>(null);
  const [seatCount, setSeatCount] = useState(0);
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [orgRes, membersRes] = await Promise.all([
          fetch("/api/org/organization"),
          fetch("/api/org/members"),
        ]);
        if (cancelled) return;
        if (orgRes.status === 403) {
          setForbidden(true);
          return;
        }
        const orgBody = await orgRes.json().catch(() => null);
        const membersBody = await membersRes.json().catch(() => null);
        if (orgRes.ok) setOrganization(orgBody.organization);
        if (membersRes.ok) setSeatCount(membersBody.members?.length ?? 0);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [status]);

  if (status === "loading") {
    return (
      <main className="flex flex-1 flex-col items-center gap-6 p-8 pt-16">
        <h1 className="text-3xl font-bold text-foreground">Organization Settings</h1>
      </main>
    );
  }

  if (status !== "authenticated") {
    return (
      <main className="flex flex-1 flex-col items-center gap-4 p-8 pt-16 text-center">
        <h1 className="text-3xl font-bold text-foreground">Organization Settings</h1>
        <p className="text-foreground/60">Sign in to manage your organization.</p>
        <Link href="/login" className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90">
          Sign In
        </Link>
      </main>
    );
  }

  if (forbidden) {
    return (
      <main className="flex flex-1 flex-col items-center gap-4 p-8 pt-16 text-center">
        <h1 className="text-3xl font-bold text-foreground">Organization Settings</h1>
        <p className="text-foreground/60">
          Only an organization&apos;s Admin can access these settings. If you don&apos;t belong to an organization yet, you
          can create one from Compliance.
        </p>
        <Link href="/compliance" className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90">
          Go to Compliance
        </Link>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col items-center gap-6 p-8 pt-16">
      <div className="flex flex-col items-center gap-1 text-center">
        <h1 className="text-3xl font-bold text-foreground">Organization Settings</h1>
        {organization && <p className="text-sm text-foreground/50">{organization.name}</p>}
      </div>

      {loading || !organization ? (
        <div className="h-24 w-full max-w-2xl animate-pulse rounded-md bg-foreground/10" />
      ) : (
        <div className="flex w-full max-w-2xl flex-col gap-6">
          <OrganizationBrandingForm organization={organization} onUpdated={setOrganization} />
          <BillingPanel billingActive={organization.billingActive} seatCount={seatCount} />
          <TeamManagementPanel />
        </div>
      )}
    </main>
  );
}
