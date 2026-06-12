import { describe, it, expect, vi } from "vitest";
import { createPumpReading } from "../pump-reading.service";
import { Db } from "../types";

describe("PumpReading Service", () => {
  it("calculates sales and variance and creates a reading", async () => {
    const mockDb = {
      dailySession: { findUnique: vi.fn().mockResolvedValue({ tenantId: "tenant_1", stationId: "st_1" }) },
      nozzle: { findUnique: vi.fn().mockResolvedValue({ tenantId: "tenant_1", stationId: "st_1", pumpId: "p_1", productId: "prod_1" }) },
      pumpReading: { 
        create: vi.fn().mockResolvedValue({ id: "reading_123" }),
        findFirst: vi.fn().mockImplementation(({ orderBy }) => {
          if (orderBy) return Promise.resolve({ currentLitre: 1000 }); // previous meter
          return Promise.resolve(null); // duplicate check
        }),
      },
      priceHistory: {
        findFirst: vi.fn().mockResolvedValue({ pricePerLitre: 15.00 }),
      },
    };

    const input = {
      stationId: "st_1",
      dailySessionId: "sess_1",
      businessDate: "2026-06-11",
      shift: "DAY" as const,
      pumpId: "p_1",
      nozzleId: "n_1",
      productId: "prod_1",
      previousLitre: 1000,
      currentLitre: 1500, // 500L sold
      pricePerLitre: 15.00, // expected 7500
      cashReceived: 6000,
      gocardAmount: 1000,
      couponAmount: 500, // total collected 7500
      ghqrAmount: 0,
      creditorsAmount: 0,
    };

    const result = await createPumpReading("tenant_1", "user_1", input, mockDb as unknown as Db);

    expect(result.id).toBe("reading_123");
    expect(mockDb.pumpReading.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "tenant_1",
        litresSold: 500,
        amountExpected: 7500,
        variance: 0, // perfect
      }),
    });
  });

  it("ignores tampered input values and uses server-derived values", async () => {
    const mockDb = {
      dailySession: { findUnique: vi.fn().mockResolvedValue({ tenantId: "tenant_1", stationId: "st_1" }) },
      nozzle: { findUnique: vi.fn().mockResolvedValue({ tenantId: "tenant_1", stationId: "st_1", pumpId: "p_1", productId: "prod_1" }) },
      pumpReading: { 
        create: vi.fn().mockResolvedValue({ id: "reading_999" }),
        findFirst: vi.fn().mockImplementation(({ orderBy }) => {
          if (orderBy) return Promise.resolve({ currentLitre: 2000 }); // server true previous meter
          return Promise.resolve(null); // duplicate check
        }),
      },
      priceHistory: {
        findFirst: vi.fn().mockResolvedValue({ pricePerLitre: 20.00 }), // server true price
      },
    };

    const tamperedInput = {
      stationId: "st_1",
      dailySessionId: "sess_1",
      businessDate: "2026-06-11",
      shift: "DAY" as const,
      pumpId: "p_1",
      nozzleId: "n_1",
      productId: "prod_1",
      previousLitre: 1000, // Client tampered (should be 2000)
      currentLitre: 2500,  // True sold = 500 (2500 - 2000). Tampered sold = 1500
      pricePerLitre: 10.00, // Client tampered (should be 20.00)
      cashReceived: 10000,
      gocardAmount: 0,
      couponAmount: 0,
      ghqrAmount: 0,
      creditorsAmount: 0,
    };

    const result = await createPumpReading("tenant_1", "user_1", tamperedInput, mockDb as unknown as Db);

    expect(result.id).toBe("reading_999");
    expect(mockDb.pumpReading.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        previousLitre: 2000, // used server value
        pricePerLitre: 20.00, // used server value
        litresSold: 500, // calculated from server values
        amountExpected: 10000, // 500 * 20.00
        variance: 0, // 10000 cash - 10000 expected
      }),
    });
  });

  it("rejects when current reading is less than server previous reading", async () => {
    const mockDb = {
      dailySession: { findUnique: vi.fn().mockResolvedValue({ tenantId: "tenant_1", stationId: "st_1" }) },
      nozzle: { findUnique: vi.fn().mockResolvedValue({ tenantId: "tenant_1", stationId: "st_1", pumpId: "p_1", productId: "prod_1" }) },
      pumpReading: { 
        create: vi.fn(),
        findFirst: vi.fn().mockImplementation(({ orderBy }) => {
          if (orderBy) return Promise.resolve({ currentLitre: 3000 }); // Server previous = 3000
          return Promise.resolve(null);
        }),
      },
      priceHistory: {
        findFirst: vi.fn().mockResolvedValue({ pricePerLitre: 20.00 }),
      },
    };

    const input = {
      stationId: "st_1",
      dailySessionId: "sess_1",
      businessDate: "2026-06-11",
      shift: "DAY" as const,
      pumpId: "p_1",
      nozzleId: "n_1",
      productId: "prod_1",
      previousLitre: 1000,
      currentLitre: 2500, // less than 3000
      pricePerLitre: 20.00,
      cashReceived: 10000,
      gocardAmount: 0,
      couponAmount: 0,
      ghqrAmount: 0,
      creditorsAmount: 0,
    };

    await expect(createPumpReading("tenant_1", "user_1", input, mockDb as unknown as Db))
      .rejects.toThrow("Current meter reading (2500) cannot be less than previous reading (3000)");
  });

  it("rejects when no active price is found", async () => {
    const mockDb = {
      dailySession: { findUnique: vi.fn().mockResolvedValue({ tenantId: "tenant_1", stationId: "st_1" }) },
      nozzle: { findUnique: vi.fn().mockResolvedValue({ tenantId: "tenant_1", stationId: "st_1", pumpId: "p_1", productId: "prod_1" }) },
      pumpReading: { 
        create: vi.fn(),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      priceHistory: {
        findFirst: vi.fn().mockResolvedValue(null), // No price found
      },
    };

    const input = {
      stationId: "st_1",
      dailySessionId: "sess_1",
      businessDate: "2026-06-11",
      shift: "DAY" as const,
      pumpId: "p_1",
      nozzleId: "n_1",
      productId: "prod_1",
      previousLitre: 1000,
      currentLitre: 1500,
      pricePerLitre: 20.00,
      cashReceived: 10000,
      gocardAmount: 0,
      couponAmount: 0,
      ghqrAmount: 0,
      creditorsAmount: 0,
    };

    await expect(createPumpReading("tenant_1", "user_1", input, mockDb as unknown as Db))
      .rejects.toThrow("Active price not found or invalid for this product");
  });

  it("rejects when active price is zero or negative", async () => {
    const mockDb = {
      dailySession: { findUnique: vi.fn().mockResolvedValue({ tenantId: "tenant_1", stationId: "st_1" }) },
      nozzle: { findUnique: vi.fn().mockResolvedValue({ tenantId: "tenant_1", stationId: "st_1", pumpId: "p_1", productId: "prod_1" }) },
      pumpReading: { 
        create: vi.fn(),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      priceHistory: {
        findFirst: vi.fn().mockResolvedValue({ pricePerLitre: 0 }), // Zero price
      },
    };

    const input = {
      stationId: "st_1",
      dailySessionId: "sess_1",
      businessDate: "2026-06-11",
      shift: "DAY" as const,
      pumpId: "p_1",
      nozzleId: "n_1",
      productId: "prod_1",
      previousLitre: 1000,
      currentLitre: 1500,
      pricePerLitre: 20.00,
      cashReceived: 10000,
      gocardAmount: 0,
      couponAmount: 0,
      ghqrAmount: 0,
      creditorsAmount: 0,
    };

    await expect(createPumpReading("tenant_1", "user_1", input, mockDb as unknown as Db))
      .rejects.toThrow("Active price not found or invalid for this product");
  });
});
