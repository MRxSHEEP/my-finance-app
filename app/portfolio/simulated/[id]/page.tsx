import SimulatedPortfolioDetailView from "@/components/portfolio/SimulatedPortfolioDetailView";

export default async function SimulatedPortfolioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SimulatedPortfolioDetailView id={id} />;
}
