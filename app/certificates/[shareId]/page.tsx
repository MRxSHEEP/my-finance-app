import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getTrack } from "@/lib/learning/certificationTracks";
import CertificateView from "@/components/learning/CertificateView";

// Deliberately unauthenticated — this is the whole point of a shareable
// certificate link (e.g. posted to LinkedIn). Access control is the
// shareId itself (an unguessable cuid, distinct from the row's own id/
// userId), not a session check — see the UserCertificate model's own
// comment in prisma/schema.prisma. The Prisma query below uses an explicit
// `select` naming only public-safe fields so there's no userId/email leak
// surface even if this page's JSX changes later.
export default async function PublicCertificatePage({ params }: { params: Promise<{ shareId: string }> }) {
  const { shareId } = await params;

  const certificate = await prisma.userCertificate.findUnique({
    where: { shareId },
    select: { trackId: true, recipientName: true, scorePercent: true, awardedAt: true },
  });

  if (!certificate) notFound();

  const track = getTrack(certificate.trackId);

  return (
    <main className="flex flex-1 flex-col items-center gap-6 p-8 pt-16 pb-20">
      <div className="w-full max-w-2xl">
        <CertificateView
          recipientName={certificate.recipientName}
          trackTitle={track?.title ?? certificate.trackId}
          scorePercent={certificate.scorePercent}
          awardedAt={certificate.awardedAt.toISOString()}
        />
      </div>
      <p className="text-xs text-foreground/40">Verified by Noble</p>
    </main>
  );
}
