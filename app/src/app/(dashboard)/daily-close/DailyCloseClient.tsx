"use client";

import { useState } from "react";
import { Station } from "@prisma/client";
import { CheckCircle, Clock, AlertTriangle, LockOpen } from "lucide-react";
import PageTitle from "@/components/ui/PageTitle";
import KpiCard from "@/components/ui/KpiCard";
import VarianceBadge from "@/components/ui/VarianceBadge";
import { formatCurrency, formatLitres } from "@/lib/calculations";
import { closeSessionAction, approveSessionAction, reopenSessionAction } from "@/lib/actions/daily-session.actions";

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
  dailySession: DailySessionProps;
  summary: SummaryProps;
  userRoles: string[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReopenModalOpen, setIsReopenModalOpen] = useState(false);

  const canApprove = userRoles.some(r => ["STATION_MANAGER", "ADMIN", "OWNER"].includes(r));
  const canReopen = userRoles.some(r => ["ADMIN", "OWNER"].includes(r));

  const handleClose = async () => {
    if (!summary.canClose) return;
    setIsSubmitting(true);
    setError(null);
    const res = await closeSessionAction(station.id, dailySession.id);
    if (!res.success) setError(res.error || "Failed to close session");
    setIsSubmitting(false);
  };

  const handleApprove = async () => {
    setIsSubmitting(true);
    setError(null);
    const res = await approveSessionAction(station.id, dailySession.id);
    if (!res.success) setError(res.error || "Failed to approve session");
    setIsSubmitting(false);
  };

  const handleReopen = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
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
        title={`${station.name} — ${dailySession.businessDate}`}
        subtitle={`${dailySession.shift} Shift · Status: ${dailySession.status.replace(/_/g, ' ')}`}
        actions={
          <>
            {(dailySession.status === "OPEN" || dailySession.status === "REOPENED") && (
              <button 
                onClick={handleClose} 
                disabled={isSubmitting || !summary.canClose}
                className="btn btn-outline disabled:opacity-50"
              >
                <Clock size={16} className="mr-2 inline" />
                Close Day
              </button>
            )}

            {dailySession.status === "READY_FOR_REVIEW" && canApprove && (
              <button 
                onClick={handleApprove} 
                disabled={isSubmitting}
                className="btn btn-gold disabled:opacity-50"
              >
                <CheckCircle size={16} className="mr-2 inline" />
                Approve Day
              </button>
            )}

            {dailySession.status === "APPROVED" && canReopen && (
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

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded shadow mb-6">
          {error}
        </div>
      )}

      {/* Validation Warning */}
      {!summary.canClose && (dailySession.status === "OPEN" || dailySession.status === "REOPENED") && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded shadow mb-6 flex items-start">
          <AlertTriangle className="mr-3 mt-0.5 text-yellow-600" size={20} />
          <div>
            <h4 className="font-semibold">Cannot Close Session</h4>
            <p className="text-sm">The following required workflows have not been completed:</p>
            <ul className="list-disc ml-5 mt-1 text-sm">
              {summary.missingRequirements.map((req, i) => (
                <li key={i}>{req}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {dailySession.supervisorNotes && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded shadow mb-6">
          <h4 className="font-semibold text-sm">Supervisor Notes</h4>
          <p className="whitespace-pre-wrap text-sm mt-1">{dailySession.supervisorNotes}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Total Volume Sold"
          value={formatLitres(summary.totalLitresSold)}
          icon={<Clock size={20} />}
        />
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
              <span className="text-gray-600">Pump Sales Variance</span>
              <VarianceBadge value={summary.totalPumpVariance} format={formatCurrency} />
            </li>
            <li className="flex justify-between items-center border-b pb-2">
              <span className="text-gray-600">Physical Cash Variance</span>
              <VarianceBadge value={summary.bankingVariance} format={formatCurrency} />
            </li>
          </ul>
        </div>
      </div>

      {isReopenModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6 border-b">
              <h3 className="text-xl font-semibold text-red-600">Reopen Daily Session</h3>
            </div>
            <form onSubmit={handleReopen} className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                Reopening an approved session will allow modifications to its data. This action is audited.
              </p>
              <div className="space-y-1">
                <label className="text-sm font-medium">Reason for Reopening *</label>
                <textarea
                  name="reason"
                  required
                  rows={3}
                  className="w-full border rounded p-2"
                  placeholder="Explain why this session needs to be reopened..."
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setIsReopenModalOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                >
                  {isSubmitting ? "Reopening..." : "Reopen Session"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
