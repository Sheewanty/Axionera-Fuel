/**
 * Edge-safe Auth.js v5 configuration.
 *
 * This file must not import Prisma, bcryptjs, or Node.js-only modules.
 * Fine-grained role and access checks still run in Server Components and
 * Server Actions; the proxy only separates authenticated tenant users from
 * platform super admins at the route boundary.
 */
import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
  },

  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isLoginPage = nextUrl.pathname === "/login";
      const isPlatformRoute = nextUrl.pathname.startsWith("/platform");
      const isSuperAdmin = auth?.user?.role === "SUPER_ADMIN";

      if (isLoggedIn && isLoginPage) {
        return Response.redirect(new URL(isSuperAdmin ? "/platform/tenants" : "/command-center", nextUrl));
      }

      if (!isLoggedIn && !isLoginPage) {
        return false;
      }

      if (isLoggedIn && !isLoginPage && isSuperAdmin && !isPlatformRoute) {
        return Response.redirect(new URL("/platform/tenants", nextUrl));
      }

      if (isLoggedIn && !isLoginPage && !isSuperAdmin && isPlatformRoute) {
        return Response.redirect(new URL("/command-center", nextUrl));
      }

      return true;
    },
  },

  providers: [],
};
