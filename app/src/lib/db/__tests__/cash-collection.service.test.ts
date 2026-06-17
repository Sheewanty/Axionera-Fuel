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
          { amount: 1000, paymentToBank: 0 },
          { amount: 500, paymentToBank: 100 }
        ]),
      },
      cashCollection: {
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
    // total net expenditure = (1000 - 0) + (500 - 100) = 1400
    // previous banked = 1000
    // base expected cash = 8200 - 1400 = 6800
    // remaining expected = 6800 - 1000 = 5800
    // amount to bank = 6000
    // variance = 6000 - 5800 = +200

    expect(mockDb.cashCollection.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "tenant_1",
        amountToBank: 6000,
        expectedCash: 5800,
        variance: 200,
      }),
    });
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
