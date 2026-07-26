import ModelPortfolioDetailView from "@/components/modelPortfolios/ModelPortfolioDetailView";

export default async function ModelPortfolioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ModelPortfolioDetailView id={id} />;
}
