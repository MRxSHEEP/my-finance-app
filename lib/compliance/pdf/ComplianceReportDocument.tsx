import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { ReportTable } from "@/lib/compliance/exportData";

// @react-pdf/renderer has no autotable-style helper — each report's table
// is hand-laid-out here with plain View/Text rows. Simple by design (cover
// summary + one flat table), per this app's "keep the report format
// simple for this first pass" scoping decision — no branding/logo yet.
const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 9, fontFamily: "Helvetica" },
  title: { fontSize: 18, fontWeight: 700, marginBottom: 4 },
  subtitle: { fontSize: 10, color: "#555555", marginBottom: 2 },
  meta: { fontSize: 9, color: "#888888", marginBottom: 16 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#cccccc", paddingVertical: 4 },
  headerRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#333333", paddingBottom: 4, marginBottom: 2 },
  cell: { flex: 1, paddingRight: 4 },
  headerCell: { flex: 1, paddingRight: 4, fontWeight: 700 },
});

interface ComplianceReportDocumentProps {
  organizationName: string;
  table: ReportTable;
  generatedAt: Date;
}

export default function ComplianceReportDocument({ organizationName, table, generatedAt }: ComplianceReportDocumentProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page} orientation="landscape">
        <Text style={styles.title}>{table.title}</Text>
        <Text style={styles.subtitle}>{organizationName}</Text>
        <Text style={styles.meta}>
          Generated {generatedAt.toISOString().replace("T", " ").slice(0, 19)} UTC · {table.rows.length} record
          {table.rows.length === 1 ? "" : "s"}
        </Text>

        <View style={styles.headerRow}>
          {table.columns.map((col) => (
            <Text key={col} style={styles.headerCell}>
              {col}
            </Text>
          ))}
        </View>

        {table.rows.length === 0 ? (
          <Text style={{ marginTop: 8, color: "#888888" }}>No records.</Text>
        ) : (
          table.rows.map((row, i) => (
            <View key={i} style={styles.row}>
              {row.map((cell, j) => (
                <Text key={j} style={styles.cell}>
                  {cell}
                </Text>
              ))}
            </View>
          ))
        )}
      </Page>
    </Document>
  );
}
