/**
 * Unit tests for mutation.ts — withMutation() and withApproval() pipeline.
 *
 * Tests verify:
 *
 * PIPELINE ORDERING
 *  - getRequiredSession → requireWriteAccess → $transaction → fn → writeAuditLog
 *  - fn receives (session, db, ...args) — db is the transaction client
 *
 * ATOMICITY (the $transaction guarantee)
 *  - Domain success + audit success → both committed (result returned)
 *  - Domain failure → fn throws → transaction rolls back → audit never called
 *  - Audit failure → writeAuditLog throws inside tx → tx rolls back → error propagates
 *
 * SAME DB OBJECT (anti-regression)
 *  - writeAuditLog receives the SAME db object that was passed to fn
 *    (prevents accidental fallback to global prisma)
 *
 * ACCESS CONTROL
 *  - Access denied → fn never called → no transaction opened
 *  - withApproval uses requireApproveAccess, not requireWriteAccess
 *
 * STATION SCOPE
 *  - getStationId extraction passes targetStationId to access check
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const {
  mockGetRequiredSession,
  mockRequireWriteAccess,
  mockRequireApproveAccess,
  mockWriteAuditLog,
  mockTransaction,
} = vi.hoisted(() => ({
  mockGetRequiredSession: vi.fn(),
  mockRequireWriteAccess: vi.fn(),
  mockRequireApproveAccess: vi.fn(),
  mockWriteAuditLog: vi.fn(),
  // $transaction executes its callback with a fake tx object.
  // The mock tx object is what fn and writeAuditLog should both receive.
  mockTransaction: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: mockTransaction,
  },
}));

vi.mock("@/lib/session", () => ({
  getRequiredSession: mockGetRequiredSession,
  requireWriteAccess: mockRequireWriteAccess,
  requireApproveAccess: mockRequireApproveAccess,
  AccessDeniedError: class AccessDeniedError extends Error {
    constructor(msg = "Access denied") { super(msg); this.name = "AccessDeniedError"; }
  },
}));

vi.mock("@/lib/db/audit.service", () => ({
  writeAuditLog: mockWriteAuditLog,
}));

import { withMutation, withApproval } from "@/lib/mutation";
import { AccessDeniedError } from "@/lib/session";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const MOCK_SESSION = {
  user: {
    id: "user-kwame",
    tenantId: "tenant-goil-gh",
    role: "OWNER",
    membershipStationId: "",
    activeStationId: null,
  },
  expires: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
};

// A stable fake transaction client — same object reference every call.
// Tests assert fn and writeAuditLog both receive this object.
const FAKE_TX = { auditLog: { create: vi.fn() }, _isFakeTx: true } as const;

beforeEach(() => {
  vi.clearAllMocks();
  mockGetRequiredSession.mockResolvedValue(MOCK_SESSION);
  mockRequireWriteAccess.mockResolvedValue(undefined);
  mockRequireApproveAccess.mockResolvedValue(undefined);
  mockWriteAuditLog.mockResolvedValue(undefined);

  // Default $transaction: execute the callback with FAKE_TX and return its result.
  mockTransaction.mockImplementation(
    async (callback: (tx: typeof FAKE_TX) => Promise<unknown>) => callback(FAKE_TX)
  );
});

// ─── Pipeline ordering ────────────────────────────────────────────────────────

describe("withMutation — pipeline ordering", () => {
  it("runs: getRequiredSession → requireWriteAccess → $transaction → fn → writeAuditLog", async () => {
    const callOrder: string[] = [];

    mockGetRequiredSession.mockImplementation(async () => {
      callOrder.push("session");
      return MOCK_SESSION;
    });
    mockRequireWriteAccess.mockImplementation(async () => {
      callOrder.push("access");
    });
    mockTransaction.mockImplementation(
      async (callback: (tx: typeof FAKE_TX) => Promise<unknown>) => {
        callOrder.push("$transaction:open");
        const result = await callback(FAKE_TX);
        callOrder.push("$transaction:close");
        return result;
      }
    );

    const fn = vi.fn().mockImplementation(async () => {
      callOrder.push("fn");
      return { id: "e-1" };
    });
    mockWriteAuditLog.mockImplementation(async () => {
      callOrder.push("audit");
    });

    const action = withMutation(
      { entityType: "PumpReading", action: "CREATE", getEntityId: (r: { id: string }) => r.id },
      fn
    );
    await action();

    expect(callOrder).toEqual([
      "session",
      "access",
      "$transaction:open",
      "fn",
      "audit",
      "$transaction:close",
    ]);
  });

  it("passes (session, db, ...args) to fn", async () => {
    const fn = vi.fn().mockResolvedValue({ id: "e-1" });
    const action = withMutation({ entityType: "PumpReading", action: "CREATE" }, fn);
    await action("arg1", 42);

    expect(fn).toHaveBeenCalledWith(MOCK_SESSION, FAKE_TX, "arg1", 42);
  });

  it("returns the result of fn", async () => {
    const fn = vi.fn().mockResolvedValue({ id: "r-1", litres: 500 });
    const action = withMutation({ entityType: "PumpReading", action: "CREATE" }, fn);
    const result = await action();
    expect(result).toEqual({ id: "r-1", litres: 500 });
  });

  it("opens $transaction AFTER requireWriteAccess completes", async () => {
    let accessDone = false;
    mockRequireWriteAccess.mockImplementation(async () => { accessDone = true; });
    mockTransaction.mockImplementation(async (cb: (tx: typeof FAKE_TX) => Promise<unknown>) => {
      expect(accessDone).toBe(true); // must be true before transaction opens
      return cb(FAKE_TX);
    });

    const fn = vi.fn().mockResolvedValue({});
    await withMutation({ entityType: "Test", action: "CREATE" }, fn)();
  });
});

// ─── Atomicity: domain success + audit success ────────────────────────────────

describe("withMutation — domain success + audit success (happy path)", () => {
  it("commits and returns result when both fn and writeAuditLog succeed", async () => {
    const fn = vi.fn().mockResolvedValue({ id: "reading-001" });
    const action = withMutation(
      { entityType: "PumpReading", action: "CREATE", getEntityId: (r: { id: string }) => r.id },
      fn
    );
    const result = await action();

    expect(result).toEqual({ id: "reading-001" });
    expect(fn).toHaveBeenCalledOnce();
    expect(mockWriteAuditLog).toHaveBeenCalledOnce();
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-goil-gh",
        actorUserId: "user-kwame",
        entityType: "PumpReading",
        entityId: "reading-001",
        action: "CREATE",
      }),
      FAKE_TX  // ← same db as fn received
    );
  });
});

// ─── Atomicity: domain failure ────────────────────────────────────────────────

describe("withMutation — domain failure (fn throws)", () => {
  it("propagates the error and never calls writeAuditLog", async () => {
    // $transaction propagates the error from the callback (simulates rollback)
    mockTransaction.mockImplementation(
      async (callback: (tx: typeof FAKE_TX) => Promise<unknown>) => callback(FAKE_TX)
    );
    const fn = vi.fn().mockRejectedValueOnce(new Error("DB constraint violated"));
    const action = withMutation({ entityType: "PumpReading", action: "CREATE" }, fn);

    await expect(action()).rejects.toThrow("DB constraint violated");
    expect(mockWriteAuditLog).not.toHaveBeenCalled();
  });

  it("preserves the original error type", async () => {
    class DomainError extends Error {
      constructor() { super("domain"); this.name = "DomainError"; }
    }
    const fn = vi.fn().mockRejectedValueOnce(new DomainError());
    const action = withMutation({ entityType: "Test", action: "UPDATE" }, fn);

    const err = await action().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DomainError);
  });

  it("does not call $transaction after access is denied", async () => {
    mockRequireWriteAccess.mockRejectedValueOnce(new AccessDeniedError("Denied"));
    const fn = vi.fn().mockResolvedValue({});
    const action = withMutation({ entityType: "Test", action: "CREATE" }, fn);

    await expect(action()).rejects.toThrow();
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(fn).not.toHaveBeenCalled();
    expect(mockWriteAuditLog).not.toHaveBeenCalled();
  });
});

// ─── Atomicity: audit failure ─────────────────────────────────────────────────

describe("withMutation — audit failure (writeAuditLog throws inside tx)", () => {
  it("propagates the audit error (simulating transaction rollback)", async () => {
    // When writeAuditLog throws, $transaction propagates the error.
    // Prisma then rolls back the domain write — the mock simulates this by
    // letting the callback error propagate out of $transaction.
    mockTransaction.mockImplementation(
      async (callback: (tx: typeof FAKE_TX) => Promise<unknown>) => callback(FAKE_TX)
    );
    const fn = vi.fn().mockResolvedValue({ id: "r-1" });
    mockWriteAuditLog.mockRejectedValueOnce(new Error("audit write failed"));

    const action = withMutation({ entityType: "PumpReading", action: "CREATE" }, fn);
    await expect(action()).rejects.toThrow("audit write failed");
  });

  it("calls fn before writeAuditLog fails — both inside same transaction", async () => {
    const callOrder: string[] = [];
    const fn = vi.fn().mockImplementation(async () => {
      callOrder.push("fn");
      return { id: "r-1" };
    });
    mockWriteAuditLog.mockImplementation(async () => {
      callOrder.push("audit-throws");
      throw new Error("audit write failed");
    });

    const action = withMutation({ entityType: "PumpReading", action: "CREATE" }, fn);
    await expect(action()).rejects.toThrow("audit write failed");

    expect(callOrder).toEqual(["fn", "audit-throws"]);
  });
});

// ─── Same db object assertion ─────────────────────────────────────────────────

describe("withMutation — same db object in fn and writeAuditLog", () => {
  it("writeAuditLog receives the same db object that fn received", async () => {
    let fnReceivedDb: unknown;
    const fn = vi.fn().mockImplementation(async (_session: unknown, db: unknown) => {
      fnReceivedDb = db;
      return { id: "r-1" };
    });

    const action = withMutation(
      { entityType: "PumpReading", action: "CREATE", getEntityId: (r: { id: string }) => r.id },
      fn
    );
    await action();

    // The second argument to writeAuditLog is the db client
    const auditCall = mockWriteAuditLog.mock.calls[0];
    const auditReceivedDb = auditCall[1];

    expect(auditReceivedDb).toBe(fnReceivedDb); // same object reference
    expect(auditReceivedDb).toBe(FAKE_TX);       // and it is the tx client, not global prisma
  });
});

// ─── Station scope ────────────────────────────────────────────────────────────

describe("withMutation — station scope", () => {
  it("passes targetStationId from getStationId to requireWriteAccess", async () => {
    const fn = vi.fn().mockResolvedValue({ id: "r-1" });
    const action = withMutation(
      {
        entityType: "PumpReading",
        action: "CREATE",
        getStationId: (data: { stationId: string }) => data.stationId,
      },
      fn
    );

    await action({ stationId: "station-accra-001" });
    expect(mockRequireWriteAccess).toHaveBeenCalledWith(
      MOCK_SESSION,
      { targetStationId: "station-accra-001" }
    );
  });

  it("passes stationId to writeAuditLog", async () => {
    const fn = vi.fn().mockResolvedValue({ id: "r-1" });
    const action = withMutation(
      {
        entityType: "PumpReading",
        action: "CREATE",
        getStationId: (data: { stationId: string }) => data.stationId,
      },
      fn
    );
    await action({ stationId: "station-accra-001" });

    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ stationId: "station-accra-001" }),
      FAKE_TX
    );
  });
});

// ─── withApproval ─────────────────────────────────────────────────────────────

describe("withApproval", () => {
  it("calls requireApproveAccess instead of requireWriteAccess", async () => {
    const fn = vi.fn().mockResolvedValue({ id: "session-1" });
    const action = withApproval(
      { entityType: "DailySession", action: "APPROVE", getEntityId: (r: { id: string }) => r.id },
      fn
    );
    await action();

    expect(mockRequireApproveAccess).toHaveBeenCalledOnce();
    expect(mockRequireWriteAccess).not.toHaveBeenCalled();
  });

  it("runs fn + writeAuditLog inside $transaction", async () => {
    const fn = vi.fn().mockResolvedValue({ id: "session-1" });
    const action = withApproval(
      { entityType: "DailySession", action: "APPROVE", getEntityId: (r: { id: string }) => r.id },
      fn
    );
    await action();

    expect(mockTransaction).toHaveBeenCalledOnce();
    expect(fn).toHaveBeenCalledOnce();
    expect(mockWriteAuditLog).toHaveBeenCalledOnce();
  });

  it("passes (session, db, ...args) to fn", async () => {
    const fn = vi.fn().mockResolvedValue({ id: "s-1" });
    const action = withApproval({ entityType: "DailySession", action: "APPROVE" }, fn);
    await action("session-id-001");

    expect(fn).toHaveBeenCalledWith(MOCK_SESSION, FAKE_TX, "session-id-001");
  });

  it("does not open $transaction when access is denied", async () => {
    mockRequireApproveAccess.mockRejectedValueOnce(
      new AccessDeniedError("Role 'SUPERVISOR' does not have approve access")
    );
    const fn = vi.fn().mockResolvedValue({});
    const action = withApproval({ entityType: "DailySession", action: "APPROVE" }, fn);

    await expect(action()).rejects.toThrow("SUPERVISOR");
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(fn).not.toHaveBeenCalled();
    expect(mockWriteAuditLog).not.toHaveBeenCalled();
  });

  it("writeAuditLog receives same db as fn", async () => {
    let fnReceivedDb: unknown;
    const fn = vi.fn().mockImplementation(async (_session: unknown, db: unknown) => {
      fnReceivedDb = db;
      return { id: "s-1" };
    });
    const action = withApproval(
      { entityType: "DailySession", action: "APPROVE", getEntityId: (r: { id: string }) => r.id },
      fn
    );
    await action();

    const auditReceivedDb = mockWriteAuditLog.mock.calls[0][1];
    expect(auditReceivedDb).toBe(fnReceivedDb);
    expect(auditReceivedDb).toBe(FAKE_TX);
  });

  it("propagates error and does not write audit when fn throws", async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error("lock contention"));
    const action = withApproval({ entityType: "DailySession", action: "APPROVE" }, fn);

    await expect(action()).rejects.toThrow("lock contention");
    expect(mockWriteAuditLog).not.toHaveBeenCalled();
  });
});

// ─── before/after snapshot wiring ────────────────────────────────────────────

describe("withMutation — before/after snapshots", () => {
  it("wires getBefore and getAfter into the audit log", async () => {
    const before = { litres: 100 };
    const after = { litres: 120 };
    const fn = vi.fn().mockResolvedValue(after);

    const action = withMutation(
      {
        entityType: "PumpReading",
        action: "UPDATE",
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        getEntityId: (_result: typeof after) => "r-1",
        getBefore: (data: typeof before) => data,
        getAfter: (r: typeof after) => r,
      },
      fn
    );
    await action(before);

    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ before, after }),
      FAKE_TX
    );
  });

  it("sends null before/after when extractors are not provided", async () => {
    const fn = vi.fn().mockResolvedValue({ id: "r-1" });
    const action = withMutation({ entityType: "PumpReading", action: "DELETE" }, fn);
    await action();

    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ before: null, after: null }),
      FAKE_TX
    );
  });
});
