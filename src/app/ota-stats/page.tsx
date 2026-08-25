import type { Metadata } from "next";
import { OtaStatsDashboard } from "./ota-stats-dashboard";

export const metadata: Metadata = {
  title: "OTA Performance | Advantage Technologies",
  description: "Public interactive OTA performance by week, month, quarter, year, and TC.",
};

export default function OtaStatsPage() {
  return <OtaStatsDashboard />;
}
