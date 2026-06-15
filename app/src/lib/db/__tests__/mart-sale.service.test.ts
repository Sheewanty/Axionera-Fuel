import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "../types";
import { createMartSale, updateMartSale } from "../mart-sale.service";
import { calcMartNetSales, calcMartVariance } from "../../calculations";

vi.mock("../../calculations", () => ({
  calcMartNetSales: vi.fn((pos, cash, mobile, returns) => pos + cash + mobile - returns),
  calcMartVariance: vi.fn((cashCount, cashSales) => cashCount - cashSales),
}));

type MockDb = {
  dailySession: {
    findUnique: ReturnType<typeof vi.fn>;
  };
  martSale: {
    findFirst: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

const asDb = (mockDb: MockDb) => mockDb as unknown as Db;

describe("mart sale service", () => {
  let mockDb: MockDb;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {
      dailySession: {
        findUnique: vi.fn().mockResolvedValue({
          id: "session_1",
          tenantId: "tenant_1",
          stationId: "station_1",
          status: "OPEN",
          businessDate: new Date("2026-06-12T00:00:00.000Z"),
        }),
      },
      martSale: {
        findFirst: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn().mockResolvedValue({
          id: "mart_1",
          tenantId: "tenant_1",
          stationId: "station_1",
          dailySessionId: "session_1",
        }),
        create: vi.fn().mockResolvedValue({ id: "mart_1" }),
        update: vi.fn().mockResolvedValue({ id: "mart_1" }),
      },
    };
  });

  const baseInput = {
    tenantId: "tenant_1",
    stationId: "station_1",
    dailySessionId: "session_1",
    openingCash: 100,
    posSales: 500,
    cashSales: 300,
    mobileMoney: 200,
    returns: 50,
    cashCount: 290,
    createdBy: "user_1",
  };

  it("creates one mart summary with server-computed totals", async () => {
    const result = await createMartSale(asDb(mockDb), baseInput);

    expect(result.id).toBe("mart_1");
    expect(calcMartNetSales).toHaveBeenCalledWith(500, 300, 200, 50);
    expect(calcMartVariance).toHaveBeenCalledWith(290, 300);
    expect(mockDb.martSale.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        netMartSales: 950,
        variance: -10,
        businessDate: new Date("2026-06-12T00:00:00.000Z"),
      }),
    });
  });

  it("rejects duplicate summaries for a session", async () => {
    mockDb.martSale.findFirst.mockResolvedValueOnce({ id: "existing" });

    await expect(createMartSale(asDb(mockDb), baseInput)).rejects.toThrow(/already exists/);
  });

  it("blocks READY_FOR_REVIEW sessions", async () => {
    mockDb.dailySession.findUnique.mockResolvedValueOnce({
      id: "session_1",
      tenantId: "tenant_1",
      stationId: "station_1",
      status: "READY_FOR_REVIEW",
    });

    await expect(createMartSale(asDb(mockDb), baseInput)).rejects.toThrow(/READY_FOR_REVIEW/);
  });

  it("updates a matching mart summary", async () => {
    const result = await updateMartSale(asDb(mockDb), {
      ...baseInput,
      id: "mart_1",
      updatedBy: "user_2",
      correctionReason: "Corrected typo in mart sales summary",
    });

    expect(result.id).toBe("mart_1");
    expect(mockDb.martSale.update).toHaveBeenCalledWith({
      where: { id: "mart_1" },
      data: expect.objectContaining({
        netMartSales: 950,
        variance: -10,
        updatedBy: "user_2",
      }),
    });
  });
});
