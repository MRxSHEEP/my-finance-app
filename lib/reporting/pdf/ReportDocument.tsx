import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";

// Same hand-laid-out Document/Page/View/Text/StyleSheet pattern as
// lib/compliance/pdf/ComplianceReportDocument.tsx — @react-pdf/renderer has
// no autotable-style helper, so each section is plain View/Text rows.
const DEFAULT_BRAND_COLOR = "#6366f1";

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 9, fontFamily: "Helvetica" },
  accentBar: { height: 4, marginBottom: 16 },
  coverRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 },
  logo: { width: 100, height: 32, objectFit: "contain" },
  orgName: { fontSize: 12, fontWeight: 700, color: "#333333" },
  title: { fontSize: 18, fontWeight: 700, marginTop: 12, marginBottom: 2 },
  subtitle: { fontSize: 10, color: "#555555", marginBottom: 2 },
  meta: { fontSize: 9, color: "#888888", marginBottom: 20 },
  sectionHeading: { fontSize: 13, fontWeight: 700, marginTop: 18, marginBottom: 8 },
  subheading: { fontSize: 9, fontWeight: 700, color: "#555555", marginBottom: 4, marginTop: 6 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#dddddd", paddingVertical: 3 },
  headerRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#333333", paddingBottom: 3, marginBottom: 2 },
  cellLabel: { flex: 2, color: "#555555" },
  cellValue: { flex: 1, textAlign: "right" },
  headerCell: { flex: 1, fontWeight: 700 },
  headerCellWide: { flex: 2, fontWeight: 700 },
  disclaimer: { marginTop: 6, marginBottom: 4, fontSize: 8, color: "#888888", fontStyle: "italic" },
  asOfLabel: { fontSize: 8, color: "#888888", marginBottom: 6, fontStyle: "italic" },
  totalRow: { flexDirection: "row", paddingVertical: 4, borderTopWidth: 1, borderTopColor: "#333333", marginTop: 2 },
  totalLabel: { flex: 2, fontWeight: 700 },
  totalValue: { flex: 1, textAlign: "right", fontWeight: 700 },
});

export interface ReportCalculatorSection {
  title: string;
  inputs: Array<{ label: string; value: string }>;
  figures: Array<{ label: string; value: string }>;
  disclaimer: string;
}

export interface ReportPortfolioSection {
  heading: string;
  asOfLabel: string;
  rows: Array<{ label: string; value: string; percent?: string }>;
  totalLabel: string;
  totalValue: string;
}

interface ReportDocumentProps {
  organizationName: string;
  logoUrl: string | null;
  brandColor: string | null;
  clientName: string;
  advisorName: string;
  generatedAt: Date;
  calculatorSections: ReportCalculatorSection[];
  portfolioSection: ReportPortfolioSection | null;
}

export default function ReportDocument({
  organizationName,
  logoUrl,
  brandColor,
  clientName,
  advisorName,
  generatedAt,
  calculatorSections,
  portfolioSection,
}: ReportDocumentProps) {
  const accent = brandColor ?? DEFAULT_BRAND_COLOR;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={[styles.accentBar, { backgroundColor: accent }]} />

        <View style={styles.coverRow}>
          <View>
            <Text style={styles.orgName}>{organizationName}</Text>
            <Text style={styles.subtitle}>Prepared by {advisorName}</Text>
          </View>
          {/* @react-pdf/renderer's Image has no `alt` prop — it's a PDF
              rendering primitive, not an HTML <img>; jsx-a11y can't tell
              the two apart. */}
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          {logoUrl && <Image src={logoUrl} style={styles.logo} />}
        </View>

        <Text style={styles.title}>Client Report — {clientName}</Text>
        <Text style={styles.meta}>Generated {generatedAt.toISOString().replace("T", " ").slice(0, 19)} UTC</Text>

        {calculatorSections.map((section, i) => (
          <View key={i}>
            <Text style={styles.sectionHeading}>{section.title}</Text>

            <Text style={styles.subheading}>Inputs</Text>
            <View style={styles.headerRow}>
              <Text style={styles.headerCellWide}>Field</Text>
              <Text style={styles.headerCell}>Value</Text>
            </View>
            {section.inputs.map((row, j) => (
              <View key={j} style={styles.row}>
                <Text style={styles.cellLabel}>{row.label}</Text>
                <Text style={styles.cellValue}>{row.value}</Text>
              </View>
            ))}

            <Text style={styles.subheading}>Results</Text>
            <View style={styles.headerRow}>
              <Text style={styles.headerCellWide}>Field</Text>
              <Text style={styles.headerCell}>Value</Text>
            </View>
            {section.figures.map((row, j) => (
              <View key={j} style={styles.row}>
                <Text style={styles.cellLabel}>{row.label}</Text>
                <Text style={styles.cellValue}>{row.value}</Text>
              </View>
            ))}

            <Text style={styles.disclaimer}>{section.disclaimer}</Text>
          </View>
        ))}

        {portfolioSection && (
          <View>
            <Text style={styles.sectionHeading}>{portfolioSection.heading}</Text>
            <Text style={styles.asOfLabel}>{portfolioSection.asOfLabel}</Text>

            <View style={styles.headerRow}>
              <Text style={styles.headerCellWide}>Holding</Text>
              <Text style={styles.headerCell}>Value</Text>
              <Text style={styles.headerCell}>% of Portfolio</Text>
            </View>
            {portfolioSection.rows.map((row, j) => (
              <View key={j} style={styles.row}>
                <Text style={styles.cellLabel}>{row.label}</Text>
                <Text style={styles.cellValue}>{row.value}</Text>
                <Text style={styles.cellValue}>{row.percent ?? "—"}</Text>
              </View>
            ))}

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>{portfolioSection.totalLabel}</Text>
              <Text style={styles.totalValue}>{portfolioSection.totalValue}</Text>
            </View>
          </View>
        )}
      </Page>
    </Document>
  );
}
