import { describe, it, expect } from "vitest";
import { createProductDischargeSchema } from "../product-discharge.schema";

describe("Product Discharge Schema", () => {
  const validPayload = {
    stationId: "station_1",
    dailySessionId: "session_1",
    tankId: "tank_1",
    productId: "prod_1",
    supplierName: "Supplier X",
    invoiceNumber: "INV-001",
    invoiceMeasurement: 5000,
    productDischargedLitres: 4950,
    topUpLitres: 50,
    beforeTankLitres: 1000,
    afterTankLitres: 5900,
  };

  it("accepts a valid payload", () => {
    const result = createProductDischargeSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("rejects negative numeric inputs", () => {
    const invalid = { ...validPayload, productDischargedLitres: -100 };
    const result = createProductDischargeSchema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/non-negative/);
    }
  });

  it("rejects missing required string inputs", () => {
    const invalid = { ...validPayload, supplierName: "" };
    const result = createProductDischargeSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects invalid measurement types", () => {
    const invalid = { ...validPayload, topUpLitres: Infinity };
    const result = createProductDischargeSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});
