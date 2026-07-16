export default function ToolCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="w-full max-w-2xl rounded-md border border-black/10 p-6 text-sm dark:border-white/15">
      <h2 className="mb-4 text-lg font-semibold text-foreground">{title}</h2>
      {children}
    </div>
  );
}
