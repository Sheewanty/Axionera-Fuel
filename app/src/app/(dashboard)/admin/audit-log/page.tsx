import PageTitle from "@/components/ui/PageTitle";
import { getRequiredSession, requireRole } from "@/lib/session";
import { prisma } from "@/lib/db/prisma";

export default async function AuditLogPage() {
  const session = await getRequiredSession();

  // OWNER full, ADMIN full, ACCOUNTANT view, AUDITOR full
  requireRole(session, ["OWNER", "ADMIN", "ACCOUNTANT", "AUDITOR"]);

  const logs = await prisma.auditLog.findMany({
    where: {
      tenantId: session.user.tenantId,
      ...(session.user.membershipStationId === "" ? {} : { stationId: session.user.membershipStationId }),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      station: { select: { name: true } },
    },
  });

  // Pre-fetch actor names for display
  const actorIds = [...new Set(logs.map((l) => l.actorUserId))];
  const actors = await prisma.user.findMany({
    where: { id: { in: actorIds } },
    select: { id: true, name: true, email: true },
  });
  const actorMap = new Map(actors.map((a) => [a.id, a.name || a.email || a.id]));

  const actionStyles: Record<string, { background: string; color: string }> = {
    CREATE: { background: "rgba(21,128,61,0.1)", color: "var(--ax-green)" },
    UPDATE: { background: "rgba(22,39,80,0.08)", color: "var(--ax-blue)" },
    DELETE: { background: "rgba(185,28,28,0.1)", color: "var(--ax-red)" },
    APPROVE: { background: "rgba(217,119,6,0.1)", color: "var(--ax-amber)" },
    REOPEN: { background: "rgba(150,108,68,0.12)", color: "var(--ax-gold)" },
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <PageTitle
        eyebrow="Administration"
        title="Audit Log"
        subtitle="Recent activity across all stations (latest 50 entries)."
      />

      <div className="dash-panel">
        <div className="dash-panel-head">
          <h2 className="dash-panel-title">Recent Activity</h2>
          <div className="text-sm text-muted">
            {logs.length} {logs.length === 1 ? "entry" : "entries"}
          </div>
        </div>

        {logs.length === 0 ? (
          <div className="p-6 text-muted text-sm">
            No audit log entries found.
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Action</th>
                  <th>Entity Type</th>
                  <th>Entity ID</th>
                  <th>Station</th>
                  <th>Actor</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="whitespace-nowrap text-sm">
                      {log.createdAt.toLocaleString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                        hour12: false,
                      })}
                    </td>
                    <td>
                      <span className="status-badge" style={actionStyles[log.action]}>
                        {log.action}
                      </span>
                    </td>
                    <td className="text-sm font-medium">
                      {log.entityType}
                    </td>
                    <td className="text-sm text-muted font-mono">
                      {log.entityId.length > 12
                        ? `${log.entityId.slice(0, 12)}…`
                        : log.entityId}
                    </td>
                    <td className="text-sm">
                      {log.station?.name ?? (
                        <span className="text-muted">-</span>
                      )}
                    </td>
                    <td className="text-sm">
                      {actorMap.get(log.actorUserId) ?? log.actorUserId}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
