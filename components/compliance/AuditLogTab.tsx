"use client";

import { useEffect, useState } from "react";
import PaginationControls from "@/components/Pagination";

interface AuditEntry {
  id: string;
  action: string;
  ticker: string | null;
  targetType: string | null;
  createdAt: string;
  actor: { name: string | null; email: string } | null;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function AuditLogTab() {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [actionFilter, setActionFilter] = useState("");
  const [tickerFilter, setTickerFilter] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const params = new URLSearchParams({ page: String(page) });
      if (actionFilter) params.set("action", actionFilter);
      if (tickerFilter) params.set("ticker", tickerFilter.toUpperCase());

      const res = await fetch(`/api/compliance/audit-log?${params.toString()}`);
      const body = await res.json().catch(() => null);
      if (cancelled) return;
      if (res.ok) {
        setEntries(body?.entries ?? []);
        setTotalPages(body?.totalPages ?? 1);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [page, actionFilter, tickerFilter]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          value={tickerFilter}
          onChange={(e) => {
            setPage(1);
            setTickerFilter(e.target.value);
          }}
          placeholder="Filter by ticker"
          className="rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none dark:border-white/15"
        />
        <select
          value={actionFilter}
          onChange={(e) => {
            setPage(1);
            setActionFilter(e.target.value);
          }}
          className="rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none dark:border-white/15"
        >
          <option value="">All actions</option>
          <option value="restricted_list_add">Restricted list: add</option>
          <option value="restricted_list_remove">Restricted list: remove</option>
          <option value="trade_disclosed">Trade disclosed</option>
          <option value="preclearance_requested">Pre-clearance requested</option>
          <option value="preclearance_approved">Pre-clearance approved</option>
          <option value="preclearance_denied">Pre-clearance denied</option>
          <option value="flag_created">Flag created</option>
          <option value="flag_reviewed">Flag reviewed</option>
          <option value="invite_created">Invite created</option>
          <option value="member_joined">Member joined</option>
          <option value="member_role_changed">Member role changed</option>
          <option value="member_removed">Member removed</option>
        </select>
      </div>

      {!entries || entries.length === 0 ? (
        <p className="p-4 text-sm text-foreground/50">No matching audit log entries.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="border-b border-black/10 text-xs text-foreground/50 dark:border-white/15">
                <th className="p-2 text-left">When</th>
                <th className="p-2 text-left">Actor</th>
                <th className="p-2 text-left">Action</th>
                <th className="p-2 text-left">Ticker</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b border-black/5 last:border-0 dark:border-white/10">
                  <td className="p-2 text-foreground/50">{formatDateTime(entry.createdAt)}</td>
                  <td className="p-2 text-foreground/80">{entry.actor?.name ?? entry.actor?.email ?? "—"}</td>
                  <td className="p-2 capitalize text-foreground/80">{entry.action.replace(/_/g, " ")}</td>
                  <td className="p-2 font-medium text-foreground">{entry.ticker ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && <PaginationControls page={page} totalPages={totalPages} onPageChange={setPage} />}
    </div>
  );
}
