"use client";

import { useEffect, useState } from "react";
import PeerSetConfigForm from "@/components/benchmarking/PeerSetConfigForm";
import BenchmarkDashboard from "@/components/benchmarking/BenchmarkDashboard";

interface OrganizationInfo {
  id: string;
  name: string;
  logoUrl: string | null;
  brandColor: string | null;
}

interface PeerSetConfig {
  ownCompanyTicker: string | null;
  peers: string[];
}

export default function BenchmarkingWorkspace({ organization }: { organization: OrganizationInfo }) {
  const [peerSet, setPeerSet] = useState<PeerSetConfig | null>(null);
  const [editing, setEditing] = useState(false);
  // Bumped after saving the peer set to re-trigger the effect below —
  // matches this app's established refreshToken idiom.
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const res = await fetch("/api/benchmarking/peer-set");
      const body = await res.json().catch(() => null);
      if (!cancelled && res.ok) {
        setPeerSet({ ownCompanyTicker: body?.ownCompanyTicker ?? null, peers: body?.peers ?? [] });
        setEditing((body?.ownCompanyTicker ?? null) === null && (body?.peers ?? []).length === 0);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  if (!peerSet) {
    return <div className="h-24 w-full max-w-3xl animate-pulse rounded-md bg-foreground/10" />;
  }

  if (editing) {
    return (
      <PeerSetConfigForm
        initialOwnCompanyTicker={peerSet.ownCompanyTicker}
        initialPeers={peerSet.peers}
        onSaved={() => {
          setRefreshToken((t) => t + 1);
          setEditing(false);
        }}
      />
    );
  }

  return (
    <BenchmarkDashboard organization={organization} peerSet={peerSet} onEditPeerSet={() => setEditing(true)} />
  );
}
