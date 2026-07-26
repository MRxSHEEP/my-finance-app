import { Sparkles } from "lucide-react";

// One consistent "try it with real numbers" affordance across every
// calculator, rather than each page inventing its own button style.
export default function LoadExampleButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex w-fit items-center gap-1.5 rounded-md border border-indigo-400/30 bg-indigo-400/[0.06] px-3 py-1.5 text-xs font-medium text-indigo-400 transition-colors duration-150 ease-out hover:border-indigo-400/50 hover:bg-indigo-400/10"
    >
      <Sparkles size={13} /> Load example
    </button>
  );
}
