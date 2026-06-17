import PageTitle from "@/components/ui/PageTitle";
import { prisma } from "@/lib/db/prisma";
import { getRequiredSession, requireSuperAdmin } from "@/lib/session";
import PlatformTenantsClient from "./PlatformTenantsClient";

export default async function PlatformTenantsPage() {
  const session = await getRequiredSession();
  requireSuperAdmin(session);

  const tenants = await prisma.tenant.findMany({
    include: {
      _count: {
        select: {
          stations: true,
          memberships: true,
        },
      },
      stations: {
        select: {
          _count: {
            select: {
              tanks: true,
              pumps: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <>
      <PageTitle
        eyebrow="Super Admin"
        title="Companies"
        subtitle="Create tenants, manage subscription status, and enforce package limits."
      />
      <PlatformTenantsClient
        tenants={tenants.map((tenant) => ({
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          billingEmail: tenant.billingEmail,
          subscriptionStatus: tenant.subscriptionStatus,
          subscriptionPackage: tenant.subscriptionPackage,
          maxStations: tenant.maxStations,
          maxTanks: tenant.maxTanks,
          maxPumps: tenant.maxPumps,
          stationCount: tenant._count.stations,
          memberCount: tenant._count.memberships,
          tankCount: tenant.stations.reduce((sum, station) => sum + station._count.tanks, 0),
          pumpCount: tenant.stations.reduce((sum, station) => sum + station._count.pumps, 0),
        }))}
      />
    </>
  );
}
