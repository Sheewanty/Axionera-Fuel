"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { createPlatformTenantAction, updatePlatformTenantAction } from "@/lib/actions/platform.actions";

type TenantRow = {
  id: string;
  name: string;
  slug: string;
  billingEmail: string | null;
  billingAddress: string | null;
  subscriptionStatus: string;
  subscriptionPackage: string;
  maxStations: number;
  maxTanks: number;
  maxPumps: number;
  stationCount: number;
  tankCount: number;
  pumpCount: number;
  memberCount: number;
};

type ActionResponse = {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

const packageDefaults: Record<string, { maxStations: number; maxTanks: number; maxPumps: number }> = {
  STARTER: { maxStations: 1, maxTanks: 3, maxPumps: 3 },
  GROWTH: { maxStations: 3, maxTanks: 12, maxPumps: 12 },
  PRO: { maxStations: 10, maxTanks: 40, maxPumps: 40 },
  ENTERPRISE: { maxStations: 50, maxTanks: 200, maxPumps: 200 },
};

function FieldErrors({ result }: { result: ActionResponse | null }) {
  if (!result || result.success) return null;
  return (
    <div
      role="alert"
      style={{
        background: "color-mix(in srgb, var(--ax-red) 7%, white)",
        border: "1px solid color-mix(in srgb, var(--ax-red) 30%, white)",
        borderRadius: 8,
        color: "var(--ax-red)",
        fontSize: 14,
        lineHeight: 1.4,
        marginBottom: 14,
        padding: "10px 12px",
      }}
    >
      <strong>{result.error ?? "Unable to save record"}</strong>
      {result.fieldErrors && (
        <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>
          {Object.entries(result.fieldErrors).flatMap(([field, messages]) =>
            messages.map((message) => <li key={`${field}-${message}`}>{field}: {message}</li>)
          )}
        </ul>
      )}
    </div>
  );
}

function setPackageDefaults(form: HTMLFormElement | null, packageName: string) {
  const defaults = packageDefaults[packageName];
  if (!form || !defaults) return;

  const stations = form.elements.namedItem("maxStations") as HTMLInputElement | null;
  const tanks = form.elements.namedItem("maxTanks") as HTMLInputElement | null;
  const pumps = form.elements.namedItem("maxPumps") as HTMLInputElement | null;
  if (stations) stations.value = String(defaults.maxStations);
  if (tanks) tanks.value = String(defaults.maxTanks);
  if (pumps) pumps.value = String(defaults.maxPumps);
}

export default function PlatformTenantsClient({ tenants }: { tenants: TenantRow[] }) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTenant, setEditTenant] = useState<TenantRow | null>(null);
  const [result, setResult] = useState<ActionResponse | null>(null);
  const [pending, startTransition] = useTransition();

  const submitCreate = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    startTransition(async () => {
      const response = await createPlatformTenantAction(formData);
      setResult(response);
      if (response.success) {
        form.reset();
        setCreateOpen(false);
        router.refresh();
      }
    });
  };

  const submitUpdate = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    startTransition(async () => {
      const response = await updatePlatformTenantAction(formData);
      setResult(response);
      if (response.success) {
        setEditTenant(null);
        router.refresh();
      }
    });
  };

  return (
    <div className="mt-6 space-y-6">
      <div style={{ marginBottom: 20 }}>
        <button
          className="btn btn-primary"
          onClick={() => {
            setResult(null);
            setCreateOpen(true);
          }}
        >
          <Plus size={14} />
          Create Tenant
        </button>
      </div>

      <div className="dash-panel">
        <div className="dash-panel-head">
          <div className="dash-panel-title">Subscription Register</div>
        </div>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tenant</th>
                <th>Billing</th>
                <th>Status</th>
                <th>Package</th>
                <th>Current Usage</th>
                <th>Allowed Limits</th>
                <th>Users</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((tenant) => (
                <tr key={tenant.id}>
                  <td>
                    <div style={{ fontWeight: 800 }}>{tenant.name}</div>
                    <div style={{ color: "var(--ax-muted)", fontSize: 12 }}>{tenant.slug}</div>
                  </td>
                  <td>
                    <div>{tenant.billingEmail ?? "-"}</div>
                    <div style={{ color: "var(--ax-muted)", fontSize: 12 }}>
                      {tenant.billingAddress ?? "No billing address"}
                    </div>
                  </td>
                  <td>
                    <span className="status-badge" data-status={tenant.subscriptionStatus}>
                      {tenant.subscriptionStatus}
                    </span>
                  </td>
                  <td>{tenant.subscriptionPackage}</td>
                  <td>{tenant.stationCount} stations / {tenant.tankCount} tanks / {tenant.pumpCount} pumps</td>
                  <td>{tenant.maxStations} stations / {tenant.maxTanks} tanks / {tenant.maxPumps} pumps</td>
                  <td>{tenant.memberCount}</td>
                  <td style={{ textAlign: "right" }}>
                    <button
                      className="btn btn-outline"
                      onClick={() => {
                        setResult(null);
                        setEditTenant(tenant);
                      }}
                    >
                      Manage
                    </button>
                  </td>
                </tr>
              ))}
              {tenants.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: 28, color: "var(--ax-muted)" }}>
                    No tenants have been created.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={createOpen}
        title="Create Tenant"
        onClose={() => setCreateOpen(false)}
        size="lg"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setCreateOpen(false)} disabled={pending}>Cancel</button>
            <button className="btn btn-primary" type="submit" form="platform-create-tenant-form" disabled={pending}>
              {pending ? "Creating..." : "Create Tenant"}
            </button>
          </>
        }
      >
        <FieldErrors result={result} />
        <form id="platform-create-tenant-form" onSubmit={submitCreate}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
            <label className="form-group">
              <span className="form-label">Tenant Name *</span>
              <input className="form-input" name="companyName" required />
            </label>
            <label className="form-group">
              <span className="form-label">Slug</span>
              <input className="form-input" name="slug" />
            </label>
            <label className="form-group">
              <span className="form-label">Billing Email</span>
              <input className="form-input" name="billingEmail" type="email" />
            </label>
            <label className="form-group" style={{ gridColumn: "1/-1" }}>
              <span className="form-label">Billing Address</span>
              <textarea className="form-textarea" name="billingAddress" rows={2} />
            </label>
            <label className="form-group">
              <span className="form-label">Status</span>
              <select className="form-select" name="subscriptionStatus" defaultValue="TRIAL">
                <option value="TRIAL">Trial</option>
                <option value="ACTIVE">Active</option>
                <option value="SUSPENDED">Suspended</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </label>
            <label className="form-group">
              <span className="form-label">Package</span>
              <select
                className="form-select"
                name="subscriptionPackage"
                defaultValue="STARTER"
                onChange={(event) => setPackageDefaults(event.currentTarget.form, event.currentTarget.value)}
              >
                <option value="STARTER">Starter</option>
                <option value="GROWTH">Growth</option>
                <option value="PRO">Pro</option>
                <option value="ENTERPRISE">Enterprise</option>
              </select>
            </label>
            <label className="form-group">
              <span className="form-label">No. of Stations</span>
              <input className="form-input" name="maxStations" type="number" min="1" defaultValue={1} required />
            </label>
            <label className="form-group">
              <span className="form-label">No. of Tanks</span>
              <input className="form-input" name="maxTanks" type="number" min="1" defaultValue={3} required />
            </label>
            <label className="form-group">
              <span className="form-label">No. of Pumps</span>
              <input className="form-input" name="maxPumps" type="number" min="1" defaultValue={3} required />
            </label>
            <label className="form-group">
              <span className="form-label">Owner Name *</span>
              <input className="form-input" name="ownerName" required />
            </label>
            <label className="form-group">
              <span className="form-label">Owner Email *</span>
              <input className="form-input" name="ownerEmail" type="email" required />
            </label>
            <label className="form-group">
              <span className="form-label">Owner Temporary Password *</span>
              <input className="form-input" name="ownerPassword" type="password" minLength={8} required />
            </label>
            <label className="form-group">
              <span className="form-label">First Station Name</span>
              <input className="form-input" name="stationName" />
            </label>
            <label className="form-group">
              <span className="form-label">First Station Code</span>
              <input className="form-input" name="stationCode" />
            </label>
            <label className="form-group">
              <span className="form-label">First Station Location</span>
              <input className="form-input" name="stationLocation" />
            </label>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(editTenant)}
        title="Manage Subscription"
        onClose={() => setEditTenant(null)}
        size="lg"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setEditTenant(null)} disabled={pending}>Cancel</button>
            <button className="btn btn-primary" type="submit" form="platform-update-tenant-form" disabled={pending}>
              {pending ? "Saving..." : "Save Changes"}
            </button>
          </>
        }
      >
        <FieldErrors result={result} />
        {editTenant && (
          <form id="platform-update-tenant-form" onSubmit={submitUpdate}>
            <input type="hidden" name="tenantId" value={editTenant.id} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
              <label className="form-group">
                <span className="form-label">Tenant Name</span>
                <input className="form-input" name="name" defaultValue={editTenant.name} required />
              </label>
              <label className="form-group">
                <span className="form-label">Billing Email</span>
                <input className="form-input" name="billingEmail" type="email" defaultValue={editTenant.billingEmail ?? ""} />
              </label>
              <label className="form-group" style={{ gridColumn: "1/-1" }}>
                <span className="form-label">Billing Address</span>
                <textarea className="form-textarea" name="billingAddress" rows={2} defaultValue={editTenant.billingAddress ?? ""} />
              </label>
              <label className="form-group">
                <span className="form-label">Status</span>
                <select className="form-select" name="subscriptionStatus" defaultValue={editTenant.subscriptionStatus}>
                  <option value="TRIAL">Trial</option>
                  <option value="ACTIVE">Active</option>
                  <option value="SUSPENDED">Suspended / deactivated</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </label>
              <label className="form-group">
                <span className="form-label">Package</span>
                <select
                  className="form-select"
                  name="subscriptionPackage"
                  defaultValue={editTenant.subscriptionPackage}
                  onChange={(event) => setPackageDefaults(event.currentTarget.form, event.currentTarget.value)}
                >
                  <option value="STARTER">Starter</option>
                  <option value="GROWTH">Growth</option>
                  <option value="PRO">Pro</option>
                  <option value="ENTERPRISE">Enterprise</option>
                </select>
              </label>
              <label className="form-group">
                <span className="form-label">No. of Stations</span>
                <input className="form-input" name="maxStations" type="number" min="1" defaultValue={editTenant.maxStations} required />
              </label>
              <label className="form-group">
                <span className="form-label">No. of Tanks</span>
                <input className="form-input" name="maxTanks" type="number" min="1" defaultValue={editTenant.maxTanks} required />
              </label>
              <label className="form-group">
                <span className="form-label">No. of Pumps</span>
                <input className="form-input" name="maxPumps" type="number" min="1" defaultValue={editTenant.maxPumps} required />
              </label>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
