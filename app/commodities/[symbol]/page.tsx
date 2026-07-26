import CommodityDetailView from "@/components/commodities/CommodityDetailView";

export default async function CommodityPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  return <CommodityDetailView symbol={decodeURIComponent(symbol)} />;
}
