/**
 * Edge-safe Auth.js v5 configuration.
 *
 * This file must not import Prisma, bcryptjs, or Node.js-only modules.
 * Fine-grained role and access checks still run in Server Components and
 * Server Actions; the proxy only separates authenticated tenant users from
 * platform super admins at the route boundary.
 */
import type { NextAuthConfig } from "next-auth";
import "@/lib/auth.types";

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
  },

  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isLoginPage = nextUrl.pathname === "/login";
      const isChangePasswordPage = nextUrl.pathname === "/change-password";
      const isPlatformRoute = nextUrl.pathname.startsWith("/platform");
      const isSuperAdmin = auth?.user?.role === "SUPER_ADMIN";
      const mustChangePassword = Boolean(auth?.user?.forcePasswordChange);

      if (isLoggedIn && isLoginPage) {
        return Response.redirect(new URL(mustChangePassword ? "/change-password" : isSuperAdmin ? "/platform" : "/command-center", nextUrl));
      }

      if (!isLoggedIn && !isLoginPage) {
        return false;
      }

      if (isLoggedIn && mustChangePassword && !isChangePasswordPage) {
        return Response.redirect(new URL("/change-password", nextUrl));
      }

      if (isLoggedIn && !mustChangePassword && isChangePasswordPage) {
        return Response.redirect(new URL(isSuperAdmin ? "/platform" : "/command-center", nextUrl));
      }

      if (isLoggedIn && !isLoginPage && !isChangePasswordPage && isSuperAdmin && !isPlatformRoute) {
        return Response.redirect(new URL("/platform", nextUrl));
      }

      if (isLoggedIn && !isLoginPage && !isChangePasswordPage && !isSuperAdmin && isPlatformRoute) {
        return Response.redirect(new URL("/command-center", nextUrl));
      }

      return true;
    },

    jwt({ token }) {
      return token;
    },

    session({ session, token }) {
      session.user.id = token.userId as string;
      session.user.tenantId = token.tenantId as string;
      session.user.role = token.role as string;
      session.user.membershipStationId = token.membershipStationId as string;
      session.user.activeStationId = token.activeStationId as string | null;
      session.user.forcePasswordChange = Boolean(token.forcePasswordChange);
      return session;
    },
  },

  providers: [],
};
