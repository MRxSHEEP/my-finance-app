import CoinDetailView from "@/components/crypto/CoinDetailView";

export default async function CoinPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CoinDetailView id={id} />;
}
