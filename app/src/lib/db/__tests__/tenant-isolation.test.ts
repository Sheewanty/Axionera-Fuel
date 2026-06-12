/**
 * Tenant isolation behavioral tests.
 *
 * These tests verify the cross-tenant access control rules at the service layer.
 * They use mocked Prisma to simulate DB responses and assert that:
 *
 *  1. A user from Tenant A is blocked from Tenant B's stations
 *  2. A station-scoped supervisor cannot access another station in the same tenant
 *  3. A tenant-wide owner can access any station in their tenant
 *  4. The sentinel stationId="" cannot be used as a real station lookup
 *  5. verifyMembershipFresh catches role changes between JWT issuance and request
 *
 * NOTE: These tests prove the service layer's isolation logic, not SQL execution.
 * For end-to-end isolation, integration tests against a real test DB are needed.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    membership: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    station: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db/prisma";
import { getMembership, assertStationAccess, verifyMembershipFresh } from "@/lib/db/membership.service";
import { getAccessibleStations, getStation } from "@/lib/db/station.service";

const mockMembershipFindFirst = vi.mocked(prisma.membership.findFirst);
const mockMembershipFindUnique = vi.mocked(prisma.membership.findUnique);
const mockStationFindMany = vi.mocked(prisma.station.findMany);
const mockStationFindFirst = vi.mocked(prisma.station.findFirst);

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const TENANT_A = "tenant-goil-gh";
const TENANT_B = "tenant-competitor";
const USER_FROM_A = "user-kwame";
const STATION_A1 = "station-accra-001";
const STATION_A2 = "station-kumasi-001";
const FIXTURE_DATE = new Date("2026-06-12T00:00:00.000Z");

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Rule 1: User from Tenant A cannot see Tenant B ──────────────────────────

describe("cross-tenant isolation", () => {
  it("getMembership for Tenant A never queries Tenant B", async () => {
    mockMembershipFindFirst.mockResolvedValueOnce(null);
    await getMembership(USER_FROM_A, TENANT_A);

    const callArgs = mockMembershipFindFirst.mock.calls[0][0] as {
      where: Record<string, unknown>;
    };
    expect(callArgs.where.tenantId).toBe(TENANT_A);
    expect(callArgs.where.tenantId).not.toBe(TENANT_B);
  });

  it("getAccessibleStations for Tenant A includes tenantId in station query", async () => {
    mockStationFindMany.mockResolvedValueOnce([]);
    await getAccessibleStations(TENANT_A, ""); // tenant-wide

    const callArgs = mockStationFindMany.mock.calls[0][0] as {
      where: Record<string, unknown>;
    };
    expect(callArgs.where.tenantId).toBe(TENANT_A);
    expect(callArgs.where.tenantId).not.toBe(TENANT_B);
  });

  it("getStation with Tenant A ID never returns a Tenant B station", async () => {
    // Simulate DB finding nothing (correct isolation via tenantId in where clause)
    mockStationFindFirst.mockResolvedValueOnce(null);
    const result = await getStation(TENANT_A, "station-b-only-id");
    expect(result).toBeNull();

    const callArgs = mockStationFindFirst.mock.calls[0][0] as {
      where: Record<string, unknown>;
    };
    // Confirm that tenantId is in the query — this is the isolation mechanism
    expect(callArgs.where.tenantId).toBe(TENANT_A);
  });
});

// ─── Rule 2: Station-scoped supervisor blocked from peer station ───────────────

describe("station-scoped role isolation", () => {
  it("supervisor from Station A1 is blocked from Station A2", () => {
    // assertStationAccess is synchronous — no DB needed
    expect(() => assertStationAccess(STATION_A1, STATION_A2)).toThrow(
      /Station access denied/
    );
  });

  it("supervisor from Station A1 can access Station A1", () => {
    expect(() => assertStationAccess(STATION_A1, STATION_A1)).not.toThrow();
  });

  it("supervisor from Station A1 is blocked from any other station cuid", () => {
    const someOtherStation = "station-takoradi-001";
    expect(() => assertStationAccess(STATION_A1, someOtherStation)).toThrow();
  });
});

// ─── Rule 3: Tenant-wide owner can access any station in their tenant ─────────

describe("tenant-wide role (membershipStationId='')", () => {
  it("owner with sentinel '' can access Station A1", () => {
    expect(() => assertStationAccess("", STATION_A1)).not.toThrow();
  });

  it("owner with sentinel '' can access Station A2", () => {
    expect(() => assertStationAccess("", STATION_A2)).not.toThrow();
  });

  it("getAccessibleStations for owner queries all stations in tenant (no id filter)", async () => {
    mockStationFindMany.mockResolvedValueOnce([]);
    await getAccessibleStations(TENANT_A, ""); // membershipStationId = "" = tenant-wide

    const callArgs = mockStationFindMany.mock.calls[0][0] as {
      where: Record<string, unknown>;
    };
    // Should NOT have an `id` filter — owner sees all stations
    expect(callArgs.where).not.toHaveProperty("id");
    expect(callArgs.where.tenantId).toBe(TENANT_A);
  });

  it("getAccessibleStations for station-scoped supervisor includes id filter", async () => {
    mockStationFindMany.mockResolvedValueOnce([]);
    await getAccessibleStations(TENANT_A, STATION_A1); // station-scoped

    const callArgs = mockStationFindMany.mock.calls[0][0] as {
      where: Record<string, unknown>;
    };
    expect(callArgs.where.id).toBe(STATION_A1);
    expect(callArgs.where.tenantId).toBe(TENANT_A);
  });
});

// ─── Rule 4: Sentinel "" cannot be used as a real station lookup ──────────────

describe("sentinel stationId guard", () => {
  it("getStation returns null for sentinel empty string (guards against misuse)", async () => {
    const result = await getStation(TENANT_A, "");
    // getStation has an explicit guard: if (!stationId || stationId === "") return null
    expect(result).toBeNull();
    // DB should never be called
    expect(mockStationFindFirst).not.toHaveBeenCalled();
  });

  it("assertStationAccess throws when targetStationId is sentinel ''", () => {
    expect(() => assertStationAccess("", "")).toThrow("Sentinel");
  });

  it("assertStationAccess throws when both are '' (cannot use sentinel as target)", () => {
    // Even a tenant-wide owner cannot 'access' the sentinel as a station
    expect(() => assertStationAccess("", "")).toThrow();
  });
});

// ─── Rule 5: Role change between JWT issuance and request ────────────────────

describe("freshness: role change between JWT and request", () => {
  it("verifyMembershipFresh returns null when DB role differs from JWT claim", async () => {
    mockMembershipFindUnique.mockResolvedValueOnce({
      id: "m1",
      tenantId: TENANT_A,
      userId: USER_FROM_A,
      stationId: "",
      role: "ADMIN", // DB was updated after JWT was issued (JWT claimed OWNER)
      createdAt: FIXTURE_DATE,
      updatedAt: FIXTURE_DATE,
    });

    const result = await verifyMembershipFresh(TENANT_A, USER_FROM_A, "", "OWNER");
    expect(result).toBeNull(); // freshness check fails — role mismatch
  });

  it("verifyMembershipFresh returns null when membership no longer exists", async () => {
    mockMembershipFindUnique.mockResolvedValueOnce(null); // membership deleted

    const result = await verifyMembershipFresh(TENANT_A, USER_FROM_A, "", "OWNER");
    expect(result).toBeNull();
  });

  it("verifyMembershipFresh returns the record when role and membership are fresh", async () => {
    const record = {
      id: "m1",
      tenantId: TENANT_A,
      userId: USER_FROM_A,
      stationId: "",
      role: "OWNER",
      createdAt: FIXTURE_DATE,
      updatedAt: FIXTURE_DATE,
    };
    mockMembershipFindUnique.mockResolvedValueOnce(record);

    const result = await verifyMembershipFresh(TENANT_A, USER_FROM_A, "", "OWNER");
    expect(result).toEqual(record);
  });

  it("verifyMembershipFresh query always scopes by tenantId", async () => {
    mockMembershipFindUnique.mockResolvedValueOnce(null);
    await verifyMembershipFresh(TENANT_A, USER_FROM_A, "", "OWNER");

    const callArgs = mockMembershipFindUnique.mock.calls[0][0] as {
      where: { tenantId_userId_stationId: Record<string, unknown> };
    };
    expect(callArgs.where.tenantId_userId_stationId.tenantId).toBe(TENANT_A);
  });
});
