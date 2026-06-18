import PageTitle from "@/components/ui/PageTitle";
import { getRequiredSession, requireSuperAdmin } from "@/lib/session";
import PlatformTenantsClient from "./tenants/PlatformTenantsClient";
import { getPlatformTenantRows } from "./_components/tenant-data";

export default async function PlatformDashboardPage() {
  const session = await getRequiredSession();
  requireSuperAdmin(session);
  const tenants = await getPlatformTenantRows();

  return (
    <>
      <PageTitle
        eyebrow="Super Admin"
        title="Global Dashboard"
        subtitle="All tenant subscriptions, usage, and package controls."
      />
      <PlatformTenantsClient tenants={tenants} />
    </>
  );
}
