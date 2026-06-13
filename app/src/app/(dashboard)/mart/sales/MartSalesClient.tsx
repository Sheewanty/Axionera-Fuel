"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
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
      } else {
        router.refresh();
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
    <div style={{ marginTop: 24 }}>
      <div
        style={{
          background: "white",
          border: "1px solid var(--ax-border)",
          borderRadius: 8,
          padding: 16,
          marginBottom: 20,
        }}
      >
        <div style={{ color: "var(--ax-slate-500)", fontSize: 13, fontWeight: 600, textTransform: "uppercase" }}>
          Mart Sales Summary
        </div>
        <p style={{ color: "var(--ax-slate-500)", marginTop: 4 }}>
          {station.name} | {dailySession.businessDate} | {dailySession.shift} Shift
        </p>
        {!canEdit && (
          <p style={{ marginTop: 8, color: "var(--ax-amber)", fontSize: 14 }}>
            This session is {dailySession.status}; mart sales are read-only.
          </p>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16, marginBottom: 20 }}>
        <div style={{ background: "white", border: "1px solid var(--ax-border)", borderRadius: 8, padding: 16 }}>
          <p style={{ color: "var(--ax-slate-500)", fontSize: 13, fontWeight: 600 }}>Net Mart Sales</p>
          <p style={{ color: "var(--ax-blue)", fontSize: 28, fontWeight: 700, marginTop: 8 }}>{formatCurrency(netMartSales)}</p>
        </div>
        <div style={{ background: "white", border: "1px solid var(--ax-border)", borderRadius: 8, padding: 16 }}>
          <p style={{ color: "var(--ax-slate-500)", fontSize: 13, fontWeight: 600 }}>Physical Cash Variance</p>
          <p style={{ color: cashVariance < 0 ? "var(--ax-red)" : cashVariance > 0 ? "var(--ax-green)" : "var(--ax-blue)", fontSize: 28, fontWeight: 700, marginTop: 8 }}>
            {formatCurrency(cashVariance)}
          </p>
        </div>
        <div style={{ background: "white", border: "1px solid var(--ax-border)", borderRadius: 8, padding: 16 }}>
          <p style={{ color: "var(--ax-slate-500)", fontSize: 13, fontWeight: 600 }}>Cash Sales Expected</p>
          <p style={{ color: "var(--ax-blue)", fontSize: 28, fontWeight: 700, marginTop: 8 }}>{formatCurrency(numbers.cashSales)}</p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        style={{
          background: "white",
          border: "1px solid var(--ax-border)",
          borderRadius: 8,
          padding: 20,
        }}
      >
        {error && (
          <div style={{ color: "var(--ax-red)", marginBottom: 14, fontSize: 14 }}>
            {error}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 14 }}>
          <label className="form-group">
            <span className="form-label">Opening Cash</span>
            <input type="number" min="0" step="0.01" value={form.openingCash} disabled={!canEdit} onChange={(e) => setForm((current) => ({ ...current, openingCash: e.target.value }))} className="form-input" />
          </label>
          <label className="form-group">
            <span className="form-label">POS Sales</span>
            <input type="number" min="0" step="0.01" value={form.posSales} disabled={!canEdit} onChange={(e) => setForm((current) => ({ ...current, posSales: e.target.value }))} className="form-input" />
          </label>
          <label className="form-group">
            <span className="form-label">Cash Sales</span>
            <input type="number" min="0" step="0.01" value={form.cashSales} disabled={!canEdit} onChange={(e) => setForm((current) => ({ ...current, cashSales: e.target.value }))} className="form-input" />
          </label>
          <label className="form-group">
            <span className="form-label">Mobile Money</span>
            <input type="number" min="0" step="0.01" value={form.mobileMoney} disabled={!canEdit} onChange={(e) => setForm((current) => ({ ...current, mobileMoney: e.target.value }))} className="form-input" />
          </label>
          <label className="form-group">
            <span className="form-label">Returns</span>
            <input type="number" min="0" step="0.01" value={form.returns} disabled={!canEdit} onChange={(e) => setForm((current) => ({ ...current, returns: e.target.value }))} className="form-input" />
          </label>
          <label className="form-group">
            <span className="form-label">Physical Cash Count</span>
            <input type="number" min="0" step="0.01" value={form.cashCount} disabled={!canEdit} onChange={(e) => setForm((current) => ({ ...current, cashCount: e.target.value }))} className="form-input" />
          </label>
        </div>

        <label className="form-group" style={{ display: "block", marginTop: 16 }}>
          <span className="form-label">Remarks</span>
          <textarea rows={3} value={form.remarks} disabled={!canEdit} onChange={(e) => setForm((current) => ({ ...current, remarks: e.target.value }))} className="form-textarea" />
        </label>

        {canEdit && (
          <div style={{ display: "flex", justifyContent: "flex-end", borderTop: "1px solid var(--ax-border)", paddingTop: 16, marginTop: 18 }}>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary"
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
