"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import DataTable from "@/components/ui/DataTable";
import VarianceBadge from "@/components/ui/VarianceBadge";
import Modal from "@/components/ui/Modal";
import { formatLitres, calcTankVariance } from "@/lib/calculations";
import { submitTankDipping } from "@/lib/actions/tank-dipping.actions";

type TankInfo = {
  id: string;
  name: string;
  productId: string;
  productName: string;
  openingStock: number;
  meterSold: number;
};

type TankDippingView = {
  id: string;
  tank: string;
  product: string;
  openingStock: number;
  receipts: number;
  meterSold: number;
  closingStock: number;
  varianceLitres: number;
  waterTest: string;
  closingDipCm: number | null;
};

export default function TankDippingClient({
  stationId,
  dailySessionId,
  businessDate,
  dippings,
  tanks,
}: {
  stationId: string;
  dailySessionId: string;
  businessDate: string;
  dippings: TankDippingView[];
  tanks: TankInfo[];
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [selectedTankId, setSelectedTankId] = useState(tanks[0]?.id || "");
  const [receiptsLitres, setReceiptsLitres] = useState("");
  const [closingStockLitres, setClosingStockLitres] = useState("");
  const [closingDipCm, setClosingDipCm] = useState("");
  const [waterTestStatus, setWaterTestStatus] = useState("CLEAR");
  const [remarks, setRemarks] = useState("");

  const selectedTank = tanks.find((t) => t.id === selectedTankId);
  
  const openingStock = selectedTank?.openingStock || 0;
  const meterSold = selectedTank?.meterSold || 0;

  const parsedReceipts = parseFloat(receiptsLitres) || 0;
  const parsedClosing = parseFloat(closingStockLitres) || 0;
  const varianceLitres = calcTankVariance(openingStock, parsedReceipts, meterSold, parsedClosing);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTank) return;

    setError(null);
    const formData = new FormData();
    formData.append("stationId", stationId);
    formData.append("dailySessionId", dailySessionId);
    formData.append("businessDate", businessDate);
    formData.append("tankId", selectedTank.id);
    formData.append("productId", selectedTank.productId);
    formData.append("openingStockLitres", openingStock.toString());
    formData.append("receiptsLitres", receiptsLitres || "0");
    formData.append("meterSoldLitres", meterSold.toString());
    formData.append("closingStockLitres", closingStockLitres);
    if (closingDipCm) formData.append("closingDipCm", closingDipCm);
    formData.append("waterTestStatus", waterTestStatus);
    if (remarks) formData.append("remarks", remarks);

    startTransition(async () => {
      const res = await submitTankDipping(stationId, formData);
      if (res.success) {
        setOpen(false);
        setReceiptsLitres("");
        setClosingStockLitres("");
        setClosingDipCm("");
        setWaterTestStatus("CLEAR");
        setRemarks("");
      } else {
        setError(res.error || "Failed to save tank dipping");
      }
    });
  };

  return (
    <>
      <div style={{ marginBottom: "20px" }}>
        <button className="btn btn-primary" onClick={() => setOpen(true)}>
          <Plus size={13} />
          Add Dipping Record
        </button>
      </div>

      <DataTable<TankDippingView>
        title="Tank Stock Control"
        columns={[
          { key: "tank", header: "Tank" },
          { key: "product", header: "Product" },
          { key: "openingStock", header: "Opening (L)", align: "right", render: (r) => formatLitres(r.openingStock) },
          { key: "receipts", header: "Receipts (L)", align: "right", render: (r) => formatLitres(r.receipts) },
          { key: "meterSold", header: "Meter Sold (L)", align: "right", computed: true, render: (r) => formatLitres(r.meterSold) },
          { key: "closingDipCm", header: "Dip (cm)", align: "right", render: (r) => r.closingDipCm != null ? `${r.closingDipCm.toFixed(1)} cm` : "—" },
          { key: "closingStock", header: "Closing (L)", align: "right", render: (r) => formatLitres(r.closingStock) },
          {
            key: "varianceLitres",
            header: "Variance (L)",
            align: "right",
            computed: true,
            render: (r) => <VarianceBadge value={r.varianceLitres} format={(v) => `${v > 0 ? "+" : ""}${v.toFixed(2)} L`} warningThreshold={30} dangerThreshold={100} />,
          },
          {
            key: "waterTest",
            header: "Water Test",
            render: (r) => (
              <span style={{ fontSize: 12, fontWeight: 600, color: r.waterTest === "CLEAR" ? "var(--ax-green)" : (r.waterTest === "NOT_TESTED" ? "var(--ax-slate-500)" : "var(--ax-red)") }}>
                {r.waterTest === "CLEAR" ? "✓ Clear" : (r.waterTest === "NOT_TESTED" ? "—" : "⚠ Water Detected")}
              </span>
            ),
          },
        ]}
        data={dippings}
        getRowKey={(r) => r.id}
      />

      <Modal
        open={open}
        title="Add Tank Dipping"
        onClose={() => setOpen(false)}
        size="md"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setOpen(false)} disabled={isPending}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={isPending}>
              {isPending ? "Saving..." : "Save Record"}
            </button>
          </>
        }
      >
        {error && <div style={{ color: "red", marginBottom: "10px" }}>{error}</div>}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
          <div className="form-group" style={{ gridColumn: "1/-1" }}>
            <label className="form-label">Tank / Product</label>
            <select 
              className="form-select" 
              value={selectedTankId} 
              onChange={(e) => setSelectedTankId(e.target.value)}
              disabled={isPending}
            >
              {tanks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.productName})
                </option>
              ))}
            </select>
          </div>
          
          <div className="form-group">
            <label className="form-label">Opening Stock (L)</label>
            <input className="form-input computed" type="number" readOnly value={openingStock} />
          </div>
          <div className="form-group">
            <label className="form-label">Receipts (L)</label>
            <input 
              className="form-input" type="number" step="1" 
              value={receiptsLitres} onChange={(e) => setReceiptsLitres(e.target.value)} 
              disabled={isPending} placeholder="e.g. 0"
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">Meter Sold (L) - computed</label>
            <input className="form-input computed" type="text" readOnly value={formatLitres(meterSold)} />
          </div>
          <div className="form-group">
            <label className="form-label">Closing Dip (cm)</label>
            <input 
              className="form-input" type="number" step="0.1" 
              value={closingDipCm} onChange={(e) => setClosingDipCm(e.target.value)} 
              disabled={isPending} placeholder="Optional"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Closing Stock (L)</label>
            <input 
              className="form-input" type="number" step="1" 
              value={closingStockLitres} onChange={(e) => setClosingStockLitres(e.target.value)} 
              disabled={isPending} placeholder="Read from chart"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Variance (L)</label>
            <input 
              className="form-input computed" type="text" readOnly 
              value={`${varianceLitres > 0 ? "+" : ""}${varianceLitres.toFixed(2)} L`} 
              style={{ color: Math.abs(varianceLitres) > 30 ? "var(--ax-red)" : "inherit" }}
            />
          </div>

          <div className="form-group" style={{ gridColumn: "1/-1" }}>
            <label className="form-label">Water Test Status</label>
            <select 
              className="form-select" 
              value={waterTestStatus} 
              onChange={(e) => setWaterTestStatus(e.target.value)}
              disabled={isPending}
            >
              <option value="CLEAR">Clear</option>
              <option value="DETECTED">Water Detected</option>
              <option value="NOT_TESTED">Not Tested</option>
            </select>
          </div>

          <div className="form-group" style={{ gridColumn: "1/-1" }}>
            <label className="form-label">Remarks</label>
            <textarea 
              className="form-textarea" rows={2} placeholder="Optional notes..." 
              value={remarks} onChange={(e) => setRemarks(e.target.value)}
              disabled={isPending}
            />
          </div>
        </div>
      </Modal>
    </>
  );
}
