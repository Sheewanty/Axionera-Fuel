import { describe, it, expect, vi } from "vitest";
import { correctCashCollection, createCashCollection, createStationCashCollectionSweep } from "../cash-collection.service";
import { Db } from "../types";

vi.mock("../audit.service", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(true),
}));

describe("CashCollection Service", () => {
  it("allocates a station cash sweep across pending sessions oldest first", async () => {
    let createCount = 0;
    const mockDb = {
      station: { findFirst: vi.fn().mockResolvedValue({ id: "st_1" }) },
      dailySession: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "sess_1",
            businessDate: new Date("2026-06-20T00:00:00.000Z"),
            status: "OPEN",
            pumpReadings: [{ cashReceived: 1000 }],
            creditorLedger: [{ amount: 100 }],
            expenditures: [{ amount: 50 }],
            cashCollections: [],
          },
          {
            id: "sess_2",
            businessDate: new Date("2026-06-21T00:00:00.000Z"),
            status: "OPEN",
            pumpReadings: [{ cashReceived: 2000 }],
            creditorLedger: [],
            expenditures: [{ amount: 500 }],
            cashCollections: [{ amountToBank: 500 }],
          },
        ]),
      },
      cashCollection: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(async () => ({ id: `cash_${++createCount}` })),
      },
    };

    const result = await createStationCashCollectionSweep(
      "tenant_1",
      "user_1",
      {
        stationId: "st_1",
        amountToBank: 1800,
        bankCollectionDate: "2026-06-21",
        bankCollectionReference: "COL-KSI-001",
      },
      mockDb as unknown as Db
    );

    expect(result).toHaveLength(2);
    expect(mockDb.dailySession.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        tenantId: "tenant_1",
        stationId: "st_1",
        status: { in: ["OPEN", "REOPENED", "READY_FOR_REVIEW"] },
      },
    }));
    expect(mockDb.cashCollection.create).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({
        amountToBank: 1050,
        expectedCash: 1050,
        variance: 0,
        businessDate: new Date("2026-06-20T00:00:00.000Z"),
        dailySession: { connect: { id: "sess_1" } },
      }),
    });
    expect(mockDb.cashCollection.create).toHaveBeenNthCalledWith(2, {
      data: expect.objectContaining({
        amountToBank: 750,
        expectedCash: 1000,
        variance: -250,
        businessDate: new Date("2026-06-21T00:00:00.000Z"),
        dailySession: { connect: { id: "sess_2" } },
      }),
    });
  });

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
      amountToBank: 5500,
    };

    const result = await createCashCollection("tenant_1", "user_1", input, mockDb as unknown as Db);

    expect(result.id).toBe("cash_123");
    expect(mockDb.pumpReading.findMany).toHaveBeenCalledWith({
      where: { tenantId: "tenant_1", dailySessionId: "sess_1" },
      select: { cashReceived: true },
    });
    expect(mockDb.creditorLedgerEntry.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant_1",
        dailySessionId: "sess_1",
        type: "PAYMENT",
        paymentMethod: { in: ["CASH", "MOMO"] },
      },
      select: { amount: true },
    });
    
    // total cash received = 8000 pump cash + 200 creditor payments = 8200
    // total actual expenditure = 1000 + 500 = 1500
    // previous banked = 1000
    // base expected cash = 8200 - 1500 = 6700
    // remaining expected = 6700 - 1000 = 5700
    // amount to bank = 5500
    // variance = 5500 - 5700 = -200

    expect(mockDb.cashCollection.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "tenant_1",
        amountToBank: 5500,
        expectedCash: 5700,
        variance: -200,
      }),
    });
  });

  it("rejects new cash collection above the remaining expected cash", async () => {
    const mockDb = {
      dailySession: { findUnique: vi.fn().mockResolvedValue({ tenantId: "tenant_1", stationId: "st_1" }) },
      pumpReading: { findMany: vi.fn().mockResolvedValue([{ cashReceived: 1000 }]) },
      creditorLedgerEntry: { findMany: vi.fn().mockResolvedValue([]) },
      expenditure: { findMany: vi.fn().mockResolvedValue([]) },
      cashCollection: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([{ amountToBank: 900 }]),
        create: vi.fn(),
      },
    };

    const input = {
      stationId: "st_1",
      dailySessionId: "sess_1",
      businessDate: "2026-06-11",
      amountToBank: 200,
    };

    await expect(createCashCollection("tenant_1", "user_1", input, mockDb as unknown as Db))
      .rejects.toThrow("cannot exceed the remaining expected cash");
    expect(mockDb.cashCollection.create).not.toHaveBeenCalled();
  });

  it("rejects new cash collection when remaining expected cash is exhausted", async () => {
    const mockDb = {
      dailySession: { findUnique: vi.fn().mockResolvedValue({ tenantId: "tenant_1", stationId: "st_1" }) },
      pumpReading: { findMany: vi.fn().mockResolvedValue([{ cashReceived: 1000 }]) },
      creditorLedgerEntry: { findMany: vi.fn().mockResolvedValue([]) },
      expenditure: { findMany: vi.fn().mockResolvedValue([]) },
      cashCollection: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([{ amountToBank: 1200 }]),
        create: vi.fn(),
      },
    };

    const input = {
      stationId: "st_1",
      dailySessionId: "sess_1",
      businessDate: "2026-06-11",
      amountToBank: 1,
    };

    await expect(createCashCollection("tenant_1", "user_1", input, mockDb as unknown as Db))
      .rejects.toThrow("No remaining expected cash");
    expect(mockDb.cashCollection.create).not.toHaveBeenCalled();
  });

  it("allows reducing an existing overbanked cash collection during correction", async () => {
    const mockDb = {
      dailySession: { findUnique: vi.fn().mockResolvedValue({ tenantId: "tenant_1", stationId: "st_1", status: "OPEN" }) },
      pumpReading: { findMany: vi.fn().mockResolvedValue([{ cashReceived: 1000 }]) },
      creditorLedgerEntry: { findMany: vi.fn().mockResolvedValue([]) },
      expenditure: { findMany: vi.fn().mockResolvedValue([]) },
      cashCollection: {
        findUnique: vi.fn().mockResolvedValue({
          id: "cash_1",
          tenantId: "tenant_1",
          stationId: "st_1",
          dailySessionId: "sess_1",
          amountToBank: 1200,
          remarks: null,
        }),
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([{ amountToBank: 1200 }]),
        update: vi.fn().mockResolvedValue({ id: "cash_1" }),
      },
    };

    const input = {
      id: "cash_1",
      stationId: "st_1",
      dailySessionId: "sess_1",
      businessDate: "2026-06-11",
      amountToBank: 0,
      correctionReason: "Duplicate entry cleanup",
    };

    const result = await correctCashCollection("tenant_1", "user_1", input, mockDb as unknown as Db);

    expect(result.id).toBe("cash_1");
    expect(mockDb.cashCollection.update).toHaveBeenCalled();
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
