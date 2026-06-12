/**
 * Unit tests for session helpers.
 *
 * Tests cover:
 *  - requireRole: allowed and blocked role scenarios
 *  - canWrite / canApprove: role permission maps
 *  - requireAccess: access level enforcement
 *  - explicit_grant: visible in nav but not writable
 *  - requireWriteAccess / requireApproveAccess: logic (DB re-check mocked)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Module mocks (must be before any imports that trigger side effects) ───────
// session.ts imports 'next/navigation' (redirect) and '@/lib/auth' (auth).
// Both require the Next.js runtime — mock them for the Vitest environment.
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue(null),
  signOut: vi.fn(),
}));

import {
  requireRole,
  canWrite,
  canApprove,
  requireAccess,
  AccessDeniedError,
  type AuthSession,
} from "@/lib/session";

// ─── Mock verifyMembershipFresh (avoids Prisma in unit tests) ────────────────
vi.mock("@/lib/db/membership.service", () => ({
  verifyMembershipFresh: vi.fn().mockResolvedValue({
    id: "mem-1",
    tenantId: "tenant-goil",
    userId: "user-1",
    stationId: "",
    role: "OWNER",
  }),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

function makeSession(role: string, membershipStationId = ""): AuthSession {
  return {
    user: {
      id: "user-1",
      tenantId: "tenant-goil",
      role,
      membershipStationId,
      activeStationId: null,
      name: "Test User",
      email: "test@goil.com.gh",
    },
    expires: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  } as AuthSession;
}

// ─── requireRole ─────────────────────────────────────────────────────────────

describe("requireRole", () => {
  it("passes when session role is in allowed list", () => {
    const session = makeSession("OWNER");
    expect(() => requireRole(session, ["OWNER", "ADMIN"])).not.toThrow();
  });

  it("throws AccessDeniedError when role is not allowed", () => {
    const session = makeSession("ATTENDANT");
    expect(() => requireRole(session, ["OWNER", "ADMIN"])).toThrow(AccessDeniedError);
  });

  it("passes for ADMIN when ADMIN is in allowed list", () => {
    const session = makeSession("ADMIN");
    expect(() => requireRole(session, ["OWNER", "ADMIN"])).not.toThrow();
  });

  it("throws for AUDITOR accessing OWNER-only route", () => {
    const session = makeSession("AUDITOR");
    expect(() => requireRole(session, ["OWNER"])).toThrow(AccessDeniedError);
  });

  it("passes for STATION_MANAGER accessing manager-level route", () => {
    const session = makeSession("STATION_MANAGER");
    expect(() =>
      requireRole(session, ["OWNER", "ADMIN", "STATION_MANAGER"])
    ).not.toThrow();
  });
});

// ─── canWrite / canApprove ───────────────────────────────────────────────────

describe("canWrite", () => {
  it.each(["OWNER", "ADMIN", "STATION_MANAGER", "SUPERVISOR", "ATTENDANT"])(
    "%s can write",
    (role) => {
      expect(canWrite(role)).toBe(true);
    }
  );

  it.each(["ACCOUNTANT", "AUDITOR"])(
    "%s cannot write",
    (role) => {
      expect(canWrite(role)).toBe(false);
    }
  );
});

describe("canApprove", () => {
  it.each(["OWNER", "ADMIN", "STATION_MANAGER"])("%s can approve", (role) => {
    expect(canApprove(role)).toBe(true);
  });

  it.each(["SUPERVISOR", "ATTENDANT", "ACCOUNTANT", "AUDITOR"])(
    "%s cannot approve",
    (role) => {
      expect(canApprove(role)).toBe(false);
    }
  );
});

// ─── requireAccess ───────────────────────────────────────────────────────────

describe("requireAccess", () => {
  it("OWNER passes full-access requirement", () => {
    expect(() => requireAccess(makeSession("OWNER"), "full")).not.toThrow();
  });

  it("ATTENDANT fails full-access requirement", () => {
    expect(() => requireAccess(makeSession("ATTENDANT"), "full")).toThrow(
      AccessDeniedError
    );
  });

  it("ATTENDANT passes entry-level access", () => {
    expect(() => requireAccess(makeSession("ATTENDANT"), "entry")).not.toThrow();
  });

  it("AUDITOR fails entry-level access (read-only role)", () => {
    expect(() => requireAccess(makeSession("AUDITOR"), "entry")).toThrow(
      AccessDeniedError
    );
  });

  it("AUDITOR passes view-level — view does not require write role", () => {
    // requireAccess("view") only checks approve/write for 'full' level
    // For non-full, any non-write role passes through (nav-config handles visibility)
    // AUDITOR: canWrite = false, but "view" doesn't need write → should pass
    // NOTE: with current implementation, view != entry check. Let's verify.
    // The current requireAccess logic: only "full" triggers approve check; otherwise write check.
    // For "view" level we should NOT require write — adjust expectation accordingly.
    // As designed: view/explicit_grant are UI-only; requireAccess only called for write ops.
    expect(() => requireAccess(makeSession("AUDITOR"), "view")).not.toThrow();
  });

  it("ACCOUNTANT fails entry-level (cannot enter pump readings)", () => {
    expect(() => requireAccess(makeSession("ACCOUNTANT"), "entry")).toThrow(
      AccessDeniedError
    );
  });
});

// ─── explicit_grant semantics ─────────────────────────────────────────────────

describe("explicit_grant access level", () => {
  it("ACCOUNTANT with explicit_grant on nav config cannot write records", () => {
    // explicit_grant gives nav visibility, NOT write access.
    // Calling requireAccess with "entry" must still throw for ACCOUNTANT.
    expect(() => requireAccess(makeSession("ACCOUNTANT"), "entry")).toThrow(
      AccessDeniedError
    );
  });

  it("canWrite returns false for AUDITOR regardless of explicit_grant on nav", () => {
    expect(canWrite("AUDITOR")).toBe(false);
  });

  it("requireAccess fails closed for explicit_grant until PermissionGrant exists", () => {
    expect(() => requireAccess(makeSession("ADMIN"), "explicit_grant")).toThrow(
      AccessDeniedError
    );
  });
});

// ─── requireWriteAccess / requireApproveAccess ───────────────────────────────

import { requireWriteAccess, requireApproveAccess } from "@/lib/session";
import { verifyMembershipFresh } from "@/lib/db/membership.service";

describe("requireWriteAccess", () => {
  it("passes for OWNER with valid DB membership", async () => {
    const session = makeSession("OWNER");
    await expect(requireWriteAccess(session)).resolves.toBeUndefined();
  });

  it("throws AccessDeniedError for AUDITOR (not in WRITE_ROLES)", async () => {
    const session = makeSession("AUDITOR");
    await expect(requireWriteAccess(session)).rejects.toThrow(AccessDeniedError);
  });

  it("throws if DB returns null (membership revoked)", async () => {
    vi.mocked(verifyMembershipFresh).mockResolvedValueOnce(null);
    const session = makeSession("OWNER");
    await expect(requireWriteAccess(session)).rejects.toThrow(AccessDeniedError);
  });

  it("throws if targetStationId is sentinel empty string", async () => {
    const session = makeSession("OWNER");
    await expect(
      requireWriteAccess(session, { targetStationId: "" })
    ).rejects.toThrow("Sentinel");
  });

  it("passes for station-scoped SUPERVISOR accessing own station", async () => {
    vi.mocked(verifyMembershipFresh).mockResolvedValueOnce({
      id: "mem-2",
      tenantId: "tenant-goil",
      userId: "user-sup",
      stationId: "station-accra",
      role: "SUPERVISOR",
    });
    const session = makeSession("SUPERVISOR", "station-accra");
    await expect(
      requireWriteAccess(session, { targetStationId: "station-accra" })
    ).resolves.toBeUndefined();
  });

  it("throws for station-scoped SUPERVISOR accessing different station", async () => {
    vi.mocked(verifyMembershipFresh).mockResolvedValueOnce({
      id: "mem-2",
      tenantId: "tenant-goil",
      userId: "user-sup",
      stationId: "station-accra",
      role: "SUPERVISOR",
    });
    const session = makeSession("SUPERVISOR", "station-accra");
    await expect(
      requireWriteAccess(session, { targetStationId: "station-kumasi" })
    ).rejects.toThrow(AccessDeniedError);
  });
});

describe("requireApproveAccess", () => {
  it("passes for STATION_MANAGER", async () => {
    vi.mocked(verifyMembershipFresh).mockResolvedValueOnce({
      id: "mem-3",
      tenantId: "tenant-goil",
      userId: "user-sm",
      stationId: "station-accra",
      role: "STATION_MANAGER",
    });
    const session = makeSession("STATION_MANAGER", "station-accra");
    await expect(requireApproveAccess(session)).resolves.toBeUndefined();
  });

  it("throws for SUPERVISOR (cannot approve)", async () => {
    const session = makeSession("SUPERVISOR", "station-accra");
    await expect(requireApproveAccess(session)).rejects.toThrow(AccessDeniedError);
  });
});
