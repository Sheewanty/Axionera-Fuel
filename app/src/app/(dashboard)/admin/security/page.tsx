import PageTitle from "@/components/ui/PageTitle";
import { getRequiredSession, requireRole } from "@/lib/session";

export default async function SecurityPage() {
  const session = await getRequiredSession();

  requireRole(session, ["OWNER", "ADMIN", "AUDITOR"]);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <PageTitle
        eyebrow="Administration"
        title="Security"
        subtitle="Authentication, sessions, and access control settings."
      />

      <div className="dash-panel">
        <div className="dash-panel-head">
          <h2 className="dash-panel-title">Current Session</h2>
        </div>
        <div className="p-6">
          <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            <div className="kpi-card">
              <div className="page-section-label">Signed In As</div>
              <div className="text-base font-semibold mt-1">
                {session.user.name ?? "-"}
              </div>
              <div className="text-sm text-muted mt-0.5">
                {session.user.email ?? "-"}
              </div>
            </div>

            <div className="kpi-card">
              <div className="page-section-label">Role</div>
              <div className="mt-2">
                <span className="status-badge ready">{session.user.role}</span>
              </div>
            </div>

            <div className="kpi-card">
              <div className="page-section-label">Auth Provider</div>
              <div className="text-base mt-1">Credentials</div>
            </div>
          </div>
        </div>
      </div>

      <div className="dash-panel">
        <div className="dash-panel-head">
          <h2 className="dash-panel-title">Password Policy</h2>
        </div>
        <div className="p-6 text-muted text-sm">
          Password complexity requirements, expiration rules, and rotation
          settings will be configurable in a future release.
        </div>
      </div>

      <div className="dash-panel">
        <div className="dash-panel-head">
          <h2 className="dash-panel-title">Two-Factor Authentication</h2>
        </div>
        <div className="p-6 text-muted text-sm">
          Organization-wide 2FA enforcement and per-user TOTP configuration
          will be available in a future release.
        </div>
      </div>

      <div className="dash-panel">
        <div className="dash-panel-head">
          <h2 className="dash-panel-title">Session Management</h2>
        </div>
        <div className="p-6 text-muted text-sm">
          Active session listing, forced logout, and session timeout configuration
          will be available in a future release.
        </div>
      </div>
    </div>
  );
}
