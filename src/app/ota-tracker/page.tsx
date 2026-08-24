import type { Metadata } from "next";
import Link from "next/link";
import "./reception-status.css";
import { OtaTrackerDashboard } from "./ota-tracker-dashboard";

export const metadata: Metadata = {
  title: "OTA Tracker | Advantage Technologies",
  description: "Company-wide OTA quote accountability dashboard for Advantage Technologies.",
};

export default function OtaTrackerPage() {
  return <>
    <Link
      href="/ota-stats/"
      aria-label="Open OTA performance year review"
      style={{
        position: "fixed",
        zIndex: 20,
        top: 24,
        right: 24,
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
      }}
    >Performance ↗</Link>
    <OtaTrackerDashboard />
  </>;
}
