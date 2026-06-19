import type { LubeBaySale } from "@prisma/client";
import type { Db } from "./types";
import type { CreateLubeBaySaleInput, UpdateLubeBaySaleInput, LubeBayServiceTypeInput, LubeBayMomoOperatorInput } from "../schemas/lube-bay.schema";
import { calcLubeBayTotalExpected, calcLubeBayVariance } from "../calculations";
import { appendCorrectionNote } from "../corrections";

const LOCKED_SESSION_STATUSES = new Set(["READY_FOR_REVIEW", "APPROVED"]);

type TenantScopedInput = {
  tenantId: string;
};

async function getWritableSession(db: Db, tenantId: string, stationId: string, dailySessionId: string) {
  const session = await db.dailySession.findUnique({ where: { id: dailySessionId } });
  if (!session || session.tenantId !== tenantId || session.stationId !== stationId) {
    throw new Error("Daily session not found or mismatch");
  }
  if (LOCKED_SESSION_STATUSES.has(session.status)) {
    throw new Error(`Cannot modify lube bay sales for a session that is ${session.status}`);
  }
  return session;
}

async function getServiceType(db: Db, tenantId: string, stationId: string, serviceTypeId: string) {
  const serviceType = await db.lubeBayServiceType.findFirst({
    where: {
      id: serviceTypeId,
      tenantId,
      isActive: true,
      OR: [{ stationId }, { stationId: null }],
    },
  });
  if (!serviceType) throw new Error("Selected service type is not active or does not belong to this station");
  return serviceType;
}

async function getLineData(db: Db, input: TenantScopedInput & Pick<CreateLubeBaySaleInput, "stationId" | "lines">) {
  const lines = [];
  for (const line of input.lines) {
    const product = await db.product.findFirst({
      where: {
        id: line.productId,
        tenantId: input.tenantId,
        isActive: true,
        category: { in: ["LUBRICANT", "OTHER"] },
      },
      include: {
        priceHistory: {
          where: { tenantId: input.tenantId, stationId: input.stationId, effectiveTo: null },
          orderBy: { effectiveFrom: "desc" },
          take: 1,
        },
      },
    });
    if (!product) throw new Error("Selected product is not active or does not belong to this tenant");

    const price = Number(product.priceHistory[0]?.pricePerLitre ?? 0);
    if (price <= 0) throw new Error(`No active price found for ${product.name}`);
    lines.push({
      productId: product.id,
      quantity: line.quantity,
      unitPrice: price,
      amount: line.quantity * price,
    });
  }
  return lines;
}

async function validateCreditor(db: Db, input: TenantScopedInput & Pick<CreateLubeBaySaleInput, "stationId" | "creditorId" | "paymentMode">) {
  if (input.paymentMode !== "CREDIT") return;
  const creditor = await db.creditor.findFirst({
    where: {
      id: input.creditorId,
      tenantId: input.tenantId,
      stationId: input.stationId,
      status: "ACTIVE",
    },
    select: { id: true },
  });
  if (!creditor) throw new Error("Selected creditor is not active or does not belong to this station");
}

async function validateMomoOperator(db: Db, input: TenantScopedInput & Pick<CreateLubeBaySaleInput, "stationId" | "momoOperator" | "paymentMode">) {
  if (input.paymentMode !== "MOMO") return;
  const operator = await db.lubeBayMomoOperator.findFirst({
    where: {
      tenantId: input.tenantId,
      name: input.momoOperator,
      isActive: true,
      OR: [{ stationId: input.stationId }, { stationId: null }],
    },
    select: { id: true },
  });
  if (!operator) throw new Error("Selected MoMo operator is not active for this station");
}

function paymentAmounts(input: CreateLubeBaySaleInput, totalExpected: number) {
  return {
    cashAmount: input.paymentMode === "CASH" ? totalExpected : 0,
    cardAmount: input.paymentMode === "CARD" ? totalExpected : 0,
    momoAmount: input.paymentMode === "MOMO" ? totalExpected : 0,
    creditorAmount: input.paymentMode === "CREDIT" ? totalExpected : 0,
  };
}

export type CreateLubeBaySaleServiceInput = CreateLubeBaySaleInput & TenantScopedInput & {
  createdBy: string;
  supervisorName?: string | null;
};

export async function createLubeBaySale(db: Db, input: CreateLubeBaySaleServiceInput): Promise<LubeBaySale> {
  const session = await getWritableSession(db, input.tenantId, input.stationId, input.dailySessionId);
  const serviceType = await getServiceType(db, input.tenantId, input.stationId, input.serviceTypeId);
  await validateCreditor(db, input);
  await validateMomoOperator(db, input);
  const lineData = await getLineData(db, input);
  const productTotal = lineData.reduce((sum, line) => sum + line.amount, 0);
  const totalExpected = calcLubeBayTotalExpected(productTotal, input.labourCharge, 0, input.discount);
  if (totalExpected < 0) throw new Error("Discount cannot exceed product and labour charges");
  const amounts = paymentAmounts(input, totalExpected);
  const variance = calcLubeBayVariance(amounts.cashAmount, amounts.cardAmount, amounts.momoAmount, amounts.creditorAmount, totalExpected);

  const sale = await db.lubeBaySale.create({
    data: {
      tenantId: input.tenantId,
      stationId: input.stationId,
      dailySessionId: input.dailySessionId,
      businessDate: session.businessDate,
      vehicleReg: input.vehicleReg.trim().toUpperCase(),
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      serviceTypeId: serviceType.id,
      serviceType: serviceType.name,
      vehicleCategory: input.vehicleCategory,
      lubricantAmount: productTotal,
      labourCharge: input.labourCharge,
      partsCharge: 0,
      discount: input.discount,
      totalExpected,
      ...amounts,
      creditorId: input.paymentMode === "CREDIT" ? input.creditorId : null,
      paymentMode: input.paymentMode,
      momoOperator: input.paymentMode === "MOMO" ? input.momoOperator : null,
      momoNumber: input.paymentMode === "MOMO" ? input.momoNumber : null,
      cardDetails: input.paymentMode === "CARD" ? input.cardDetails : null,
      variance,
      technicianName: input.technicianName,
      supervisorName: input.supervisorName,
      remarks: input.remarks,
      createdBy: input.createdBy,
      lines: {
        create: lineData.map((line) => ({ tenantId: input.tenantId, ...line })),
      },
    },
  });

  if (input.paymentMode === "CREDIT" && input.creditorId) {
    await db.creditorLedgerEntry.create({
      data: {
        tenantId: input.tenantId,
        stationId: input.stationId,
        dailySessionId: input.dailySessionId,
        creditorId: input.creditorId,
        businessDate: session.businessDate,
        type: "SALE",
        amount: totalExpected,
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
  supervisorName?: string | null;
};

export async function updateLubeBaySale(db: Db, input: UpdateLubeBaySaleServiceInput): Promise<LubeBaySale> {
  const existing = await db.lubeBaySale.findUnique({ where: { id: input.id } });
  if (!existing || existing.tenantId !== input.tenantId || existing.stationId !== input.stationId || existing.dailySessionId !== input.dailySessionId) {
    throw new Error("Lube bay sale not found or mismatch");
  }

  await getWritableSession(db, input.tenantId, input.stationId, input.dailySessionId);
  const serviceType = await getServiceType(db, input.tenantId, input.stationId, input.serviceTypeId);
  await validateCreditor(db, input);
  await validateMomoOperator(db, input);
  const lineData = await getLineData(db, input);
  const productTotal = lineData.reduce((sum, line) => sum + line.amount, 0);
  const totalExpected = calcLubeBayTotalExpected(productTotal, input.labourCharge, 0, input.discount);
  if (totalExpected < 0) throw new Error("Discount cannot exceed product and labour charges");
  const amounts = paymentAmounts(input, totalExpected);
  const variance = calcLubeBayVariance(amounts.cashAmount, amounts.cardAmount, amounts.momoAmount, amounts.creditorAmount, totalExpected);

  await db.lubeBaySaleLine.deleteMany({ where: { tenantId: input.tenantId, saleId: input.id } });
  await db.creditorLedgerEntry.deleteMany({ where: { tenantId: input.tenantId, lubeBaySaleId: input.id } });

  const sale = await db.lubeBaySale.update({
    where: { id: input.id },
    data: {
      vehicleReg: input.vehicleReg.trim().toUpperCase(),
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      serviceTypeId: serviceType.id,
      serviceType: serviceType.name,
      vehicleCategory: input.vehicleCategory,
      lubricantProductId: null,
      quantity: 0,
      unitPrice: 0,
      lubricantAmount: productTotal,
      labourCharge: input.labourCharge,
      partsCharge: 0,
      discount: input.discount,
      totalExpected,
      ...amounts,
      creditorId: input.paymentMode === "CREDIT" ? input.creditorId : null,
      paymentMode: input.paymentMode,
      momoOperator: input.paymentMode === "MOMO" ? input.momoOperator : null,
      momoNumber: input.paymentMode === "MOMO" ? input.momoNumber : null,
      cardDetails: input.paymentMode === "CARD" ? input.cardDetails : null,
      variance,
      technicianName: input.technicianName,
      supervisorName: input.supervisorName,
      remarks: appendCorrectionNote(input.remarks ?? existing.remarks, input.correctionReason),
      updatedBy: input.updatedBy,
      lines: {
        create: lineData.map((line) => ({ tenantId: input.tenantId, ...line })),
      },
    },
  });

  if (input.paymentMode === "CREDIT" && input.creditorId) {
    await db.creditorLedgerEntry.create({
      data: {
        tenantId: input.tenantId,
        stationId: input.stationId,
        dailySessionId: input.dailySessionId,
        creditorId: input.creditorId,
        businessDate: existing.businessDate,
        type: "SALE",
        amount: totalExpected,
        lubeBaySaleId: input.id,
        remarks: `Lube bay correction for ${sale.vehicleReg}`,
        createdBy: input.updatedBy,
      },
    });
  }

  return sale;
}

export type SaveLubeBayServiceTypeInput = LubeBayServiceTypeInput & TenantScopedInput & {
  userId: string;
};

export async function saveLubeBayServiceType(db: Db, input: SaveLubeBayServiceTypeInput) {
  if (input.stationId) {
    const station = await db.station.findFirst({ where: { id: input.stationId, tenantId: input.tenantId } });
    if (!station) throw new Error("Station was not found for this company");
  }

  if (input.id) {
    const existing = await db.lubeBayServiceType.findFirst({
      where: { id: input.id, tenantId: input.tenantId },
      select: { id: true },
    });
    if (!existing) throw new Error("Service type was not found for this company");

    return db.lubeBayServiceType.update({
      where: { id: input.id },
      data: {
        name: input.name,
        stationId: input.stationId,
        vehicleCategory: input.vehicleCategory,
        defaultLabourCharge: input.defaultLabourCharge,
        isActive: input.isActive,
        updatedBy: input.userId,
      },
    });
  }

  return db.lubeBayServiceType.create({
    data: {
      tenantId: input.tenantId,
      stationId: input.stationId,
      name: input.name,
      vehicleCategory: input.vehicleCategory,
      defaultLabourCharge: input.defaultLabourCharge,
      isActive: input.isActive,
      createdBy: input.userId,
    },
  });
}

export type SaveLubeBayMomoOperatorInput = LubeBayMomoOperatorInput & TenantScopedInput & {
  userId: string;
};

export async function saveLubeBayMomoOperator(db: Db, input: SaveLubeBayMomoOperatorInput) {
  if (input.stationId) {
    const station = await db.station.findFirst({ where: { id: input.stationId, tenantId: input.tenantId } });
    if (!station) throw new Error("Station was not found for this company");
  }

  if (input.id) {
    const existing = await db.lubeBayMomoOperator.findFirst({
      where: { id: input.id, tenantId: input.tenantId },
      select: { id: true },
    });
    if (!existing) throw new Error("MoMo operator was not found for this company");

    return db.lubeBayMomoOperator.update({
      where: { id: input.id },
      data: {
        name: input.name,
        stationId: input.stationId,
        isActive: input.isActive,
        updatedBy: input.userId,
      },
    });
  }

  return db.lubeBayMomoOperator.create({
    data: {
      tenantId: input.tenantId,
      stationId: input.stationId,
      name: input.name,
      isActive: input.isActive,
      createdBy: input.userId,
    },
  });
}
