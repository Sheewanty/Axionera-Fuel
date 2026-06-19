import { describe, expect, it } from "vitest";
import { createLubeBaySaleSchema } from "./lube-bay.schema";

const baseInput = {
  stationId: "station-1",
  dailySessionId: "session-1",
  vehicleReg: "GR-1234-26",
  serviceTypeId: "service-1",
  vehicleCategory: "Salon and Sedans",
  labourCharge: 50,
  discount: 0,
  paymentMode: "CASH",
};

describe("lube bay sale schema", () => {
  it("allows service-only sales without product lines", () => {
    const result = createLubeBaySaleSchema.safeParse({
      ...baseInput,
      lines: [],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.lines).toEqual([]);
    }
  });

  it("still validates product lines when products are added", () => {
    const result = createLubeBaySaleSchema.safeParse({
      ...baseInput,
      lines: [{ productId: "", quantity: 1 }],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.lines).toBeDefined();
    }
  });
});
