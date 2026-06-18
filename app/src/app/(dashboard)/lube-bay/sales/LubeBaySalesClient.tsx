"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Save } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { createLubeBaySaleAction, updateLubeBaySaleAction } from "@/lib/actions/lube-bay.actions";
import {
  calcLubeBayLubricantAmount,
  calcLubeBayTotalExpected,
  calcLubeBayVariance,
  formatCurrency,
} from "@/lib/calculations";

type DailySessionProps = {
  id: string;
  businessDate: string;
  shift: string;
  status: string;
};

type Product = {
  id: string;
  name: string;
  price: number;
};

type Creditor = {
  id: string;
  name: string;
};

type LubeBaySale = {
  id: string;
  vehicleReg: string;
  customerName: string | null;
  customerPhone: string | null;
  serviceType: string;
  lubricantProductId: string | null;
  quantity: number;
  unitPrice: number;
  lubricantAmount: number;
  labourCharge: number;
  partsCharge: number;
  discount: number;
  totalExpected: number;
  cashAmount: number;
  cardAmount: number;
  momoAmount: number;
  creditorAmount: number;
  creditorId: string | null;
  variance: number;
  technicianName: string | null;
  supervisorName: string | null;
  remarks: string | null;
};

type Props = {
  station: { id: string; name: string };
  dailySession: DailySessionProps | null;
  products: Product[];
  creditors: Creditor[];
  sales: LubeBaySale[];
};

type FormState = {
  id?: string;
  vehicleReg: string;
  customerName: string;
  customerPhone: string;
  serviceType: string;
  lubricantProductId: string;
  quantity: string;
  unitPrice: string;
  labourCharge: string;
  partsCharge: string;
  discount: string;
  cashAmount: string;
  cardAmount: string;
  momoAmount: string;
  creditorAmount: string;
  creditorId: string;
  technicianName: string;
  supervisorName: string;
  remarks: string;
  correctionReason: string;
};

const SERVICE_TYPES = [
  "Oil Change",
  "Filter Change",
  "Oil Top-up",
  "Greasing",
  "Coolant / Brake Fluid",
  "Other Service",
];

const emptyForm: FormState = {
  vehicleReg: "",
  customerName: "",
  customerPhone: "",
  serviceType: "Oil Change",
  lubricantProductId: "",
  quantity: "0",
  unitPrice: "0",
  labourCharge: "0",
  partsCharge: "0",
  discount: "0",
  cashAmount: "0",
  cardAmount: "0",
  momoAmount: "0",
  creditorAmount: "0",
  creditorId: "",
  technicianName: "",
  supervisorName: "",
  remarks: "",
  correctionReason: "",
};

function numberValue(value: string): number {
  return Number(value || 0);
}

function fieldLabel(field: string): string {
  const labels: Record<string, string> = {
    vehicleReg: "Vehicle registration",
    serviceType: "Service type",
    lubricantProductId: "Lubricant product",
    quantity: "Quantity",
    unitPrice: "Unit price",
    labourCharge: "Labour charge",
    partsCharge: "Parts charge",
    discount: "Discount",
    cashAmount: "Cash amount",
    cardAmount: "Card amount",
    momoAmount: "MoMo amount",
    creditorAmount: "Creditor amount",
    creditorId: "Creditor",
    correctionReason: "Correction reason",
  };
  return labels[field] ?? field;
}

export default function LubeBaySalesClient({ station, dailySession, products, creditors, sales }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const canEdit = Boolean(dailySession) && (dailySession?.status === "OPEN" || dailySession?.status === "REOPENED");
  const isEditing = Boolean(form.id);

  const totals = useMemo(() => {
    const lubricantAmount = calcLubeBayLubricantAmount(numberValue(form.quantity), numberValue(form.unitPrice));
    const totalExpected = calcLubeBayTotalExpected(
      lubricantAmount,
      numberValue(form.labourCharge),
      numberValue(form.partsCharge),
      numberValue(form.discount)
    );
    const variance = calcLubeBayVariance(
      numberValue(form.cashAmount),
      numberValue(form.cardAmount),
      numberValue(form.momoAmount),
      numberValue(form.creditorAmount),
      totalExpected
    );
    return { lubricantAmount, totalExpected, variance };
  }, [form]);

  const summary = useMemo(() => {
    return sales.reduce(
      (acc, sale) => ({
        totalExpected: acc.totalExpected + sale.totalExpected,
        cashAmount: acc.cashAmount + sale.cashAmount,
        cardAmount: acc.cardAmount + sale.cardAmount,
        momoAmount: acc.momoAmount + sale.momoAmount,
        creditorAmount: acc.creditorAmount + sale.creditorAmount,
        variance: acc.variance + sale.variance,
      }),
      { totalExpected: 0, cashAmount: 0, cardAmount: 0, momoAmount: 0, creditorAmount: 0, variance: 0 }
    );
  }, [sales]);

  const resetErrors = () => {
    setError(null);
    setFieldErrors({});
  };

  const updateField = (field: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const openNew = () => {
    resetErrors();
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (sale: LubeBaySale) => {
    resetErrors();
    setForm({
      id: sale.id,
      vehicleReg: sale.vehicleReg,
      customerName: sale.customerName ?? "",
      customerPhone: sale.customerPhone ?? "",
      serviceType: sale.serviceType,
      lubricantProductId: sale.lubricantProductId ?? "",
      quantity: String(sale.quantity),
      unitPrice: String(sale.unitPrice),
      labourCharge: String(sale.labourCharge),
      partsCharge: String(sale.partsCharge),
      discount: String(sale.discount),
      cashAmount: String(sale.cashAmount),
      cardAmount: String(sale.cardAmount),
      momoAmount: String(sale.momoAmount),
      creditorAmount: String(sale.creditorAmount),
      creditorId: sale.creditorId ?? "",
      technicianName: sale.technicianName ?? "",
      supervisorName: sale.supervisorName ?? "",
      remarks: sale.remarks ?? "",
      correctionReason: "",
    });
    setOpen(true);
  };

  const handleProductChange = (productId: string) => {
    const product = products.find((item) => item.id === productId);
    setForm((current) => ({
      ...current,
      lubricantProductId: productId,
      unitPrice: product ? String(product.price) : current.unitPrice,
    }));
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!dailySession) return;

    const payload = {
      stationId: station.id,
      dailySessionId: dailySession.id,
      vehicleReg: form.vehicleReg,
      customerName: form.customerName || undefined,
      customerPhone: form.customerPhone || undefined,
      serviceType: form.serviceType,
      lubricantProductId: form.lubricantProductId || undefined,
      quantity: numberValue(form.quantity),
      unitPrice: numberValue(form.unitPrice),
      labourCharge: numberValue(form.labourCharge),
      partsCharge: numberValue(form.partsCharge),
      discount: numberValue(form.discount),
      cashAmount: numberValue(form.cashAmount),
      cardAmount: numberValue(form.cardAmount),
      momoAmount: numberValue(form.momoAmount),
      creditorAmount: numberValue(form.creditorAmount),
      creditorId: form.creditorId || undefined,
      technicianName: form.technicianName || undefined,
      supervisorName: form.supervisorName || undefined,
      remarks: form.remarks || undefined,
    };

    startTransition(async () => {
      resetErrors();
      const response = form.id
        ? await updateLubeBaySaleAction({ ...payload, id: form.id, correctionReason: form.correctionReason })
        : await createLubeBaySaleAction(payload);

      if (!response.success) {
        setError(response.error ?? "Unable to save lube bay sale");
        setFieldErrors(response.fieldErrors ?? {});
        return;
      }

      setOpen(false);
      setForm(emptyForm);
      router.refresh();
    });
  };

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <button className="btn btn-primary" onClick={openNew} disabled={!canEdit}>
          <Plus size={14} />
          Record Lube Bay Sale
        </button>
      </div>

      {!dailySession && (
        <div className="dash-panel" style={{ padding: 16, color: "var(--ax-muted)", marginBottom: 20 }}>
          Open today&apos;s session before recording lube bay sales.
        </div>
      )}

      {dailySession && !canEdit && (
        <div className="dash-panel" style={{ padding: 16, color: "var(--ax-amber)", marginBottom: 20 }}>
          This session is {dailySession.status}; lube bay sales are read-only.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 16, marginBottom: 20 }}>
        <div className="dash-panel">
          <div className="kpi-label">Expected Sales</div>
          <div className="kpi-value" style={{ fontSize: 28 }}>{formatCurrency(summary.totalExpected)}</div>
        </div>
        <div className="dash-panel">
          <div className="kpi-label">Cash Received</div>
          <div className="kpi-value" style={{ fontSize: 28 }}>{formatCurrency(summary.cashAmount)}</div>
        </div>
        <div className="dash-panel">
          <div className="kpi-label">Non-Cash / Credit</div>
          <div className="kpi-value" style={{ fontSize: 28 }}>
            {formatCurrency(summary.cardAmount + summary.momoAmount + summary.creditorAmount)}
          </div>
        </div>
        <div className="dash-panel">
          <div className="kpi-label">Variance</div>
          <div className="kpi-value" style={{ fontSize: 28 }}>{formatCurrency(summary.variance)}</div>
        </div>
      </div>

      <div className="table-wrapper">
        <div className="table-toolbar">
          <div className="table-title">Lube Bay Sales Register</div>
          <div style={{ color: "var(--ax-muted)", fontSize: 12 }}>
            {dailySession ? `${station.name} | ${dailySession.businessDate} | ${dailySession.shift} Shift` : station.name}
          </div>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Vehicle</th>
                <th>Service</th>
                <th>Customer</th>
                <th style={{ textAlign: "right" }}>Expected</th>
                <th style={{ textAlign: "right" }}>Cash</th>
                <th style={{ textAlign: "right" }}>Card/MoMo/Credit</th>
                <th style={{ textAlign: "right" }}>Variance</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sales.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: 28, color: "var(--ax-muted)" }}>
                    No lube bay sales recorded for this session.
                  </td>
                </tr>
              ) : (
                sales.map((sale) => (
                  <tr key={sale.id}>
                    <td style={{ fontWeight: 700 }}>{sale.vehicleReg}</td>
                    <td>{sale.serviceType}</td>
                    <td>
                      <div>{sale.customerName || "-"}</div>
                      <div style={{ color: "var(--ax-muted)", fontSize: 12 }}>{sale.customerPhone || ""}</div>
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 700 }}>{formatCurrency(sale.totalExpected)}</td>
                    <td style={{ textAlign: "right" }}>{formatCurrency(sale.cashAmount)}</td>
                    <td style={{ textAlign: "right" }}>{formatCurrency(sale.cardAmount + sale.momoAmount + sale.creditorAmount)}</td>
                    <td style={{ textAlign: "right", fontWeight: 700 }}>{formatCurrency(sale.variance)}</td>
                    <td>
                      <button className="btn btn-outline btn-sm" onClick={() => openEdit(sale)} disabled={!canEdit}>
                        Correct
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={open}
        title={isEditing ? "Correct Lube Bay Sale" : "Record Lube Bay Sale"}
        onClose={() => setOpen(false)}
        size="lg"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setOpen(false)} disabled={isPending}>Cancel</button>
            <button className="btn btn-primary" type="submit" form="lube-bay-sale-form" disabled={isPending}>
              <Save size={16} />
              {isPending ? "Saving..." : isEditing ? "Save Correction" : "Save Sale"}
            </button>
          </>
        }
      >
        {error && (
          <div style={{ color: "var(--ax-red)", marginBottom: 12, fontSize: 14 }}>
            <strong>{error}</strong>
            {Object.keys(fieldErrors).length > 0 && (
              <ul style={{ margin: "6px 0 0 18px" }}>
                {Object.entries(fieldErrors).flatMap(([field, messages]) =>
                  messages.map((message) => <li key={`${field}-${message}`}>{fieldLabel(field)}: {message}</li>)
                )}
              </ul>
            )}
          </div>
        )}

        <form id="lube-bay-sale-form" onSubmit={handleSubmit}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <label className="form-group">
              <span className="form-label">Vehicle Registration *</span>
              <input className="form-input" value={form.vehicleReg} onChange={(e) => updateField("vehicleReg", e.target.value)} required />
            </label>
            <label className="form-group">
              <span className="form-label">Service Type *</span>
              <select className="form-select" value={form.serviceType} onChange={(e) => updateField("serviceType", e.target.value)} required>
                {SERVICE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </label>
            <label className="form-group">
              <span className="form-label">Customer Name</span>
              <input className="form-input" value={form.customerName} onChange={(e) => updateField("customerName", e.target.value)} />
            </label>
            <label className="form-group">
              <span className="form-label">Customer Phone</span>
              <input className="form-input" value={form.customerPhone} onChange={(e) => updateField("customerPhone", e.target.value)} />
            </label>
            <label className="form-group">
              <span className="form-label">Lubricant Product</span>
              <select className="form-select" value={form.lubricantProductId} onChange={(e) => handleProductChange(e.target.value)}>
                <option value="">No lubricant product</option>
                {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
              </select>
            </label>
            <label className="form-group">
              <span className="form-label">Quantity</span>
              <input className="form-input" type="number" min="0" step="0.01" value={form.quantity} onChange={(e) => updateField("quantity", e.target.value)} />
            </label>
            <label className="form-group">
              <span className="form-label">Unit Price</span>
              <input className="form-input" type="number" min="0" step="0.01" value={form.unitPrice} onChange={(e) => updateField("unitPrice", e.target.value)} />
            </label>
            <label className="form-group">
              <span className="form-label">Lubricant Amount (Computed)</span>
              <input className="form-input computed" value={formatCurrency(totals.lubricantAmount)} readOnly />
            </label>
            <label className="form-group">
              <span className="form-label">Labour Charge</span>
              <input className="form-input" type="number" min="0" step="0.01" value={form.labourCharge} onChange={(e) => updateField("labourCharge", e.target.value)} />
            </label>
            <label className="form-group">
              <span className="form-label">Parts / Filter Charge</span>
              <input className="form-input" type="number" min="0" step="0.01" value={form.partsCharge} onChange={(e) => updateField("partsCharge", e.target.value)} />
            </label>
            <label className="form-group">
              <span className="form-label">Discount</span>
              <input className="form-input" type="number" min="0" step="0.01" value={form.discount} onChange={(e) => updateField("discount", e.target.value)} />
            </label>
            <label className="form-group">
              <span className="form-label">Total Expected (Computed)</span>
              <input className="form-input computed" value={formatCurrency(totals.totalExpected)} readOnly />
            </label>
            <label className="form-group">
              <span className="form-label">Cash</span>
              <input className="form-input" type="number" min="0" step="0.01" value={form.cashAmount} onChange={(e) => updateField("cashAmount", e.target.value)} />
            </label>
            <label className="form-group">
              <span className="form-label">Card</span>
              <input className="form-input" type="number" min="0" step="0.01" value={form.cardAmount} onChange={(e) => updateField("cardAmount", e.target.value)} />
            </label>
            <label className="form-group">
              <span className="form-label">MoMo</span>
              <input className="form-input" type="number" min="0" step="0.01" value={form.momoAmount} onChange={(e) => updateField("momoAmount", e.target.value)} />
            </label>
            <label className="form-group">
              <span className="form-label">Credit Sale</span>
              <input className="form-input" type="number" min="0" step="0.01" value={form.creditorAmount} onChange={(e) => updateField("creditorAmount", e.target.value)} />
            </label>
            <label className="form-group">
              <span className="form-label">Creditor</span>
              <select className="form-select" value={form.creditorId} onChange={(e) => updateField("creditorId", e.target.value)}>
                <option value="">No creditor</option>
                {creditors.map((creditor) => <option key={creditor.id} value={creditor.id}>{creditor.name}</option>)}
              </select>
            </label>
            <label className="form-group">
              <span className="form-label">Variance (Computed)</span>
              <input className="form-input computed" value={formatCurrency(totals.variance)} readOnly />
            </label>
            <label className="form-group">
              <span className="form-label">Technician</span>
              <input className="form-input" value={form.technicianName} onChange={(e) => updateField("technicianName", e.target.value)} />
            </label>
            <label className="form-group">
              <span className="form-label">Supervisor</span>
              <input className="form-input" value={form.supervisorName} onChange={(e) => updateField("supervisorName", e.target.value)} />
            </label>
            <label className="form-group" style={{ gridColumn: "1/-1" }}>
              <span className="form-label">Remarks</span>
              <textarea className="form-textarea" rows={3} value={form.remarks} onChange={(e) => updateField("remarks", e.target.value)} />
            </label>
            {isEditing && (
              <label className="form-group" style={{ gridColumn: "1/-1" }}>
                <span className="form-label">Correction Reason *</span>
                <textarea
                  className="form-textarea"
                  rows={3}
                  required
                  value={form.correctionReason}
                  onChange={(e) => updateField("correctionReason", e.target.value)}
                  placeholder="Explain what was wrong and what you corrected."
                />
              </label>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
}
