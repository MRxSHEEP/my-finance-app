// Congressional financial disclosure reports (House PTRs and Senate eFD
// filings) are subject to a real federal statute, not just a website
// terms-of-service checkbox — 5 U.S.C. app. § 105(c)(1)-(2) of the Ethics
// in Government Act, quoted verbatim on BOTH the Senate eFD search page's
// click-through agreement AND the House Clerk's Financial Disclosure page
// (confirmed live on both — the House Clerk displays it plainly without a
// gate, the Senate requires an explicit checkbox before granting search
// access, but it's the same underlying law either way):
//
//   "It shall be unlawful for any person to obtain or use a report:
//   ...for any commercial purpose, other than by news and communications
//   media for dissemination to the general public..."
//   The Attorney General may bring a civil action... a penalty in any
//   amount not to exceed $10,000.
//
// Whether this app counts as exempt "news and communications media...
// for dissemination to the general public" or a restricted "commercial
// purpose" is a business/legal judgment call, not a technical one — so
// this whole pipeline defaults OFF. Setting ENABLE_CONGRESS_PDF_INGESTION=true
// is an explicit, deliberate opt-in that should only happen once that
// judgment call has actually been made (ideally with real legal counsel),
// not a default assumption baked into the code.
export function isCongressPdfIngestionEnabled(): boolean {
  return process.env.ENABLE_CONGRESS_PDF_INGESTION === "true";
}

export const CONGRESS_PDF_DISABLED_MESSAGE =
  "Congressional PDF ingestion (House Clerk + Senate eFD) is built but disabled by default pending legal review of 5 U.S.C. app. § 105(c)'s commercial-use restriction on financial disclosure reports. Set ENABLE_CONGRESS_PDF_INGESTION=true to opt in.";
