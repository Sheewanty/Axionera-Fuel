/**
 * Login page — Server Component with a Server Action form handler.
 *
 * Security design:
 *  - Generic error message: never reveals which field (email vs password) is wrong
 *  - Redis-backed rate limiter (Upstash): max 5 attempts per IP per 15-min sliding window
 *    dev/test: in-memory fallback | production: Upstash (fail closed if not configured)
 *  - bcrypt.compare in auth.ts already runs in constant time
 *  - CSRF protection handled by Auth.js v5 automatically
 *  - Error state passed via redirect search param (no client-side state)
 */
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { signIn } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { Fuel } from "lucide-react";

function isNextRedirectError(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("digest" in error)) return false;
  return String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT");
}

// ─── Server Action ────────────────────────────────────────────────────────────

async function handleLogin(formData: FormData) {
  "use server";

  // Rate limit check — uses Upstash Redis in production, in-memory fallback in dev
  const headersList = await headers();
  const ip =
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headersList.get("x-real-ip") ??
    "unknown";

  const { allowed } = await checkRateLimit(ip);
  if (!allowed) {
    redirect("/login?error=TooManyRequests");
    return;
  }

  const email = formData.get("email");
  const password = formData.get("password");

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/post-login",
    });
  } catch (error) {
    // Re-throw anything that is NOT an AuthError.
    // This includes Next.js internal redirect errors thrown by signIn() on
    // success (their exact message format varies across Next.js versions, so
    // string-matching is fragile). Non-AuthError exceptions bubble to Next.js,
    // which handles redirects correctly and shows the error boundary for truly
    // unexpected crashes.
    if (isNextRedirectError(error)) throw error;

    // All AuthError subtypes (CredentialsSignin, AccessDenied, etc.) map to
    // the same generic message — never reveal which field was wrong.
    if (error instanceof AuthError) {
      redirect("/login?error=InvalidCredentials");
    }

    console.error("Login server error", error);
    redirect("/login?error=ServerError");
  }
}

// ─── Error message map ────────────────────────────────────────────────────────

const ERROR_MESSAGES: Record<string, string> = {
  InvalidCredentials: "Invalid email or password. Please try again.",
  TooManyRequests:
    "Too many login attempts. Please wait 15 minutes before trying again.",
  ServerError: "A server error occurred. Please try again later.",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

interface LoginPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error } = await searchParams;
  const errorMessage = error ? (ERROR_MESSAGES[error] ?? ERROR_MESSAGES.ServerError) : null;

  return (
    <div className="login-shell">
      <div className="login-card">
        {/* Logo */}
        <div className="login-logo" aria-label="FuelStation OS">
          <Fuel size={28} strokeWidth={1.5} />
        </div>

        <div className="login-eyebrow">GOIL Ghana Ltd</div>
        <h1 className="login-title">FuelStation OS</h1>
        <p className="login-sub">Sign in to continue</p>

        {/* Error banner */}
        {errorMessage && (
          <div className="login-error" role="alert" aria-live="polite">
            {errorMessage}
          </div>
        )}

        {/* Login form */}
        <form action={handleLogin} className="login-form" noValidate>
          <div className="form-group">
            <label htmlFor="login-email" className="form-label">
              Email address
            </label>
            <input
              id="login-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="form-input"
              placeholder="you@goil.com.gh"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="login-password" className="form-label">
              Password
            </label>
            <input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="form-input"
              placeholder="••••••••"
            />
          </div>

          <button type="submit" className="btn btn-primary login-submit" id="btn-login">
            Sign in
          </button>
        </form>

        {/* Dev hint */}
        {process.env.NODE_ENV === "development" && (
          <p className="login-dev-hint">
            Demo: <code>kwame.mensah@goil.com.gh</code> / <code>goil1234</code>
          </p>
        )}
      </div>
    </div>
  );
}
