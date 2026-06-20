import PageTitle from "@/components/ui/PageTitle";
import { prisma } from "@/lib/db/prisma";
import { currentBusinessDate, formatDisplayDate } from "@/lib/business-date";
import { getRequiredSession, requireWriteAccess } from "@/lib/session";
import { resolveOrRedirectStation } from "@/lib/station-utils";
import CreditorsClient from "./CreditorsClient";

export default async function CreditorsPage({
  searchParams,
}: {
  searchParams: Promise<{ stationId?: string }>;
}) {
  const session = await getRequiredSession();
  const params = await searchParams;
  const stationId = await resolveOrRedirectStation(session, params.stationId, "/cash/creditors");

  if (!stationId) {
    return (
      <div className="p-6">
        <PageTitle eyebrow="Cash & Banking" title="Credit Sales / Payments" />
        <div className="dash-panel p-6">No stations available for this account.</div>
      </div>
    );
  }

  await requireWriteAccess(session, { targetStationId: stationId });

  const station = await prisma.station.findFirst({
    where: { id: stationId, tenantId: session.user.tenantId },
  });
  if (!station) return <div>Station not found.</div>;

  const dailySession = await prisma.dailySession.findFirst({
    where: {
      tenantId: session.user.tenantId,
      stationId,
      businessDate: currentBusinessDate(),
      shift: "DAY",
    },
  });

  const [creditors, products, ledgerEntries, balanceEntries] = await Promise.all([
    prisma.creditor.findMany({
      where: { tenantId: session.user.tenantId, stationId },
      orderBy: [{ status: "asc" }, { name: "asc" }],
    }),
    prisma.product.findMany({
      where: { tenantId: session.user.tenantId, isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.creditorLedgerEntry.findMany({
      where: { tenantId: session.user.tenantId, stationId },
      include: { creditor: true, product: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.creditorLedgerEntry.findMany({
      where: { tenantId: session.user.tenantId, stationId },
      select: {
        creditorId: true,
        type: true,
        amount: true,
      },
    }),
  ]);

  const balances = new Map<string, number>();
  for (const creditor of creditors) {
    balances.set(creditor.id, Number(creditor.openingBalance));
  }
  for (const entry of balanceEntries) {
    const current = balances.get(entry.creditorId) ?? 0;
    const signedAmount = entry.type === "SALE" ? Number(entry.amount) : -Number(entry.amount);
    balances.set(entry.creditorId, current + signedAmount);
  }

  const dayEntries = ledgerEntries.filter((entry) => entry.dailySessionId === dailySession?.id);
  const sessionWritable = dailySession?.status === "OPEN" || dailySession?.status === "REOPENED";

  return (
    <>
      <PageTitle
        eyebrow="Cash & Banking"
        title="Credit Sales / Payments"
        subtitle={`${station.name} · ${dailySession ? formatDisplayDate(dailySession.businessDate) : "No open day"}`}
      />

      <CreditorsClient
        mode="transactions"
        stationId={stationId}
        stationName={station.name}
        dailySessionId={dailySession?.id ?? null}
        sessionWritable={Boolean(sessionWritable)}
        creditors={creditors.map((creditor) => ({
          id: creditor.id,
          name: creditor.name,
          phone: creditor.phone,
          email: creditor.email,
          creditLimit: creditor.creditLimit ? Number(creditor.creditLimit) : null,
          openingBalance: Number(creditor.openingBalance),
          status: creditor.status,
          balance: balances.get(creditor.id) ?? 0,
        }))}
        products={products.map((product) => ({ id: product.id, name: product.name }))}
        entries={dayEntries.map((entry) => ({
          id: entry.id,
          creditorName: entry.creditor.name,
          productName: entry.product?.name ?? null,
          type: entry.type,
          paymentMethod: entry.paymentMethod,
          amount: Number(entry.amount),
          referenceNumber: entry.referenceNumber,
          createdAt: formatDisplayDate(entry.createdAt),
        }))}
      />
    </>
  );
}
