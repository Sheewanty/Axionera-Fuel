"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import Modal from "@/components/ui/Modal";
import VarianceBadge from "@/components/ui/VarianceBadge";
import { createStockAdjustmentAction } from "@/lib/actions/stock-adjustment.actions";
import { formatLitres } from "@/lib/calculations";
import { formatReportDate } from "@/lib/reports";

type TankOption = {
  id: string;
  name: string;
  productId: string;
  productName: string;
};

type StockAdjustmentView = {
  id: string;
  tank: string;
  product: string;
  adjustmentType: string;
  direction: string;
  litres: number;
  authorityReason: string | null;
  reference: string | null;
  recordedByName: string | null;
  approvedByName: string | null;
  approvalStatus: string;
  remarks: string | null;
  createdAt: string;
};

export default function StockAdjustmentsClient({
  stationId,
  dailySessionId,
  businessDate,
  sessionStatus,
  tanks,
  adjustments,
}: {
  stationId: string;
  dailySessionId: string;
  businessDate: string;
  sessionStatus: string;
  tanks: TankOption[];
  adjustments: StockAdjustmentView[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tankId, setTankId] = useState(tanks[0]?.id ?? "");
  const [adjustmentType, setAdjustmentType] = useState("REGULATORY_INSPECTION");
  const [direction, setDirection] = useState("OUT");
  const [litres, setLitres] = useState("");
  const [authorityReason, setAuthorityReason] = useState("NPA inspection draw-off");
  const [reference, setReference] = useState("");
  const [recordedByName, setRecordedByName] = useState("");
  const [approvedByName, setApprovedByName] = useState("");
  const [approvalStatus, setApprovalStatus] = useState("APPROVED");
  const [remarks, setRemarks] = useState("");

  const selectedTank = useMemo(() => tanks.find((tank) => tank.id === tankId), [tankId, tanks]);
  const canRecord = sessionStatus === "OPEN" || sessionStatus === "REOPENED";

  const resetForm = () => {
    setTankId(tanks[0]?.id ?? "");
    setAdjustmentType("REGULATORY_INSPECTION");
    setDirection("OUT");
    setLitres("");
    setAuthorityReason("NPA inspection draw-off");
    setReference("");
    setRecordedByName("");
    setApprovedByName("");
    setApprovalStatus("APPROVED");
    setRemarks("");
    setError(null);
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedTank) {
      setError("Select a tank.");
      return;
    }

    setLoading(true);
    setError(null);

    const response = await createStockAdjustmentAction({
      stationId,
      dailySessionId,
      businessDate: new Date(businessDate),
      tankId: selectedTank.id,
      productId: selectedTank.productId,
      adjustmentType: adjustmentType as "REGULATORY_INSPECTION" | "STOCK_CORRECTION" | "EVAPORATION" | "OTHER",
      direction: direction as "IN" | "OUT",
      litres: Number(litres),
      authorityReason,
      reference,
      recordedByName,
      approvedByName,
      approvalStatus: approvalStatus as "PENDING" | "APPROVED" | "REJECTED",
      remarks,
    });

    setLoading(false);
    if (!response.success) {
      const firstFieldError = response.fieldErrors
        ? Object.entries(response.fieldErrors).find(([, messages]) => messages.length > 0)
        : null;
      setError(firstFieldError ? `${firstFieldError[0]}: ${firstFieldError[1][0]}` : response.error ?? "Unable to save stock adjustment.");
      return;
    }

    setOpen(false);
    resetForm();
    router.refresh();
  };

  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!canRecord || tanks.length === 0}
          onClick={() => {
            resetForm();
            setOpen(true);
          }}
        >
          <Plus size={16} />
          Add Stock Adjustment
        </button>
      </div>

      {!canRecord && (
        <div className="alert-box warning" style={{ marginBottom: 16 }}>
          This session is {sessionStatus.replace(/_/g, " ")}. Stock adjustments can only be recorded while the session is open or reopened.
        </div>
      )}

      <div className="dash-panel">
        <div className="dash-panel-head">
          <div>
            <div className="dash-panel-title">Stock Adjustment Register</div>
            <div className="dash-panel-sub">Approved OUT adjustments reduce expected closing stock without creating sales or cash.</div>
          </div>
        </div>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Tank</th>
                <th>Product</th>
                <th>Type</th>
                <th>Direction</th>
                <th style={{ textAlign: "right" }}>Litres</th>
                <th>Reference</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {adjustments.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", color: "var(--ax-muted)", padding: 24 }}>
                    No stock adjustments have been recorded for this session.
                  </td>
                </tr>
              ) : (
                adjustments.map((row) => (
                  <tr key={row.id}>
                    <td>{formatReportDate(new Date(row.createdAt))}</td>
                    <td style={{ fontWeight: 700 }}>{row.tank}</td>
                    <td>{row.product}</td>
                    <td>{row.adjustmentType.replace(/_/g, " ")}</td>
                    <td>{row.direction}</td>
                    <td style={{ textAlign: "right" }}>
                      <VarianceBadge
                        value={row.direction === "OUT" ? -row.litres : row.litres}
                        format={(value) => formatLitres(Math.abs(value))}
                      />
                    </td>
                    <td>{row.reference ?? "-"}</td>
                    <td>
                      <span className={`status-badge ${row.approvalStatus === "APPROVED" ? "success" : row.approvalStatus === "REJECTED" ? "danger" : "warning"}`}>
                        {row.approvalStatus}
                      </span>
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
        title="Add Stock Adjustment"
        onClose={() => {
          if (!loading) setOpen(false);
        }}
        size="lg"
        footer={
          <>
            <button type="button" className="btn btn-outline" disabled={loading} onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="submit" form="stock-adjustment-form" className="btn btn-primary" disabled={loading}>
              {loading ? "Saving..." : "Save Adjustment"}
            </button>
          </>
        }
      >
        <form id="stock-adjustment-form" onSubmit={submit} style={{ display: "grid", gap: 16 }}>
          {error && <div className="alert-box danger">{error}</div>}

          <div className="alert-box warning">
            Use this only for approved non-sales stock movement, such as NPA inspection draw-offs. It affects tank variance only, not sales or bankable cash.
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16 }}>
            <label className="form-group">
              <span className="form-label">Tank / Product</span>
              <select className="form-select" value={tankId} onChange={(event) => setTankId(event.target.value)} required>
                {tanks.map((tank) => (
                  <option key={tank.id} value={tank.id}>
                    {tank.name} ({tank.productName})
                  </option>
                ))}
              </select>
            </label>
            <label className="form-group">
              <span className="form-label">Adjustment Type</span>
              <select
                className="form-select"
                value={adjustmentType}
                onChange={(event) => {
                  const value = event.target.value;
                  setAdjustmentType(value);
                  if (value === "REGULATORY_INSPECTION") {
                    setDirection("OUT");
                    setAuthorityReason("NPA inspection draw-off");
                  }
                }}
              >
                <option value="REGULATORY_INSPECTION">Regulatory Inspection</option>
                <option value="STOCK_CORRECTION">Stock Correction</option>
                <option value="EVAPORATION">Evaporation</option>
                <option value="OTHER">Other</option>
              </select>
            </label>
            <label className="form-group">
              <span className="form-label">Direction</span>
              <select className="form-select" value={direction} onChange={(event) => setDirection(event.target.value)}>
                <option value="OUT">OUT - reduce expected stock</option>
                <option value="IN">IN - increase expected stock</option>
              </select>
            </label>
            <label className="form-group">
              <span className="form-label">Litres</span>
              <input className="form-input" type="number" min="0.01" step="0.01" value={litres} onChange={(event) => setLitres(event.target.value)} required />
            </label>
            <label className="form-group">
              <span className="form-label">Authority / Reason</span>
              <input className="form-input" value={authorityReason} onChange={(event) => setAuthorityReason(event.target.value)} placeholder="e.g. NPA inspection draw-off" />
            </label>
            <label className="form-group">
              <span className="form-label">Reference</span>
              <input className="form-input" value={reference} onChange={(event) => setReference(event.target.value)} placeholder="e.g. NPA/ACC/2026/014" />
            </label>
            <label className="form-group">
              <span className="form-label">Recorded By</span>
              <input className="form-input" value={recordedByName} onChange={(event) => setRecordedByName(event.target.value)} />
            </label>
            <label className="form-group">
              <span className="form-label">Approved By</span>
              <input className="form-input" value={approvedByName} onChange={(event) => setApprovedByName(event.target.value)} />
            </label>
            <label className="form-group">
              <span className="form-label">Approval Status</span>
              <select className="form-select" value={approvalStatus} onChange={(event) => setApprovalStatus(event.target.value)}>
                <option value="APPROVED">Approved - affects tank variance</option>
                <option value="PENDING">Pending - visible only</option>
                <option value="REJECTED">Rejected - visible only</option>
              </select>
            </label>
          </div>

          <label className="form-group">
            <span className="form-label">Remarks</span>
            <textarea className="form-textarea" rows={3} value={remarks} onChange={(event) => setRemarks(event.target.value)} />
          </label>
        </form>
      </Modal>
    </>
  );
}
