import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { signOut } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { getRequiredSession } from "@/lib/session";

type SearchParams = Promise<{ error?: string }>;

async function changePasswordAction(formData: FormData) {
  "use server";

  const session = await getRequiredSession();
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (newPassword.length < 8) {
    redirect("/change-password?error=New%20password%20must%20be%20at%20least%208%20characters.");
  }

  if (newPassword !== confirmPassword) {
    redirect("/change-password?error=New%20password%20and%20confirmation%20do%20not%20match.");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, passwordHash: true },
  });

  if (!user?.passwordHash) {
    redirect("/change-password?error=Your%20account%20does%20not%20have%20a%20password%20configured.");
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    redirect("/change-password?error=Current%20password%20is%20incorrect.");
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      forcePasswordChange: false,
    },
  });

  await signOut({ redirectTo: "/login?changed=1" });
}

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
