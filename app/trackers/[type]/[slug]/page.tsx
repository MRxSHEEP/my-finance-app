import TrackerDetailView from "@/components/trackers/TrackerDetailView";

export default async function TrackerPage({ params }: { params: Promise<{ type: string; slug: string }> }) {
  const { slug } = await params;
  return <TrackerDetailView slug={slug} />;
}
