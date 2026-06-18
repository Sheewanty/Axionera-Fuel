import PageTitle from "@/components/ui/PageTitle";
import { prisma } from "@/lib/db/prisma";
import { getRequiredSession, requireWriteAccess } from "@/lib/session";
import { resolveOrRedirectStation } from "@/lib/station-utils";
import { currentBusinessDate, formatDisplayDate } from "@/lib/business-date";
import LubeBaySalesClient from "./LubeBaySalesClient";

export default async function LubeBaySalesPage({
  searchParams,
}: {
  searchParams: Promise<{ stationId?: string }>;
}) {
  const session = await getRequiredSession();
  const params = await searchParams;
  const targetStationId = await resolveOrRedirectStation(session, params.stationId, "/lube-bay/sales");

  if (!targetStationId) {
    return (
      <div className="p-6">
        <PageTitle title="Lube Bay Sales" />
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
    where: {
      stationId: targetStationId,
      tenantId: session.user.tenantId,
      businessDate: currentBusinessDate(),
      shift: "DAY",
    },
  });

  const [products, creditors, sales] = await Promise.all([
    prisma.product.findMany({
      where: {
        tenantId: session.user.tenantId,
        category: "LUBRICANT",
        isActive: true,
      },
      include: {
        priceHistory: {
          where: { stationId: targetStationId },
          orderBy: { effectiveFrom: "desc" },
          take: 1,
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.creditor.findMany({
      where: {
        tenantId: session.user.tenantId,
        stationId: targetStationId,
        status: "ACTIVE",
      },
      orderBy: { name: "asc" },
    }),
    dailySession
      ? prisma.lubeBaySale.findMany({
          where: {
            tenantId: session.user.tenantId,
            stationId: targetStationId,
            dailySessionId: dailySession.id,
          },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
  ]);

  const formattedDate = formatDisplayDate(dailySession?.businessDate);

  return (
    <>
      <PageTitle
        eyebrow="Lube Bay Operations"
        title="Lube Bay Sales"
        subtitle={dailySession ? `${station.name} - ${formattedDate} - ${dailySession.shift} Shift` : station.name}
      />

      <LubeBaySalesClient
        station={{ id: station.id, name: station.name }}
        dailySession={
          dailySession
            ? {
                id: dailySession.id,
                businessDate: formatDisplayDate(dailySession.businessDate),
                shift: dailySession.shift,
                status: dailySession.status,
              }
            : null
        }
        products={products.map((product) => ({
          id: product.id,
          name: product.name,
          price: Number(product.priceHistory[0]?.pricePerLitre ?? 0),
        }))}
        creditors={creditors.map((creditor) => ({
          id: creditor.id,
          name: creditor.name,
        }))}
        sales={sales.map((sale) => ({
          id: sale.id,
          vehicleReg: sale.vehicleReg,
          customerName: sale.customerName,
          customerPhone: sale.customerPhone,
          serviceType: sale.serviceType,
          lubricantProductId: sale.lubricantProductId,
          quantity: Number(sale.quantity),
          unitPrice: Number(sale.unitPrice),
          lubricantAmount: Number(sale.lubricantAmount),
          labourCharge: Number(sale.labourCharge),
          partsCharge: Number(sale.partsCharge),
          discount: Number(sale.discount),
          totalExpected: Number(sale.totalExpected),
          cashAmount: Number(sale.cashAmount),
          cardAmount: Number(sale.cardAmount),
          momoAmount: Number(sale.momoAmount),
          creditorAmount: Number(sale.creditorAmount),
          creditorId: sale.creditorId,
          variance: Number(sale.variance),
          technicianName: sale.technicianName,
          supervisorName: sale.supervisorName,
          remarks: sale.remarks,
        }))}
      />
    </>
  );
}
