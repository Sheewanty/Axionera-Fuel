import PageTitle from "@/components/ui/PageTitle";
import { getRequiredSession, requireSuperAdmin } from "@/lib/session";
import { NORTHBRIDGE_IMPORT_REQUIRED_SHEETS } from "@/lib/import/workbook-validation";
import TenantImportClient from "./TenantImportClient";

export default async function PlatformTenantImportsPage() {
  const session = await getRequiredSession();
  requireSuperAdmin(session);

  return (
    <>
      <PageTitle
        eyebrow="Super Admin"
        title="Tenant Imports"
        subtitle="Upload and validate tenant setup and transaction workbooks before database import."
      />
      <TenantImportClient requiredSheets={[...NORTHBRIDGE_IMPORT_REQUIRED_SHEETS]} />
    </>
  );
}
