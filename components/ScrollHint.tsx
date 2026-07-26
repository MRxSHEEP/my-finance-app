// A table wide enough to need overflow-x-auto has no other visual signal
// that it's scrollable — no scrollbar on touch devices, no gradient edge —
// so a mobile user can easily miss that swiping sideways reveals more
// columns. `sm:hidden` since a mouse-and-trackpad desktop user already
// sees a real scrollbar the moment the table doesn't fit.
export default function ScrollHint() {
  return <p className="text-xs text-foreground/40 sm:hidden">Swipe to see more →</p>;
}
