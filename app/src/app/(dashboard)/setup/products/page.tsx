import PageTitle from "@/components/ui/PageTitle";
import { getRequiredSession, requireRole, requireStationScope } from "@/lib/session";
import { prisma } from "@/lib/db/prisma";
import { resolveOrRedirectStation } from "@/lib/station-utils";
import { formatDisplayDate } from "@/lib/business-date";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ stationId?: string }>;
}) {
  const session = await getRequiredSession();
  requireRole(session, ["OWNER", "ADMIN", "STATION_MANAGER", "AUDITOR"]);

  const params = await searchParams;
  const stationId = await resolveOrRedirectStation(session, params.stationId, "/setup/products");

  if (!stationId) {
    return (
      <>
        <PageTitle eyebrow="Setup" title="Products & Prices" />
        <div className="dash-panel">
          <div style={{ padding: "2rem", textAlign: "center", color: "var(--ax-muted)" }}>
            No stations available for this account.
          </div>
        </div>
      </>
    );
  }
  requireStationScope(session, stationId);

  const station = await prisma.station.findFirst({
    where: { id: stationId, tenantId: session.user.tenantId },
  });

  const products = await prisma.product.findMany({
    where: { tenantId: session.user.tenantId },
    orderBy: { name: "asc" },
  });

  // Get the current (latest) price for each product at this station
  const currentPrices = await prisma.priceHistory.findMany({
    where: {
      tenantId: session.user.tenantId,
      stationId,
      effectiveTo: null, // current price has no end date
    },
    orderBy: { effectiveFrom: "desc" },
  });

  const priceMap = new Map(
    currentPrices.map((p) => [p.productId, p])
  );

  const categoryLabel: Record<string, string> = {
    FUEL: "Fuel",
    LUBRICANT: "Lubricant",
    OTHER: "Other",
  };

  return (
    <>
      <PageTitle
        eyebrow="Setup"
        title="Products & Prices"
        subtitle={station ? `${station.name} · ${products.length} product${products.length !== 1 ? "s" : ""}` : undefined}
      />

      <div className="dash-panel">
        <div className="dash-panel-head">
          <div>
            <div className="dash-panel-title">Product Catalogue</div>
          </div>
        </div>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Product Name</th>
                <th>Category</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Current Price / Litre</th>
                <th>Price Effective From</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "2rem", color: "var(--ax-muted)" }}>
                    No products configured yet.
                  </td>
                </tr>
              ) : (
                products.map((product) => {
                  const price = priceMap.get(product.id);
                  return (
                    <tr key={product.id}>
                      <td style={{ fontWeight: 600 }}>{product.name}</td>
                      <td>
                        <span className="status-badge" data-status={product.category}>
                          {categoryLabel[product.category] ?? product.category}
                        </span>
                      </td>
                      <td>
                        <span className="status-badge" data-status={product.isActive ? "ACTIVE" : "INACTIVE"}>
                          {product.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                        {price
                          ? `GHS ${Number(price.pricePerLitre).toFixed(2)}`
                          : <span style={{ color: "var(--ax-muted)" }}>No price set</span>}
                      </td>
                      <td>
                        {price
                          ? formatDisplayDate(price.effectiveFrom)
                          : <span style={{ color: "var(--ax-muted)" }}>—</span>}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
