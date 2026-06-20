"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Edit, Plus } from "lucide-react";
import DataTable from "@/components/ui/DataTable";
import VarianceBadge from "@/components/ui/VarianceBadge";
import Modal from "@/components/ui/Modal";
import { formatLitres, calcTankVariance } from "@/lib/calculations";
import { correctTankDippingAction, submitTankDipping } from "@/lib/actions/tank-dipping.actions";

type TankInfo = {
  id: string;
  name: string;
  productId: string;
  productName: string;
  openingStock: number;
  hasPreviousDipping: boolean;
  meterSold: number;
};

type TankDippingView = {
  id: string;
  tankId: string;
  tank: string;
  productId: string;
  product: string;
  openingStock: number;
  receipts: number;
  meterSold: number;
  closingStock: number;
  varianceLitres: number;
  waterTest: string;
  closingDipCm: number | null;
  remarks: string | null;
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
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [correctionTarget, setCorrectionTarget] = useState<TankDippingView | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [selectedTankId, setSelectedTankId] = useState(tanks[0]?.id || "");
  const [initialOpeningStockLitres, setInitialOpeningStockLitres] = useState("");
  const [receiptsLitres, setReceiptsLitres] = useState("");
  const [closingStockLitres, setClosingStockLitres] = useState("");
  const [closingDipCm, setClosingDipCm] = useState("");
  const [waterTestStatus, setWaterTestStatus] = useState("CLEAR");
  const [remarks, setRemarks] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");

  const selectedTank = tanks.find((t) => t.id === selectedTankId);
  
  const parsedInitialOpening = parseFloat(initialOpeningStockLitres) || 0;
  const openingStock = correctionTarget
    ? correctionTarget.openingStock
    : selectedTank?.hasPreviousDipping
      ? selectedTank.openingStock
      : parsedInitialOpening;
  const isOpeningStockEditable = Boolean(selectedTank && !selectedTank.hasPreviousDipping && !correctionTarget);
  const meterSold = selectedTank?.meterSold || 0;

  const parsedReceipts = parseFloat(receiptsLitres) || 0;
  const parsedClosing = parseFloat(closingStockLitres) || 0;
  const varianceLitres = calcTankVariance(openingStock, parsedReceipts, meterSold, parsedClosing);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTank) return;

    setError(null);
    const formData = new FormData();
    if (correctionTarget) {
      formData.append("id", correctionTarget.id);
      formData.append("correctionReason", correctionReason);
    }
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
      const res = correctionTarget
        ? await correctTankDippingAction(stationId, formData)
        : await submitTankDipping(stationId, formData);
      if (res.success) {
        setOpen(false);
        setCorrectionTarget(null);
        setInitialOpeningStockLitres("");
        setReceiptsLitres("");
        setClosingStockLitres("");
        setClosingDipCm("");
        setWaterTestStatus("CLEAR");
        setRemarks("");
        setCorrectionReason("");
        router.refresh();
      } else {
        setError(res.error || "Failed to save tank dipping");
      }
    });
  };

  const openCorrection = (dipping: TankDippingView) => {
    setCorrectionTarget(dipping);
    setSelectedTankId(dipping.tankId);
    setInitialOpeningStockLitres("");
    setReceiptsLitres(dipping.receipts.toString());
    setClosingStockLitres(dipping.closingStock.toString());
    setClosingDipCm(dipping.closingDipCm?.toString() ?? "");
    setWaterTestStatus(dipping.waterTest);
    setRemarks(dipping.remarks ?? "");
    setCorrectionReason("");
    setError(null);
    setOpen(true);
  };

  return (
    <>
      <div style={{ marginBottom: "20px" }}>
        <button className="btn btn-primary" onClick={() => {
          setCorrectionTarget(null);
          setInitialOpeningStockLitres("");
          setOpen(true);
        }}>
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
          {
            key: "id",
            header: "Actions",
            align: "right",
            render: (r) => (
              <button
                type="button"
                className="btn btn-outline"
                style={{ width: 34, height: 34, padding: 0 }}
                aria-label="Correct tank dipping"
                onClick={() => openCorrection(r)}
              >
                <Edit size={14} />
              </button>
            ),
          },
        ]}
        data={dippings}
        getRowKey={(r) => r.id}
      />

      <Modal
        open={open}
        title={correctionTarget ? "Correct Tank Dipping" : "Add Tank Dipping"}
        onClose={() => {
          setOpen(false);
          setCorrectionTarget(null);
        }}
        size="md"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => {
              setOpen(false);
              setCorrectionTarget(null);
            }} disabled={isPending}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={isPending}>
              {isPending ? "Saving..." : correctionTarget ? "Save Correction" : "Save Record"}
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
              onChange={(e) => {
                setSelectedTankId(e.target.value);
                setInitialOpeningStockLitres("");
              }}
              disabled={isPending || Boolean(correctionTarget)}
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
            <input
              className={`form-input ${isOpeningStockEditable ? "" : "computed"}`}
              type="number"
              step="1"
              min="0"
              readOnly={!isOpeningStockEditable}
              value={isOpeningStockEditable ? initialOpeningStockLitres : openingStock}
              onChange={(e) => setInitialOpeningStockLitres(e.target.value)}
              placeholder={isOpeningStockEditable ? "Enter first opening stock" : undefined}
              disabled={isPending}
            />
            {isOpeningStockEditable && (
              <div className="form-help">
                First record for this tank. Later opening stock will come from the previous closing stock.
              </div>
            )}
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
          {correctionTarget && (
            <div className="form-group" style={{ gridColumn: "1/-1" }}>
              <label className="form-label">Correction Reason *</label>
              <textarea
                className="form-textarea"
                rows={3}
                required
                placeholder="Explain what was wrong and what you corrected."
                value={correctionReason}
                onChange={(e) => setCorrectionReason(e.target.value)}
                disabled={isPending}
              />
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
