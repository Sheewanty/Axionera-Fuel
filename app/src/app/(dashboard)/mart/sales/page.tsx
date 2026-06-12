import PageTitle from "@/components/ui/PageTitle";
import { prisma } from "@/lib/db/prisma";
import { getRequiredSession, requireWriteAccess } from "@/lib/session";
import { resolveOrRedirectStation } from "@/lib/station-utils";
import MartSalesClient from "./MartSalesClient";

export default async function MartSalesPage({
  searchParams,
}: {
  searchParams: Promise<{ stationId?: string }>;
}) {
  const session = await getRequiredSession();
  const params = await searchParams;
  const targetStationId = await resolveOrRedirectStation(session, params.stationId, "/mart/sales");

  if (!targetStationId) {
    return (
      <div className="p-6">
        <PageTitle title="Mart Sales" />
        <div className="mt-6 bg-white p-6 rounded shadow">
          <p>No stations available for this account.</p>
        </div>
      </div>
    );
  }

  await requireWriteAccess(session, { targetStationId });

  const station = await prisma.station.findFirst({
    where: { id: targetStationId, tenantId: session.user.tenantId },
  });

  if (!station) {
    return <div>Station not found</div>;
  }

  const dailySession = await prisma.dailySession.findFirst({
    where: { stationId: targetStationId, tenantId: session.user.tenantId, shift: "DAY" },
    orderBy: { businessDate: "desc" },
  });

  const martSale = dailySession
    ? await prisma.martSale.findFirst({
        where: {
          tenantId: session.user.tenantId,
          dailySessionId: dailySession.id,
        },
      })
    : null;

  const formattedDate = dailySession?.businessDate.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <>
      <PageTitle
        eyebrow="Mart Operations"
        title="Mart Sales"
        subtitle={dailySession ? `${station.name} - ${formattedDate} - ${dailySession.shift} Shift` : station.name}
      />

      <MartSalesClient
        station={{
          id: station.id,
          name: station.name,
        }}
        dailySession={
          dailySession
            ? {
                id: dailySession.id,
                businessDate: dailySession.businessDate.toISOString().split("T")[0],
                shift: dailySession.shift,
                status: dailySession.status,
              }
            : null
        }
        martSale={
          martSale
            ? {
                id: martSale.id,
                openingCash: Number(martSale.openingCash),
                posSales: Number(martSale.posSales),
                cashSales: Number(martSale.cashSales),
                mobileMoney: Number(martSale.mobileMoney),
                returns: Number(martSale.returns),
                netMartSales: Number(martSale.netMartSales),
                cashCount: Number(martSale.cashCount),
                variance: Number(martSale.variance),
                remarks: martSale.remarks,
              }
            : null
        }
      />
    </>
  );
}
