export function GET() {
  return Response.json({
    ok: true,
    service: "proposal-and-report-generator",
    phase: 2,
    timestamp: new Date().toISOString(),
  });
}
