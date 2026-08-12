import type { Metadata } from "next";
import { ClientCompassRuntime } from "@/components/client-compass-runtime";
import { AgeDisplayRuntime } from "@/components/age-display-runtime";
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
import "./v10941-client-review.css";
import "./v10942-map-hero.css";
import "./v10943-map-layout.css";
import "./v10945-map-polish.css";
import "./v10946-map-positioning.css";
import "./v10947-compass-polish.css";
import "./v10948-map-scale.css";
import "./v10949-map-balance.css";
import "./client-compass-overrides.css";
import "./settings.css";
import "./responsive.css";
import "./shell.css";
import "./workbench-shell.css";
import "./generator-create.css";
import "./mobile.css";
import "./admin.css";
import "./mobile-map.css";
import "./client-review.css";
import "./tracked-actions.css";
import "./map-display.css";
import "./workbench.css";
import "./workbench-bulk.css";
import "./workbench-review-resolution.css";
import "./mobile-workbench.css";
import "./mobile-workbench-glass.css";
import "./workbench-desktop-glass.css";
import "./v110-polish.css";
import "./workbench-stage-icons.css";
import "./settings-mobile-center.css";
import "./shell-final-polish.css";
import "./workbench-resizable-columns.css";
import "./durable-storage.css";
import "./presentation-clean-mode.css";
import "./client-review-viewport.css";
import "./client-activity-notes.css";
import "./sales-activity-v1127.css";
import "./list-view-settings.css";

export const metadata: Metadata = {
  title: "Client Compass",
  description: "Advantage Technologies project opportunity and client planning workspace",
  manifest: "/client-compass.webmanifest?v=110-max",
  icons: {
    icon: [{ url: "/client-compass-favicon.svg?v=110-max", type: "image/svg+xml", sizes: "any" }],
    shortcut: "/client-compass-favicon.svg?v=110-max",
    apple: "/client-compass-icon.png?v=10926",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}<ClientCompassRuntime /><AgeDisplayRuntime /></body>
    </html>
  );
}
