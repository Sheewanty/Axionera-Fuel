/**
 * Unit tests for membership.service.ts
 *
 * Tests verify:
 *  - tenantId is ALWAYS included in every Prisma query's where clause
 *  - Sentinel stationId="" is correctly handled
 *  - Station scope assertions reject cross-station access
 *  - verifyMembershipFresh rejects role mismatches
 *
 * Uses vi.mock to avoid a live DB connection. These tests prove the
 * query SHAPE, not the DB result — integration tests cover the latter.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock the Prisma singleton ────────────────────────────────────────────────
// Must be hoisted before any import that uses @/lib/db/prisma
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    membership: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db/prisma";
import {
  getMembership,
  getStationMemberships,
  verifyMembershipFresh,
  assertStationAccess,
} from "@/lib/db/membership.service";

const mockFindFirst = vi.mocked(prisma.membership.findFirst);
const mockFindMany = vi.mocked(prisma.membership.findMany);
const mockFindUnique = vi.mocked(prisma.membership.findUnique);

const TENANT_A = "tenant-goil-gh";
const TENANT_B = "tenant-other";
const USER_1 = "user-kwame";
const STATION_ACCRA = "station-accra-001";
const STATION_KUMASI = "station-kumasi-001";
const FIXTURE_DATE = new Date("2026-06-12T00:00:00.000Z");

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── getMembership ────────────────────────────────────────────────────────────

describe("getMembership", () => {
  it("passes tenantId AND userId in the where clause", async () => {
    mockFindFirst.mockResolvedValueOnce(null);
    await getMembership(USER_1, TENANT_A);

    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: USER_1, tenantId: TENANT_A }),
      })
    );
  });

  it("returns null when no membership exists for the user in that tenant", async () => {
    mockFindFirst.mockResolvedValueOnce(null);
    const result = await getMembership(USER_1, TENANT_B);
    expect(result).toBeNull();
  });

  it("returns the membership record when found", async () => {
    const record = {
      id: "mem-1",
      tenantId: TENANT_A,
      userId: USER_1,
      stationId: "",
      role: "OWNER",
      createdAt: FIXTURE_DATE,
      updatedAt: FIXTURE_DATE,
    };
    mockFindFirst.mockResolvedValueOnce(record);
    const result = await getMembership(USER_1, TENANT_A);
    expect(result).toEqual(record);
  });

  it("does NOT query TENANT_B when asked for TENANT_A — isolation assured by caller", async () => {
    mockFindFirst.mockResolvedValueOnce(null);
    await getMembership(USER_1, TENANT_A);
    const callArgs = mockFindFirst.mock.calls[0][0] as { where: Record<string, unknown> };
    // Confirm the tenant ID passed is exactly TENANT_A (not TENANT_B)
    expect(callArgs.where.tenantId).toBe(TENANT_A);
    expect(callArgs.where.tenantId).not.toBe(TENANT_B);
  });
});

// ─── getStationMemberships ────────────────────────────────────────────────────

describe("getStationMemberships", () => {
  it("includes tenantId and userId and excludes sentinel stationId", async () => {
    mockFindMany.mockResolvedValueOnce([]);
    await getStationMemberships(USER_1, TENANT_A);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: USER_1,
          tenantId: TENANT_A,
          NOT: { stationId: "" }, // sentinel excluded
        }),
      })
    );
  });

  it("returns empty array when user has only tenant-wide memberships", async () => {
    mockFindMany.mockResolvedValueOnce([]);
    const result = await getStationMemberships(USER_1, TENANT_A);
    expect(result).toEqual([]);
  });

  it("returns station-scoped memberships", async () => {
    const records = [
      {
        id: "m1",
        tenantId: TENANT_A,
        userId: USER_1,
        stationId: STATION_ACCRA,
        role: "SUPERVISOR",
        createdAt: FIXTURE_DATE,
        updatedAt: FIXTURE_DATE,
      },
    ];
    mockFindMany.mockResolvedValueOnce(records);
    const result = await getStationMemberships(USER_1, TENANT_A);
    expect(result).toHaveLength(1);
    expect(result[0].stationId).toBe(STATION_ACCRA);
  });

  it("sentinel stationId is never in the returned records (enforced by NOT filter)", async () => {
    // If the mock returns a sentinel record, that would indicate a DB schema bug —
    // the NOT filter should prevent it. Verify the filter is passed correctly.
    mockFindMany.mockResolvedValueOnce([]);
    await getStationMemberships(USER_1, TENANT_A);
    const callWhere = (mockFindMany.mock.calls[0][0] as { where: Record<string, unknown> }).where;
    expect((callWhere.NOT as Record<string, unknown>).stationId).toBe("");
  });
});

// ─── verifyMembershipFresh ────────────────────────────────────────────────────

describe("verifyMembershipFresh", () => {
  it("queries by composite key including tenantId", async () => {
    mockFindUnique.mockResolvedValueOnce(null);
    await verifyMembershipFresh(TENANT_A, USER_1, "", "OWNER");

    expect(mockFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId_userId_stationId: {
            tenantId: TENANT_A,
            userId: USER_1,
            stationId: "",
          },
        },
      })
    );
  });

  it("returns null when membership is not found (revoked)", async () => {
    mockFindUnique.mockResolvedValueOnce(null);
    const result = await verifyMembershipFresh(TENANT_A, USER_1, "", "OWNER");
    expect(result).toBeNull();
  });

  it("returns null when role has changed (stale JWT)", async () => {
    mockFindUnique.mockResolvedValueOnce({
      id: "m1", tenantId: TENANT_A, userId: USER_1, stationId: "", role: "ADMIN", // changed from OWNER
      createdAt: FIXTURE_DATE,
      updatedAt: FIXTURE_DATE,
    });
    // JWT claims role OWNER, DB now has ADMIN → freshness check fails
    const result = await verifyMembershipFresh(TENANT_A, USER_1, "", "OWNER");
    expect(result).toBeNull();
  });

  it("returns the record when membership is fresh and role matches", async () => {
    const record = {
      id: "m1",
      tenantId: TENANT_A,
      userId: USER_1,
      stationId: "",
      role: "OWNER",
      createdAt: FIXTURE_DATE,
      updatedAt: FIXTURE_DATE,
    };
    mockFindUnique.mockResolvedValueOnce(record);
    const result = await verifyMembershipFresh(TENANT_A, USER_1, "", "OWNER");
    expect(result).toEqual(record);
  });
});

// ─── assertStationAccess ──────────────────────────────────────────────────────

describe("assertStationAccess", () => {
  it("allows tenant-wide role (membershipStationId='') to access any station", () => {
    expect(() => assertStationAccess("", STATION_ACCRA)).not.toThrow();
    expect(() => assertStationAccess("", STATION_KUMASI)).not.toThrow();
  });

  it("allows station-scoped role to access their own station", () => {
    expect(() => assertStationAccess(STATION_ACCRA, STATION_ACCRA)).not.toThrow();
  });

  it("blocks station-scoped role from accessing a different station", () => {
    expect(() => assertStationAccess(STATION_ACCRA, STATION_KUMASI)).toThrow();
  });

  it("throws if targetStationId is the sentinel empty string", () => {
    expect(() => assertStationAccess("", "")).toThrow("Sentinel");
  });

  it("throws specific message when cross-station access is attempted", () => {
    expect(() => assertStationAccess(STATION_ACCRA, STATION_KUMASI)).toThrow(
      /Station access denied/
    );
  });
});
