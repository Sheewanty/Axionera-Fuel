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

  const [products, details, debtorEntries] = await Promise.all([
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
    prisma.creditorLedgerEntry.findMany({
      where: {
        tenantId: session.user.tenantId,
        stationId,
        dailySessionId: dailySession.id,
      },
      select: {
        type: true,
        paymentMethod: true,
        amount: true,
      },
    }),
  ]);

  const paymentTotals = {
    goCardVisa: details
      .filter((detail) => detail.channel === "GO_CARD" || detail.channel === "VISA")
      .reduce((sum, detail) => sum + Number(detail.amount), 0),
    coupons: details
      .filter((detail) => detail.channel === "GOIL_COUPON" || detail.channel === "YY_COUPON")
      .reduce((sum, detail) => sum + Number(detail.amount), 0),
    ghqrMomo: details
      .filter((detail) => detail.channel === "GHQR")
      .reduce((sum, detail) => sum + Number(detail.amount), 0),
    debtorCreditSales: debtorEntries
      .filter((entry) => entry.type === "SALE")
      .reduce((sum, entry) => sum + Number(entry.amount), 0),
    debtorPaymentCash: debtorEntries
      .filter((entry) => entry.type === "PAYMENT" && entry.paymentMethod === "CASH")
      .reduce((sum, entry) => sum + Number(entry.amount), 0),
    debtorPaymentCheque: debtorEntries
      .filter((entry) => entry.type === "PAYMENT" && entry.paymentMethod === "CHEQUE")
      .reduce((sum, entry) => sum + Number(entry.amount), 0),
    debtorPaymentCard: debtorEntries
      .filter((entry) => entry.type === "PAYMENT" && entry.paymentMethod === "CARD")
      .reduce((sum, entry) => sum + Number(entry.amount), 0),
    debtorPaymentMomo: debtorEntries
      .filter((entry) => entry.type === "PAYMENT" && entry.paymentMethod === "MOMO")
      .reduce((sum, entry) => sum + Number(entry.amount), 0),
  };

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
        totals={paymentTotals}
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
