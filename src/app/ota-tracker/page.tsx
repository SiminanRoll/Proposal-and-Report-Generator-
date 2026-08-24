import type { Metadata } from "next";
import { OtaTrackerDashboard } from "./ota-tracker-dashboard";

export const metadata: Metadata = {
  title: "OTA Tracker | Advantage Technologies",
  description: "Company-wide OTA quote accountability dashboard for Advantage Technologies.",
};

export default function OtaTrackerPage() {
  return <OtaTrackerDashboard />;
}
