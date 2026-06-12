"use client";

import { useMemo, useState } from "react";
import { Save } from "lucide-react";
import {
  createMartSaleAction,
  updateMartSaleAction,
} from "@/lib/actions/mart-sale.actions";
import { calcMartNetSales, calcMartVariance, formatCurrency } from "@/lib/calculations";

type StationProps = {
  id: string;
  name: string;
};

type DailySessionProps = {
  id: string;
  businessDate: string;
  shift: string;
  status: string;
};

type MartSaleProps = {
  id: string;
  openingCash: number;
  posSales: number;
  cashSales: number;
  mobileMoney: number;
  returns: number;
  netMartSales: number;
  cashCount: number;
  variance: number;
  remarks: string | null;
};

type Props = {
  station: StationProps;
  dailySession: DailySessionProps | null;
  martSale: MartSaleProps | null;
};

type FormState = {
  openingCash: string;
  posSales: string;
  cashSales: string;
  mobileMoney: string;
  returns: string;
  cashCount: string;
  remarks: string;
};

function toField(value: number | undefined): string {
  return value === undefined ? "0" : String(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "An unknown error occurred";
}

export default function MartSalesClient({ station, dailySession, martSale }: Props) {
  const [form, setForm] = useState<FormState>({
    openingCash: toField(martSale?.openingCash),
    posSales: toField(martSale?.posSales),
    cashSales: toField(martSale?.cashSales),
    mobileMoney: toField(martSale?.mobileMoney),
    returns: toField(martSale?.returns),
    cashCount: toField(martSale?.cashCount),
    remarks: martSale?.remarks ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canEdit = Boolean(dailySession) && (dailySession?.status === "OPEN" || dailySession?.status === "REOPENED");
  const numbers = useMemo(
    () => ({
      openingCash: Number(form.openingCash || 0),
      posSales: Number(form.posSales || 0),
      cashSales: Number(form.cashSales || 0),
      mobileMoney: Number(form.mobileMoney || 0),
      returns: Number(form.returns || 0),
      cashCount: Number(form.cashCount || 0),
    }),
    [form]
  );
  const netMartSales = calcMartNetSales(numbers.posSales, numbers.cashSales, numbers.mobileMoney, numbers.returns);
  const cashVariance = calcMartVariance(numbers.cashCount, numbers.cashSales);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!dailySession) return;

    setError(null);
    setIsSubmitting(true);

    const payload = {
      stationId: station.id,
      dailySessionId: dailySession.id,
      openingCash: numbers.openingCash,
      posSales: numbers.posSales,
      cashSales: numbers.cashSales,
      mobileMoney: numbers.mobileMoney,
      returns: numbers.returns,
      cashCount: numbers.cashCount,
      remarks: form.remarks || undefined,
    };

    try {
      const response = martSale
        ? await updateMartSaleAction({ ...payload, id: martSale.id })
        : await createMartSaleAction(payload);

      if (!response.success) {
        setError(response.error ?? "Unable to save mart sales");
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!dailySession) {
    return (
      <div className="mt-6 bg-white p-6 rounded shadow">
        <p>No active session for this station. Please open a session first.</p>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-6">
      <div className="bg-white p-6 rounded shadow">
        <h2 className="text-xl font-semibold">Mart Sales Summary</h2>
        <p className="text-gray-600">
          {station.name} | {dailySession.businessDate} | {dailySession.shift} Shift
        </p>
        {!canEdit && (
          <p className="mt-2 text-sm text-amber-700">
            This session is {dailySession.status}; mart sales are read-only.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded shadow">
          <p className="text-sm text-gray-500">Net Mart Sales</p>
          <p className="text-2xl font-semibold">{formatCurrency(netMartSales)}</p>
        </div>
        <div className="bg-white p-5 rounded shadow">
          <p className="text-sm text-gray-500">Physical Cash Variance</p>
          <p className={`text-2xl font-semibold ${cashVariance < 0 ? "text-red-600" : cashVariance > 0 ? "text-green-700" : "text-gray-900"}`}>
            {formatCurrency(cashVariance)}
          </p>
        </div>
        <div className="bg-white p-5 rounded shadow">
          <p className="text-sm text-gray-500">Cash Sales Expected</p>
          <p className="text-2xl font-semibold">{formatCurrency(numbers.cashSales)}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded shadow space-y-6">
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded border border-red-200 text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="space-y-1">
            <span className="text-sm font-medium text-gray-700">Opening Cash</span>
            <input type="number" min="0" step="0.01" value={form.openingCash} disabled={!canEdit} onChange={(e) => setForm((current) => ({ ...current, openingCash: e.target.value }))} className="w-full border rounded p-2" />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-gray-700">POS Sales</span>
            <input type="number" min="0" step="0.01" value={form.posSales} disabled={!canEdit} onChange={(e) => setForm((current) => ({ ...current, posSales: e.target.value }))} className="w-full border rounded p-2" />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-gray-700">Cash Sales</span>
            <input type="number" min="0" step="0.01" value={form.cashSales} disabled={!canEdit} onChange={(e) => setForm((current) => ({ ...current, cashSales: e.target.value }))} className="w-full border rounded p-2" />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-gray-700">Mobile Money</span>
            <input type="number" min="0" step="0.01" value={form.mobileMoney} disabled={!canEdit} onChange={(e) => setForm((current) => ({ ...current, mobileMoney: e.target.value }))} className="w-full border rounded p-2" />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-gray-700">Returns</span>
            <input type="number" min="0" step="0.01" value={form.returns} disabled={!canEdit} onChange={(e) => setForm((current) => ({ ...current, returns: e.target.value }))} className="w-full border rounded p-2" />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-gray-700">Physical Cash Count</span>
            <input type="number" min="0" step="0.01" value={form.cashCount} disabled={!canEdit} onChange={(e) => setForm((current) => ({ ...current, cashCount: e.target.value }))} className="w-full border rounded p-2" />
          </label>
        </div>

        <label className="space-y-1 block">
          <span className="text-sm font-medium text-gray-700">Remarks</span>
          <textarea rows={3} value={form.remarks} disabled={!canEdit} onChange={(e) => setForm((current) => ({ ...current, remarks: e.target.value }))} className="w-full border rounded p-2" />
        </label>

        {canEdit && (
          <div className="flex justify-end border-t pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow hover:bg-slate-800 disabled:opacity-50"
            >
              <Save size={16} />
              {isSubmitting ? "Saving..." : martSale ? "Update Summary" : "Save Summary"}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
