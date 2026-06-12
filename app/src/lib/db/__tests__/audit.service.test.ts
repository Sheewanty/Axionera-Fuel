/**
 * Unit tests for audit.service.ts
 *
 * Tests verify:
 *  - prisma.auditLog.create is called with the correct shape
 *  - tenantId is always present (isolation contract)
 *  - All 5 AuditAction values are accepted
 *  - before/after null semantics work correctly
 *  - Errors from Prisma propagate (not swallowed)
 *  - stationId is optional (nullable for tenant-level actions)
 *  - db parameter: when provided, uses that client instead of global prisma singleton
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    auditLog: {
      create: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db/prisma";
import { writeAuditLog, type AuditAction } from "@/lib/db/audit.service";

const mockCreate = vi.mocked(prisma.auditLog.create);

const BASE: Parameters<typeof writeAuditLog>[0] = {
  tenantId: "tenant-goil-gh",
  actorUserId: "user-kwame",
  entityType: "PumpReading",
  entityId: "reading-001",
  action: "CREATE",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockCreate.mockResolvedValue({} as never);
});

// ─── Shape validation ─────────────────────────────────────────────────────────

describe("writeAuditLog — Prisma call shape", () => {
  it("calls prisma.auditLog.create with all required fields", async () => {
    await writeAuditLog(BASE);

    expect(mockCreate).toHaveBeenCalledOnce();
    const call = mockCreate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(call.data.tenantId).toBe("tenant-goil-gh");
    expect(call.data.actorUserId).toBe("user-kwame");
    expect(call.data.entityType).toBe("PumpReading");
    expect(call.data.entityId).toBe("reading-001");
    expect(call.data.action).toBe("CREATE");
  });

  it("sets stationId to null when not provided", async () => {
    await writeAuditLog(BASE);
    const call = mockCreate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(call.data.stationId).toBeNull();
  });

  it("passes stationId when provided", async () => {
    await writeAuditLog({ ...BASE, stationId: "station-accra-001" });
    const call = mockCreate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(call.data.stationId).toBe("station-accra-001");
  });

  it("sets beforeJson to undefined when before is not provided (CREATE)", async () => {
    await writeAuditLog({ ...BASE, action: "CREATE" });
    const call = mockCreate.mock.calls[0][0] as { data: Record<string, unknown> };
    // Prisma ignores undefined — field stays absent rather than null
    expect(call.data.beforeJson).toBeUndefined();
  });

  it("sets afterJson to undefined when after is not provided (DELETE)", async () => {
    await writeAuditLog({ ...BASE, action: "DELETE", before: { id: "reading-001" } });
    const call = mockCreate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(call.data.afterJson).toBeUndefined();
  });

  it("passes before and after snapshots for UPDATE", async () => {
    const before = { litres: 100 };
    const after = { litres: 120 };
    await writeAuditLog({ ...BASE, action: "UPDATE", before, after });

    const call = mockCreate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(call.data.beforeJson).toEqual(before);
    expect(call.data.afterJson).toEqual(after);
  });
});

// ─── Tenant isolation ─────────────────────────────────────────────────────────

describe("writeAuditLog — tenant isolation", () => {
  it("always includes tenantId in the Prisma call", async () => {
    await writeAuditLog(BASE);
    const call = mockCreate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(call.data.tenantId).toBe(BASE.tenantId);
  });

  it("tenantId is scoped per call — different tenants produce different rows", async () => {
    mockCreate.mockResolvedValue({} as never);
    await writeAuditLog({ ...BASE, tenantId: "tenant-a" });
    await writeAuditLog({ ...BASE, tenantId: "tenant-b" });

    const calls = mockCreate.mock.calls;
    expect((calls[0][0] as { data: Record<string, unknown> }).data.tenantId).toBe("tenant-a");
    expect((calls[1][0] as { data: Record<string, unknown> }).data.tenantId).toBe("tenant-b");
  });
});

// ─── All 5 AuditAction values ─────────────────────────────────────────────────

describe("writeAuditLog — all AuditAction values accepted", () => {
  const actions: AuditAction[] = ["CREATE", "UPDATE", "DELETE", "APPROVE", "REOPEN"];

  for (const action of actions) {
    it(`accepts action: "${action}"`, async () => {
      await writeAuditLog({ ...BASE, action });
      const call = mockCreate.mock.calls[0][0] as { data: Record<string, unknown> };
      expect(call.data.action).toBe(action);
      vi.clearAllMocks();
    });
  }
});

// ─── Error propagation ────────────────────────────────────────────────────────

describe("writeAuditLog — error propagation", () => {
  it("propagates Prisma errors (audit failures are not swallowed)", async () => {
    const dbError = new Error("DB connection lost");
    mockCreate.mockRejectedValueOnce(dbError);

    await expect(writeAuditLog(BASE)).rejects.toThrow("DB connection lost");
  });

  it("only calls prisma.auditLog.create once per writeAuditLog call", async () => {
    await writeAuditLog(BASE);
    expect(mockCreate).toHaveBeenCalledOnce();
  });
});

// ─── Optional field defaults ──────────────────────────────────────────────────

describe("writeAuditLog — optional field defaults", () => {
  it("null before is treated as undefined (Prisma omits the field)", async () => {
    await writeAuditLog({ ...BASE, before: null });
    const call = mockCreate.mock.calls[0][0] as { data: Record<string, unknown> };
    // null ?? undefined → undefined
    expect(call.data.beforeJson).toBeUndefined();
  });

  it("null after is treated as undefined (Prisma omits the field)", async () => {
    await writeAuditLog({ ...BASE, after: null });
    const call = mockCreate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(call.data.afterJson).toBeUndefined();
  });
});

// ─── db parameter (transaction-aware) ───────────────────────────────────────────

describe("writeAuditLog — db parameter (transaction-aware)", () => {
  it("uses the provided db client instead of the global prisma singleton", async () => {
    // Create a fake transaction client with its own auditLog.create mock
    const txCreate = vi.fn().mockResolvedValue({});
    const fakeTx = { auditLog: { create: txCreate } } as unknown as Parameters<typeof writeAuditLog>[1];

    await writeAuditLog(BASE, fakeTx);

    // fakeTx.auditLog.create should be called, not prisma.auditLog.create
    expect(txCreate).toHaveBeenCalledOnce();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("passes the same params to db.auditLog.create as it does to prisma.auditLog.create", async () => {
    const txCreate = vi.fn().mockResolvedValue({});
    const fakeTx = { auditLog: { create: txCreate } } as unknown as Parameters<typeof writeAuditLog>[1];

    const params = { ...BASE, action: "UPDATE" as const, before: { v: 1 }, after: { v: 2 } };
    await writeAuditLog(params, fakeTx);

    const call = txCreate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(call.data.tenantId).toBe(BASE.tenantId);
    expect(call.data.action).toBe("UPDATE");
    expect(call.data.beforeJson).toEqual({ v: 1 });
    expect(call.data.afterJson).toEqual({ v: 2 });
  });

  it("falls back to prisma singleton when db is not provided", async () => {
    await writeAuditLog(BASE);
    expect(mockCreate).toHaveBeenCalledOnce();
  });
});
