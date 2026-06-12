"use client";

import { useState } from "react";
import { Station } from "@prisma/client";
import { submitCashCollection } from "@/lib/actions/cash-collection.actions";
import { formatCurrency } from "@/lib/calculations";

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
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded shadow flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Active Session</h2>
          <p className="text-gray-600">
            {station.name} | {dailySession.businessDate} | Shift: {dailySession.shift}
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
        >
          Add Cash Entry
        </button>
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
                    {c.bankCollectionDate || "-"} <br/>
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

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h3 className="text-xl font-semibold">New Cash Entry</h3>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded">
                  {error}
                </div>
              )}

              <div className="bg-gray-50 p-4 rounded space-y-2 border">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Total Pump Cash Received:</span>
                  <span>{formatCurrency(totalCashReceived)}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-600 border-b pb-2">
                  <span>Total Net Expenditure:</span>
                  <span>- {formatCurrency(totalNetExpenditure)}</span>
                </div>
                {totalBanked > 0 && (
                  <div className="flex justify-between text-sm text-gray-600 border-b pb-2 pt-2">
                    <span>Already Banked:</span>
                    <span>- {formatCurrency(totalBanked)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold pt-1">
                  <span>Remaining Expected Cash:</span>
                  <span>{formatCurrency(currentExpectedCash)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Amount to Bank *</label>
                  <input
                    type="number"
                    name="amountToBank"
                    step="0.01"
                    min="0"
                    required
                    className="w-full border rounded p-2"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Bank Collection Date</label>
                  <input
                    type="date"
                    name="bankCollectionDate"
                    className="w-full border rounded p-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Collection Reference</label>
                  <input
                    type="text"
                    name="bankCollectionReference"
                    className="w-full border rounded p-2"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Bank Signature Name</label>
                  <input
                    type="text"
                    name="bankSignatureName"
                    className="w-full border rounded p-2"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Supervisor Signature Name</label>
                <input
                  type="text"
                  name="supervisorSignatureName"
                  className="w-full border rounded p-2"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Remarks</label>
                <textarea
                  name="remarks"
                  rows={2}
                  className="w-full border rounded p-2"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSubmitting ? "Saving..." : "Save Cash Entry"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
