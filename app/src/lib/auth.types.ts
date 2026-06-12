/**
 * Module augmentation for Auth.js v5 (next-auth@5 / @auth/core).
 *
 * In Auth.js v5, the JWT type lives in "@auth/core/jwt" and the Session/User
 * types live in "next-auth". The augmentation paths differ from v4.
 *
 * Fields added to the session:
 *   id                  — User.id (cuid)
 *   tenantId            — The tenant this session belongs to
 *   role                — The user's role in that tenant (from Membership.role)
 *   membershipStationId — Membership.stationId; "" = tenant-wide role
 *   activeStationId     — Currently selected station; null = not yet selected.
 *                         For OWNER/ADMIN this may differ from membershipStationId
 *                         when station-switching is added (M3).
 */

import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      tenantId: string;
      role: string;
      membershipStationId: string; // "" = tenant-wide
      activeStationId: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    tenantId: string;
    role: string;
    membershipStationId: string;
    activeStationId: string | null;
  }
}

// Auth.js v5: JWT augmentation is on "@auth/core/jwt", not "next-auth/jwt"
declare module "@auth/core/jwt" {
  interface JWT {
    userId: string;
    tenantId: string;
    role: string;
    membershipStationId: string;
    activeStationId: string | null;
  }
}
