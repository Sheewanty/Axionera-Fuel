import PageTitle from "@/components/ui/PageTitle";
import { getRequiredSession, requireRole } from "@/lib/session";
import { prisma } from "@/lib/db/prisma";
import { formatDisplayDate } from "@/lib/business-date";

export default async function SubscriptionPage() {
  const session = await getRequiredSession();

  // ADMIN sees the nav link as explicit_grant, but the server fails closed
  // until PermissionGrant exists.
  requireRole(session, ["OWNER"]);

  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { id: session.user.tenantId },
  });

  const statusClass: Record<string, string> = {
    TRIAL: "status-badge open",
    ACTIVE: "status-badge approved",
    SUSPENDED: "status-badge reopened",
    CANCELLED: "status-badge",
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <PageTitle
        eyebrow="Administration"
        title="Subscription"
        subtitle="View your organization's subscription and billing details."
      />

      <div className="dash-panel">
        <div className="dash-panel-head">
          <h2 className="dash-panel-title">Subscription Details</h2>
        </div>

        <div className="p-6">
          <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            <div className="kpi-card">
              <div className="page-section-label">Organization</div>
              <div className="text-xl font-semibold mt-1">{tenant.name}</div>
            </div>

            <div className="kpi-card">
              <div className="page-section-label">Status</div>
              <div className="mt-2">
                <span className={statusClass[tenant.subscriptionStatus] ?? "status-badge"}>
                  {tenant.subscriptionStatus}
                </span>
              </div>
            </div>

            <div className="kpi-card">
              <div className="page-section-label">Billing Email</div>
              <div className="text-base mt-1">
                {tenant.billingEmail ?? <span className="text-muted italic">Not set</span>}
              </div>
            </div>

            <div className="kpi-card">
              <div className="page-section-label">Account Created</div>
              <div className="text-base mt-1">
                {formatDisplayDate(tenant.createdAt)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="dash-panel">
        <div className="dash-panel-head">
          <h2 className="dash-panel-title">Plan &amp; Usage</h2>
        </div>
        <div className="p-6 text-muted text-sm">
          Plan management and usage metrics will be available in a future release.
          Contact support to change your subscription plan.
        </div>
      </div>
    </div>
  );
}
