"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Station } from "@prisma/client";
import Modal from "@/components/ui/Modal";
import { submitCashCollection } from "@/lib/actions/cash-collection.actions";
import { formatCurrency } from "@/lib/calculations";
import { formatDisplayDate } from "@/lib/business-date";

type DailySessionProps = {
  id: string;
  businessDate: string;
  shift: string;
};

type CashCollectionProps = {
  id: string;
  businessDate: string;
  amountToBank: number;
  bankCollectionDate: string | null;
  bankCollectionReference: string | null;
  expectedCash: number;
  variance: number;
  bankSignatureName: string | null;
  supervisorSignatureName: string | null;
  remarks: string | null;
};

type Props = {
  station: Station;
  dailySession: DailySessionProps;
  cashCollections: CashCollectionProps[];
  currentExpectedCash: number;
  totalCashReceived: number;
  totalNetExpenditure: number;
  totalBanked: number;
};

export default function CashEntriesClient({
  station,
  dailySession,
  cashCollections,
  currentExpectedCash,
  totalCashReceived,
  totalNetExpenditure,
  totalBanked,
}: Props) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);
    formData.append("stationId", station.id);
    formData.append("dailySessionId", dailySession.id);
    formData.append("businessDate", dailySession.businessDate);

    try {
      const res = await submitCashCollection(formData);
      if (!res.success) {
        setError(res.error + ": " + JSON.stringify(res.fieldErrors || {}));
      } else {
        setIsModalOpen(false);
        router.refresh();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div style={{ marginBottom: "20px" }}>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={13} />
          Add Cash Entry
        </button>
      </div>

      <div className="bg-white p-6 rounded shadow">
        <div>
          <h2 className="text-xl font-semibold">Active Session</h2>
          <p className="text-gray-600">
            {station.name} | {formatDisplayDate(dailySession.businessDate)} | Shift: {dailySession.shift}
          </p>
        </div>
      </div>

      <div className="bg-white p-6 rounded shadow overflow-x-auto">
        <h3 className="text-lg font-semibold mb-4">Cash Collections</h3>
        {cashCollections.length === 0 ? (
          <p className="text-gray-500">No cash entries recorded for this session yet.</p>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-3 border-b">Time</th>
                <th className="p-3 border-b text-right">Expected</th>
                <th className="p-3 border-b text-right">To Bank</th>
                <th className="p-3 border-b text-right">Variance</th>
                <th className="p-3 border-b">Bank Date/Ref</th>
                <th className="p-3 border-b">Supervisor</th>
              </tr>
            </thead>
            <tbody>
              {cashCollections.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="p-3 border-b">...</td>
                  <td className="p-3 border-b text-right text-gray-600">
                    {formatCurrency(c.expectedCash)}
                  </td>
                  <td className="p-3 border-b text-right font-medium text-green-700">
                    {formatCurrency(c.amountToBank)}
                  </td>
                  <td className={`p-3 border-b text-right font-medium ${c.variance < 0 ? 'text-red-600' : c.variance > 0 ? 'text-green-600' : 'text-gray-500'}`}>
                    {formatCurrency(c.variance)}
                  </td>
                  <td className="p-3 border-b text-sm text-gray-500">
                    {formatDisplayDate(c.bankCollectionDate)} <br/>
                    {c.bankCollectionReference}
                  </td>
                  <td className="p-3 border-b text-sm text-gray-600">
                    {c.supervisorSignatureName || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal
        open={isModalOpen}
        title="New Cash Entry"
        onClose={() => {
          if (!isSubmitting) setIsModalOpen(false);
        }}
        size="lg"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="btn btn-outline"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="cash-entry-form"
              disabled={isSubmitting}
              className="btn btn-primary"
            >
              {isSubmitting ? "Saving..." : "Save Cash Entry"}
            </button>
          </>
        }
      >
        <form id="cash-entry-form" onSubmit={handleSubmit}>
          {error && (
            <div style={{ color: "var(--ax-red)", marginBottom: 14, fontSize: 14 }}>
              {error}
            </div>
          )}

          <div
            style={{
              background: "var(--ax-slate-50)",
              border: "1px solid var(--ax-border)",
              borderRadius: 8,
              padding: 14,
              marginBottom: 16,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", color: "var(--ax-slate-500)", fontSize: 14 }}>
              <span>Total Pump Cash Received</span>
              <span>{formatCurrency(totalCashReceived)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", color: "var(--ax-slate-500)", fontSize: 14, marginTop: 6 }}>
              <span>Total Net Expenditure</span>
              <span>- {formatCurrency(totalNetExpenditure)}</span>
            </div>
            {totalBanked > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--ax-slate-500)", fontSize: 14, marginTop: 6 }}>
                <span>Already Banked</span>
                <span>- {formatCurrency(totalBanked)}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--ax-border)", marginTop: 10, paddingTop: 10, color: "var(--ax-blue)", fontWeight: 700 }}>
              <span>Remaining Expected Cash</span>
              <span>{formatCurrency(currentExpectedCash)}</span>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Amount to Bank *</label>
              <input type="number" name="amountToBank" step="0.01" min="0" required className="form-input" />
            </div>
            <div className="form-group">
              <label className="form-label">Bank Collection Date</label>
              <input type="date" name="bankCollectionDate" className="form-input" />
            </div>
            <div className="form-group">
              <label className="form-label">Collection Reference</label>
              <input type="text" name="bankCollectionReference" className="form-input" />
            </div>
            <div className="form-group">
              <label className="form-label">Bank Signature Name</label>
              <input type="text" name="bankSignatureName" className="form-input" />
            </div>
            <div className="form-group" style={{ gridColumn: "1/-1" }}>
              <label className="form-label">Supervisor Signature Name</label>
              <input type="text" name="supervisorSignatureName" className="form-input" />
            </div>
            <div className="form-group" style={{ gridColumn: "1/-1" }}>
              <label className="form-label">Remarks</label>
              <textarea name="remarks" rows={3} className="form-textarea" />
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
