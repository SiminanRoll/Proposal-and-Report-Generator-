import { AppShell } from "@/components/app-shell";
import { WorkbenchPageLoader } from "@/components/workbench-page-loader";

export default function WorkbenchRoute() {
  return <AppShell><WorkbenchPageLoader /></AppShell>;
}
