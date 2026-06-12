/**
 * Edge-safe Auth.js v5 configuration.
 *
 * This file MUST NOT import Prisma, bcryptjs, or any Node.js-only module.
 * It is bundled into the Edge runtime by the Next.js proxy (proxy.ts).
 *
 * The `authorized` callback is the ONLY auth logic that runs in the proxy.
 * It performs a single check: is the user authenticated?
 * Fine-grained role/access checks run in Server Components and Server Actions.
 */
import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
  },

  callbacks: {
    /**
     * Runs on every request that matches the proxy matcher.
     * Returns true  → allow
     * Returns false → redirect to /login (NextAuth default)
     * Returns Response → custom redirect
     */
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isLoginPage = nextUrl.pathname === "/login";

      // Already logged in and trying to access /login → redirect to dashboard
      if (isLoggedIn && isLoginPage) {
        return Response.redirect(new URL("/command-center", nextUrl));
      }

      // Not logged in and not on the login page → deny (triggers redirect to /login)
      if (!isLoggedIn && !isLoginPage) {
        return false;
      }

      return true;
    },
  },

  // providers array is required by the type but populated in auth.ts
  providers: [],
};
