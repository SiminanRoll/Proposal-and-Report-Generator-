import type { Metadata } from "next";
import { OtaTrackerDashboard } from "@/components/ota-tracker-dashboard";

export const metadata: Metadata = {
  title: "OTA Tracker | Client Compass",
  description: "Company-wide OTA quote accountability dashboard for Advantage Technologies.",
};

export default function OtaTrackerPage() {
  return <OtaTrackerDashboard />;
}
