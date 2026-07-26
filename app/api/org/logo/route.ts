import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { requireOrgAdmin } from "@/lib/orgAuth";
import { prisma } from "@/lib/prisma";
import { logOrgAction } from "@/lib/org/auditLog";

export const dynamic = "force-dynamic";

const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

// Vercel's serverless functions have ephemeral filesystems (confirmed via
// this app's own vercel.json cron config), so an uploaded logo can't be
// written to local disk the way every other image in this app is served —
// this is the one real, persistent object store, requiring a
// BLOB_READ_WRITE_TOKEN (auto-provisioned once a Blob store is attached to
// the Vercel project; pull into .env.local locally via `vercel env pull`).
export async function POST(request: NextRequest) {
  const ctx = await requireOrgAdmin();
  if (ctx.error) return ctx.error;

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "Server is missing BLOB_READ_WRITE_TOKEN configuration" }, { status: 500 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("logo");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing required file field: logo" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Logo must be a PNG, JPEG, WebP, or SVG image" }, { status: 400 });
  }
  if (file.size > MAX_LOGO_BYTES) {
    return NextResponse.json({ error: "Logo must be under 2MB" }, { status: 400 });
  }

  const extension = file.type === "image/svg+xml" ? "svg" : file.type.split("/")[1];
  const blob = await put(`org-logos/${ctx.organizationId}-${Date.now()}.${extension}`, file, {
    access: "public",
    addRandomSuffix: false,
  });

  await prisma.organization.update({ where: { id: ctx.organizationId }, data: { logoUrl: blob.url } });
  await logOrgAction({
    organizationId: ctx.organizationId,
    actorUserId: ctx.userId,
    action: "branding_updated",
    targetType: "Organization",
    targetId: ctx.organizationId,
    details: { logoUrl: blob.url },
  });

  return NextResponse.json({ logoUrl: blob.url });
}
