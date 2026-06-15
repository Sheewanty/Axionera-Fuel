import { type Db } from "./types";
import { calcExpectedTankAfterDischarge, calcDischargeVariance } from "../calculations";
import { appendCorrectionNote } from "../corrections";

export type CreateProductDischargeInput = {
  tenantId: string;
  stationId: string;
  dailySessionId: string;
  tankId: string;
  productId: string;
  supplierName: string;
  invoiceNumber: string;
  sealNumbers?: string;
  sealNumbersContinued?: string;
  compartmentNumber?: string;
  invoiceMeasurement: number;
  stationMeasurement?: number;
  productDischargedLitres: number;
  vehicleRegistrationNumber?: string;
  stationSupervisorName?: string;
  couplingHeightCm?: number;
  calibrationCertificate?: string;
  tbar?: number;
  topUpLitres: number;
  beforeTankLitres: number;
  afterTankLitres: number;
  driverName?: string;
  dealerName?: string;
  remarks?: string;
  createdBy: string;
};

export async function createProductDischarge(db: Db, input: CreateProductDischargeInput) {
  const session = await db.dailySession.findUnique({
    where: { id: input.dailySessionId },
  });

  if (!session || session.tenantId !== input.tenantId || session.stationId !== input.stationId) {
    throw new Error("Daily session not found or mismatch.");
  }

  if (session.status === "APPROVED" || session.status === "READY_FOR_REVIEW") {
    throw new Error(`Cannot modify product discharge for a session that is ${session.status}.`);
  }

  const tank = await db.tank.findUnique({
    where: { id: input.tankId },
  });

  if (!tank || tank.tenantId !== input.tenantId || tank.stationId !== input.stationId || tank.productId !== input.productId) {
    throw new Error("Tank not found or mismatch.");
  }

  const expectedTankAfterDischarge = calcExpectedTankAfterDischarge(
    input.beforeTankLitres,
    input.productDischargedLitres,
    input.topUpLitres
  );

  const dischargeVarianceLitres = calcDischargeVariance(
    input.afterTankLitres,
    expectedTankAfterDischarge
  );

  return db.productDischarge.create({
    data: {
      tenantId: input.tenantId,
      stationId: input.stationId,
      dailySessionId: input.dailySessionId,
      businessDate: session.businessDate,
      tankId: input.tankId,
      productId: input.productId,
      supplierName: input.supplierName,
      invoiceNumber: input.invoiceNumber,
      sealNumbers: input.sealNumbers,
      sealNumbersContinued: input.sealNumbersContinued,
      compartmentNumber: input.compartmentNumber,
      invoiceMeasurement: input.invoiceMeasurement,
      stationMeasurement: input.stationMeasurement,
      productDischargedLitres: input.productDischargedLitres,
      vehicleRegistrationNumber: input.vehicleRegistrationNumber,
      stationSupervisorName: input.stationSupervisorName,
      couplingHeightCm: input.couplingHeightCm,
      calibrationCertificate: input.calibrationCertificate,
      tbar: input.tbar,
      topUpLitres: input.topUpLitres,
      beforeTankLitres: input.beforeTankLitres,
      expectedTankAfterDischarge,
      afterTankLitres: input.afterTankLitres,
      dischargeVarianceLitres,
      driverName: input.driverName,
      dealerName: input.dealerName,
      remarks: input.remarks,
      createdBy: input.createdBy,
    },
  });
}

export type UpdateProductDischargeInput = {
  id: string;
  tenantId: string;
  stationId: string;
  dailySessionId: string;
  tankId: string;
  productId: string;
  supplierName: string;
  invoiceNumber: string;
  sealNumbers?: string;
  sealNumbersContinued?: string;
  compartmentNumber?: string;
  invoiceMeasurement: number;
  stationMeasurement?: number;
  productDischargedLitres: number;
  vehicleRegistrationNumber?: string;
  stationSupervisorName?: string;
  couplingHeightCm?: number;
  calibrationCertificate?: string;
  tbar?: number;
  topUpLitres: number;
  beforeTankLitres: number;
  afterTankLitres: number;
  driverName?: string;
  dealerName?: string;
  remarks?: string;
  correctionReason: string;
  updatedBy: string;
};

export async function updateProductDischarge(db: Db, input: UpdateProductDischargeInput) {
  const existing = await db.productDischarge.findUnique({
    where: { id: input.id },
  });

  if (!existing || existing.tenantId !== input.tenantId || existing.stationId !== input.stationId || existing.dailySessionId !== input.dailySessionId) {
    throw new Error("Product discharge not found or mismatch.");
  }

  const session = await db.dailySession.findUnique({
    where: { id: input.dailySessionId },
  });

  if (!session) {
    throw new Error("Daily session not found.");
  }

  if (session.status === "APPROVED" || session.status === "READY_FOR_REVIEW") {
    throw new Error(`Cannot modify product discharge for a session that is ${session.status}.`);
  }

  const tank = await db.tank.findUnique({
    where: { id: input.tankId },
  });

  if (!tank || tank.tenantId !== input.tenantId || tank.stationId !== input.stationId || tank.productId !== input.productId) {
    throw new Error("Tank not found or mismatch.");
  }

  const expectedTankAfterDischarge = calcExpectedTankAfterDischarge(
    input.beforeTankLitres,
    input.productDischargedLitres,
    input.topUpLitres
  );

  const dischargeVarianceLitres = calcDischargeVariance(
    input.afterTankLitres,
    expectedTankAfterDischarge
  );

  return db.productDischarge.update({
    where: { id: input.id },
    data: {
      tankId: input.tankId,
      productId: input.productId,
      supplierName: input.supplierName,
      invoiceNumber: input.invoiceNumber,
      sealNumbers: input.sealNumbers,
      sealNumbersContinued: input.sealNumbersContinued,
      compartmentNumber: input.compartmentNumber,
      invoiceMeasurement: input.invoiceMeasurement,
      stationMeasurement: input.stationMeasurement,
      productDischargedLitres: input.productDischargedLitres,
      vehicleRegistrationNumber: input.vehicleRegistrationNumber,
      stationSupervisorName: input.stationSupervisorName,
      couplingHeightCm: input.couplingHeightCm,
      calibrationCertificate: input.calibrationCertificate,
      tbar: input.tbar,
      topUpLitres: input.topUpLitres,
      beforeTankLitres: input.beforeTankLitres,
      expectedTankAfterDischarge,
      afterTankLitres: input.afterTankLitres,
      dischargeVarianceLitres,
      driverName: input.driverName,
      dealerName: input.dealerName,
      remarks: appendCorrectionNote(input.remarks ?? existing.remarks, input.correctionReason),
      updatedBy: input.updatedBy,
    },
  });
}

export async function deleteProductDischarge(db: Db, id: string, tenantId: string, stationId: string, dailySessionId: string) {
  const existing = await db.productDischarge.findUnique({
    where: { id },
  });

  if (!existing || existing.tenantId !== tenantId || existing.stationId !== stationId || existing.dailySessionId !== dailySessionId) {
    throw new Error("Product discharge not found or mismatch.");
  }

  const session = await db.dailySession.findUnique({
    where: { id: dailySessionId },
  });

  if (!session) {
    throw new Error("Daily session not found.");
  }

  if (session.status === "APPROVED" || session.status === "READY_FOR_REVIEW") {
    throw new Error(`Cannot modify product discharge for a session that is ${session.status}.`);
  }

  return db.productDischarge.delete({
    where: { id },
  });
}
