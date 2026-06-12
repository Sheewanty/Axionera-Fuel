import type { MartSale } from "@prisma/client";
import type { Db } from "./types";
import type { CreateMartSaleInput, UpdateMartSaleInput } from "../schemas/mart-sale.schema";
import { calcMartNetSales, calcMartVariance } from "../calculations";

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
    throw new Error(`Cannot modify mart sales for a session that is ${session.status}`);
  }

  return session;
}

export type CreateMartSaleServiceInput = CreateMartSaleInput & TenantScopedInput & {
  createdBy: string;
};

export async function createMartSale(db: Db, input: CreateMartSaleServiceInput): Promise<MartSale> {
  const session = await getWritableSession(db, input.tenantId, input.stationId, input.dailySessionId);

  const existing = await db.martSale.findFirst({
    where: {
      tenantId: input.tenantId,
      dailySessionId: input.dailySessionId,
    },
    select: { id: true },
  });

  if (existing) {
    throw new Error("Mart sales summary already exists for this session");
  }

  const netMartSales = calcMartNetSales(input.posSales, input.cashSales, input.mobileMoney, input.returns);
  const variance = calcMartVariance(input.cashCount, input.cashSales);

  return db.martSale.create({
    data: {
      tenantId: input.tenantId,
      stationId: input.stationId,
      dailySessionId: input.dailySessionId,
      businessDate: session.businessDate,
      openingCash: input.openingCash,
      posSales: input.posSales,
      cashSales: input.cashSales,
      mobileMoney: input.mobileMoney,
      returns: input.returns,
      netMartSales,
      cashCount: input.cashCount,
      variance,
      remarks: input.remarks,
      createdBy: input.createdBy,
    },
  });
}

export type UpdateMartSaleServiceInput = UpdateMartSaleInput & TenantScopedInput & {
  updatedBy: string;
};

export async function updateMartSale(db: Db, input: UpdateMartSaleServiceInput): Promise<MartSale> {
  const existing = await db.martSale.findUnique({
    where: { id: input.id },
  });

  if (
    !existing ||
    existing.tenantId !== input.tenantId ||
    existing.stationId !== input.stationId ||
    existing.dailySessionId !== input.dailySessionId
  ) {
    throw new Error("Mart sales summary not found or mismatch");
  }

  await getWritableSession(db, input.tenantId, input.stationId, existing.dailySessionId);

  const netMartSales = calcMartNetSales(input.posSales, input.cashSales, input.mobileMoney, input.returns);
  const variance = calcMartVariance(input.cashCount, input.cashSales);

  return db.martSale.update({
    where: { id: input.id },
    data: {
      openingCash: input.openingCash,
      posSales: input.posSales,
      cashSales: input.cashSales,
      mobileMoney: input.mobileMoney,
      returns: input.returns,
      netMartSales,
      cashCount: input.cashCount,
      variance,
      remarks: input.remarks,
      updatedBy: input.updatedBy,
    },
  });
}
