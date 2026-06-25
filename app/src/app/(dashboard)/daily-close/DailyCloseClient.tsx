"use client";

import { useState } from "react";
import { Station } from "@prisma/client";
import { CheckCircle, Clock, AlertTriangle, LockOpen } from "lucide-react";
import PageTitle from "@/components/ui/PageTitle";
import KpiCard from "@/components/ui/KpiCard";
import VarianceBadge from "@/components/ui/VarianceBadge";
import Modal from "@/components/ui/Modal";
import { formatCurrency, formatLitres } from "@/lib/calculations";
import {
  openTodaySessionAction,
  closeSessionAction,
  approveSessionAction,
  reopenSessionAction,
} from "@/lib/actions/daily-session.actions";

type DailySessionProps = {
  id: string;
  businessDate: string;
  shift: string;
  status: string;
  supervisorNotes: string | null;
};

type SummaryProps = {
  totalLitresSold: number;
  totalPumpExpected: number;
  totalPumpVariance: number;
  totalPumpCash: number;
  totalLubeBayCashSales: number;
  totalHqSettlement: number;
  totalNetExpenditure: number;
  totalMartNetSales: number;
  totalMartCashVariance: number;
  totalStockAdjustmentIn: number;
  totalStockAdjustmentOut: number;
  expectedCash: number;
  totalBanked: number;
  bankingVariance: number;
  totalDischargeVariance: number;
  totalStockVariance: number;
  missingRequirements: string[];
  canClose: boolean;
};

export default function DailyCloseClient({
  station,
  dailySession,
  summary,
  userRoles,
}: {
  station: Station;
  dailySession: DailySessionProps | null;
  summary: SummaryProps;
  userRoles: string[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReopenModalOpen, setIsReopenModalOpen] = useState(false);
  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState(false);
  const [showCloseRequirements, setShowCloseRequirements] = useState(false);

  const canOpen = userRoles.some((r) =>
    ["SUPERVISOR", "STATION_MANAGER", "ADMIN", "OWNER"].includes(r)
  );
  const canApprove = userRoles.some((r) => ["STATION_MANAGER", "ADMIN", "OWNER"].includes(r));
  const canReopen = userRoles.some((r) => ["ADMIN", "OWNER"].includes(r));

  const handleOpen = async () => {
    setIsSubmitting(true);
    setError(null);
    setShowCloseRequirements(false);
    const res = await openTodaySessionAction(station.id);
    if (!res.success) setError(res.error || "Failed to open today's session");
    setIsSubmitting(false);
  };

  const handleClose = async () => {
    if (!dailySession) return;
    if (!summary.canClose) {
      setError(null);
      setShowCloseRequirements(true);
      return;
    }
    setError(null);
    setShowCloseRequirements(false);
    setIsCloseConfirmOpen(true);
  };

  const confirmClose = async () => {
    if (!dailySession) return;
    setIsSubmitting(true);
    setError(null);
    setShowCloseRequirements(false);
    const res = await closeSessionAction(station.id, dailySession.id);
    if (!res.success) setError(res.error || "Failed to close session");
    else setIsCloseConfirmOpen(false);
    setIsSubmitting(false);
  };

  const handleApprove = async () => {
    if (!dailySession) return;
    setIsSubmitting(true);
    setError(null);
    const res = await approveSessionAction(station.id, dailySession.id);
    if (!res.success) setError(res.error || "Failed to approve session");
    setIsSubmitting(false);
  };

  const handleReopen = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!dailySession) return;
    setIsSubmitting(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    const reason = formData.get("reason") as string;

    const res = await reopenSessionAction(station.id, dailySession.id, reason);
    if (!res.success) setError(res.error || "Failed to reopen session");
    else setIsReopenModalOpen(false);
    setIsSubmitting(false);
  };

  return (
    <>
      <PageTitle
        eyebrow="Daily Close"
        title={
          dailySession
            ? `${station.name} - ${dailySession.businessDate}`
            : `${station.name} - No session open today`
        }
        subtitle={
          dailySession
            ? `${dailySession.shift} Shift - Status: ${dailySession.status.replace(/_/g, " ")}`
            : "Open today's operating session before recording daily transactions."
        }
        actions={
          <>
            {!dailySession && canOpen && (
              <button
                onClick={handleOpen}
                disabled={isSubmitting}
                className="btn btn-gold disabled:opacity-50"
              >
                <Clock size={16} className="mr-2 inline" />
                Open Today
              </button>
            )}

            {dailySession && (dailySession.status === "OPEN" || dailySession.status === "REOPENED") && (
              <button
                onClick={handleClose}
                disabled={isSubmitting}
                className="btn btn-outline disabled:opacity-50"
              >
                <Clock size={16} className="mr-2 inline" />
                Close Day
              </button>
            )}

            {dailySession?.status === "READY_FOR_REVIEW" && canApprove && (
              <button
                onClick={handleApprove}
                disabled={isSubmitting}
                className="btn btn-gold disabled:opacity-50"
              >
                <CheckCircle size={16} className="mr-2 inline" />
                Approve Day
              </button>
            )}

            {dailySession?.status === "APPROVED" && canReopen && (
              <button
                onClick={() => setIsReopenModalOpen(true)}
                disabled={isSubmitting}
                className="btn btn-outline text-red-600 border-red-600 hover:bg-red-50"
              >
                <LockOpen size={16} className="mr-2 inline" />
                Reopen Day
              </button>
            )}
          </>
        }
      />

      {error && <div className="bg-red-50 text-red-600 p-4 rounded shadow mb-6">{error}</div>}

      {!dailySession && (
        <div className="bg-white border border-slate-200 p-6 rounded shadow mb-6">
          <h3 className="font-semibold text-slate-900">No daily session is open</h3>
          <p className="text-sm text-slate-600 mt-1">
            Open today&apos;s session to enable pump readings, tank dipping, discharge,
            expenditure, mart sales, and cash collection for this station.
          </p>
        </div>
      )}

      {dailySession &&
        showCloseRequirements &&
        !summary.canClose &&
        (dailySession.status === "OPEN" || dailySession.status === "REOPENED") && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded shadow mb-6 flex items-start">
          <AlertTriangle className="mr-3 mt-0.5 text-yellow-600" size={20} />
          <div>
            <h4 className="font-semibold">Before Closing Day</h4>
            <p className="text-sm">Complete these workflows before this session can be closed:</p>
            <ul className="list-disc ml-5 mt-1 text-sm">
              {summary.missingRequirements.map((req, i) => (
                <li key={i}>{req}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {dailySession?.supervisorNotes && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded shadow mb-6">
          <h4 className="font-semibold text-sm">Supervisor Notes</h4>
          <p className="whitespace-pre-wrap text-sm mt-1">{dailySession.supervisorNotes}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Total Volume Sold" value={formatLitres(summary.totalLitresSold)} icon={<Clock size={20} />} />
        <KpiCard
          label="Pump Variance"
          value={formatCurrency(summary.totalPumpVariance)}
          delta={`Expected: ${formatCurrency(summary.totalPumpExpected)}`}
          icon={<AlertTriangle size={20} />}
          variance={summary.totalPumpVariance}
        />
        <KpiCard
          label="Cash Banked"
          value={formatCurrency(summary.totalBanked)}
          delta={`Expected: ${formatCurrency(summary.expectedCash)}`}
          icon={<CheckCircle size={20} />}
        />
        <KpiCard
          label="Banking Variance"
          value={formatCurrency(summary.bankingVariance)}
          icon={<AlertTriangle size={20} />}
          variance={summary.bankingVariance}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded shadow">
          <h3 className="text-lg font-semibold mb-4">Reconciliation Checks</h3>
          <ul className="space-y-4">
            <li className="flex justify-between items-center border-b pb-2">
              <span className="text-gray-600">Product Discharge Variance</span>
              <VarianceBadge value={summary.totalDischargeVariance} format={formatLitres} />
            </li>
            <li className="flex justify-between items-center border-b pb-2">
              <span className="text-gray-600">Tank Stock Variance</span>
              <VarianceBadge value={summary.totalStockVariance} format={formatLitres} />
            </li>
            <li className="flex justify-between items-center border-b pb-2">
              <span className="text-gray-600">Approved Stock Adjustments In</span>
              <span className="font-medium">{formatLitres(summary.totalStockAdjustmentIn)}</span>
            </li>
            <li className="flex justify-between items-center border-b pb-2">
              <span className="text-gray-600">Approved Stock Adjustments Out</span>
              <span className="font-medium">{formatLitres(summary.totalStockAdjustmentOut)}</span>
            </li>
            <li className="flex justify-between items-center border-b pb-2">
              <span className="text-gray-600">Pump Sales Variance</span>
              <VarianceBadge value={summary.totalPumpVariance} format={formatCurrency} />
            </li>
            <li className="flex justify-between items-center border-b pb-2">
              <span className="text-gray-600">Physical Cash Variance</span>
              <VarianceBadge value={summary.bankingVariance} format={formatCurrency} />
            </li>
            <li className="flex justify-between items-center border-b pb-2">
              <span className="text-gray-600">Mart Cash Variance</span>
              <VarianceBadge value={summary.totalMartCashVariance} format={formatCurrency} />
            </li>
          </ul>
        </div>

        <div className="bg-white p-6 rounded shadow">
          <h3 className="text-lg font-semibold mb-4">Cash Position</h3>
          <ul className="space-y-4">
            <li className="flex justify-between items-center border-b pb-2">
              <span className="text-gray-600">Pump Physical Cash</span>
              <span className="font-medium">{formatCurrency(summary.totalPumpCash)}</span>
            </li>
            <li className="flex justify-between items-center border-b pb-2">
              <span className="text-gray-600">Lube Bay Cash Sales</span>
              <span className="font-medium">{formatCurrency(summary.totalLubeBayCashSales)}</span>
            </li>
            <li className="flex justify-between items-center border-b pb-2">
              <span className="text-gray-600">HQ-Direct Sales</span>
              <span className="font-medium">{formatCurrency(summary.totalHqSettlement)}</span>
            </li>
            <li className="flex justify-between items-center border-b pb-2">
              <span className="text-gray-600">Net Expenditure</span>
              <span className="font-medium">{formatCurrency(summary.totalNetExpenditure)}</span>
            </li>
            <li className="flex justify-between items-center border-b pb-2">
              <span className="text-gray-600">Mart Net Sales</span>
              <span className="font-medium">{formatCurrency(summary.totalMartNetSales)}</span>
            </li>
          </ul>
        </div>
      </div>

      <Modal
        open={isCloseConfirmOpen}
        title="Close Daily Session"
        onClose={() => {
          if (!isSubmitting) setIsCloseConfirmOpen(false);
        }}
        size="md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsCloseConfirmOpen(false)}
              className="btn btn-outline"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmClose}
              disabled={isSubmitting}
              className="btn btn-primary"
            >
              {isSubmitting ? "Closing..." : "Confirm Close Day"}
            </button>
          </>
        }
      >
        <div
          style={{
            background: "color-mix(in srgb, var(--ax-amber) 10%, white)",
            border: "1px solid color-mix(in srgb, var(--ax-amber) 35%, white)",
            borderRadius: 8,
            color: "var(--ax-blue)",
            fontSize: 14,
            lineHeight: 1.45,
            marginBottom: 16,
            padding: "10px 12px",
          }}
        >
          Closing this daily session moves it to review. Operators will no longer be able to
          add or correct entries unless an authorised user reopens the day.
        </div>
        <dl style={{ display: "grid", gap: 10, fontSize: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
            <dt style={{ color: "var(--ax-slate)" }}>Station</dt>
            <dd style={{ fontWeight: 700, color: "var(--ax-blue)", textAlign: "right" }}>
              {station.name}
            </dd>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
            <dt style={{ color: "var(--ax-slate)" }}>Business date</dt>
            <dd style={{ fontWeight: 700, color: "var(--ax-blue)", textAlign: "right" }}>
              {dailySession?.businessDate}
            </dd>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
            <dt style={{ color: "var(--ax-slate)" }}>Expected cash</dt>
            <dd style={{ fontWeight: 700, color: "var(--ax-blue)", textAlign: "right" }}>
              {formatCurrency(summary.expectedCash)}
            </dd>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
            <dt style={{ color: "var(--ax-slate)" }}>Banked</dt>
            <dd style={{ fontWeight: 700, color: "var(--ax-blue)", textAlign: "right" }}>
              {formatCurrency(summary.totalBanked)}
            </dd>
          </div>
        </dl>
      </Modal>

      <Modal
        open={isReopenModalOpen}
        title="Reopen Daily Session"
        onClose={() => {
          if (!isSubmitting) setIsReopenModalOpen(false);
        }}
        size="md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsReopenModalOpen(false)}
              className="btn btn-outline"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="reopen-session-form"
              disabled={isSubmitting}
              className="btn btn-primary"
              style={{ background: "var(--ax-red)", borderColor: "var(--ax-red)" }}
            >
              {isSubmitting ? "Reopening..." : "Reopen Session"}
            </button>
          </>
        }
      >
        <form id="reopen-session-form" onSubmit={handleReopen}>
          <div
            style={{
              background: "color-mix(in srgb, var(--ax-amber) 10%, white)",
              border: "1px solid color-mix(in srgb, var(--ax-amber) 35%, white)",
              borderRadius: 8,
              color: "var(--ax-blue)",
              fontSize: 14,
              lineHeight: 1.45,
              marginBottom: 16,
              padding: "10px 12px",
            }}
          >
            Reopening an approved session will allow modifications to its data. This action is audited.
          </div>
          <div className="form-group">
            <label className="form-label">Reason for Reopening *</label>
            <textarea
              name="reason"
              required
              rows={3}
              className="form-textarea"
              placeholder="Explain why this session needs to be reopened..."
            />
          </div>
        </form>
      </Modal>
    </>
  );
}
