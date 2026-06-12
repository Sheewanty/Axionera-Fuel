import PageTitle from "@/components/ui/PageTitle";
import { getRequiredSession, requireRole } from "@/lib/session";

export default async function IntegrationsPage() {
  const session = await getRequiredSession();

  requireRole(session, ["OWNER", "ADMIN", "AUDITOR"]);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <PageTitle
        eyebrow="Administration"
        title="Integrations"
        subtitle="Manage API connections and external service integrations."
      />

      <div className="dash-panel">
        <div className="dash-panel-head">
          <h2 className="dash-panel-title">Connected Services</h2>
        </div>
        <div className="p-10 text-center">
          <div className="text-4xl mb-4 text-gold">API</div>
          <h3 className="text-lg font-semibold mb-2">No integrations configured</h3>
          <p className="text-sm text-muted max-w-md mx-auto">
            API keys, webhook endpoints, and third-party service connections
            will appear here once available. This feature is coming in a future
            release.
          </p>
        </div>
      </div>

      <div className="dash-panel">
        <div className="dash-panel-head">
          <h2 className="dash-panel-title">API Access</h2>
        </div>
        <div className="p-6 text-muted text-sm">
          API key management and usage monitoring will be available in a future
          release. Contact support if you need programmatic access to your data.
        </div>
      </div>
    </div>
  );
}
