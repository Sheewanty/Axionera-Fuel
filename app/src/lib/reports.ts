import { redirect } from "next/navigation";
import { getAccessibleStations, StationSummary } from "@/lib/db/station.service";
import { AuthSession } from "@/lib/session";

export const RELEASE_LABEL = "V09.06.26";

const DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export function formatReportDate(value: Date): string {
  return DATE_FORMATTER.format(value).replace(/ /g, "-");
}

export function toCsv(rows: Array<Record<string, string | number | null | undefined>>): string {
  if (rows.length === 0) return "";

  const headers = Object.keys(rows[0]);
  const escape = (value: string | number | null | undefined) => {
    const text = String(value ?? "");
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  return [
    headers.map(escape).join(","),
    ...rows.map((row) => headers.map((header) => escape(row[header])).join(",")),
  ].join("\n");
}

export async function resolveReportStation(
  session: AuthSession,
  currentStationId: string | undefined,
  pathname: string
): Promise<StationSummary | null> {
  const stations = await getAccessibleStations(session.user.tenantId, session.user.membershipStationId);
  if (stations.length === 0) return null;

  const selected = currentStationId
    ? stations.find((station) => station.id === currentStationId)
    : undefined;
  const active = session.user.activeStationId
    ? stations.find((station) => station.id === session.user.activeStationId)
    : undefined;
  const fallback = selected ?? active ?? stations[0];

  if (!selected) {
    redirect(`${pathname}?stationId=${fallback.id}`);
  }

  return selected;
}
