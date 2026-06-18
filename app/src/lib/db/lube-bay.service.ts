import type { LubeBaySale } from "@prisma/client";
import type { Db } from "./types";
import type { CreateLubeBaySaleInput, UpdateLubeBaySaleInput } from "../schemas/lube-bay.schema";
import {
  calcLubeBayLubricantAmount,
  calcLubeBayTotalExpected,
  calcLubeBayVariance,
} from "../calculations";
import { appendCorrectionNote } from "../corrections";

const LOCKED_SESSION_STATUSES = new Set(["READY_FOR_REVIEW", "APPROVED"]);

type TenantScopedInput = {
  tenantId: string;
};

async function getWritableSession(db: Db, tenantId: string, stationId: string, dailySessionId: string) {
  const session = await db.dailySession.findUnique({
    where: { id: dailySessionId },
  });

  if (!session || session.tenantId !== tenantId || session.stationId !== stationId) {
    throw new Error("Daily session not found or mismatch");
  }

  if (LOCKED_SESSION_STATUSES.has(session.status)) {
    throw new Error(`Cannot modify lube bay sales for a session that is ${session.status}`);
  }

  return session;
}

async function validateReferences(db: Db, input: TenantScopedInput & CreateLubeBaySaleInput) {
  if (input.lubricantProductId) {
    const product = await db.product.findFirst({
      where: {
        id: input.lubricantProductId,
        tenantId: input.tenantId,
        category: "LUBRICANT",
        isActive: true,
      },
      select: { id: true },
    });

    if (!product) {
      throw new Error("Selected lubricant product is not active or does not belong to this tenant");
    }
  }

  if (input.creditorId) {
    const creditor = await db.creditor.findFirst({
      where: {
        id: input.creditorId,
        tenantId: input.tenantId,
        stationId: input.stationId,
        status: "ACTIVE",
      },
      select: { id: true },
    });

    if (!creditor) {
      throw new Error("Selected creditor is not active or does not belong to this station");
    }
  }
}

function computedValues(input: CreateLubeBaySaleInput) {
  const lubricantAmount = calcLubeBayLubricantAmount(input.quantity, input.unitPrice);
  const totalExpected = calcLubeBayTotalExpected(
    lubricantAmount,
    input.labourCharge,
    input.partsCharge,
    input.discount
  );
  const variance = calcLubeBayVariance(
    input.cashAmount,
    input.cardAmount,
    input.momoAmount,
    input.creditorAmount,
    totalExpected
  );

  if (totalExpected < 0) {
    throw new Error("Discount cannot exceed lubricant, labour, and parts charges");
  }

  return { lubricantAmount, totalExpected, variance };
}

export type CreateLubeBaySaleServiceInput = CreateLubeBaySaleInput & TenantScopedInput & {
  createdBy: string;
};

export async function createLubeBaySale(db: Db, input: CreateLubeBaySaleServiceInput): Promise<LubeBaySale> {
  const session = await getWritableSession(db, input.tenantId, input.stationId, input.dailySessionId);
  await validateReferences(db, input);
  const computed = computedValues(input);

  const sale = await db.lubeBaySale.create({
    data: {
      tenantId: input.tenantId,
      stationId: input.stationId,
      dailySessionId: input.dailySessionId,
      businessDate: session.businessDate,
      vehicleReg: input.vehicleReg.trim().toUpperCase(),
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      serviceType: input.serviceType,
      lubricantProductId: input.lubricantProductId,
      quantity: input.quantity,
      unitPrice: input.unitPrice,
      lubricantAmount: computed.lubricantAmount,
      labourCharge: input.labourCharge,
      partsCharge: input.partsCharge,
      discount: input.discount,
      totalExpected: computed.totalExpected,
      cashAmount: input.cashAmount,
      cardAmount: input.cardAmount,
      momoAmount: input.momoAmount,
      creditorAmount: input.creditorAmount,
      creditorId: input.creditorId,
      variance: computed.variance,
      technicianName: input.technicianName,
      supervisorName: input.supervisorName,
      remarks: input.remarks,
      createdBy: input.createdBy,
    },
  });

  if (input.creditorId && input.creditorAmount > 0) {
    await db.creditorLedgerEntry.create({
      data: {
        tenantId: input.tenantId,
        stationId: input.stationId,
        dailySessionId: input.dailySessionId,
        creditorId: input.creditorId,
        businessDate: session.businessDate,
        type: "SALE",
        amount: input.creditorAmount,
        productId: input.lubricantProductId,
        lubeBaySaleId: sale.id,
        remarks: `Lube bay sale for ${sale.vehicleReg}`,
        createdBy: input.createdBy,
      },
    });
  }

  return sale;
}

export type UpdateLubeBaySaleServiceInput = UpdateLubeBaySaleInput & TenantScopedInput & {
  updatedBy: string;
};

export async function updateLubeBaySale(db: Db, input: UpdateLubeBaySaleServiceInput): Promise<LubeBaySale> {
  const existing = await db.lubeBaySale.findUnique({
    where: { id: input.id },
  });

  if (
    !existing ||
    existing.tenantId !== input.tenantId ||
    existing.stationId !== input.stationId ||
    existing.dailySessionId !== input.dailySessionId
  ) {
    throw new Error("Lube bay sale not found or mismatch");
  }

  await getWritableSession(db, input.tenantId, input.stationId, input.dailySessionId);
  await validateReferences(db, input);
  const computed = computedValues(input);

  const sale = await db.lubeBaySale.update({
    where: { id: input.id },
    data: {
      vehicleReg: input.vehicleReg.trim().toUpperCase(),
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      serviceType: input.serviceType,
      lubricantProductId: input.lubricantProductId,
      quantity: input.quantity,
      unitPrice: input.unitPrice,
      lubricantAmount: computed.lubricantAmount,
      labourCharge: input.labourCharge,
      partsCharge: input.partsCharge,
      discount: input.discount,
      totalExpected: computed.totalExpected,
      cashAmount: input.cashAmount,
      cardAmount: input.cardAmount,
      momoAmount: input.momoAmount,
      creditorAmount: input.creditorAmount,
      creditorId: input.creditorId,
      variance: computed.variance,
      technicianName: input.technicianName,
      supervisorName: input.supervisorName,
      remarks: appendCorrectionNote(input.remarks ?? existing.remarks, input.correctionReason),
      updatedBy: input.updatedBy,
    },
  });

  await db.creditorLedgerEntry.deleteMany({
    where: {
      tenantId: input.tenantId,
      lubeBaySaleId: input.id,
    },
  });

  if (input.creditorId && input.creditorAmount > 0) {
    await db.creditorLedgerEntry.create({
      data: {
        tenantId: input.tenantId,
        stationId: input.stationId,
        dailySessionId: input.dailySessionId,
        creditorId: input.creditorId,
        businessDate: existing.businessDate,
        type: "SALE",
        amount: input.creditorAmount,
        productId: input.lubricantProductId,
        lubeBaySaleId: input.id,
        remarks: `Lube bay correction for ${sale.vehicleReg}`,
        createdBy: input.updatedBy,
      },
    });
  }

  return sale;
}
