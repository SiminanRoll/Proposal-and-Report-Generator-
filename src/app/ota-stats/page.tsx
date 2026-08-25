import type { Metadata, Viewport } from "next";
import { OtaStatsDashboard } from "./ota-stats-dashboard";

export const metadata: Metadata = {
  title: "OTA Performance | Advantage Technologies",
  description: "Public interactive OTA performance by week, month, quarter, year, and TC.",
  appleWebApp: {
    capable: true,
    title: "OTA Performance",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#050c13",
  colorScheme: "dark",
};

export default function OtaStatsPage() {
  return <OtaStatsDashboard />;
}
