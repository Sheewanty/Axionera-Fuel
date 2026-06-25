import { describe, it, expect, vi } from "vitest";
import { recordClosingPumpReading, recordOpeningPumpReading } from "../pump-reading.service";
import { Db } from "../types";

describe("PumpReading Service", () => {
  function baseDb(overrides: object = {}) {
    return {
      dailySession: { findUnique: vi.fn().mockResolvedValue({ tenantId: "tenant_1", stationId: "st_1", status: "OPEN" }) },
      nozzle: { findUnique: vi.fn().mockResolvedValue({ tenantId: "tenant_1", stationId: "st_1", pumpId: "p_1", productId: "prod_1" }) },
      priceHistory: { findFirst: vi.fn().mockResolvedValue({ pricePerLitre: 20 }) },
      pumpReading: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([{ litresSold: 500 }]),
        create: vi.fn().mockResolvedValue({ id: "reading_open" }),
        update: vi.fn().mockResolvedValue({ id: "reading_closed" }),
      },
      tankDipping: {
        findMany: vi.fn().mockResolvedValue([]),
        update: vi.fn(),
      },
      stockAdjustment: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      ...overrides,
    };
  }

  const openingInput = {
    stationId: "st_1",
    dailySessionId: "sess_1",
    businessDate: "2026-06-11",
    shift: "DAY" as const,
    pumpId: "p_1",
    nozzleId: "n_1",
    productId: "prod_1",
    openingLitre: 2000,
  };

  const closingInput = {
    stationId: "st_1",
    dailySessionId: "sess_1",
    businessDate: "2026-06-11",
    shift: "DAY" as const,
    pumpId: "p_1",
    nozzleId: "n_1",
    productId: "prod_1",
    currentLitre: 2500,
    cashReceived: 9000,
    gocardAmount: 500,
    couponAmount: 250,
    ghqrAmount: 250,
    creditorsAmount: 0,
  };

  it("records an opening meter without sales or payment values", async () => {
    const db = baseDb({
      pumpReading: {
        findFirst: vi.fn().mockImplementation(({ orderBy }) => {
          if (orderBy) return Promise.resolve({ currentLitre: 1000 });
          return Promise.resolve(null);
        }),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({ id: "reading_open" }),
      },
    });

    const result = await recordOpeningPumpReading("tenant_1", "user_1", openingInput, db as unknown as Db);

    expect(result.id).toBe("reading_open");
    expect(db.pumpReading.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        previousLitre: 2000,
        currentLitre: 2000,
        litresSold: 0,
        amountExpected: 0,
        cashReceived: 0,
        gocardAmount: 0,
        couponAmount: 0,
        ghqrAmount: 0,
        creditorsAmount: 0,
        variance: 0,
        isClosingRecorded: false,
      }),
    });
  });

  it("rejects opening meter lower than the previous closing meter", async () => {
    const db = baseDb({
      pumpReading: {
        findFirst: vi.fn().mockImplementation(({ orderBy }) => {
          if (orderBy) return Promise.resolve({ currentLitre: 3000 });
          return Promise.resolve(null);
        }),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn(),
      },
    });

    await expect(recordOpeningPumpReading("tenant_1", "user_1", openingInput, db as unknown as Db))
      .rejects.toThrow("Opening meter reading (2000) cannot be less than previous closing reading (3000)");
  });

  it("calculates closing sales and variance from stored opening meter and server price", async () => {
    const db = baseDb({
      pumpReading: {
        findFirst: vi.fn().mockResolvedValue({
          id: "reading_open",
          previousLitre: 2000,
          isClosingRecorded: false,
        }),
        findMany: vi.fn().mockResolvedValue([{ litresSold: 500 }]),
        update: vi.fn().mockResolvedValue({ id: "reading_open" }),
      },
      tankDipping: {
        findMany: vi.fn().mockResolvedValue([
          { id: "dip_1", tankId: "tank_1", openingStockLitres: 10000, receiptsLitres: 1000, closingStockLitres: 10500 },
        ]),
        update: vi.fn().mockResolvedValue({ id: "dip_1" }),
      },
    });

    const result = await recordClosingPumpReading("tenant_1", "user_1", closingInput, db as unknown as Db);

    expect(result.id).toBe("reading_open");
    expect(db.pumpReading.update).toHaveBeenCalledWith({
      where: { id: "reading_open" },
      data: expect.objectContaining({
        currentLitre: 2500,
        litresSold: 500,
        pricePerLitre: 20,
        amountExpected: 10000,
        cashReceived: 9000,
        gocardAmount: 500,
        couponAmount: 250,
        ghqrAmount: 250,
        variance: 0,
        isClosingRecorded: true,
        updatedBy: "user_1",
      }),
    });
    expect(db.tankDipping.update).toHaveBeenCalledWith({
      where: { id: "dip_1" },
      data: {
        meterSoldLitres: 500,
        varianceLitres: 0,
      },
    });
  });

  it("requires an opening meter before closing sales", async () => {
    const db = baseDb();

    await expect(recordClosingPumpReading("tenant_1", "user_1", closingInput, db as unknown as Db))
      .rejects.toThrow("Opening meter must be recorded before closing meter for this nozzle");
  });

  it("rejects duplicate closing sales", async () => {
    const db = baseDb({
      pumpReading: {
        findFirst: vi.fn().mockResolvedValue({ id: "reading_open", previousLitre: 2000, isClosingRecorded: true }),
        update: vi.fn(),
      },
    });

    await expect(recordClosingPumpReading("tenant_1", "user_1", closingInput, db as unknown as Db))
      .rejects.toThrow("Closing meter already exists for this nozzle in this session");
  });

  it("rejects when closing meter is less than opening meter", async () => {
    const db = baseDb({
      pumpReading: {
        findFirst: vi.fn().mockResolvedValue({ id: "reading_open", previousLitre: 3000, isClosingRecorded: false }),
        update: vi.fn(),
      },
    });

    await expect(recordClosingPumpReading("tenant_1", "user_1", closingInput, db as unknown as Db))
      .rejects.toThrow("Closing meter reading (2500) cannot be less than opening reading (3000)");
  });

  it("rejects when no active price is found", async () => {
    const db = baseDb({
      priceHistory: { findFirst: vi.fn().mockResolvedValue(null) },
    });

    await expect(recordOpeningPumpReading("tenant_1", "user_1", openingInput, db as unknown as Db))
      .rejects.toThrow("Active price not found or invalid for this product");
  });
});
