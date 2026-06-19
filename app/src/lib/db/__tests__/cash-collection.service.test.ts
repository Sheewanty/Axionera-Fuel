import { describe, it, expect, vi } from "vitest";
import { createCashCollection } from "../cash-collection.service";
import { Db } from "../types";

vi.mock("../audit.service", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(true),
}));

describe("CashCollection Service", () => {
  it("computes physical cash to bank and saves cash collection", async () => {
    const mockDb = {
      dailySession: { findUnique: vi.fn().mockResolvedValue({ tenantId: "tenant_1", stationId: "st_1" }) },
      pumpReading: {
        findMany: vi.fn().mockResolvedValue([
          { cashReceived: 5000 },
          { cashReceived: 3000 }
        ]),
      },
      creditorLedgerEntry: {
        findMany: vi.fn().mockResolvedValue([
          { amount: 200 },
        ]),
      },
      expenditure: {
        findMany: vi.fn().mockResolvedValue([
          { amount: 1000 },
          { amount: 500 }
        ]),
      },
      cashCollection: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([
          { amountToBank: 1000 }
        ]),
        create: vi.fn().mockResolvedValue({ id: "cash_123" }),
      },
    };

    const input = {
      stationId: "st_1",
      dailySessionId: "sess_1",
      businessDate: "2026-06-11",
      amountToBank: 6000,
    };

    const result = await createCashCollection("tenant_1", "user_1", input, mockDb as unknown as Db);

    expect(result.id).toBe("cash_123");
    expect(mockDb.pumpReading.findMany).toHaveBeenCalledWith({
      where: { tenantId: "tenant_1", dailySessionId: "sess_1" },
      select: { cashReceived: true },
    });
    
    // total cash received = 8000 pump cash + 200 creditor payments = 8200
    // total actual expenditure = 1000 + 500 = 1500
    // previous banked = 1000
    // base expected cash = 8200 - 1500 = 6700
    // remaining expected = 6700 - 1000 = 5700
    // amount to bank = 6000
    // variance = 6000 - 5700 = +300

    expect(mockDb.cashCollection.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "tenant_1",
        amountToBank: 6000,
        expectedCash: 5700,
        variance: 300,
      }),
    });
  });

  it("rejects likely duplicate cash collection entries", async () => {
    const mockDb = {
      dailySession: { findUnique: vi.fn().mockResolvedValue({ tenantId: "tenant_1", stationId: "st_1" }) },
      pumpReading: { findMany: vi.fn().mockResolvedValue([]) },
      creditorLedgerEntry: { findMany: vi.fn().mockResolvedValue([]) },
      expenditure: { findMany: vi.fn().mockResolvedValue([]) },
      cashCollection: {
        findFirst: vi.fn().mockResolvedValue({ id: "cash_existing" }),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn(),
      },
    };

    const input = {
      stationId: "st_1",
      dailySessionId: "sess_1",
      businessDate: "2026-06-11",
      amountToBank: 6000,
      bankCollectionDate: "2026-06-11",
      bankCollectionReference: "COL001",
    };

    await expect(createCashCollection("tenant_1", "user_1", input, mockDb as unknown as Db))
      .rejects.toThrow("already been recorded");
    expect(mockDb.cashCollection.create).not.toHaveBeenCalled();
  });

  it("throws on tenant mismatch", async () => {
    const mockDb = {
      dailySession: { findUnique: vi.fn().mockResolvedValue({ tenantId: "tenant_2", stationId: "st_1" }) },
    };

    const input = {
      stationId: "st_1",
      dailySessionId: "sess_1",
      businessDate: "2026-06-11",
      amountToBank: 6000,
    };

    await expect(createCashCollection("tenant_1", "user_1", input, mockDb as unknown as Db))
      .rejects.toThrow("Invalid session or tenant mismatch");
  });
});
