import type { Metadata } from "next";
import Link from "next/link";
import "./reception-status.css";
import { OtaTrackerDashboard } from "./ota-tracker-dashboard";
import { OtaTimeInputEnhancer } from "./ota-time-input-enhancer";
import { OtaDateInputEnhancer } from "./ota-date-input-enhancer";
import { OtaTcInputEnhancer } from "./ota-tc-input-enhancer";

export const metadata: Metadata = {
  title: "OTA Tracker | Advantage Technologies",
  description: "Company-wide OTA quote accountability dashboard for Advantage Technologies.",
};

const navLinkStyle = {
  padding: "7px 10px",
  color: "#91dcca",
  border: "1px solid rgba(145,220,202,.16)",
  borderRadius: 9,
  background: "rgba(7,20,28,.72)",
  backdropFilter: "blur(12px)",
  boxShadow: "0 8px 24px rgba(0,0,0,.16)",
  fontSize: 11,
  fontWeight: 760,
  textDecoration: "none",
} as const;

export default function OtaTrackerPage() {
  return <>
    <OtaTimeInputEnhancer />
    <OtaDateInputEnhancer />
    <OtaTcInputEnhancer />
    <nav
      aria-label="OTA Tracker secondary views"
      style={{
        position: "fixed",
        zIndex: 20,
        top: 24,
        right: 24,
        display: "flex",
        gap: 7,
        alignItems: "center",
      }}
    >
      <Link href="/ota-stats/" aria-label="Open OTA performance year review" style={navLinkStyle}>Performance ↗</Link>
    </nav>
    <OtaTrackerDashboard />
  </>;
}
