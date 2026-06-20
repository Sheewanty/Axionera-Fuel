"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveLubeBayServiceTypeAction, saveProductAction, setProductPriceAction } from "@/lib/actions/setup.actions";
import { LUBE_VEHICLE_CATEGORIES } from "@/lib/schemas/lube-bay.schema";

type ActionResponse = {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

type Product = {
  id: string;
  name: string;
  category: string;
  isActive: boolean;
  price: number | null;
};

type ServiceType = {
  id: string;
  name: string;
  vehicleCategory: string;
  defaultLabourCharge: number;
  isActive: boolean;
};

type Props = {
  stationId: string;
  products: Product[];
  serviceTypes: ServiceType[];
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

function useSetupSubmit(action: (formData: FormData) => Promise<ActionResponse>, onSuccess?: () => void) {
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
        onSuccess?.();
        router.refresh();
      }
    });
  };

  return { pending, result, submit };
}

function SetupPanel({ title, children }: { title: string; children: React.ReactNode }) {
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
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
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

export default function LubeBaySetupClient({ stationId, products, serviceTypes }: Props) {
  const [editingService, setEditingService] = useState<ServiceType | null>(null);
  const serviceForm = useSetupSubmit(saveLubeBayServiceTypeAction, () => setEditingService(null));
  const productForm = useSetupSubmit(saveProductAction);
  const priceForm = useSetupSubmit(setProductPriceAction);

  return (
    <>
      <SetupPanel title={editingService ? "Edit Service Type" : "Add Service Type"}>
        <FormError result={serviceForm.result} />
        <form key={editingService?.id ?? "new-service"} onSubmit={serviceForm.submit}>
          {editingService && <input type="hidden" name="id" value={editingService.id} />}
          <input type="hidden" name="stationId" value={stationId} />
          <FormGrid>
            <div className="form-group">
              <label className="form-label">Service Type</label>
              <input className="form-input" name="name" required placeholder="Oil Change" defaultValue={editingService?.name ?? ""} />
            </div>
            <div className="form-group">
              <label className="form-label">Vehicle Category</label>
              <select className="form-select" name="vehicleCategory" required defaultValue={editingService?.vehicleCategory ?? ""}>
                <option value="">Select vehicle category</option>
                {LUBE_VEHICLE_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Default Labour Charge</label>
              <input className="form-input" name="defaultLabourCharge" type="number" step="0.01" min="0" defaultValue={editingService?.defaultLabourCharge ?? 0} required />
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-select" name="isActive" defaultValue={editingService ? String(editingService.isActive) : "true"}>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
            <SubmitButton pending={serviceForm.pending}>{editingService ? "Update Service Type" : "Save Service Type"}</SubmitButton>
            {editingService && (
              <div style={{ alignSelf: "end" }}>
                <button className="btn btn-outline" type="button" onClick={() => setEditingService(null)}>
                  Cancel Edit
                </button>
              </div>
            )}
          </FormGrid>
        </form>
      </SetupPanel>

      <SetupPanel title="Add Lube Bay Product">
        <FormError result={productForm.result} />
        <form onSubmit={productForm.submit}>
          <input type="hidden" name="stationId" value={stationId} />
          <FormGrid>
            <div className="form-group">
              <label className="form-label">Product Name</label>
              <input className="form-input" name="name" required placeholder="Oil Filter" />
            </div>
            <div className="form-group">
              <label className="form-label">Category</label>
              <select className="form-select" name="category" defaultValue="OTHER">
                <option value="LUBRICANT">Lubricant</option>
                <option value="OTHER">Parts / Filter / Accessory</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Opening Price</label>
              <input className="form-input" name="pricePerLitre" type="number" step="0.01" min="0" required />
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
              <label className="form-label">New Price</label>
              <input className="form-input" name="pricePerLitre" type="number" step="0.01" min="0" required />
            </div>
            <SubmitButton pending={priceForm.pending}>Set Price</SubmitButton>
          </FormGrid>
        </form>
      </SetupPanel>

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 18 }}>
        <div className="dash-panel">
          <div className="dash-panel-head">
            <div className="dash-panel-title">Service Types</div>
          </div>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Vehicle Category</th>
                  <th style={{ textAlign: "right" }}>Default Labour</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {serviceTypes.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: "center", padding: 24, color: "var(--ax-muted)" }}>No service types configured.</td></tr>
                ) : serviceTypes.map((service) => (
                  <tr key={service.id}>
                    <td style={{ fontWeight: 700 }}>{service.name}</td>
                    <td>{service.vehicleCategory}</td>
                    <td style={{ textAlign: "right" }}>GHS {service.defaultLabourCharge.toFixed(2)}</td>
                    <td><span className="status-badge" data-status={service.isActive ? "ACTIVE" : "INACTIVE"}>{service.isActive ? "Active" : "Inactive"}</span></td>
                    <td><button className="btn btn-outline btn-sm" type="button" onClick={() => setEditingService(service)}>Edit</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="dash-panel">
          <div className="dash-panel-head">
            <div className="dash-panel-title">Lube Bay Products</div>
          </div>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th style={{ textAlign: "right" }}>Current Price</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr><td colSpan={4} style={{ textAlign: "center", padding: 24, color: "var(--ax-muted)" }}>No lube bay products configured.</td></tr>
                ) : products.map((product) => (
                  <tr key={product.id}>
                    <td style={{ fontWeight: 700 }}>{product.name}</td>
                    <td>{product.category === "LUBRICANT" ? "Lubricant" : "Parts / Other"}</td>
                    <td style={{ textAlign: "right" }}>{product.price == null ? "No price" : `GHS ${product.price.toFixed(2)}`}</td>
                    <td><span className="status-badge" data-status={product.isActive ? "ACTIVE" : "INACTIVE"}>{product.isActive ? "Active" : "Inactive"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
