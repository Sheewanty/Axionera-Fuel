import { describe, it, expect, beforeEach } from "vitest";
import { withStationParam } from "./station-utils";
import { getAccessibleStations } from "./db/station.service";
import { prisma } from "./db/prisma";
import { vi } from "vitest";

// Mock prisma
vi.mock("./db/prisma", () => ({
  prisma: {
    station: {
      findMany: vi.fn(),
    },
  },
}));

describe("Station Switcher Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Accessible Stations Filtering", () => {
    it("returns all tenant stations for OWNER/ADMIN (membershipStationId is empty)", async () => {
      vi.mocked(prisma.station.findMany).mockResolvedValueOnce([
        { id: "s1", tenantId: "t1", name: "Station 1", location: "Loc 1", code: "S1", status: "ACTIVE", createdAt: new Date(), updatedAt: new Date() },
        { id: "s2", tenantId: "t1", name: "Station 2", location: "Loc 2", code: "S2", status: "ACTIVE", createdAt: new Date(), updatedAt: new Date() },
      ]);

      const stations = await getAccessibleStations("t1", "");
      expect(stations).toHaveLength(2);
      expect(prisma.station.findMany).toHaveBeenCalledWith({
        where: { tenantId: "t1", status: "ACTIVE" },
        select: { id: true, name: true, location: true, code: true, status: true },
        orderBy: { name: "asc" },
      });
    });

    it("returns only the assigned station for STATION_MANAGER/SUPERVISOR/ATTENDANT", async () => {
      vi.mocked(prisma.station.findMany).mockResolvedValueOnce([
        { id: "s1", tenantId: "t1", name: "Station 1", location: "Loc 1", code: "S1", status: "ACTIVE", createdAt: new Date(), updatedAt: new Date() },
      ]);

      const stations = await getAccessibleStations("t1", "s1");
      expect(stations).toHaveLength(1);
      expect(stations[0].id).toBe("s1");
      expect(prisma.station.findMany).toHaveBeenCalledWith({
        where: { tenantId: "t1", id: "s1", status: "ACTIVE" },
        select: { id: true, name: true, location: true, code: true, status: true },
        orderBy: { name: "asc" },
      });
    });
  });

  describe("URL Generation (withStationParam)", () => {
    it("appends stationId to href when stationScoped is true", () => {
      const href = "/daily-close";
      const newHref = withStationParam(href, "stat_123", true);
      expect(newHref).toBe("/daily-close?stationId=stat_123");
    });
    
    it("does not append if stationScoped is false", () => {
      const href = "/owner-dashboard";
      const newHref = withStationParam(href, "stat_123", false);
      expect(newHref).toBe("/owner-dashboard");
    });

    it("does not append if stationId is missing", () => {
      const href = "/daily-close";
      const newHref = withStationParam(href, null, true);
      expect(newHref).toBe("/daily-close");
    });

    it("appends correctly if href already has query parameters", () => {
      const href = "/daily-close?view=summary";
      const newHref = withStationParam(href, "stat_123", true);
      expect(newHref).toBe("/daily-close?view=summary&stationId=stat_123");
    });
  });
});
