import PageTitle from "@/components/ui/PageTitle";
import { getRequiredSession, requireSuperAdmin } from "@/lib/session";
import PlatformTenantsClient from "../tenants/PlatformTenantsClient";
import { getPlatformTenantRows } from "../_components/tenant-data";

export default async function PlatformSubscriptionsPage() {
  const session = await getRequiredSession();
  requireSuperAdmin(session);
  const tenants = await getPlatformTenantRows();

  return (
    <>
      <PageTitle
        eyebrow="Super Admin"
        title="Subscriptions"
        subtitle="Create tenants, manage subscription status, and enforce package limits."
      />
      <PlatformTenantsClient tenants={tenants} />
    </>
  );
}
