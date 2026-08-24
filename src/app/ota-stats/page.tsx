import type { Metadata } from "next";
import { OtaStatsDashboard } from "./ota-stats-dashboard";

export const metadata: Metadata = {
  title: "OTA Performance | Advantage Technologies",
  description: "Year-over-year OTA appointment-setting performance by TC and set date.",
};

export default function OtaStatsPage() {
  return <OtaStatsDashboard />;
}
