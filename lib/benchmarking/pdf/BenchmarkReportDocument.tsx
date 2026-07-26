import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";

// Mirrors lib/reporting/pdf/ReportDocument.tsx's structure exactly (cover
// block, StyleSheet-based tables). Table-only, no rendered chart — deliberate:
// @react-pdf/renderer has no charting primitive, and every existing PDF
// export in this app (Compliance, Reporting) is table-based for the same
// reason. The client-side PNG export is where the real trend charts appear.
const DEFAULT_BRAND_COLOR = "#6366f1";
const HISTORY_COLUMN_LIMIT = 6;

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 8, fontFamily: "Helvetica" },
  accentBar: { height: 4, marginBottom: 16 },
  coverRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 },
  logo: { width: 100, height: 32, objectFit: "contain" },
  orgName: { fontSize: 12, fontWeight: 700, color: "#333333" },
  title: { fontSize: 16, fontWeight: 700, marginTop: 10, marginBottom: 12 },
  sectionHeading: { fontSize: 11, fontWeight: 700, marginTop: 14, marginBottom: 6 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#dddddd", paddingVertical: 3 },
  headerRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#333333", paddingBottom: 3, marginBottom: 2 },
  metricCell: { flex: 1.4, color: "#555555" },
  metricHeaderCell: { flex: 1.4, fontWeight: 700 },
  dataCell: { flex: 1, textAlign: "right" },
  dataHeaderCell: { flex: 1, textAlign: "right", fontWeight: 700 },
  ownCompanyLabel: { fontSize: 6, color: "#888888" },
  meta: { fontSize: 8, color: "#888888", marginTop: 16 },
});

export interface BenchmarkMetricValues {
  revenueGrowth: number | null;
  grossMargin: number | null;
  fcfYield: number | null;
  forwardPE: number | null;
  evEbitda: number | null;
  roe: number | null;
}

export interface BenchmarkTickerData {
  ticker: string;
  isOwnCompany: boolean;
  latest: BenchmarkMetricValues | null;
  series: Array<BenchmarkMetricValues & { asOfDate: string }>;
}

interface BenchmarkReportDocumentProps {
  organizationName: string;
  logoUrl: string | null;
  brandColor: string | null;
  generatedAt: Date;
  tickers: BenchmarkTickerData[];
}

const METRIC_DEFS: Array<{ key: keyof BenchmarkMetricValues; label: string; format: (v: number) => string }> = [
  { key: "revenueGrowth", label: "Revenue Growth", format: (v) => `${v.toFixed(1)}%` },
  { key: "grossMargin", label: "Gross Margin", format: (v) => `${v.toFixed(1)}%` },
  { key: "fcfYield", label: "FCF Yield", format: (v) => `${v.toFixed(1)}%` },
  { key: "forwardPE", label: "Forward P/E", format: (v) => v.toFixed(2) },
  { key: "evEbitda", label: "EV/EBITDA", format: (v) => v.toFixed(2) },
  { key: "roe", label: "ROE", format: (v) => `${v.toFixed(1)}%` },
];

function formatValue(value: number | null, format: (v: number) => string): string {
  return value != null ? format(value) : "—";
}

function tickerLabel(t: BenchmarkTickerData): string {
  return t.ticker;
}

export default function BenchmarkReportDocument({
  organizationName,
  logoUrl,
  brandColor,
  generatedAt,
  tickers,
}: BenchmarkReportDocumentProps) {
  const accent = brandColor ?? DEFAULT_BRAND_COLOR;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={[styles.accentBar, { backgroundColor: accent }]} />

        <View style={styles.coverRow}>
          <Text style={styles.orgName}>{organizationName}</Text>
          {/* @react-pdf/renderer's Image has no `alt` prop — it's a PDF
              rendering primitive, not an HTML <img>; jsx-a11y can't tell
              the two apart. */}
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          {logoUrl && <Image src={logoUrl} style={styles.logo} />}
        </View>

        <Text style={styles.title}>Peer Benchmarking Report</Text>

        <Text style={styles.sectionHeading}>Current Comparison</Text>
        <View style={styles.headerRow}>
          <Text style={styles.metricHeaderCell}>Metric</Text>
          {tickers.map((t) => (
            <View key={t.ticker} style={styles.dataHeaderCell}>
              <Text>{tickerLabel(t)}</Text>
              {t.isOwnCompany && <Text style={styles.ownCompanyLabel}>(Own Company)</Text>}
            </View>
          ))}
        </View>
        {METRIC_DEFS.map((def) => (
          <View key={def.key} style={styles.row}>
            <Text style={styles.metricCell}>{def.label}</Text>
            {tickers.map((t) => (
              <Text key={t.ticker} style={styles.dataCell}>
                {formatValue(t.latest?.[def.key] ?? null, def.format)}
              </Text>
            ))}
          </View>
        ))}

        {METRIC_DEFS.map((def) => {
          // Compact recent history: last N snapshot dates as columns, one
          // row per ticker — a text/table representation of the trend
          // (see the module comment above for why, not a rendered chart).
          const dateSet = new Set<string>();
          tickers.forEach((t) => t.series.forEach((s) => dateSet.add(s.asOfDate)));
          const dates = [...dateSet].sort().slice(-HISTORY_COLUMN_LIMIT);
          if (dates.length === 0) return null;

          return (
            <View key={def.key} wrap={false}>
              <Text style={styles.sectionHeading}>{def.label} — Recent History</Text>
              <View style={styles.headerRow}>
                <Text style={styles.metricHeaderCell}>Ticker</Text>
                {dates.map((d) => (
                  <Text key={d} style={styles.dataHeaderCell}>
                    {new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </Text>
                ))}
              </View>
              {tickers.map((t) => {
                const byDate = new Map(t.series.map((s) => [s.asOfDate, s[def.key]]));
                return (
                  <View key={t.ticker} style={styles.row}>
                    <Text style={styles.metricCell}>{tickerLabel(t)}</Text>
                    {dates.map((d) => (
                      <Text key={d} style={styles.dataCell}>
                        {formatValue(byDate.get(d) ?? null, def.format)}
                      </Text>
                    ))}
                  </View>
                );
              })}
            </View>
          );
        })}

        <Text style={styles.meta}>
          Generated {generatedAt.toISOString().replace("T", " ").slice(0, 19)} UTC · ROE shown in place of ROIC, which
          is not available from this app&apos;s data providers.
        </Text>
      </Page>
    </Document>
  );
}
