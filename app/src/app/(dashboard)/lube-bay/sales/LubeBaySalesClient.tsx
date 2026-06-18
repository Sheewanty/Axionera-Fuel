"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Save, Trash2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { createLubeBaySaleAction, updateLubeBaySaleAction } from "@/lib/actions/lube-bay.actions";
import { formatCurrency } from "@/lib/calculations";
import type { CreateLubeBaySaleInput } from "@/lib/schemas/lube-bay.schema";

type DailySessionProps = { id: string; businessDate: string; shift: string; status: string };
type Product = { id: string; name: string; price: number };
type Creditor = { id: string; name: string };
type ServiceType = { id: string; name: string; vehicleCategory: string; defaultLabourCharge: number };
type SaleLine = { productId: string; productName: string; quantity: number; unitPrice: number; amount: number };

type LubeBaySale = {
  id: string;
  vehicleReg: string;
  customerName: string | null;
  customerPhone: string | null;
  serviceTypeId: string | null;
  serviceType: string;
  vehicleCategory: string | null;
  lines: SaleLine[];
  labourCharge: number;
  discount: number;
  totalExpected: number;
  cashAmount: number;
  cardAmount: number;
  momoAmount: number;
  creditorAmount: number;
  creditorId: string | null;
  paymentMode: string;
  momoOperator: string | null;
  momoNumber: string | null;
  cardDetails: string | null;
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
  serviceTypes: ServiceType[];
  supervisorName: string;
  sales: LubeBaySale[];
};

type LineState = { productId: string; quantity: string };
type FormState = {
  id?: string;
  vehicleReg: string;
  customerName: string;
  customerPhone: string;
  serviceTypeId: string;
  vehicleCategory: string;
  lines: LineState[];
  labourCharge: string;
  discount: string;
  paymentMode: "CASH" | "MOMO" | "CARD" | "CREDIT";
  creditorId: string;
  momoOperator: string;
  momoNumber: string;
  cardDetails: string;
  technicianName: string;
  remarks: string;
  correctionReason: string;
};

const emptyForm: FormState = {
  vehicleReg: "",
  customerName: "",
  customerPhone: "",
  serviceTypeId: "",
  vehicleCategory: "",
  lines: [{ productId: "", quantity: "1" }],
  labourCharge: "0",
  discount: "0",
  paymentMode: "CASH",
  creditorId: "",
  momoOperator: "",
  momoNumber: "",
  cardDetails: "",
  technicianName: "",
  remarks: "",
  correctionReason: "",
};

function numberValue(value: string): number {
  return Number(value || 0);
}

function fieldLabel(field: string): string {
  const labels: Record<string, string> = {
    vehicleReg: "Vehicle registration",
    serviceTypeId: "Service type",
    vehicleCategory: "Vehicle category",
    lines: "Products",
    labourCharge: "Labour charge",
    discount: "Discount",
    paymentMode: "Mode of payment",
    creditorId: "Creditor",
    momoOperator: "MoMo operator",
    momoNumber: "MoMo number",
    cardDetails: "Card details",
    correctionReason: "Correction reason",
  };
  return labels[field] ?? field;
}

export default function LubeBaySalesClient({ station, dailySession, products, creditors, serviceTypes, supervisorName, sales }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const canEdit = Boolean(dailySession) && (dailySession?.status === "OPEN" || dailySession?.status === "REOPENED");
  const isEditing = Boolean(form.id);

  const linePreview = useMemo(() => form.lines.map((line) => {
    const product = products.find((item) => item.id === line.productId);
    const quantity = numberValue(line.quantity);
    const unitPrice = product?.price ?? 0;
    return { productId: line.productId, productName: product?.name ?? "", quantity, unitPrice, amount: quantity * unitPrice };
  }), [form.lines, products]);

  const productTotal = linePreview.reduce((sum, line) => sum + line.amount, 0);
  const totalExpected = productTotal + numberValue(form.labourCharge) - numberValue(form.discount);
  const nonCashTotal = form.paymentMode === "CASH" ? 0 : totalExpected;

  const summary = useMemo(() => sales.reduce(
    (acc, sale) => ({
      totalExpected: acc.totalExpected + sale.totalExpected,
      cashAmount: acc.cashAmount + sale.cashAmount,
      nonCash: acc.nonCash + sale.cardAmount + sale.momoAmount + sale.creditorAmount,
      variance: acc.variance + sale.variance,
    }),
    { totalExpected: 0, cashAmount: 0, nonCash: 0, variance: 0 }
  ), [sales]);

  const resetErrors = () => {
    setError(null);
    setFieldErrors({});
  };

  const setField = (field: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const setLine = (index: number, field: keyof LineState, value: string) => {
    setForm((current) => ({
      ...current,
      lines: current.lines.map((line, lineIndex) => lineIndex === index ? { ...line, [field]: value } : line),
    }));
  };

  const addLine = () => setForm((current) => ({ ...current, lines: [...current.lines, { productId: "", quantity: "1" }] }));
  const removeLine = (index: number) => setForm((current) => {
    const lines = current.lines.filter((_, lineIndex) => lineIndex !== index);
    return { ...current, lines: lines.length > 0 ? lines : emptyForm.lines };
  });

  const selectServiceType = (serviceTypeId: string) => {
    const serviceType = serviceTypes.find((item) => item.id === serviceTypeId);
    setForm((current) => ({
      ...current,
      serviceTypeId,
      vehicleCategory: serviceType?.vehicleCategory ?? "",
      labourCharge: serviceType ? String(serviceType.defaultLabourCharge) : current.labourCharge,
    }));
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
      serviceTypeId: sale.serviceTypeId ?? "",
      vehicleCategory: sale.vehicleCategory ?? "",
      lines: sale.lines.length > 0 ? sale.lines.map((line) => ({ productId: line.productId, quantity: String(line.quantity) })) : [{ productId: "", quantity: "1" }],
      labourCharge: String(sale.labourCharge),
      discount: String(sale.discount),
      paymentMode: sale.paymentMode as FormState["paymentMode"],
      creditorId: sale.creditorId ?? "",
      momoOperator: sale.momoOperator ?? "",
      momoNumber: sale.momoNumber ?? "",
      cardDetails: sale.cardDetails ?? "",
      technicianName: sale.technicianName ?? "",
      remarks: sale.remarks ?? "",
      correctionReason: "",
    });
    setOpen(true);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!dailySession) return;

    const payload: CreateLubeBaySaleInput = {
      stationId: station.id,
      dailySessionId: dailySession.id,
      vehicleReg: form.vehicleReg,
      customerName: form.customerName || undefined,
      customerPhone: form.customerPhone || undefined,
      serviceTypeId: form.serviceTypeId,
      vehicleCategory: form.vehicleCategory as CreateLubeBaySaleInput["vehicleCategory"],
      lines: form.lines.filter((line) => line.productId).map((line) => ({ productId: line.productId, quantity: numberValue(line.quantity) })),
      labourCharge: numberValue(form.labourCharge),
      discount: numberValue(form.discount),
      paymentMode: form.paymentMode,
      creditorId: form.creditorId || undefined,
      momoOperator: form.momoOperator || undefined,
      momoNumber: form.momoNumber || undefined,
      cardDetails: form.cardDetails || undefined,
      technicianName: form.technicianName || undefined,
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
        <button className="btn btn-primary" onClick={openNew} disabled={!canEdit || serviceTypes.length === 0 || products.length === 0}>
          <Plus size={14} />
          Record Lube Bay Sale
        </button>
      </div>

      {serviceTypes.length === 0 && <div className="dash-panel" style={{ padding: 16, color: "var(--ax-amber)", marginBottom: 20 }}>Set up lube bay service types before recording sales.</div>}
      {products.length === 0 && <div className="dash-panel" style={{ padding: 16, color: "var(--ax-amber)", marginBottom: 20 }}>Set up lube bay products and prices before recording sales.</div>}
      {!dailySession && <div className="dash-panel" style={{ padding: 16, color: "var(--ax-muted)", marginBottom: 20 }}>Open today&apos;s session before recording lube bay sales.</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 16, marginBottom: 20 }}>
        <div className="dash-panel"><div className="kpi-label">Expected Sales</div><div className="kpi-value" style={{ fontSize: 28 }}>{formatCurrency(summary.totalExpected)}</div></div>
        <div className="dash-panel"><div className="kpi-label">Cash Received</div><div className="kpi-value" style={{ fontSize: 28 }}>{formatCurrency(summary.cashAmount)}</div></div>
        <div className="dash-panel"><div className="kpi-label">Non-Cash / Credit</div><div className="kpi-value" style={{ fontSize: 28 }}>{formatCurrency(summary.nonCash)}</div></div>
        <div className="dash-panel"><div className="kpi-label">Variance</div><div className="kpi-value" style={{ fontSize: 28 }}>{formatCurrency(summary.variance)}</div></div>
      </div>

      <div className="table-wrapper">
        <div className="table-toolbar">
          <div className="table-title">Lube Bay Sales Register</div>
          <div style={{ color: "var(--ax-muted)", fontSize: 12 }}>{dailySession ? `${station.name} | ${dailySession.businessDate} | ${dailySession.shift} Shift` : station.name}</div>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Vehicle</th><th>Service</th><th>Products</th><th>Payment</th><th style={{ textAlign: "right" }}>Expected</th><th style={{ textAlign: "right" }}>Variance</th><th>Actions</th></tr></thead>
            <tbody>
              {sales.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: "center", padding: 28, color: "var(--ax-muted)" }}>No lube bay sales recorded for this session.</td></tr>
              ) : sales.map((sale) => (
                <tr key={sale.id}>
                  <td style={{ fontWeight: 700 }}>{sale.vehicleReg}</td>
                  <td>{sale.serviceType}<div style={{ color: "var(--ax-muted)", fontSize: 12 }}>{sale.vehicleCategory}</div></td>
                  <td>{sale.lines.map((line) => `${line.productName} x ${line.quantity}`).join(", ") || "-"}</td>
                  <td>{sale.paymentMode}</td>
                  <td style={{ textAlign: "right", fontWeight: 700 }}>{formatCurrency(sale.totalExpected)}</td>
                  <td style={{ textAlign: "right", fontWeight: 700 }}>{formatCurrency(sale.variance)}</td>
                  <td><button className="btn btn-outline btn-sm" onClick={() => openEdit(sale)} disabled={!canEdit}>Correct</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={open}
        title={isEditing ? "Correct Lube Bay Sale" : "Record Lube Bay Sale"}
        onClose={() => setOpen(false)}
        size="lg"
        footer={<><button className="btn btn-outline" onClick={() => setOpen(false)} disabled={isPending}>Cancel</button><button className="btn btn-primary" type="submit" form="lube-bay-sale-form" disabled={isPending}><Save size={16} />{isPending ? "Saving..." : isEditing ? "Save Correction" : "Save Sale"}</button></>}
      >
        {error && (
          <div style={{ color: "var(--ax-red)", marginBottom: 12, fontSize: 14 }}>
            <strong>{error}</strong>
            {Object.keys(fieldErrors).length > 0 && <ul style={{ margin: "6px 0 0 18px" }}>{Object.entries(fieldErrors).flatMap(([field, messages]) => messages.map((message) => <li key={`${field}-${message}`}>{fieldLabel(field)}: {message}</li>))}</ul>}
          </div>
        )}

        <form id="lube-bay-sale-form" onSubmit={handleSubmit}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <label className="form-group"><span className="form-label">Vehicle Registration *</span><input className="form-input" value={form.vehicleReg} onChange={(e) => setField("vehicleReg", e.target.value)} required /></label>
            <label className="form-group"><span className="form-label">Service Type *</span><select className="form-select" value={form.serviceTypeId} onChange={(e) => selectServiceType(e.target.value)} required><option value="">Select service</option>{serviceTypes.map((service) => <option key={service.id} value={service.id}>{service.name} - {service.vehicleCategory}</option>)}</select></label>
            <label className="form-group"><span className="form-label">Vehicle Category</span><input className="form-input computed" value={form.vehicleCategory} readOnly /></label>
            <label className="form-group"><span className="form-label">Supervisor</span><input className="form-input computed" value={supervisorName} readOnly /></label>
            <label className="form-group"><span className="form-label">Customer Name</span><input className="form-input" value={form.customerName} onChange={(e) => setField("customerName", e.target.value)} /></label>
            <label className="form-group"><span className="form-label">Customer Phone</span><input className="form-input" value={form.customerPhone} onChange={(e) => setField("customerPhone", e.target.value)} /></label>
          </div>

          <div className="dash-panel" style={{ marginTop: 12, padding: 14 }}>
            <div className="dash-panel-title" style={{ marginBottom: 12 }}>Products</div>
            {form.lines.map((line, index) => {
              const preview = linePreview[index];
              return (
                <div key={index} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr auto", gap: 10, alignItems: "end", marginBottom: 10 }}>
                  <label className="form-group"><span className="form-label">Product</span><select className="form-select" value={line.productId} onChange={(e) => setLine(index, "productId", e.target.value)} required><option value="">Select product</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>
                  <label className="form-group"><span className="form-label">Quantity</span><input className="form-input" type="number" min="0.01" step="0.01" value={line.quantity} onChange={(e) => setLine(index, "quantity", e.target.value)} required /></label>
                  <label className="form-group"><span className="form-label">Unit Price</span><input className="form-input computed" value={formatCurrency(preview?.unitPrice ?? 0)} readOnly /></label>
                  <label className="form-group"><span className="form-label">Amount</span><input className="form-input computed" value={formatCurrency(preview?.amount ?? 0)} readOnly /></label>
                  <button type="button" className="btn btn-outline" onClick={() => removeLine(index)} disabled={form.lines.length === 1}><Trash2 size={14} /></button>
                </div>
              );
            })}
            <button type="button" className="btn btn-outline btn-sm" onClick={addLine}><Plus size={13} /> Add Product</button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 }}>
            <label className="form-group"><span className="form-label">Labour Charge</span><input className="form-input" type="number" min="0" step="0.01" value={form.labourCharge} onChange={(e) => setField("labourCharge", e.target.value)} /></label>
            <label className="form-group"><span className="form-label">Discount</span><input className="form-input" type="number" min="0" step="0.01" value={form.discount} onChange={(e) => setField("discount", e.target.value)} /></label>
            <label className="form-group"><span className="form-label">Total Expected (Computed)</span><input className="form-input computed" value={formatCurrency(totalExpected)} readOnly /></label>
            <label className="form-group"><span className="form-label">Mode of Payment</span><select className="form-select" value={form.paymentMode} onChange={(e) => setField("paymentMode", e.target.value as FormState["paymentMode"])}><option value="CASH">Cash</option><option value="MOMO">MoMo</option><option value="CARD">Card / Go Card</option><option value="CREDIT">Credit</option></select></label>
            {form.paymentMode === "CREDIT" && <label className="form-group"><span className="form-label">Creditor *</span><select className="form-select" value={form.creditorId} onChange={(e) => setField("creditorId", e.target.value)} required><option value="">Select creditor</option>{creditors.map((creditor) => <option key={creditor.id} value={creditor.id}>{creditor.name}</option>)}</select></label>}
            {form.paymentMode === "MOMO" && <><label className="form-group"><span className="form-label">MoMo Operator *</span><input className="form-input" value={form.momoOperator} onChange={(e) => setField("momoOperator", e.target.value)} required /></label><label className="form-group"><span className="form-label">MoMo Number *</span><input className="form-input" value={form.momoNumber} onChange={(e) => setField("momoNumber", e.target.value)} required /></label></>}
            {form.paymentMode === "CARD" && <label className="form-group"><span className="form-label">Card / Go Card Details *</span><input className="form-input" value={form.cardDetails} onChange={(e) => setField("cardDetails", e.target.value)} required /></label>}
            {nonCashTotal > 0 && <label className="form-group"><span className="form-label">Non-Cash Amount (Computed)</span><input className="form-input computed" value={formatCurrency(nonCashTotal)} readOnly /></label>}
            <label className="form-group"><span className="form-label">Technician</span><input className="form-input" value={form.technicianName} onChange={(e) => setField("technicianName", e.target.value)} /></label>
            <label className="form-group" style={{ gridColumn: "1/-1" }}><span className="form-label">Remarks</span><textarea className="form-textarea" rows={3} value={form.remarks} onChange={(e) => setField("remarks", e.target.value)} /></label>
            {isEditing && <label className="form-group" style={{ gridColumn: "1/-1" }}><span className="form-label">Correction Reason *</span><textarea className="form-textarea" rows={3} required value={form.correctionReason} onChange={(e) => setField("correctionReason", e.target.value)} /></label>}
          </div>
        </form>
      </Modal>
    </div>
  );
}
