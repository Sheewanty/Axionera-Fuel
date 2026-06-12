import { describe, expect, it } from "vitest";
import { createMartSaleSchema, updateMartSaleSchema } from "../mart-sale.schema";

const validPayload = {
  stationId: "station_1",
  dailySessionId: "session_1",
  openingCash: 100,
  posSales: 500,
  cashSales: 300,
  mobileMoney: 200,
  returns: 50,
  cashCount: 290,
};

describe("mart sale schema", () => {
  it("accepts a valid payload", () => {
    const result = createMartSaleSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("rejects negative amounts", () => {
    const result = createMartSaleSchema.safeParse({
      ...validPayload,
      cashSales: -1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects infinity", () => {
    const result = createMartSaleSchema.safeParse({
      ...validPayload,
      posSales: Infinity,
    });
    expect(result.success).toBe(false);
  });

  it("requires id for updates", () => {
    const result = updateMartSaleSchema.safeParse(validPayload);
    expect(result.success).toBe(false);
  });
});
