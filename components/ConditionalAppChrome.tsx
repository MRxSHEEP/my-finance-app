"use client";

import Image from "next/image";
import Link from "next/link";
import AccountMenu from "@/components/AccountMenu";
import MobileNavButton from "@/components/MobileNavButton";
import Sidebar from "@/components/Sidebar";
import TickerBar, { TICKER_BAR_HEIGHT_PX } from "@/components/TickerBar";
import { SCROLLBAR_THIN_CLASS } from "@/lib/scrollbarStyles";
import { usePathname } from "next/navigation";
import { isMarketingRoute } from "@/lib/chromeRoutes";

function NobleWordmark() {
  return (
    <Link href="/" className="flex items-center gap-2">
      <Image
        src="/crown(1).webp.webp"
        alt="Noble"
        width={32}
        height={32}
        priority
        style={{ width: "auto", height: "32px" }}
      />
      <span className="text-xl font-bold text-foreground">Noble</span>
    </Link>
  );
}

// usePathname() reflects the route being rendered on BOTH the server pass
// (so the initial HTML for an excluded route already omits TickerBar/
// Sidebar/AccountMenu) and the client pass (so a client-side navigation
// into/out of an excluded route re-renders this same branch synchronously
// with the route change) — unlike a useEffect/"mounted" gate, there's no
// separate render that starts with the wrong chrome and corrects itself
// after the fact, so there's nothing to flash. Confirmed by inspecting the
// raw (pre-hydration) server-rendered HTML for /advisors — see this
// feature's own verification notes.
export default function ConditionalAppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isMarketing = isMarketingRoute(pathname);

  if (isMarketing) {
    // No TickerBar (so no height offset to apply either — both are this
    // one branch, not two separate checks that could disagree), no
    // Sidebar, no AccountMenu. A minimal marketing header instead of the
    // authenticated app's own — this is a separate front door, not the
    // retail app with a couple of pieces of chrome switched off.
    return (
      <div id="app-scroll-region" className={`flex flex-1 flex-col overflow-y-auto ${SCROLLBAR_THIN_CLASS}`}>
        <header className="flex items-center justify-between gap-2 px-4 py-4 sm:px-8">
          <NobleWordmark />
          <div className="flex items-center gap-4 text-sm">
            <Link href="/login" className="font-medium text-foreground/70 hover:text-foreground">
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-md bg-foreground px-4 py-2 font-medium text-background hover:opacity-90"
            >
              Create your organization
            </Link>
          </div>
        </header>
        <div className="flex flex-1 flex-col">{children}</div>
      </div>
    );
  }

  return (
    <>
      <TickerBar />
      <div
        id="app-scroll-region"
        className={`flex flex-1 flex-col overflow-y-auto ${SCROLLBAR_THIN_CLASS}`}
        style={{ marginTop: TICKER_BAR_HEIGHT_PX }}
      >
        <header id="app-header" className="flex items-center justify-between gap-2 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-1 sm:gap-2">
            <MobileNavButton />
            <NobleWordmark />
          </div>
          <AccountMenu />
        </header>
        <div className="flex flex-1">
          <Sidebar />
          {/* min-w-0 overrides the flex default of min-width:auto — without
              it, this column refuses to shrink below its content's own
              intrinsic width (confirmed live: a grid-cols-2 card row was
              measuring 584px wide inside a 375px viewport, silently cropped
              by body's overflow-hidden with no scrollbar to reveal it,
              rather than actually reflowing to fit). */}
          <div className="flex min-w-0 flex-1 flex-col">{children}</div>
        </div>
      </div>
    </>
  );
}
