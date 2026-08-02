import { analyzeFile } from "@/lib/intelligence/server/analyze-file";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    const expectedKind = String(form.get("expectedKind") ?? "supporting-document");
    const fileId = String(form.get("fileId") ?? `file_${Date.now()}`);
    if (!(file instanceof File)) {
      return Response.json({ error: "A source file is required." }, { status: 400 });
    }
    if (file.size > 35 * 1024 * 1024) {
      return Response.json({ error: "Files larger than 35 MB are not supported in local source intelligence." }, { status: 413 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const analysis = await analyzeFile({
      buffer,
      fileName: file.name,
      mimeType: file.type,
      expectedKind,
      fileId,
    });
    return Response.json({ analysis });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Source analysis failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
