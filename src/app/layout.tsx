import type { Metadata } from "next";
import { MapSelectionGroupBridge } from "@/components/map-selection-group-bridge";
import "./globals.css";
import "./generator-home-v199.css";
import "./segments.css";
import "./record-review-v10916.css";
import "./v10917-backup.css";
import "./v10918-polish.css";
import "./v10919-territory-map.css";
import "./v10922-territory-map-polish.css";
import "./v10923-territory-map-refine.css";
import "./v10924-polish.css";
import "./v10925-fixes.css";
import "./v10926-polish.css";
import "./v10927-polish.css";
import "./v10928-polish.css";
import "./v10929-polish.css";
import "./v10930-polish.css";

export const metadata: Metadata = {
  title: "Client Compass",
  description: "Advantage Technologies project opportunity and client planning workspace",
  icons: {
    icon: [
      { url: "/client-compass-favicon.svg?v=10926", type: "image/svg+xml", sizes: "any" },
      { url: "/client-compass-icon.png?v=10926", type: "image/png", sizes: "128x128" },
    ],
    shortcut: "/client-compass-favicon.svg?v=10926",
    apple: "/client-compass-icon.png?v=10926",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}<MapSelectionGroupBridge /></body>
    </html>
  );
}
