import { describe, expect, it } from "vitest";
import { createExpenditureSchema, deleteExpenditureSchema } from "../expenditure.schema";

const validPayload = {
  stationId: "station_1",
  dailySessionId: "session_1",
  category: "Generator Fuel",
  amount: 350,
  paymentToBank: 0,
  paidBy: "Kofi Asante",
  receiptAttached: true,
};

describe("expenditure schema", () => {
  it("accepts a valid session-linked expenditure", () => {
    const result = createExpenditureSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("accepts a valid standalone expenditure", () => {
    const result = createExpenditureSchema.safeParse({
      ...validPayload,
      dailySessionId: undefined,
    });
    expect(result.success).toBe(true);
  });

  it("rejects negative amounts", () => {
    const result = createExpenditureSchema.safeParse({
      ...validPayload,
      amount: -1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects payment to bank greater than amount", () => {
    const result = createExpenditureSchema.safeParse({
      ...validPayload,
      amount: 100,
      paymentToBank: 101,
    });
    expect(result.success).toBe(false);
  });

  it("rejects infinity", () => {
    const result = createExpenditureSchema.safeParse({
      ...validPayload,
      amount: Infinity,
    });
    expect(result.success).toBe(false);
  });

  it("validates delete payload with optional daily session", () => {
    const result = deleteExpenditureSchema.safeParse({
      id: "expense_1",
      stationId: "station_1",
    });
    expect(result.success).toBe(true);
  });
});
