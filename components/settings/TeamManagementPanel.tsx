"use client";

import { useEffect, useState } from "react";
import { cardClass } from "@/lib/cardStyles";

interface Grant {
  featureArea: string;
  role: string;
}

interface Member {
  id: string;
  orgRole: "member" | "admin";
  userId: string;
  name: string | null;
  email: string;
  grants: Grant[];
}

interface Invite {
  id: string;
  token: string;
  orgRole: "member" | "admin";
  email: string | null;
  featureGrants: Grant[];
}

const COMPLIANCE_ROLE_OPTIONS = ["employee", "compliance_officer", "admin"];

// Rebuilt from components/compliance/TeamTab.tsx's exact logic and layout
// (same refreshToken-bump-triggers-useEffect idiom, same cardClass/input
// styling) — generalized from a single flat Compliance role to an org-wide
// tier plus a repeatable list of per-feature-area grants. This whole page
// is gated to org-wide Admins only (see app/settings/organization/page.tsx),
// so there's no isAdmin branching here the way TeamTab needed.
export default function TeamManagementPanel() {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [invites, setInvites] = useState<Invite[] | null>(null);
  const [orgWideAdmin, setOrgWideAdmin] = useState(false);
  const [grantRows, setGrantRows] = useState<Grant[]>([{ featureArea: "compliance", role: "employee" }]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [membersRes, invitesRes] = await Promise.all([
        fetch("/api/org/members"),
        fetch("/api/org/invites"),
      ]);
      const membersBody = await membersRes.json().catch(() => null);
      const invitesBody = await invitesRes.json().catch(() => null);
      if (cancelled) return;
      if (membersRes.ok) setMembers(membersBody?.members ?? []);
      if (invitesRes.ok) setInvites(invitesBody?.invites ?? []);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/org/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orgWideAdmin,
        grants: orgWideAdmin ? [] : grantRows,
        email: inviteEmail || undefined,
      }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) return setError(body?.error ?? "Failed to create invite");
    setInviteEmail("");
    setRefreshToken((t) => t + 1);
  }

  async function handleRevoke(id: string) {
    await fetch(`/api/org/invites/${id}`, { method: "DELETE" });
    setRefreshToken((t) => t + 1);
  }

  async function handleOrgRoleChange(id: string, newOrgRole: "member" | "admin") {
    const res = await fetch(`/api/org/members/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgRole: newOrgRole }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) return setError(body?.error ?? "Failed to change role");
    setRefreshToken((t) => t + 1);
  }

  async function handleRemoveMember(id: string) {
    const res = await fetch(`/api/org/members/${id}`, { method: "DELETE" });
    const body = await res.json().catch(() => null);
    if (!res.ok) return setError(body?.error ?? "Failed to remove member");
    setRefreshToken((t) => t + 1);
  }

  function copyLink(token: string) {
    const url = `${window.location.origin}/compliance/join/${token}`;
    navigator.clipboard?.writeText(url).then(() => {
      setCopiedToken(token);
      setTimeout(() => setCopiedToken((t) => (t === token ? null : t)), 2000);
    });
  }

  function updateGrantRow(index: number, patch: Partial<Grant>) {
    setGrantRows((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleInvite} className={cardClass("indigo", { extra: "flex flex-col gap-3 p-4" })}>
        <h3 className="text-sm font-semibold text-foreground">Invite a team member</h3>
        <p className="text-xs text-foreground/50">
          No email is sent — generate a link below and share it yourself.
        </p>

        <label className="flex items-center gap-2 text-sm text-foreground/80">
          <input type="checkbox" checked={orgWideAdmin} onChange={(e) => setOrgWideAdmin(e.target.checked)} />
          Org-wide Admin (full access to every feature)
        </label>

        {!orgWideAdmin && (
          <div className="flex flex-col gap-2">
            {grantRows.map((row, i) => (
              <div key={i} className="flex flex-wrap gap-2">
                {row.featureArea === "compliance" ? (
                  <select
                    value={row.featureArea}
                    onChange={(e) => updateGrantRow(i, { featureArea: e.target.value, role: "employee" })}
                    className="rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none dark:border-white/15"
                  >
                    <option value="compliance">Compliance</option>
                    <option value="__other__">Other feature area…</option>
                  </select>
                ) : (
                  <input
                    type="text"
                    value={row.featureArea === "__other__" ? "" : row.featureArea}
                    onChange={(e) => updateGrantRow(i, { featureArea: e.target.value })}
                    placeholder="Feature area"
                    className="w-40 rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none dark:border-white/15"
                  />
                )}
                {row.featureArea === "compliance" ? (
                  <select
                    value={row.role}
                    onChange={(e) => updateGrantRow(i, { role: e.target.value })}
                    className="rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none dark:border-white/15"
                  >
                    {COMPLIANCE_ROLE_OPTIONS.map((r) => (
                      <option key={r} value={r}>
                        {r.replace("_", " ")}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={row.role}
                    onChange={(e) => updateGrantRow(i, { role: e.target.value })}
                    placeholder="Role"
                    className="w-32 rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none dark:border-white/15"
                  />
                )}
                {grantRows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setGrantRows((rows) => rows.filter((_, idx) => idx !== i))}
                    className="rounded-md border border-black/10 px-2 py-1 text-xs text-foreground/50 hover:text-foreground dark:border-white/15"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => setGrantRows((rows) => [...rows, { featureArea: "compliance", role: "employee" }])}
              className="self-start text-xs text-indigo-400 hover:underline"
            >
              + Add another feature area
            </button>
          </div>
        )}

        <input
          type="email"
          value={inviteEmail}
          onChange={(e) => setInviteEmail(e.target.value)}
          placeholder="Email (optional, for your own reference)"
          className="rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none dark:border-white/15"
        />

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          className="self-start rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
        >
          Generate invite link
        </button>
      </form>

      {invites && invites.length > 0 && (
        <div className={cardClass("neutral", { extra: "flex flex-col gap-2 p-4" })}>
          <h3 className="text-sm font-semibold text-foreground">Pending invites</h3>
          {invites.map((inv) => (
            <div key={inv.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="text-foreground/70">
                {inv.orgRole === "admin"
                  ? "Org-wide Admin"
                  : inv.featureGrants.map((g) => `${g.featureArea}: ${g.role.replace("_", " ")}`).join(", ")}
                {inv.email ? ` — ${inv.email}` : ""}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => copyLink(inv.token)}
                  className="rounded-md border border-black/10 px-2 py-1 text-xs font-medium text-foreground/70 hover:text-foreground dark:border-white/15"
                >
                  {copiedToken === inv.token ? "Copied!" : "Copy link"}
                </button>
                <button
                  type="button"
                  onClick={() => handleRevoke(inv.id)}
                  className="rounded-md border border-red-500/30 px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-500/10"
                >
                  Revoke
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className={cardClass("neutral", { extra: "flex flex-col gap-2 p-4" })}>
        <h3 className="text-sm font-semibold text-foreground">Members</h3>
        {!members || members.length === 0 ? (
          <p className="text-sm text-foreground/50">No members yet.</p>
        ) : (
          members.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between gap-2 border-b border-black/5 py-2 text-sm last:border-0 dark:border-white/10"
            >
              <div>
                <span className="text-foreground/80">{m.name ?? m.email}</span>
                {m.orgRole !== "admin" && m.grants.length > 0 && (
                  <span className="ml-2 text-xs text-foreground/40">
                    {m.grants.map((g) => `${g.featureArea}: ${g.role.replace("_", " ")}`).join(", ")}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={m.orgRole}
                  onChange={(e) => handleOrgRoleChange(m.id, e.target.value as "member" | "admin")}
                  className="rounded-md border border-black/10 bg-transparent px-2 py-1 text-xs outline-none dark:border-white/15"
                >
                  <option value="member">Member</option>
                  <option value="admin">Org-wide Admin</option>
                </select>
                <button
                  type="button"
                  onClick={() => handleRemoveMember(m.id)}
                  className="rounded-md border border-red-500/30 px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-500/10"
                >
                  Remove
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
