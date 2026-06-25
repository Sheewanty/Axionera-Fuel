import { NextResponse } from "next/server";
import { REPORT_TEMPLATES } from "@/lib/reporting/report-templates";
import { getRequiredSession, requireRole } from "@/lib/session";

export async function GET() {
  const session = await getRequiredSession();
  requireRole(session, ["OWNER", "ADMIN", "STATION_MANAGER", "SUPERVISOR", "ACCOUNTANT", "AUDITOR"]);

  return NextResponse.json({ templates: REPORT_TEMPLATES });
}
