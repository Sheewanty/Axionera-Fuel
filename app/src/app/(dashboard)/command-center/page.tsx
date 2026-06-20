import PageTitle from "@/components/ui/PageTitle";
import { currentBusinessDate, formatDisplayDate } from "@/lib/business-date";
import { prisma } from "@/lib/db/prisma";
import { getRequiredSession, requireWriteAccess } from "@/lib/session";
import { resolveOrRedirectStation } from "@/lib/station-utils";
import CommandCenterClient, {
  type CommandCenterAlert,
  type CommandCenterMetrics,
  type StationStatusRow,
} from "./CommandCenterClient";

function toNumber(value: unknown) {
  return Number(value ?? 0);
}

function sessionMetrics(
  session: {
    pumpReadings: { litresSold: unknown; amountExpected: unknown; variance: unknown }[];
    tankDippings: { tank: { name: string }; product: { name: string }; varianceLitres: unknown }[];
    cashCollections: { amountToBank: unknown; variance: unknown }[];
    martSales: { netMartSales: unknown; variance: unknown }[];
  } | null
): CommandCenterMetrics {
  if (!session) {
    return {
      totalLitresSold: 0,
      expectedForecourtRevenue: 0,
      cashBanked: 0,
      bankingVariance: 0,
      tankVarianceLitres: 0,
      martNetSales: 0,
      openExceptions: 0,
      hasOperationalData: false,
    };
  }

  const totalLitresSold = session.pumpReadings.reduce((sum, row) => sum + toNumber(row.litresSold), 0);
  const expectedForecourtRevenue = session.pumpReadings.reduce((sum, row) => sum + toNumber(row.amountExpected), 0);
  const cashBanked = session.cashCollections.reduce((sum, row) => sum + toNumber(row.amountToBank), 0);
  const bankingVariance = session.cashCollections.reduce((sum, row) => sum + toNumber(row.variance), 0);
  const tankVarianceLitres = session.tankDippings.reduce((sum, row) => sum + toNumber(row.varianceLitres), 0);
  const martNetSales = session.martSales.reduce((sum, row) => sum + toNumber(row.netMartSales), 0);
  const hasOperationalData =
    session.pumpReadings.length > 0 ||
    session.tankDippings.length > 0 ||
    session.cashCollections.length > 0 ||
    session.martSales.length > 0;

  const openExceptions =
    session.pumpReadings.filter((row) => toNumber(row.variance) !== 0).length +
    session.tankDippings.filter((row) => toNumber(row.varianceLitres) !== 0).length +
    session.cashCollections.filter((row) => toNumber(row.variance) !== 0).length +
    session.martSales.filter((row) => toNumber(row.variance) !== 0).length;

  return {
    totalLitresSold,
    expectedForecourtRevenue,
    cashBanked,
    bankingVariance,
    tankVarianceLitres,
    martNetSales,
    openExceptions,
    hasOperationalData,
  };
}

function sessionAlerts(
  stationName: string,
  businessDate: string,
  session: {
    pumpReadings: {
      id: string;
      variance: unknown;
      nozzle: { name: string; pump: { name: string } };
    }[];
    tankDippings: {
      id: string;
      varianceLitres: unknown;
      tank: { name: string };
      product: { name: string };
    }[];
    cashCollections: {
      id: string;
      variance: unknown;
      bankCollectionReference: string | null;
    }[];
    martSales: {
      id: string;
      variance: unknown;
    }[];
  } | null
): CommandCenterAlert[] {
  if (!session) return [];

  const alerts: CommandCenterAlert[] = [];

  for (const reading of session.pumpReadings) {
    const variance = toNumber(reading.variance);
    if (variance === 0) continue;
    alerts.push({
      id: `pump-${reading.id}`,
      severity: Math.abs(variance) >= 500 ? "danger" : "warning",
      title: `${reading.nozzle.pump.name} ${reading.nozzle.name} - ${variance < 0 ? "Cash Short" : "Cash Over"}`,
      detail: `${stationName} | ${businessDate}`,
      amount: variance,
      unit: "currency",
    });
  }

  for (const dipping of session.tankDippings) {
    const variance = toNumber(dipping.varianceLitres);
    if (variance === 0) continue;
    alerts.push({
      id: `tank-${dipping.id}`,
      severity: Math.abs(variance) >= 50 ? "danger" : "warning",
      title: `${dipping.tank.name} ${dipping.product.name} - ${variance < 0 ? "Stock Short" : "Stock Over"}`,
      detail: `${stationName} | Closing stock variance`,
      amount: variance,
      unit: "litres",
    });
  }

  for (const collection of session.cashCollections) {
    const variance = toNumber(collection.variance);
    if (variance === 0) continue;
    alerts.push({
      id: `cash-${collection.id}`,
      severity: Math.abs(variance) >= 500 ? "danger" : "warning",
      title: `Cash Collection - ${variance < 0 ? "Underbanked" : "Overbanked"}`,
      detail: collection.bankCollectionReference ? `Reference: ${collection.bankCollectionReference}` : `${stationName} | ${businessDate}`,
      amount: variance,
      unit: "currency",
    });
  }

  for (const martSale of session.martSales) {
    const variance = toNumber(martSale.variance);
    if (variance === 0) continue;
    alerts.push({
      id: `mart-${martSale.id}`,
      severity: Math.abs(variance) >= 200 ? "danger" : "warning",
      title: `Mart Cash Variance - ${variance < 0 ? "Short" : "Over"}`,
      detail: `${stationName} | ${businessDate}`,
      amount: variance,
      unit: "currency",
    });
  }

  return alerts
    .sort((left, right) => Math.abs(right.amount) - Math.abs(left.amount))
    .slice(0, 5);
}

export default async function CommandCenterPage({
  searchParams,
}: {
  searchParams: Promise<{ stationId?: string }>;
}) {
  const session = await getRequiredSession();
  const params = await searchParams;
  const stationId = await resolveOrRedirectStation(session, params.stationId, "/command-center");

  if (!stationId) {
    return (
      <>
        <PageTitle eyebrow="Command Center" title="Station Dashboard" />
        <div className="dash-panel">
          <div style={{ padding: "2rem", textAlign: "center", color: "var(--ax-muted)" }}>
            No stations available for this account.
          </div>
        </div>
      </>
    );
  }

  await requireWriteAccess(session, { targetStationId: stationId });

  const station = await prisma.station.findFirst({
    where: { id: stationId, tenantId: session.user.tenantId },
  });

  if (!station) {
    return (
      <>
        <PageTitle eyebrow="Command Center" title="Station Dashboard" />
        <div className="dash-panel">
          <div style={{ padding: "2rem", textAlign: "center", color: "var(--ax-muted)" }}>
            Station not found.
          </div>
        </div>
      </>
    );
  }

  const today = currentBusinessDate();
  const dailySession = await prisma.dailySession.findFirst({
    where: {
      tenantId: session.user.tenantId,
      stationId,
      businessDate: today,
      shift: "DAY",
    },
    include: {
      pumpReadings: {
        include: { nozzle: { include: { pump: true } } },
      },
      tankDippings: {
        include: { tank: true, product: true },
      },
      cashCollections: true,
      martSales: true,
    },
  });

  const recentSessions = await prisma.dailySession.findMany({
    where: {
      tenantId: session.user.tenantId,
      stationId,
    },
    include: {
      pumpReadings: { select: { litresSold: true } },
      cashCollections: { select: { amountToBank: true, variance: true } },
    },
    orderBy: [{ businessDate: "desc" }, { openedAt: "desc" }],
    take: 5,
  });

  const metrics = sessionMetrics(dailySession);
  const businessDate = formatDisplayDate(today);
  const statusRows: StationStatusRow[] = recentSessions.map((row) => ({
    id: row.id,
    station: station.name,
    date: formatDisplayDate(row.businessDate),
    status: row.status as StationStatusRow["status"],
    litresSold: row.pumpReadings.reduce((sum, reading) => sum + Number(reading.litresSold), 0),
    cashBanked: row.cashCollections.reduce((sum, collection) => sum + Number(collection.amountToBank), 0),
    variance: row.cashCollections.reduce((sum, collection) => sum + Number(collection.variance), 0),
  }));
  const alerts = sessionAlerts(station.name, businessDate, dailySession);

  return (
    <CommandCenterClient
      stationId={station.id}
      stationName={station.name}
      businessDate={businessDate}
      dailySessionStatus={dailySession?.status ?? null}
      metrics={{ ...metrics, openExceptions: alerts.length }}
      statusRows={statusRows}
      alerts={alerts}
    />
  );
}
