import { AppShell } from "@/components/app-shell";
import { ProjectWorkspace } from "@/components/project-workspace";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return (
    <AppShell>
      <ProjectWorkspace projectId={projectId} />
    </AppShell>
  );
}
