/**
 * Full Auth.js v5 configuration — Node.js only.
 *
 * DO NOT import this file in middleware.ts (Edge runtime).
 * Use auth.config.ts for the middleware instead.
 *
 * This file uses Prisma and bcryptjs, both of which require Node.js APIs.
 */
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { authConfig } from "@/lib/auth.config";
import { prisma } from "@/lib/db/prisma";
import "@/lib/auth.types"; // ensure module augmentation is applied

// ─── Timing-safe dummy hash ────────────────────────────────────────────────────
// When a user is not found, we still run bcrypt.compare() against this dummy
// hash to prevent timing-oracle attacks (attacker cannot distinguish
// "user not found" from "wrong password" via response time).
const DUMMY_HASH =
  "$2b$10$X9oHQ6dHYwFzFzFzFzFzFuOoOoOoOoOoOoOoOoOoOoOoOoOoOoOo";




export const { handlers, auth, signIn, signOut, unstable_update: updateSession } = NextAuth({
  ...authConfig,

  adapter: PrismaAdapter(prisma),

  session: {
    strategy: "jwt",
    maxAge: 30 * 60, // 30 minutes — short enough to limit stale-role window
  },

  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "you@example.com" },
        password: { label: "Password", type: "password" },
      },

      async authorize(credentials) {
        const email =
          typeof credentials?.email === "string" ? credentials.email.trim().toLowerCase() : null;
        const password =
          typeof credentials?.password === "string" ? credentials.password : null;

        if (!email || !password) return null;

        // 1. Look up the user
        const user = await prisma.user.findUnique({
          where: { email },
        });

        // 2. Always run bcrypt (prevents timing oracle even when user not found)
        const hashToCheck = user?.passwordHash ?? DUMMY_HASH;
        const isValid = await bcrypt.compare(password, hashToCheck);

        if (!user || !isValid || user.status.toUpperCase() !== "ACTIVE") {
          // Return null → NextAuth maps this to a CredentialsSignin error
          // The login page renders a generic message; we never expose which check failed.
          return null;
        }

        if (user.isSuperAdmin) {
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            tenantId: "",
            role: "SUPER_ADMIN",
            membershipStationId: "",
            activeStationId: null,
            forcePasswordChange: user.forcePasswordChange,
          };
        }

        // 3. Find the user's primary membership (tenant-wide first, then station-scoped)
        const membership = await prisma.membership.findFirst({
          where: { userId: user.id },
          orderBy: { stationId: "asc" }, // "" sorts first (tenant-wide roles take priority)
        });

        if (!membership) return null;

        const tenant = await prisma.tenant.findUnique({
          where: { id: membership.tenantId },
          select: { subscriptionStatus: true },
        });
        const subscriptionStatus = tenant?.subscriptionStatus.toUpperCase();
        if (!tenant || subscriptionStatus === "SUSPENDED" || subscriptionStatus === "CANCELLED") {
          return null;
        }

        // 4. Determine activeStationId:
        //    - Tenant-wide roles start with null (station selector shown in M3)
        //    - Station-scoped roles use their fixed station
        const activeStationId: string | null =
          membership.stationId === "" ? null : membership.stationId;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          tenantId: membership.tenantId,
          role: membership.role,
          membershipStationId: membership.stationId,
          activeStationId,
          forcePasswordChange: user.forcePasswordChange,
        };
      },
    }),
  ],

  callbacks: {
    // Merge the authorized callback from authConfig (runs in middleware)
    ...authConfig.callbacks,

    jwt({ token, user, trigger, session }) {
      // `user` is only defined on the initial sign-in
      if (user) {
        token.userId = user.id!;
        token.tenantId = user.tenantId;
        token.role = user.role;
        token.membershipStationId = user.membershipStationId;
        token.activeStationId = user.activeStationId;
        token.forcePasswordChange = user.forcePasswordChange;
      }
      if (trigger === "update") {
        const update = session as { user?: { forcePasswordChange?: unknown }; forcePasswordChange?: unknown } | undefined;
        const forcePasswordChange = update?.user?.forcePasswordChange ?? update?.forcePasswordChange;
        if (typeof forcePasswordChange === "boolean") {
          token.forcePasswordChange = forcePasswordChange;
        }
      }
      return token;
    },

    session({ session, token }) {
      // Explicit casts are required here because next-auth v5 beta types
      // the token as Record<string, unknown> in the session callback context,
      // even when @auth/core/jwt augmentation is applied in a separate file.
      session.user.id = token.userId as string;
      session.user.tenantId = token.tenantId as string;
      session.user.role = token.role as string;
      session.user.membershipStationId = token.membershipStationId as string;
      session.user.activeStationId = token.activeStationId as string | null;
      session.user.forcePasswordChange = Boolean(token.forcePasswordChange);
      return session;
    },
  },
});
