import { handlers } from "@/lib/auth";

/**
 * Auth.js v5 catch-all API route handler.
 * Mounts GET /api/auth/* and POST /api/auth/* endpoints:
 *   /api/auth/signin      — credential form submission
 *   /api/auth/signout     — sign out
 *   /api/auth/session     — session probe
 *   /api/auth/csrf        — CSRF token
 */
export const { GET, POST } = handlers;
