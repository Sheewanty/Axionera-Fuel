import PageTitle from "@/components/ui/PageTitle";
import { prisma } from "@/lib/db/prisma";
import { currentBusinessDate, formatDisplayDate } from "@/lib/business-date";
import { getRequiredSession, requireWriteAccess } from "@/lib/session";
import { resolveOrRedirectStation } from "@/lib/station-utils";
import PaymentDetailsClient from "./PaymentDetailsClient";

export default async function PaymentDetailsPage({
  searchParams,
}: {
  searchParams: Promise<{ stationId?: string }>;
}) {
  const session = await getRequiredSession();
  const params = await searchParams;
  const stationId = await resolveOrRedirectStation(session, params.stationId, "/cash/payment-details");

  if (!stationId) {
    return (
      <>
        <PageTitle eyebrow="Cash & Banking" title="Payment Details" />
        <div className="dash-panel" style={{ padding: 24 }}>No stations available for this account.</div>
      </>
    );
  }

  await requireWriteAccess(session, { targetStationId: stationId });

  const station = await prisma.station.findFirst({
    where: { id: stationId, tenantId: session.user.tenantId },
  });
  if (!station) return <div>Station not found</div>;

  const dailySession = await prisma.dailySession.findFirst({
    where: {
      stationId,
      tenantId: session.user.tenantId,
      businessDate: currentBusinessDate(),
      shift: "DAY",
    },
  });

  if (!dailySession) {
    return (
      <>
        <PageTitle eyebrow="Cash & Banking" title="Payment Details" subtitle={station.name} />
        <div className="dash-panel" style={{ padding: 24 }}>Open today&apos;s daily session before recording payment details.</div>
      </>
    );
  }

  const [products, details] = await Promise.all([
    prisma.product.findMany({
      where: { tenantId: session.user.tenantId, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.paymentDetail.findMany({
      where: {
        tenantId: session.user.tenantId,
        stationId,
        dailySessionId: dailySession.id,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <>
      <PageTitle
        eyebrow="Cash & Banking"
        title="Payment Details"
        subtitle={`${station.name} · ${formatDisplayDate(dailySession.businessDate)} · ${dailySession.shift} Shift`}
      />

      <PaymentDetailsClient
        stationId={stationId}
        dailySessionId={dailySession.id}
        products={products}
        sessionWritable={dailySession.status === "OPEN" || dailySession.status === "REOPENED"}
        details={details.map((detail) => ({
          id: detail.id,
          channel: detail.channel,
          amount: Number(detail.amount),
          customerName: detail.customerName,
          attendantName: detail.attendantName,
          referenceNumber: detail.referenceNumber,
          serialNumber: detail.serialNumber,
          status: detail.status,
          createdAt: detail.createdAt.toISOString(),
        }))}
      />
    </>
  );
}
