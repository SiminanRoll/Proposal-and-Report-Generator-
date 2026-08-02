import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { CreateProjectScreen } from "@/components/create-project-screen";
import { isProjectType } from "@/lib/projects/types";

export default async function CreateProjectPage({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const { type } = await params;
  if (!isProjectType(type)) notFound();

  return (
    <AppShell>
      <CreateProjectScreen projectType={type} />
    </AppShell>
  );
}
