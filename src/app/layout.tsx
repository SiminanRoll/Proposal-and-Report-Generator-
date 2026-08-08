import type { Metadata } from "next";
import { MapSelectionGroupBridge } from "@/components/map-selection-group-bridge";
import { MapSegmentDrawerV10931 } from "@/components/map-segment-drawer-v10931";
import { MapInteractionPolishV10932 } from "@/components/map-interaction-polish-v10932";
import { MapCompassRuntimeV10934 } from "@/components/map-compass-runtime-v10934";
import { InterfacePolishRuntimeV10939 } from "@/components/interface-polish-runtime-v10939";
import { MapModeControllerV10940 } from "@/components/map-mode-controller-v10940";
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
import "./v10931-polish.css";
import "./v10932-map-interactions.css";
import "./v10933-map-hotfix.css";
import "./v10934-polish.css";
import "./v10935-map-stability.css";
import "./v10936-map-geography.css";
import "./v10937-map-settle.css";
import "./v10938-map-selection.css";
import "./v10939-client-map.css";
import "./v10940-map-mode.css";

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
      <body>{children}<MapSelectionGroupBridge /><MapSegmentDrawerV10931 /><MapInteractionPolishV10932 /><MapModeControllerV10940 /><MapCompassRuntimeV10934 /><InterfacePolishRuntimeV10939 /></body>
    </html>
  );
}
