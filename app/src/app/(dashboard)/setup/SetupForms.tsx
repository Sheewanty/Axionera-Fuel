"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Edit } from "lucide-react";
import Modal from "@/components/ui/Modal";
import {
  createUserMembershipAction,
  createTenantAction,
  saveNozzleAction,
  saveProductAction,
  savePumpAction,
  saveStationAction,
  saveTankAction,
  setProductPriceAction,
  updateCompanyAction,
} from "@/lib/actions/setup.actions";

type ActionResponse = {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

type Option = {
  id: string;
  name: string;
};

type TankRow = {
  id: string;
  name: string;
  productId: string;
  productName: string;
  capacityLitres: number;
  status: string;
  createdAt: string;
};

type NozzleRow = {
  id: string;
  name: string;
  pumpId: string;
  productId: string;
  productName: string;
  meterCode: string | null;
  status: string;
};

type PumpRow = {
  id: string;
  name: string;
  status: string;
  nozzles: NozzleRow[];
};

type Company = {
  name: string;
  billingEmail: string;
};

function FormError({ result }: { result: ActionResponse | null }) {
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
            messages.map((message) => (
              <li key={`${field}-${message}`}>
                {field}: {message}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

function SetupPanel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="dash-panel" style={{ marginBottom: 18 }}>
      <div className="dash-panel-head">
        <div className="dash-panel-title">{title}</div>
      </div>
      <div style={{ padding: "1.25rem" }}>{children}</div>
    </div>
  );
}

function FormGrid({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: 14,
      }}
    >
      {children}
    </div>
  );
}

function SubmitButton({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <div style={{ alignSelf: "end" }}>
      <button className="btn btn-primary" disabled={pending} type="submit">
        {pending ? "Saving..." : children}
      </button>
    </div>
  );
}

function useSetupSubmit(action: (formData: FormData) => Promise<ActionResponse>) {
  const router = useRouter();
  const [result, setResult] = useState<ActionResponse | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    startTransition(async () => {
      const response = await action(formData);
      setResult(response);
      if (response.success) {
        form.reset();
        router.refresh();
      }
    });
  };

  return { pending, result, submit };
}

export function CompanySettingsForm({ company }: { company: Company }) {
  const form = useSetupSubmit(updateCompanyAction);

  return (
    <SetupPanel title="Update Company">
      <FormError result={form.result} />
      <form onSubmit={form.submit}>
        <FormGrid>
          <div className="form-group">
            <label className="form-label">Company Name</label>
            <input className="form-input" name="name" defaultValue={company.name} required />
          </div>
          <div className="form-group">
            <label className="form-label">Billing Email</label>
            <input className="form-input" name="billingEmail" type="email" defaultValue={company.billingEmail} />
          </div>
          <SubmitButton pending={form.pending}>Save Company</SubmitButton>
        </FormGrid>
      </form>
    </SetupPanel>
  );
}

export function TenantCreationForm() {
  const form = useSetupSubmit(createTenantAction);

  return (
    <SetupPanel title="Create New Company / Tenant">
      <FormError result={form.result} />
      {form.result?.success && (
        <div
          style={{
            background: "color-mix(in srgb, var(--ax-green) 8%, white)",
            border: "1px solid color-mix(in srgb, var(--ax-green) 30%, white)",
            borderRadius: 8,
            color: "var(--ax-green)",
            fontSize: 14,
            fontWeight: 700,
            marginBottom: 14,
            padding: "10px 12px",
          }}
        >
          Company created. The owner can now sign in with the email and password entered below.
        </div>
      )}
      <form onSubmit={form.submit}>
        <FormGrid>
          <div className="form-group">
            <label className="form-label">Company Name</label>
            <input className="form-input" name="companyName" required placeholder="Pojoba 96 Fuel" />
          </div>
          <div className="form-group">
            <label className="form-label">Slug</label>
            <input className="form-input" name="slug" placeholder="pojoba-96-fuel" />
          </div>
          <div className="form-group">
            <label className="form-label">Billing Email</label>
            <input className="form-input" name="billingEmail" type="email" placeholder="accounts@example.com" />
          </div>
          <div className="form-group">
            <label className="form-label">Owner Name</label>
            <input className="form-input" name="ownerName" required placeholder="Gideon Pojoba" />
          </div>
          <div className="form-group">
            <label className="form-label">Owner Email</label>
            <input className="form-input" name="ownerEmail" type="email" required placeholder="owner@example.com" />
          </div>
          <div className="form-group">
            <label className="form-label">Owner Temporary Password</label>
            <input className="form-input" name="ownerPassword" type="password" minLength={8} required />
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--ax-blue)", fontWeight: 700 }}>
            <input type="checkbox" name="forcePasswordChange" value="true" defaultChecked />
            Force password change at first login
          </label>
          <div className="form-group">
            <label className="form-label">First Station Name</label>
            <input className="form-input" name="stationName" placeholder="Main Station" />
          </div>
          <div className="form-group">
            <label className="form-label">First Station Code</label>
            <input className="form-input" name="stationCode" placeholder="MAIN-01" />
          </div>
          <div className="form-group">
            <label className="form-label">First Station Location</label>
            <input className="form-input" name="stationLocation" placeholder="Accra" />
          </div>
          <SubmitButton pending={form.pending}>Create Company</SubmitButton>
        </FormGrid>
      </form>
    </SetupPanel>
  );
}

export function StationSetupForm() {
  const form = useSetupSubmit(saveStationAction);

  return (
    <SetupPanel title="Add Station">
      <FormError result={form.result} />
      <form onSubmit={form.submit}>
        <FormGrid>
          <div className="form-group">
            <label className="form-label">Station Name</label>
            <input className="form-input" name="name" required placeholder="GOIL Accra Central" />
          </div>
          <div className="form-group">
            <label className="form-label">Station Code</label>
            <input className="form-input" name="code" required placeholder="ACC-01" />
          </div>
          <div className="form-group">
            <label className="form-label">Location</label>
            <input className="form-input" name="location" placeholder="Accra" />
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-select" name="status" defaultValue="ACTIVE">
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
          <SubmitButton pending={form.pending}>Add Station</SubmitButton>
        </FormGrid>
      </form>
    </SetupPanel>
  );
}

export function ProductSetupForms({
  stationId,
  products,
}: {
  stationId: string;
  products: Option[];
}) {
  const productForm = useSetupSubmit(saveProductAction);
  const priceForm = useSetupSubmit(setProductPriceAction);

  return (
    <>
      <SetupPanel title="Add Product">
        <FormError result={productForm.result} />
        <form onSubmit={productForm.submit}>
          <input type="hidden" name="stationId" value={stationId} />
          <FormGrid>
            <div className="form-group">
              <label className="form-label">Product Name</label>
              <input className="form-input" name="name" required placeholder="Super 95" />
            </div>
            <div className="form-group">
              <label className="form-label">Category</label>
              <select className="form-select" name="category" defaultValue="FUEL">
                <option value="FUEL">Fuel</option>
                <option value="LUBRICANT">Lubricant</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Opening Price / Litre</label>
              <input className="form-input" name="pricePerLitre" type="number" step="0.0001" min="0" />
            </div>
            <SubmitButton pending={productForm.pending}>Add Product</SubmitButton>
          </FormGrid>
        </form>
      </SetupPanel>

      <SetupPanel title="Update Product Price">
        <FormError result={priceForm.result} />
        <form onSubmit={priceForm.submit}>
          <input type="hidden" name="stationId" value={stationId} />
          <FormGrid>
            <div className="form-group">
              <label className="form-label">Product</label>
              <select className="form-select" name="productId" required>
                <option value="">Select product</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">New Price / Litre</label>
              <input className="form-input" name="pricePerLitre" type="number" step="0.0001" min="0" required />
            </div>
            <SubmitButton pending={priceForm.pending}>Set Price</SubmitButton>
          </FormGrid>
        </form>
      </SetupPanel>
    </>
  );
}

export function TankSetupForm({
  stationId,
  products,
}: {
  stationId: string;
  products: Option[];
}) {
  const form = useSetupSubmit(saveTankAction);

  return (
    <SetupPanel title="Add Tank">
      <FormError result={form.result} />
      <form onSubmit={form.submit}>
        <input type="hidden" name="stationId" value={stationId} />
        <FormGrid>
          <div className="form-group">
            <label className="form-label">Tank Name</label>
            <input className="form-input" name="name" required placeholder="Tank 1" />
          </div>
          <div className="form-group">
            <label className="form-label">Product</label>
            <select className="form-select" name="productId" required>
              <option value="">Select product</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Capacity (Litres)</label>
            <input className="form-input" name="capacityLitres" type="number" step="0.01" min="0" required />
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-select" name="status" defaultValue="ACTIVE">
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
          <SubmitButton pending={form.pending}>Add Tank</SubmitButton>
        </FormGrid>
      </form>
    </SetupPanel>
  );
}

export function TankInventoryEditor({
  stationId,
  products,
  tanks,
  canEdit,
}: {
  stationId: string;
  products: Option[];
  tanks: TankRow[];
  canEdit: boolean;
}) {
  const form = useSetupSubmit(saveTankAction);
  const [editTank, setEditTank] = useState<TankRow | null>(null);

  return (
    <>
      <div className="dash-panel">
        <div className="dash-panel-head">
          <div>
            <div className="dash-panel-title">Tank Inventory</div>
          </div>
        </div>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tank Name</th>
                <th>Product</th>
                <th style={{ textAlign: "right" }}>Capacity (Litres)</th>
                <th>Status</th>
                <th>Created</th>
                {canEdit && <th style={{ textAlign: "right" }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {tanks.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 6 : 5} style={{ textAlign: "center", padding: "2rem", color: "var(--ax-muted)" }}>
                    No tanks configured for this station yet.
                  </td>
                </tr>
              ) : (
                tanks.map((tank) => (
                  <tr key={tank.id}>
                    <td style={{ fontWeight: 600 }}>{tank.name}</td>
                    <td>{tank.productName}</td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {tank.capacityLitres.toLocaleString()}
                    </td>
                    <td>
                      <span className="status-badge" data-status={tank.status}>
                        {tank.status === "ACTIVE" ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>{tank.createdAt}</td>
                    {canEdit && (
                      <td style={{ textAlign: "right" }}>
                        <button
                          type="button"
                          className="btn btn-outline"
                          style={{ width: 34, height: 34, padding: 0 }}
                          aria-label={`Edit ${tank.name}`}
                          onClick={() => {
                            setEditTank(tank);
                          }}
                        >
                          <Edit size={15} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={Boolean(editTank)}
        title="Edit Tank"
        onClose={() => setEditTank(null)}
        size="lg"
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={() => setEditTank(null)} disabled={form.pending}>
              Cancel
            </button>
            <button type="submit" form="edit-tank-form" className="btn btn-primary" disabled={form.pending}>
              {form.pending ? "Saving..." : "Save Tank"}
            </button>
          </>
        }
      >
        <FormError result={form.result} />
        {editTank && (
          <form
            id="edit-tank-form"
            onSubmit={form.submit}
          >
            <input type="hidden" name="id" value={editTank.id} />
            <input type="hidden" name="stationId" value={stationId} />
            <FormGrid>
              <div className="form-group">
                <label className="form-label">Tank Name</label>
                <input className="form-input" name="name" required defaultValue={editTank.name} />
              </div>
              <div className="form-group">
                <label className="form-label">Product</label>
                <select className="form-select" name="productId" required defaultValue={editTank.productId}>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Capacity (Litres)</label>
                <input className="form-input" name="capacityLitres" type="number" step="0.01" min="0" required defaultValue={editTank.capacityLitres} />
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-select" name="status" defaultValue={editTank.status}>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>
            </FormGrid>
          </form>
        )}
      </Modal>
    </>
  );
}

export function PumpNozzleSetupForms({
  stationId,
  products,
  pumps,
}: {
  stationId: string;
  products: Option[];
  pumps: Option[];
}) {
  const pumpForm = useSetupSubmit(savePumpAction);
  const nozzleForm = useSetupSubmit(saveNozzleAction);

  return (
    <>
      <SetupPanel title="Add Pump">
        <FormError result={pumpForm.result} />
        <form onSubmit={pumpForm.submit}>
          <input type="hidden" name="stationId" value={stationId} />
          <FormGrid>
            <div className="form-group">
              <label className="form-label">Pump Name</label>
              <input className="form-input" name="name" required placeholder="Pump 1" />
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-select" name="status" defaultValue="ACTIVE">
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
            <SubmitButton pending={pumpForm.pending}>Add Pump</SubmitButton>
          </FormGrid>
        </form>
      </SetupPanel>

      <SetupPanel title="Add Nozzle">
        <FormError result={nozzleForm.result} />
        <form onSubmit={nozzleForm.submit}>
          <input type="hidden" name="stationId" value={stationId} />
          <FormGrid>
            <div className="form-group">
              <label className="form-label">Pump</label>
              <select className="form-select" name="pumpId" required>
                <option value="">Select pump</option>
                {pumps.map((pump) => (
                  <option key={pump.id} value={pump.id}>
                    {pump.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Nozzle Name</label>
              <input className="form-input" name="name" required placeholder="Nozzle A" />
            </div>
            <div className="form-group">
              <label className="form-label">Product</label>
              <select className="form-select" name="productId" required>
                <option value="">Select product</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Meter Code</label>
              <input className="form-input" name="meterCode" placeholder="Optional" />
            </div>
            <SubmitButton pending={nozzleForm.pending}>Add Nozzle</SubmitButton>
          </FormGrid>
        </form>
      </SetupPanel>
    </>
  );
}

export function PumpNozzleInventoryEditor({
  stationId,
  products,
  pumps,
  canEdit,
}: {
  stationId: string;
  products: Option[];
  pumps: PumpRow[];
  canEdit: boolean;
}) {
  const pumpForm = useSetupSubmit(savePumpAction);
  const nozzleForm = useSetupSubmit(saveNozzleAction);
  const [editPump, setEditPump] = useState<PumpRow | null>(null);
  const [editNozzle, setEditNozzle] = useState<NozzleRow | null>(null);

  if (pumps.length === 0) {
    return (
      <div className="dash-panel">
        <div style={{ padding: "2rem", textAlign: "center", color: "var(--ax-muted)" }}>
          No pumps configured for this station yet.
        </div>
      </div>
    );
  }

  return (
    <>
      {pumps.map((pump) => (
        <div key={pump.id} className="dash-panel" style={{ marginBottom: "1rem" }}>
          <div className="dash-panel-head">
            <div>
              <div className="dash-panel-title">{pump.name}</div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span className="status-badge" data-status={pump.status}>
                {pump.status === "ACTIVE" ? "Active" : "Inactive"}
              </span>
              {canEdit && (
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ width: 34, height: 34, padding: 0 }}
                  aria-label={`Edit ${pump.name}`}
                  onClick={() => setEditPump(pump)}
                >
                  <Edit size={15} />
                </button>
              )}
            </div>
          </div>
          {pump.nozzles.length === 0 ? (
            <div style={{ padding: "1rem 1.25rem", color: "var(--ax-muted)", fontSize: "0.875rem" }}>
              No nozzles assigned to this pump.
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nozzle</th>
                    <th>Product</th>
                    <th>Meter Code</th>
                    <th>Status</th>
                    {canEdit && <th style={{ textAlign: "right" }}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {pump.nozzles.map((nozzle) => (
                    <tr key={nozzle.id}>
                      <td style={{ fontWeight: 600 }}>{nozzle.name}</td>
                      <td>{nozzle.productName}</td>
                      <td>{nozzle.meterCode ?? <span style={{ color: "var(--ax-muted)" }}>-</span>}</td>
                      <td>
                        <span className="status-badge" data-status={nozzle.status}>
                          {nozzle.status === "ACTIVE" ? "Active" : "Inactive"}
                        </span>
                      </td>
                      {canEdit && (
                        <td style={{ textAlign: "right" }}>
                          <button
                            type="button"
                            className="btn btn-outline"
                            style={{ width: 34, height: 34, padding: 0 }}
                            aria-label={`Edit ${nozzle.name}`}
                            onClick={() => setEditNozzle(nozzle)}
                          >
                            <Edit size={15} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}

      <Modal
        open={Boolean(editPump)}
        title="Edit Pump"
        onClose={() => setEditPump(null)}
        size="md"
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={() => setEditPump(null)} disabled={pumpForm.pending}>
              Cancel
            </button>
            <button type="submit" form="edit-pump-form" className="btn btn-primary" disabled={pumpForm.pending}>
              {pumpForm.pending ? "Saving..." : "Save Pump"}
            </button>
          </>
        }
      >
        <FormError result={pumpForm.result} />
        {editPump && (
          <form id="edit-pump-form" onSubmit={pumpForm.submit}>
            <input type="hidden" name="id" value={editPump.id} />
            <input type="hidden" name="stationId" value={stationId} />
            <FormGrid>
              <div className="form-group">
                <label className="form-label">Pump Name</label>
                <input className="form-input" name="name" required defaultValue={editPump.name} />
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-select" name="status" defaultValue={editPump.status}>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>
            </FormGrid>
          </form>
        )}
      </Modal>

      <Modal
        open={Boolean(editNozzle)}
        title="Edit Nozzle"
        onClose={() => setEditNozzle(null)}
        size="lg"
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={() => setEditNozzle(null)} disabled={nozzleForm.pending}>
              Cancel
            </button>
            <button type="submit" form="edit-nozzle-form" className="btn btn-primary" disabled={nozzleForm.pending}>
              {nozzleForm.pending ? "Saving..." : "Save Nozzle"}
            </button>
          </>
        }
      >
        <FormError result={nozzleForm.result} />
        {editNozzle && (
          <form id="edit-nozzle-form" onSubmit={nozzleForm.submit}>
            <input type="hidden" name="id" value={editNozzle.id} />
            <input type="hidden" name="stationId" value={stationId} />
            <FormGrid>
              <div className="form-group">
                <label className="form-label">Pump</label>
                <select className="form-select" name="pumpId" required defaultValue={editNozzle.pumpId}>
                  {pumps.map((pump) => (
                    <option key={pump.id} value={pump.id}>
                      {pump.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Nozzle Name</label>
                <input className="form-input" name="name" required defaultValue={editNozzle.name} />
              </div>
              <div className="form-group">
                <label className="form-label">Product</label>
                <select className="form-select" name="productId" required defaultValue={editNozzle.productId}>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Meter Code</label>
                <input className="form-input" name="meterCode" defaultValue={editNozzle.meterCode ?? ""} />
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-select" name="status" defaultValue={editNozzle.status}>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>
            </FormGrid>
          </form>
        )}
      </Modal>
    </>
  );
}

export function UserSetupForm({ stations }: { stations: Option[] }) {
  const form = useSetupSubmit(createUserMembershipAction);

  return (
    <SetupPanel title="Add User">
      <FormError result={form.result} />
      <form onSubmit={form.submit}>
        <FormGrid>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input className="form-input" name="name" required placeholder="Akua Mensah" />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" name="email" type="email" required placeholder="name@example.com" />
          </div>
          <div className="form-group">
            <label className="form-label">Temporary Password</label>
            <input className="form-input" name="password" type="password" minLength={8} required />
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--ax-blue)", fontWeight: 700 }}>
            <input type="checkbox" name="forcePasswordChange" value="true" defaultChecked />
            Force password change at first login
          </label>
          <div className="form-group">
            <label className="form-label">Role</label>
            <select className="form-select" name="role" defaultValue="ATTENDANT">
              <option value="OWNER">Owner</option>
              <option value="ADMIN">Admin</option>
              <option value="STATION_MANAGER">Station Manager</option>
              <option value="SUPERVISOR">Supervisor</option>
              <option value="ATTENDANT">Attendant</option>
              <option value="ACCOUNTANT">Accountant</option>
              <option value="AUDITOR">Auditor</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Station Assignment</label>
            <select className="form-select" name="stationId" defaultValue="">
              <option value="">All stations / tenant-wide</option>
              {stations.map((station) => (
                <option key={station.id} value={station.id}>
                  {station.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-select" name="status" defaultValue="ACTIVE">
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
          <SubmitButton pending={form.pending}>Add User</SubmitButton>
        </FormGrid>
      </form>
    </SetupPanel>
  );
}
