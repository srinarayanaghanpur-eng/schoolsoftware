import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Use the NarayanaOS mobile app",
  description: "NarayanaOS dashboards are built for a computer. Open the NarayanaOS mobile app on your phone.",
  robots: { index: false, follow: false }
};

const pageStyle = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px",
  background: "linear-gradient(160deg, #ecfdf5 0%, #f8fafc 55%, #eef2ff 100%)",
  fontFamily:
    "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
} as const;

const cardStyle = {
  width: "100%",
  maxWidth: "440px",
  background: "#ffffff",
  borderRadius: "24px",
  padding: "32px 28px",
  boxShadow: "0 24px 60px rgba(15, 23, 42, 0.12)",
  border: "1px solid rgba(15, 23, 42, 0.06)"
} as const;

const brandStyle = {
  fontSize: "13px",
  fontWeight: 700,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "#047857",
  margin: "0 0 18px"
} as const;

const titleStyle = {
  fontSize: "26px",
  lineHeight: 1.2,
  fontWeight: 800,
  color: "#0f172a",
  margin: "0 0 12px"
} as const;

const bodyStyle = {
  fontSize: "15px",
  lineHeight: 1.6,
  color: "#475569",
  margin: "0 0 14px"
} as const;

const noteStyle = {
  fontSize: "13px",
  lineHeight: 1.6,
  color: "#64748b",
  margin: "20px 0 0",
  paddingTop: "18px",
  borderTop: "1px solid #e2e8f0"
} as const;

export default function UseMobileAppPage() {
  return (
    <main style={pageStyle}>
      <div style={cardStyle}>
        <p style={brandStyle}>NarayanaOS</p>
        <h1 style={titleStyle}>This dashboard is built for a computer</h1>
        <p style={bodyStyle}>
          Open NarayanaOS on a desktop or laptop to manage attendance, fees,
          exams, and reports for Sri Narayana High School.
        </p>
        <p style={bodyStyle}>
          On a phone, please use the <strong>NarayanaOS mobile app</strong>.
        </p>
        <p style={noteStyle}>
          Received a receipt or report link on WhatsApp? Open that link directly
          — shared documents still work on this phone.
        </p>
      </div>
    </main>
  );
}
