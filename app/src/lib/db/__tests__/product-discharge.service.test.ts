import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import { createProductDischarge, updateProductDischarge, deleteProductDischarge } from "../product-discharge.service";
import { calcExpectedTankAfterDischarge, calcDischargeVariance } from "../../calculations";

// Mock calculations so we know they are called correctly
vi.mock("../../calculations", () => ({
  calcExpectedTankAfterDischarge: vi.fn((before: number, discharged: number, topup: number) => before + discharged + topup),
  calcDischargeVariance: vi.fn((after: number, expected: number) => after - expected),
}));

/**
 * Minimal mock shape that satisfies the service's runtime access patterns.
 * Kept intentionally narrow — only the Prisma delegates the service actually calls.
 */
interface MockDb {
  dailySession: { findUnique: Mock };
  tank: { findUnique: Mock };
  productDischarge: {
    create: Mock;
    update: Mock;
    delete: Mock;
    findUnique: Mock;
  };
}

/** Build a fresh mock Db with sensible defaults. */
function createMockDb(): MockDb {
  return {
    dailySession: {
      findUnique: vi.fn().mockResolvedValue({
        id: "session_1",
        tenantId: "tenant_1",
        stationId: "station_1",
        status: "OPEN",
        businessDate: new Date(),
      }),
    },
    tank: {
      findUnique: vi.fn().mockResolvedValue({
        id: "tank_1",
        tenantId: "tenant_1",
        stationId: "station_1",
        productId: "prod_1",
      }),
    },
    productDischarge: {
      create: vi.fn().mockResolvedValue({ id: "discharge_1" }),
      update: vi.fn().mockResolvedValue({ id: "discharge_1" }),
      delete: vi.fn().mockResolvedValue({ id: "discharge_1" }),
      findUnique: vi.fn().mockResolvedValue({
        id: "discharge_1",
        tenantId: "tenant_1",
        stationId: "station_1",
        dailySessionId: "session_1",
      }),
    },
  };
}

/**
 * The service accepts `Db` (full Prisma tx client), but our tests only touch
 * three delegates.  We cast once here so every call site stays clean.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asDb = (m: MockDb) => m as any;

describe("Product Discharge Service", () => {
  let mockDb: MockDb;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
  });

  const baseInput = {
    tenantId: "tenant_1",
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
    afterTankLitres: 5900, // Expected: 1000 + 4950 + 50 = 6000. Variance = -100
    createdBy: "user_1",
  };

  describe("createProductDischarge", () => {
    it("creates discharge successfully", async () => {
      const result = await createProductDischarge(asDb(mockDb), baseInput);

      expect(result.id).toBe("discharge_1");
      expect(calcExpectedTankAfterDischarge).toHaveBeenCalledWith(1000, 4950, 50);
      expect(calcDischargeVariance).toHaveBeenCalledWith(5900, 6000);

      expect(mockDb.productDischarge.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            expectedTankAfterDischarge: 6000,
            dischargeVarianceLitres: -100,
          }),
        })
      );
    });

    it("rejects if session is APPROVED", async () => {
      mockDb.dailySession.findUnique.mockResolvedValueOnce({
        id: "session_1",
        tenantId: "tenant_1",
        stationId: "station_1",
        status: "APPROVED",
        businessDate: new Date(),
      });

      await expect(createProductDischarge(asDb(mockDb), baseInput)).rejects.toThrow(/APPROVED/);
    });

    it("rejects if session is READY_FOR_REVIEW", async () => {
      mockDb.dailySession.findUnique.mockResolvedValueOnce({
        id: "session_1",
        tenantId: "tenant_1",
        stationId: "station_1",
        status: "READY_FOR_REVIEW",
        businessDate: new Date(),
      });

      await expect(createProductDischarge(asDb(mockDb), baseInput)).rejects.toThrow(/READY_FOR_REVIEW/);
    });

    it("rejects on tenant mismatch", async () => {
      mockDb.tank.findUnique.mockResolvedValueOnce({
        id: "tank_1",
        tenantId: "tenant_2", // mismatch
        stationId: "station_1",
        productId: "prod_1",
      });

      await expect(createProductDischarge(asDb(mockDb), baseInput)).rejects.toThrow(/mismatch/);
    });
  });

  describe("updateProductDischarge", () => {
    const updateInput = {
      ...baseInput,
      id: "discharge_1",
      updatedBy: "user_2",
      correctionReason: "Corrected typo in discharge litres",
    };

    it("updates discharge and recalculates variance", async () => {
      const result = await updateProductDischarge(asDb(mockDb), updateInput);

      expect(result.id).toBe("discharge_1");
      expect(calcExpectedTankAfterDischarge).toHaveBeenCalledWith(1000, 4950, 50);
      expect(mockDb.productDischarge.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "discharge_1" },
          data: expect.objectContaining({
            expectedTankAfterDischarge: 6000,
            dischargeVarianceLitres: -100,
          }),
        })
      );
    });

    it("rejects update if session is READY_FOR_REVIEW", async () => {
      mockDb.dailySession.findUnique.mockResolvedValueOnce({
        id: "session_1",
        tenantId: "tenant_1",
        stationId: "station_1",
        status: "READY_FOR_REVIEW",
      });

      await expect(updateProductDischarge(asDb(mockDb), updateInput)).rejects.toThrow(/READY_FOR_REVIEW/);
    });
  });

  describe("deleteProductDischarge", () => {
    it("deletes discharge successfully", async () => {
      const result = await deleteProductDischarge(asDb(mockDb), "discharge_1", "tenant_1", "station_1", "session_1");
      expect(result.id).toBe("discharge_1");
      expect(mockDb.productDischarge.delete).toHaveBeenCalledWith({ where: { id: "discharge_1" } });
    });

    it("rejects delete if session is APPROVED", async () => {
      mockDb.dailySession.findUnique.mockResolvedValueOnce({
        id: "session_1",
        tenantId: "tenant_1",
        stationId: "station_1",
        status: "APPROVED",
      });

      await expect(deleteProductDischarge(asDb(mockDb), "discharge_1", "tenant_1", "station_1", "session_1")).rejects.toThrow(/APPROVED/);
    });

    it("rejects delete if session is READY_FOR_REVIEW", async () => {
      mockDb.dailySession.findUnique.mockResolvedValueOnce({
        id: "session_1",
        tenantId: "tenant_1",
        stationId: "station_1",
        status: "READY_FOR_REVIEW",
      });

      await expect(deleteProductDischarge(asDb(mockDb), "discharge_1", "tenant_1", "station_1", "session_1")).rejects.toThrow(/READY_FOR_REVIEW/);
    });
  });
});
