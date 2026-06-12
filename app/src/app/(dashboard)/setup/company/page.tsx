import PageTitle from "@/components/ui/PageTitle";
import { getRequiredSession, requireRole } from "@/lib/session";
import { prisma } from "@/lib/db/prisma";

export default async function CompanyPage() {
  const session = await getRequiredSession();
  requireRole(session, ["OWNER", "ADMIN", "AUDITOR"]);

  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { id: session.user.tenantId },
  });

  const stationCount = await prisma.station.count({
    where: { tenantId: session.user.tenantId },
  });

  const memberCount = await prisma.membership.count({
    where: { tenantId: session.user.tenantId },
  });

  const statusLabel: Record<string, string> = {
    TRIAL: "Trial",
    ACTIVE: "Active",
    SUSPENDED: "Suspended",
    CANCELLED: "Cancelled",
  };

  return (
    <>
      <PageTitle
        eyebrow="Setup"
        title="Company Settings"
        subtitle={tenant.name}
      />

      {/* KPI summary */}
      <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
        <div className="kpi-card">
          <div className="kpi-label">Stations</div>
          <div className="kpi-value">{stationCount}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Team Members</div>
          <div className="kpi-value">{memberCount}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Subscription</div>
          <div className="kpi-value">
            <span className="status-badge" data-status={tenant.subscriptionStatus}>
              {statusLabel[tenant.subscriptionStatus] ?? tenant.subscriptionStatus}
            </span>
          </div>
        </div>
      </div>

      {/* Company details panel */}
      <div className="dash-panel">
        <div className="dash-panel-head">
          <div>
            <div className="dash-panel-title">Company Information</div>
          </div>
        </div>
        <div className="table-wrapper">
          <table className="data-table">
            <tbody>
              <tr>
                <td style={{ fontWeight: 600, width: "200px" }}>Company Name</td>
                <td>{tenant.name}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Slug</td>
                <td><code>{tenant.slug}</code></td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Subscription Status</td>
                <td>
                  <span className="status-badge" data-status={tenant.subscriptionStatus}>
                    {statusLabel[tenant.subscriptionStatus] ?? tenant.subscriptionStatus}
                  </span>
                </td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Billing Email</td>
                <td>{tenant.billingEmail ?? <span style={{ color: "var(--ax-muted)" }}>Not set</span>}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Created</td>
                <td>{tenant.createdAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Last Updated</td>
                <td>{tenant.updatedAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
