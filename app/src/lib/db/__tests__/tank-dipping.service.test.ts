import { describe, it, expect, vi } from "vitest";
import { createTankDipping } from "../tank-dipping.service";
import { Db } from "../types";

describe("TankDipping Service", () => {
  it("calculates variance and creates a tank dipping", async () => {
    const mockDb = {
      dailySession: { findUnique: vi.fn().mockResolvedValue({ tenantId: "tenant_1", stationId: "st_1" }) },
      tank: { findUnique: vi.fn().mockResolvedValue({ tenantId: "tenant_1", stationId: "st_1", productId: "prod_1" }) },
      tankDipping: { 
        create: vi.fn().mockResolvedValue({ id: "dipping_123" }),
        findFirst: vi.fn().mockImplementation(({ orderBy }) => {
          if (orderBy) return Promise.resolve({ closingStockLitres: 10000 }); // previous stock
          return Promise.resolve(null); // duplicate check
        }),
      },
      pumpReading: {
        findMany: vi.fn().mockResolvedValue([{ litresSold: 5000 }]),
      },
      stockAdjustment: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    const input = {
      stationId: "st_1",
      dailySessionId: "sess_1",
      businessDate: "2026-06-11",
      tankId: "t_1",
      productId: "prod_1",
      openingStockLitres: 10000,
      receiptsLitres: 2000,
      meterSoldLitres: 5000, // expected closing = 10000 + 2000 - 5000 = 7000
      closingStockLitres: 6950, // variance = 50 (expected 7000 - actual 6950)
      closingDipCm: 120.5,
      waterTestStatus: "CLEAR" as const,
    };

    const result = await createTankDipping("tenant_1", "user_1", input, mockDb as unknown as Db);

    expect(result.id).toBe("dipping_123");
    expect(mockDb.tankDipping.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "tenant_1",
        varianceLitres: 50,
      }),
    });
  });

  it("ignores tampered input values and uses server-derived values", async () => {
    const mockDb = {
      dailySession: { findUnique: vi.fn().mockResolvedValue({ tenantId: "tenant_1", stationId: "st_1" }) },
      tank: { findUnique: vi.fn().mockResolvedValue({ tenantId: "tenant_1", stationId: "st_1", productId: "prod_1" }) },
      tankDipping: { 
        create: vi.fn().mockResolvedValue({ id: "dipping_999" }),
        findFirst: vi.fn().mockImplementation(({ orderBy }) => {
          if (orderBy) return Promise.resolve({ closingStockLitres: 5000 }); // server true previous stock
          return Promise.resolve(null); // duplicate check
        }),
      },
      pumpReading: {
        findMany: vi.fn().mockResolvedValue([{ litresSold: 1000 }, { litresSold: 2000 }]), // total 3000 server meter sold
      },
      stockAdjustment: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    const tamperedInput = {
      stationId: "st_1",
      dailySessionId: "sess_1",
      businessDate: "2026-06-11",
      tankId: "t_1",
      productId: "prod_1",
      openingStockLitres: 10000, // Client tampered (should be 5000)
      receiptsLitres: 2000,
      meterSoldLitres: 1000, // Client tampered (should be 3000)
      // Server expectation: 5000 (opening) + 2000 (receipts) - 3000 (meterSold) = 4000
      closingStockLitres: 4000, 
      closingDipCm: 100.0,
      waterTestStatus: "CLEAR" as const,
    };

    const result = await createTankDipping("tenant_1", "user_1", tamperedInput, mockDb as unknown as Db);

    expect(result.id).toBe("dipping_999");
    expect(mockDb.tankDipping.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        openingStockLitres: 5000, // used server value
        meterSoldLitres: 3000, // used server value
        varianceLitres: 0, // 4000 - 4000
      }),
    });
  });

  it("uses submitted opening stock for the first dipping on a new tank", async () => {
    const mockDb = {
      dailySession: { findUnique: vi.fn().mockResolvedValue({ tenantId: "tenant_1", stationId: "st_1" }) },
      tank: { findUnique: vi.fn().mockResolvedValue({ tenantId: "tenant_1", stationId: "st_1", productId: "prod_1" }) },
      tankDipping: {
        create: vi.fn().mockResolvedValue({ id: "dipping_first" }),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      pumpReading: {
        findMany: vi.fn().mockResolvedValue([{ litresSold: 500 }]),
      },
      stockAdjustment: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    const input = {
      stationId: "st_1",
      dailySessionId: "sess_1",
      businessDate: "2026-06-11",
      tankId: "t_1",
      productId: "prod_1",
      openingStockLitres: 12000,
      receiptsLitres: 0,
      meterSoldLitres: 0,
      closingStockLitres: 11500,
      waterTestStatus: "CLEAR" as const,
    };

    const result = await createTankDipping("tenant_1", "user_1", input, mockDb as unknown as Db);

    expect(result.id).toBe("dipping_first");
    expect(mockDb.tankDipping.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        openingStockLitres: 12000,
        meterSoldLitres: 500,
        varianceLitres: 0,
      }),
    });
  });

  it("applies approved stock adjustment out when calculating variance", async () => {
    const mockDb = {
      dailySession: { findUnique: vi.fn().mockResolvedValue({ tenantId: "tenant_1", stationId: "st_1" }) },
      tank: { findUnique: vi.fn().mockResolvedValue({ tenantId: "tenant_1", stationId: "st_1", productId: "prod_1" }) },
      tankDipping: {
        create: vi.fn().mockResolvedValue({ id: "dipping_adjusted" }),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      pumpReading: {
        findMany: vi.fn().mockResolvedValue([{ litresSold: 500 }]),
      },
      stockAdjustment: {
        findMany: vi.fn().mockResolvedValue([{ direction: "OUT", litres: 5 }]),
      },
    };

    const input = {
      stationId: "st_1",
      dailySessionId: "sess_1",
      businessDate: "2026-06-11",
      tankId: "t_1",
      productId: "prod_1",
      openingStockLitres: 5000,
      receiptsLitres: 0,
      meterSoldLitres: 0,
      closingStockLitres: 4495,
      waterTestStatus: "CLEAR" as const,
    };

    await createTankDipping("tenant_1", "user_1", input, mockDb as unknown as Db);

    expect(mockDb.tankDipping.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        varianceLitres: 0,
      }),
    });
  });
});
