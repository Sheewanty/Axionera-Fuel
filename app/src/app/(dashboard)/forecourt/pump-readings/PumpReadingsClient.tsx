"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import DataTable from "@/components/ui/DataTable";
import VarianceBadge from "@/components/ui/VarianceBadge";
import Modal from "@/components/ui/Modal";
import { formatCurrency, formatLitres } from "@/lib/calculations";
import { submitPumpReading } from "@/lib/actions/pump-reading.actions";

type NozzleInfo = {
  id: string;
  name: string;
  pumpId: string;
  pumpName: string;
  productId: string;
  productName: string;
  pricePerLitre: number;
  previousMeter: number;
};

type PumpReadingView = {
  id: string;
  pump: string;
  nozzle: string;
  product: string;
  attendant: string;
  previousMeter: number;
  currentMeter: number;
  litresSold: number;
  pricePerLitre: number;
  amountExpected: number;
  cashReceived: number;
  gocardAmount: number;
  couponAmount: number;
  ghqrAmount: number;
  creditorsAmount: number;
  variance: number;
};

const fieldLabels: Record<string, string> = {
  stationId: "Station",
  dailySessionId: "Daily session",
  businessDate: "Business date",
  shift: "Shift",
  pumpId: "Pump",
  nozzleId: "Nozzle",
  productId: "Product",
  previousLitre: "Previous meter",
  currentLitre: "Current meter",
  pricePerLitre: "Price per litre",
  cashReceived: "Cash received",
  gocardAmount: "GO Card / Visa",
  couponAmount: "GOIL Coupon",
  ghqrAmount: "GHQR / Mobile Money",
  creditorsAmount: "Creditors",
  remarks: "Remarks",
};

function fieldLabel(field: string): string {
  return fieldLabels[field] ?? field;
}

export default function PumpReadingsClient({
  stationId,
  dailySessionId,
  businessDate,
  readings,
  nozzles,
}: {
  stationId: string;
  dailySessionId: string;
  businessDate: string;
  readings: PumpReadingView[];
  nozzles: NozzleInfo[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  // Form state
  const [selectedNozzleId, setSelectedNozzleId] = useState(nozzles[0]?.id || "");
  const [currentMeter, setCurrentMeter] = useState("");
  const [cashReceived, setCashReceived] = useState("");
  const [gocardAmount, setGocardAmount] = useState("");
  const [couponAmount, setCouponAmount] = useState("");
  const [ghqrAmount, setGhqrAmount] = useState("");
  const [creditorsAmount, setCreditorsAmount] = useState("");

  const selectedNozzle = nozzles.find((n) => n.id === selectedNozzleId);
  const price = selectedNozzle?.pricePerLitre || 0;
  const prevMeter = selectedNozzle?.previousMeter || 0;

  const parsedCurrent = parseFloat(currentMeter) || 0;
  const litresSold = Math.max(0, parsedCurrent - prevMeter);
  const expectedAmount = litresSold * price;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNozzle) return;

    setError(null);
    setFieldErrors({});
    const formData = new FormData();
    formData.append("stationId", stationId);
    formData.append("dailySessionId", dailySessionId);
    formData.append("businessDate", businessDate);
    formData.append("shift", "DAY"); // Hardcoded for demo
    formData.append("pumpId", selectedNozzle.pumpId);
    formData.append("nozzleId", selectedNozzle.id);
    formData.append("productId", selectedNozzle.productId);
    formData.append("previousLitre", prevMeter.toString());
    formData.append("currentLitre", currentMeter);
    formData.append("pricePerLitre", price.toString());
    formData.append("cashReceived", cashReceived || "0");
    formData.append("gocardAmount", gocardAmount || "0");
    formData.append("couponAmount", couponAmount || "0");
    formData.append("ghqrAmount", ghqrAmount || "0");
    formData.append("creditorsAmount", creditorsAmount || "0");
    
    // We should pass pumpId. Let's fix that.

    startTransition(async () => {
      const res = await submitPumpReading(stationId, formData);
      if (res.success) {
        setOpen(false);
        setCurrentMeter("");
        setCashReceived("");
        setGocardAmount("");
        setCouponAmount("");
        setGhqrAmount("");
        setCreditorsAmount("");
        router.refresh();
      } else {
        setError(res.fieldErrors ? "Please correct the highlighted fields." : res.error || "Failed to save reading");
        setFieldErrors(res.fieldErrors ?? {});
      }
    });
  };

  return (
    <>
      <div style={{ marginBottom: "20px" }}>
        <button className="btn btn-primary" onClick={() => setOpen(true)}>
          <Plus size={13} />
          Add Reading
        </button>
      </div>

      <DataTable<PumpReadingView>
        title="Nozzle Meter Readings"
        columns={[
          { key: "pump", header: "Pump" },
          { key: "nozzle", header: "Nozzle" },
          { key: "product", header: "Product" },
          { key: "previousMeter", header: "Prev Meter (L)", align: "right", render: (r) => r.previousMeter.toFixed(2) },
          { key: "currentMeter", header: "Curr Meter (L)", align: "right", render: (r) => r.currentMeter.toFixed(2) },
          { key: "litresSold", header: "Litres Sold", align: "right", computed: true, render: (r) => formatLitres(r.litresSold) },
          { key: "pricePerLitre", header: "Price/L", align: "right", render: (r) => `GHS ${r.pricePerLitre.toFixed(4)}` },
          { key: "amountExpected", header: "Expected", align: "right", computed: true, render: (r) => formatCurrency(r.amountExpected) },
          { key: "cashReceived", header: "Cash", align: "right", render: (r) => formatCurrency(r.cashReceived) },
          { key: "gocardAmount", header: "GO Card", align: "right", render: (r) => r.gocardAmount ? formatCurrency(r.gocardAmount) : "—" },
          { key: "couponAmount", header: "Coupon", align: "right", render: (r) => r.couponAmount ? formatCurrency(r.couponAmount) : "—" },
          {
            key: "variance",
            header: "Variance",
            align: "right",
            computed: true,
            render: (r) => <VarianceBadge value={r.variance} format={(v) => formatCurrency(Math.abs(v)) + (v < 0 ? " short" : " over")} warningThreshold={200} dangerThreshold={1000} />,
          },
        ]}
        data={readings}
        getRowKey={(r) => r.id}
      />

      <Modal
        open={open}
        title="Add Pump Reading"
        onClose={() => setOpen(false)}
        size="lg"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setOpen(false)} disabled={isPending}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={isPending}>
              {isPending ? "Saving..." : "Save Reading"}
            </button>
          </>
        }
      >
        {error && (
          <div
            role="alert"
            style={{
              color: "var(--ax-red)",
              border: "1px solid color-mix(in srgb, var(--ax-red) 30%, transparent)",
              borderRadius: 8,
              background: "color-mix(in srgb, var(--ax-red) 7%, white)",
              padding: "10px 12px",
              marginBottom: "14px",
              fontSize: 14,
              lineHeight: 1.4,
            }}
          >
            <div style={{ fontWeight: 700 }}>{error}</div>
            {Object.keys(fieldErrors).length > 0 && (
              <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>
                {Object.entries(fieldErrors).flatMap(([field, messages]) =>
                  messages.map((message) => (
                    <li key={`${field}-${message}`}>
                      <strong>{fieldLabel(field)}:</strong> {message}
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
          <div className="form-group" style={{ gridColumn: "1/-1" }}>
            <label className="form-label">Pump / Nozzle</label>
            <select 
              className="form-select" 
              value={selectedNozzleId} 
              onChange={(e) => setSelectedNozzleId(e.target.value)}
              disabled={isPending}
            >
              {nozzles.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.pumpName} — {n.name} ({n.productName})
                </option>
              ))}
            </select>
          </div>
          
          <div className="form-group">
            <label className="form-label">Previous Meter (L)</label>
            <input className="form-input computed" type="number" readOnly value={prevMeter.toFixed(2)} />
          </div>
          <div className="form-group">
            <label className="form-label">Current Meter (L)</label>
            <input 
              className="form-input" type="number" step="0.01" 
              value={currentMeter} onChange={(e) => setCurrentMeter(e.target.value)} 
              disabled={isPending}
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">Litres Sold (computed)</label>
            <input className="form-input computed" type="text" readOnly value={formatLitres(litresSold)} />
          </div>
          <div className="form-group">
            <label className="form-label">Expected Amount (computed)</label>
            <input className="form-input computed" type="text" readOnly value={formatCurrency(expectedAmount)} />
          </div>
          
          {/* Channels */}
          <div className="form-group">
            <label className="form-label">Cash Received</label>
            <input className="form-input" type="number" step="0.01" value={cashReceived} onChange={e => setCashReceived(e.target.value)} disabled={isPending} />
          </div>
          <div className="form-group">
            <label className="form-label">GO Card / Visa</label>
            <input className="form-input" type="number" step="0.01" value={gocardAmount} onChange={e => setGocardAmount(e.target.value)} disabled={isPending} />
          </div>
          <div className="form-group">
            <label className="form-label">GOIL Coupon</label>
            <input className="form-input" type="number" step="0.01" value={couponAmount} onChange={e => setCouponAmount(e.target.value)} disabled={isPending} />
          </div>
          <div className="form-group">
            <label className="form-label">GHQR / Mobile Money</label>
            <input className="form-input" type="number" step="0.01" value={ghqrAmount} onChange={e => setGhqrAmount(e.target.value)} disabled={isPending} />
          </div>
          <div className="form-group">
            <label className="form-label">Creditors (Credit Sales)</label>
            <input className="form-input" type="number" step="0.01" value={creditorsAmount} onChange={e => setCreditorsAmount(e.target.value)} disabled={isPending} />
          </div>
        </div>
      </Modal>
    </>
  );
}
