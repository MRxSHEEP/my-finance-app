"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

interface InvitePreview {
  organizationName: string;
  orgWideAdmin: boolean;
  grants: Array<{ featureArea: string; role: string }>;
  expired: boolean;
  used: boolean;
}

export default function JoinInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const { status } = useSession();
  const router = useRouter();
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") return;
    (async () => {
      const res = await fetch(`/api/compliance/join/${token}`);
      const body = await res.json().catch(() => null);
      if (!res.ok) return setError(body?.error ?? "Invite not found");
      setPreview(body);
    })();
  }, [status, token]);

  async function handleAccept() {
    setAccepting(true);
    setError(null);
    try {
      const res = await fetch(`/api/compliance/join/${token}`, { method: "POST" });
      const body = await res.json().catch(() => null);
      if (!res.ok) return setError(body?.error ?? "Failed to accept invite");
      setAccepted(true);
      router.push("/compliance");
      router.refresh();
    } finally {
      setAccepting(false);
    }
  }

  if (status === "loading") {
    return (
      <main className="flex flex-1 flex-col items-center gap-6 p-8 pt-16">
        <h1 className="text-2xl font-bold text-foreground">Compliance invite</h1>
      </main>
    );
  }

  if (status !== "authenticated") {
    return (
      <main className="flex flex-1 flex-col items-center gap-4 p-8 pt-16 text-center">
        <h1 className="text-2xl font-bold text-foreground">Compliance invite</h1>
        <p className="text-foreground/60">Sign in to accept this invite.</p>
        <Link
          href={`/login?callbackUrl=${encodeURIComponent(`/compliance/join/${token}`)}`}
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
        >
          Sign In
        </Link>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col items-center gap-4 p-8 pt-16 text-center">
      <h1 className="text-2xl font-bold text-foreground">Compliance invite</h1>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {!error && !preview && <p className="text-foreground/60">Loading invite…</p>}

      {preview && !error && (
        <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-md border border-black/10 p-6 dark:border-white/15">
          <p className="text-foreground/80">
            You&apos;ve been invited to join <span className="font-semibold text-foreground">{preview.organizationName}</span>{" "}
            as{" "}
            <span className="font-semibold capitalize text-foreground">
              {preview.orgWideAdmin
                ? "an org-wide Admin"
                : preview.grants.map((g) => `${g.featureArea}: ${g.role.replace("_", " ")}`).join(", ")}
            </span>
            .
          </p>
          {preview.used ? (
            <p className="text-sm text-red-500">This invite has already been used.</p>
          ) : preview.expired ? (
            <p className="text-sm text-red-500">This invite has expired.</p>
          ) : accepted ? (
            <p className="text-sm text-green-500">Joined! Redirecting…</p>
          ) : (
            <button
              type="button"
              disabled={accepting}
              onClick={handleAccept}
              className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
            >
              {accepting ? "Joining…" : "Accept invite"}
            </button>
          )}
        </div>
      )}
    </main>
  );
}
