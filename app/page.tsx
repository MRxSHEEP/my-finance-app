import AudienceModePicker from "@/components/AudienceModePicker";
import MarketDigestHome from "@/components/home/MarketDigestHome";
import { resolveBaseAudienceMode } from "@/lib/audienceMode";

// "/" is the one place an unresolved audience mode matters — every other
// route either doesn't care (retail content, shown regardless) or resolves
// implicitly (/advisors). Resolved server-side before any HTML is sent, so
// there's no flash between "picker" and "digest" — same technique as
// ConditionalAppChrome's pathname check, just keyed on the cookie/User
// preference instead of the route.
export default async function HomePage() {
  const { explicit } = await resolveBaseAudienceMode();
  if (!explicit) return <AudienceModePicker />;
  return <MarketDigestHome />;
}
