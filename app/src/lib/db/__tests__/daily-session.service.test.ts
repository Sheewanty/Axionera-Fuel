import { describe, it, expect, vi } from "vitest";
import { openTodaySession, closeSession, approveSession, reopenSession } from "../daily-session.service";
import { Db } from "../types";

describe("DailySession Service", () => {
  describe("openTodaySession", () => {
    it("creates today's DAY session for an active station", async () => {
      const mockDb = {
        station: {
          findFirst: vi.fn().mockResolvedValue({ id: "station_1", tenantId: "tenant_1", status: "ACTIVE" }),
        },
        dailySession: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: "sess_1", status: "OPEN", shift: "DAY" }),
        },
      };

      const res = await openTodaySession("tenant_1", "station_1", "user_1", mockDb as unknown as Db);

      expect(res.status).toBe("OPEN");
      expect(mockDb.dailySession.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: "tenant_1",
          stationId: "station_1",
          shift: "DAY",
          status: "OPEN",
          openedBy: "user_1",
        }),
      });
    });

    it("returns an existing unapproved session for today", async () => {
      const existing = { id: "sess_1", status: "REOPENED" };
      const mockDb = {
        station: {
          findFirst: vi.fn().mockResolvedValue({ id: "station_1", tenantId: "tenant_1", status: "ACTIVE" }),
        },
        dailySession: {
          findUnique: vi.fn().mockResolvedValue(existing),
          create: vi.fn(),
        },
      };

      const res = await openTodaySession("tenant_1", "station_1", "user_1", mockDb as unknown as Db);

      expect(res).toBe(existing);
      expect(mockDb.dailySession.create).not.toHaveBeenCalled();
    });

    it("rejects inactive or cross-tenant stations", async () => {
      const mockDb = {
        station: { findFirst: vi.fn().mockResolvedValue(null) },
      };

      await expect(openTodaySession("tenant_1", "station_1", "user_1", mockDb as unknown as Db))
        .rejects.toThrow("Station not found or inactive");
    });
  });

  describe("closeSession", () => {
    it("updates status to READY_FOR_REVIEW if valid", async () => {
      const mockDb = {
        dailySession: {
          findUnique: vi.fn().mockResolvedValue({
            id: "sess_1",
            tenantId: "tenant_1",
            stationId: "station_1",
            status: "OPEN",
            pumpReadings: [{ id: "pr_1" }],
            tankDippings: [{ id: "td_1", receiptsLitres: 0 }],
            cashCollections: [{ id: "cc_1" }],
            productDischarges: [],
            martSales: [{ id: "ms_1" }],
          }),
          update: vi.fn().mockResolvedValue({ id: "sess_1", status: "READY_FOR_REVIEW" }),
        },
      };

      const res = await closeSession("tenant_1", "station_1", "user_1", "sess_1", mockDb as unknown as Db);
      expect(res.status).toBe("READY_FOR_REVIEW");
      expect(mockDb.dailySession.update).toHaveBeenCalledWith({
        where: { id: "sess_1" },
        data: expect.objectContaining({
          status: "READY_FOR_REVIEW",
          closedBy: "user_1",
        }),
      });
    });

    it("throws if tenant mismatch", async () => {
      const mockDb = {
        dailySession: { findUnique: vi.fn().mockResolvedValue({ tenantId: "tenant_2" }) },
      };
      await expect(closeSession("tenant_1", "station_1", "user_1", "sess_1", mockDb as unknown as Db))
        .rejects.toThrow("Session not found or tenant mismatch");
    });

    it("throws if already approved", async () => {
      const mockDb = {
        dailySession: {
          findUnique: vi.fn().mockResolvedValue({
            tenantId: "tenant_1",
            stationId: "station_1",
            status: "APPROVED",
            pumpReadings: [],
            tankDippings: [],
            cashCollections: [],
            martSales: [],
          }),
        },
      };
      await expect(closeSession("tenant_1", "station_1", "user_1", "sess_1", mockDb as unknown as Db))
        .rejects.toThrow("Cannot close session from status: APPROVED");
    });

      it("throws if missing required operational data", async () => {
        const mockDb = {
          dailySession: {
            findUnique: vi.fn().mockResolvedValue({
              id: "sess_1",
              tenantId: "tenant_1",
              stationId: "station_1",
              status: "OPEN",
              pumpReadings: [],
              tankDippings: [{ id: "td_1", receiptsLitres: 0 }],
              cashCollections: [{ id: "cc_1" }],
              productDischarges: [],
              martSales: [{ id: "ms_1" }],
            }),
          },
        };
        await expect(closeSession("tenant_1", "station_1", "user_1", "sess_1", mockDb as unknown as Db))
          .rejects.toThrow("Cannot close session: No pump readings recorded");
      });

      it("throws if tank dipping declares receipts but no discharge exists", async () => {
        const mockDb = {
          dailySession: {
            findUnique: vi.fn().mockResolvedValue({
              id: "sess_1",
              tenantId: "tenant_1",
              stationId: "station_1",
              status: "OPEN",
              pumpReadings: [{ id: "pr_1" }],
              tankDippings: [{ tankId: "tank_1", receiptsLitres: 1000 }],
              cashCollections: [{ id: "cc_1" }],
              productDischarges: [],
              martSales: [{ id: "ms_1" }],
            }),
          },
        };
        await expect(closeSession("tenant_1", "station_1", "user_1", "sess_1", mockDb as unknown as Db))
          .rejects.toThrow(/Tank dipping declares receipts > 0 but no Product Discharge recorded for tank tank_1/);
      });

      it("throws if total discharged mismatch with receipts exceeds tolerance", async () => {
        const mockDb = {
          dailySession: {
            findUnique: vi.fn().mockResolvedValue({
              id: "sess_1",
              tenantId: "tenant_1",
              stationId: "station_1",
              status: "OPEN",
              pumpReadings: [{ id: "pr_1" }],
              tankDippings: [{ tankId: "tank_1", receiptsLitres: 5000 }],
              cashCollections: [{ id: "cc_1" }],
              productDischarges: [{ tankId: "tank_1", productDischargedLitres: 4950, topUpLitres: 0 }],
              martSales: [{ id: "ms_1" }],
            }),
          },
        };
        await expect(closeSession("tenant_1", "station_1", "user_1", "sess_1", mockDb as unknown as Db))
          .rejects.toThrow(/Product discharge total \(4950 L\) does not match tank dipping receipts \(5000 L\) for tank tank_1/);
      });

      it("passes if total discharged matches receipts within tolerance", async () => {
        const mockDb = {
          dailySession: {
            findUnique: vi.fn().mockResolvedValue({
              id: "sess_1",
              tenantId: "tenant_1",
              stationId: "station_1",
              status: "OPEN",
              pumpReadings: [{ id: "pr_1" }],
              tankDippings: [{ tankId: "tank_1", receiptsLitres: 5000 }],
              cashCollections: [{ id: "cc_1" }],
              productDischarges: [{ tankId: "tank_1", productDischargedLitres: 4950, topUpLitres: 50.005 }], // total 5000.005, diff is 0.005 <= 0.01
              martSales: [{ id: "ms_1" }],
            }),
            update: vi.fn().mockResolvedValue({ status: "READY_FOR_REVIEW" }),
          },
        };
        
        const res = await closeSession("tenant_1", "station_1", "user_1", "sess_1", mockDb as unknown as Db);
        expect(res.status).toBe("READY_FOR_REVIEW");
      });

      it("throws if mart sales summary is missing", async () => {
        const mockDb = {
          dailySession: {
            findUnique: vi.fn().mockResolvedValue({
              id: "sess_1",
              tenantId: "tenant_1",
              stationId: "station_1",
              status: "OPEN",
              pumpReadings: [{ id: "pr_1" }],
              tankDippings: [{ id: "td_1", receiptsLitres: 0 }],
              cashCollections: [{ id: "cc_1" }],
              productDischarges: [],
              martSales: [],
            }),
          },
        };
        await expect(closeSession("tenant_1", "station_1", "user_1", "sess_1", mockDb as unknown as Db))
          .rejects.toThrow("Cannot close session: No mart sales summary recorded");
      });
    });

  describe("approveSession", () => {
    it("updates status to APPROVED if currently READY_FOR_REVIEW", async () => {
      const mockDb = {
        dailySession: {
          findUnique: vi.fn().mockResolvedValue({ tenantId: "tenant_1", stationId: "station_1", status: "READY_FOR_REVIEW" }),
          update: vi.fn().mockResolvedValue({ status: "APPROVED" }),
        },
      };

      const res = await approveSession("tenant_1", "station_1", "user_1", "sess_1", mockDb as unknown as Db);
      expect(res.status).toBe("APPROVED");
      expect(mockDb.dailySession.update).toHaveBeenCalledWith({
        where: { id: "sess_1" },
        data: { status: "APPROVED" },
      });
    });

    it("throws if not READY_FOR_REVIEW", async () => {
      const mockDb = {
        dailySession: { findUnique: vi.fn().mockResolvedValue({ tenantId: "tenant_1", stationId: "station_1", status: "OPEN" }) },
      };
      await expect(approveSession("tenant_1", "station_1", "user_1", "sess_1", mockDb as unknown as Db))
        .rejects.toThrow("Cannot approve session from status: OPEN");
    });
  });

  describe("reopenSession", () => {
    it("updates status to REOPENED and appends reason", async () => {
      const mockDb = {
        dailySession: {
          findUnique: vi.fn().mockResolvedValue({
            tenantId: "tenant_1",
            stationId: "station_1",
            status: "APPROVED",
            supervisorNotes: "Initial note",
          }),
          update: vi.fn().mockResolvedValue({ status: "REOPENED" }),
        },
      };

      const res = await reopenSession("tenant_1", "station_1", "user_1", "sess_1", "Need to fix reading", mockDb as unknown as Db);
      expect(res.status).toBe("REOPENED");
      expect(mockDb.dailySession.update).toHaveBeenCalledWith({
        where: { id: "sess_1" },
        data: {
          status: "REOPENED",
          supervisorNotes: "Initial note\n\nReopened: Need to fix reading",
        },
      });
    });

    it("throws if reason is empty", async () => {
      const mockDb = {
        dailySession: {
          findUnique: vi.fn().mockResolvedValue({ tenantId: "tenant_1", stationId: "station_1", status: "APPROVED" }),
        },
      };
      await expect(reopenSession("tenant_1", "station_1", "user_1", "sess_1", "   ", mockDb as unknown as Db))
        .rejects.toThrow("A reason must be provided to reopen a session");
    });
  });
});
