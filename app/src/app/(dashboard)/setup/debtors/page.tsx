import PageTitle from "@/components/ui/PageTitle";
import { currentBusinessDate, formatDisplayDate } from "@/lib/business-date";
import { prisma } from "@/lib/db/prisma";
import { getRequiredSession, requireWriteAccess } from "@/lib/session";
import { resolveOrRedirectStation } from "@/lib/station-utils";
import CreditorsClient from "../../cash/creditors/CreditorsClient";

export default async function DebtorsSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ stationId?: string }>;
}) {
  const session = await getRequiredSession();
  const params = await searchParams;
  const stationId = await resolveOrRedirectStation(session, params.stationId, "/setup/debtors");

  if (!stationId) {
    return (
      <div className="p-6">
        <PageTitle eyebrow="Setup" title="Debtors" />
        <div className="dash-panel p-6">No stations available for this account.</div>
      </div>
    );
  }

  await requireWriteAccess(session, { targetStationId: stationId });

  const station = await prisma.station.findFirst({
    where: { id: stationId, tenantId: session.user.tenantId },
  });
  if (!station) return <div>Station not found.</div>;

  const [dailySession, creditors, ledgerEntries] = await Promise.all([
    prisma.dailySession.findFirst({
      where: {
        tenantId: session.user.tenantId,
        stationId,
        businessDate: currentBusinessDate(),
        shift: "DAY",
      },
    }),
    prisma.creditor.findMany({
      where: { tenantId: session.user.tenantId, stationId },
      orderBy: [{ status: "asc" }, { name: "asc" }],
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
  for (const entry of ledgerEntries) {
    const current = balances.get(entry.creditorId) ?? 0;
    const signedAmount = entry.type === "SALE" ? Number(entry.amount) : -Number(entry.amount);
    balances.set(entry.creditorId, current + signedAmount);
  }

  return (
    <>
      <PageTitle
        eyebrow="Setup"
        title="Debtors"
        subtitle={`${station.name} - ${dailySession ? formatDisplayDate(dailySession.businessDate) : "No open day"}`}
      />

      <CreditorsClient
        mode="setup"
        stationId={stationId}
        stationName={station.name}
        dailySessionId={dailySession?.id ?? null}
        sessionWritable
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
        products={[]}
        entries={[]}
      />
    </>
  );
}
