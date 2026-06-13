/**
 * Edge proxy — route guard for all FuelStation OS pages.
 *
 * Renamed from middleware.ts per the Next.js 16 convention change.
 * The file is named proxy.ts and must export a function named `proxy`.
 *
 * Uses auth.config.ts ONLY (no Prisma, no bcrypt, no Node.js-only APIs).
 * The `authorized` callback in auth.config.ts performs a single check:
 *   authenticated? → allow
 *   not authenticated? → redirect to /login
 *
 * Fine-grained role and access-level checks run AFTER this in:
 *   1. Server Components  — via getRequiredSession() + requireRole()
 *   2. Server Actions     — via requireWriteAccess() / requireApproveAccess()
 *   3. Service methods    — via assertStationAccess()
 */
import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

// Create the Auth.js handler scoped to the Edge-safe config.
// Destructure `auth` and re-export it as `proxy` per Next.js 16 convention.
const { auth: proxy } = NextAuth(authConfig);
export { proxy };

export const config = {
  /**
   * Matcher excludes:
   *   - Next.js internal routes (_next/*)
   *   - Static files (images, favicons, web manifests, etc.)
   *   - The auth API itself (/api/auth/*)
   *   - Health checks (/api/health)
   * Everything else (including /login itself) goes through the proxy
   * so that already-authenticated users visiting /login are redirected away.
   */
  matcher: [
    "/((?!api/auth|api/health|_next/static|_next/image|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|txt|xml|json|webmanifest)$).*)",
  ],
};
