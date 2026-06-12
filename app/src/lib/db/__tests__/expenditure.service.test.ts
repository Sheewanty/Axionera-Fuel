import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "../types";
import { createExpenditure, deleteExpenditure, updateExpenditure } from "../expenditure.service";

type MockDb = {
  station: {
    findFirst: ReturnType<typeof vi.fn>;
  };
  dailySession: {
    findUnique: ReturnType<typeof vi.fn>;
  };
  expenditure: {
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
  };
};

const asDb = (mockDb: MockDb) => mockDb as unknown as Db;

describe("expenditure service", () => {
  let mockDb: MockDb;

  beforeEach(() => {
    mockDb = {
      station: {
        findFirst: vi.fn().mockResolvedValue({ id: "station_1" }),
      },
      dailySession: {
        findUnique: vi.fn().mockResolvedValue({
          id: "session_1",
          tenantId: "tenant_1",
          stationId: "station_1",
          status: "OPEN",
          businessDate: new Date("2026-06-12T00:00:00.000Z"),
        }),
      },
      expenditure: {
        create: vi.fn().mockResolvedValue({ id: "expense_1" }),
        update: vi.fn().mockResolvedValue({ id: "expense_1" }),
        delete: vi.fn().mockResolvedValue({ id: "expense_1" }),
        findUnique: vi.fn().mockResolvedValue({
          id: "expense_1",
          tenantId: "tenant_1",
          stationId: "station_1",
          dailySessionId: "session_1",
        }),
      },
    };
  });

  const baseInput = {
    tenantId: "tenant_1",
    stationId: "station_1",
    dailySessionId: "session_1",
    category: "Generator Fuel",
    amount: 350,
    paymentToBank: 0,
    paidBy: "Kofi Asante",
    receiptAttached: true,
    createdBy: "user_1",
  };

  describe("createExpenditure", () => {
    it("creates a session-linked expenditure", async () => {
      const result = await createExpenditure(asDb(mockDb), baseInput);

      expect(result.id).toBe("expense_1");
      expect(mockDb.expenditure.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: "tenant_1",
          stationId: "station_1",
          dailySessionId: "session_1",
          businessDate: new Date("2026-06-12T00:00:00.000Z"),
          amount: 350,
          paymentToBank: 0,
        }),
      });
    });

    it("blocks APPROVED sessions", async () => {
      mockDb.dailySession.findUnique.mockResolvedValueOnce({
        id: "session_1",
        tenantId: "tenant_1",
        stationId: "station_1",
        status: "APPROVED",
      });

      await expect(createExpenditure(asDb(mockDb), baseInput)).rejects.toThrow(/APPROVED/);
    });

    it("blocks READY_FOR_REVIEW sessions", async () => {
      mockDb.dailySession.findUnique.mockResolvedValueOnce({
        id: "session_1",
        tenantId: "tenant_1",
        stationId: "station_1",
        status: "READY_FOR_REVIEW",
      });

      await expect(createExpenditure(asDb(mockDb), baseInput)).rejects.toThrow(/READY_FOR_REVIEW/);
    });

    it("rejects tenant mismatches", async () => {
      mockDb.dailySession.findUnique.mockResolvedValueOnce({
        id: "session_1",
        tenantId: "tenant_2",
        stationId: "station_1",
        status: "OPEN",
      });

      await expect(createExpenditure(asDb(mockDb), baseInput)).rejects.toThrow(/mismatch/);
    });

    it("creates a standalone expenditure without session guard", async () => {
      const result = await createExpenditure(asDb(mockDb), {
        ...baseInput,
        dailySessionId: undefined,
      });

      expect(result.id).toBe("expense_1");
      expect(mockDb.station.findFirst).toHaveBeenCalledWith({
        where: { id: "station_1", tenantId: "tenant_1" },
        select: { id: true },
      });
      expect(mockDb.dailySession.findUnique).not.toHaveBeenCalled();
    });
  });

  describe("updateExpenditure", () => {
    const updateInput = {
      ...baseInput,
      id: "expense_1",
      updatedBy: "user_2",
    };

    it("updates without changing daily session linkage", async () => {
      const result = await updateExpenditure(asDb(mockDb), updateInput);

      expect(result.id).toBe("expense_1");
      expect(mockDb.expenditure.update).toHaveBeenCalledWith({
        where: { id: "expense_1" },
        data: expect.objectContaining({
          category: "Generator Fuel",
          updatedBy: "user_2",
        }),
      });
    });

    it("rejects attempts to change daily session linkage", async () => {
      await expect(updateExpenditure(asDb(mockDb), {
        ...updateInput,
        dailySessionId: "session_2",
      })).rejects.toThrow(/cannot be changed/);
    });

    it("blocks READY_FOR_REVIEW sessions", async () => {
      mockDb.dailySession.findUnique.mockResolvedValueOnce({
        id: "session_1",
        tenantId: "tenant_1",
        stationId: "station_1",
        status: "READY_FOR_REVIEW",
      });

      await expect(updateExpenditure(asDb(mockDb), updateInput)).rejects.toThrow(/READY_FOR_REVIEW/);
    });
  });

  describe("deleteExpenditure", () => {
    it("deletes a matching expenditure", async () => {
      const result = await deleteExpenditure(asDb(mockDb), "expense_1", "tenant_1", "station_1", "session_1");

      expect(result.id).toBe("expense_1");
      expect(mockDb.expenditure.delete).toHaveBeenCalledWith({ where: { id: "expense_1" } });
    });

    it("uses the existing record session when checking locks", async () => {
      mockDb.dailySession.findUnique.mockResolvedValueOnce({
        id: "session_1",
        tenantId: "tenant_1",
        stationId: "station_1",
        status: "APPROVED",
      });

      await expect(
        deleteExpenditure(asDb(mockDb), "expense_1", "tenant_1", "station_1", "session_1")
      ).rejects.toThrow(/APPROVED/);
    });

    it("rejects omitted daily session for a linked expenditure", async () => {
      await expect(
        deleteExpenditure(asDb(mockDb), "expense_1", "tenant_1", "station_1")
      ).rejects.toThrow(/daily session mismatch/);
    });
  });
});
