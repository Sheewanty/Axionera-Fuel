import PageTitle from "@/components/ui/PageTitle";
import { getRequiredSession, requireWriteAccess } from "@/lib/session";
import { prisma } from "@/lib/db/prisma";
import { resolveOrRedirectStation } from "@/lib/station-utils";
import { currentBusinessDate, formatDisplayDate } from "@/lib/business-date";
import ProductDischargeClient from "./ProductDischargeClient";

export default async function ProductDischargePage({
  searchParams,
}: {
  searchParams: Promise<{ stationId?: string }>;
}) {
  const session = await getRequiredSession();
  const params = await searchParams;
  const targetStationId = await resolveOrRedirectStation(session, params.stationId, "/forecourt/product-discharge");

  if (!targetStationId) {
    return <div>Error: No stations available for this account.</div>;
  }

  await requireWriteAccess(session, { targetStationId });

  const station = await prisma.station.findFirst({
    where: { id: targetStationId, tenantId: session.user.tenantId },
  });
  if (!station) return <div>Station not found</div>;

  const dailySession = await prisma.dailySession.findFirst({
    where: {
      stationId: targetStationId,
      tenantId: session.user.tenantId,
      businessDate: currentBusinessDate(),
      shift: "DAY",
    },
  });

  if (!dailySession) {
    return (
      <div className="p-6">
        <PageTitle title="Product Discharge" />
        <div className="mt-6 bg-white p-6 rounded shadow">
          <p>No active session for this station. Please open a session first.</p>
        </div>
      </div>
    );
  }

  const dischargesDb = await prisma.productDischarge.findMany({
    where: { dailySessionId: dailySession.id, tenantId: session.user.tenantId },
    include: { tank: true, product: true },
    orderBy: { createdAt: "desc" },
  });

  const discharges = dischargesDb.map((d) => ({
    id: d.id,
    tankId: d.tankId,
    productId: d.productId,
    tank: d.tank.name,
    product: d.product.name,
    supplierName: d.supplierName,
    invoiceNumber: d.invoiceNumber,
    invoiceMeasurement: Number(d.invoiceMeasurement),
    stationMeasurement: d.stationMeasurement ? Number(d.stationMeasurement) : null,
    productDischargedLitres: Number(d.productDischargedLitres),
    beforeTankLitres: Number(d.beforeTankLitres),
    afterTankLitres: Number(d.afterTankLitres),
    dischargeVarianceLitres: Number(d.dischargeVarianceLitres),
    topUpLitres: Number(d.topUpLitres),
    expectedTankAfterDischarge: Number(d.expectedTankAfterDischarge),
    vehicleRegistrationNumber: d.vehicleRegistrationNumber,
    driverName: d.driverName,
    stationSupervisorName: d.stationSupervisorName,
    couplingHeightCm: d.couplingHeightCm ? Number(d.couplingHeightCm) : null,
    tbar: d.tbar ? Number(d.tbar) : null,
    calibrationCertificate: d.calibrationCertificate,
    tankerWaterTestStatus: d.tankerWaterTestStatus,
    receivingTankWaterTestStatus: d.receivingTankWaterTestStatus,
    waterTestRemarks: d.waterTestRemarks,
    sealNumbers: d.sealNumbers,
    sealNumbersContinued: d.sealNumbersContinued,
    compartmentNumber: d.compartmentNumber,
    remarks: d.remarks,
  }));

  const tanksDb = await prisma.tank.findMany({
    where: { stationId: targetStationId, tenantId: session.user.tenantId },
    include: { product: true },
    orderBy: { name: "asc" },
  });

  const tanks = tanksDb.map(t => ({
    id: t.id,
    name: t.name,
    productId: t.product.id,
    productName: t.product.name,
  }));

  const formattedDate = formatDisplayDate(dailySession.businessDate);

  return (
    <>
      <PageTitle
        eyebrow="Forecourt Operations"
        title="Product Discharge"
        subtitle={`${station.name} · ${formattedDate} · ${dailySession.shift} Shift`}
      />

      <ProductDischargeClient
        stationId={targetStationId}
        dailySessionId={dailySession.id}
        sessionStatus={dailySession.status}
        discharges={discharges}
        tanks={tanks}
      />
    </>
  );
}
