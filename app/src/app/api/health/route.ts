export async function GET() {
  return Response.json({
    ok: true,
    service: "fuelstation-os",
    timestamp: new Date().toISOString(),
  });
}
