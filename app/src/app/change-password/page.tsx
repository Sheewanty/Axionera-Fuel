import { changePasswordAction } from "@/lib/actions/change-password.actions";
import { getRequiredSession } from "@/lib/session";

type SearchParams = Promise<{ error?: string }>;

export default async function ChangePasswordPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getRequiredSession();
  const params = await searchParams;
  const error = params.error ? decodeURIComponent(params.error) : null;

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "var(--ax-slate-50)",
        padding: 24,
      }}
    >
      <section
        style={{
          width: "min(520px, 100%)",
          background: "white",
          border: "1px solid var(--ax-border)",
          borderRadius: 8,
          padding: 28,
        }}
      >
        <div className="page-eyebrow">Security</div>
        <h1 className="page-title" style={{ marginBottom: 6 }}>Change Password</h1>
        <p style={{ color: "var(--ax-muted)", marginBottom: 20 }}>
          {session.user.forcePasswordChange
            ? "Your account is using a temporary password. Set a new password before continuing."
            : "Update your password."}
        </p>

        {error && (
          <div
            role="alert"
            style={{
              background: "color-mix(in srgb, var(--ax-red) 7%, white)",
              border: "1px solid color-mix(in srgb, var(--ax-red) 30%, white)",
              borderRadius: 8,
              color: "var(--ax-red)",
              marginBottom: 16,
              padding: "10px 12px",
            }}
          >
            {error}
          </div>
        )}

        <form action={changePasswordAction} className="space-y-4">
          <label className="form-group" style={{ display: "block" }}>
            <span className="form-label">Current Password</span>
            <input className="form-input" name="currentPassword" type="password" autoComplete="current-password" required />
          </label>
          <label className="form-group" style={{ display: "block" }}>
            <span className="form-label">New Password</span>
            <input className="form-input" name="newPassword" type="password" minLength={8} autoComplete="new-password" required />
          </label>
          <label className="form-group" style={{ display: "block" }}>
            <span className="form-label">Confirm New Password</span>
            <input className="form-input" name="confirmPassword" type="password" minLength={8} autoComplete="new-password" required />
          </label>
          <button className="btn btn-primary" type="submit" style={{ width: "100%" }}>
            Save New Password
          </button>
        </form>
      </section>
    </main>
  );
}
