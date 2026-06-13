"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Edit, Plus, Trash2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import {
  createExpenditureAction,
  updateExpenditureAction,
  deleteExpenditureAction,
} from "@/lib/actions/expenditure.actions";
import { formatCurrency } from "@/lib/calculations";

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

type ExpenditureProps = {
  id: string;
  dailySessionId: string | null;
  businessDate: string;
  voucherReference: string | null;
  category: string;
  amount: number;
  paymentToBank: number;
  paidBy: string;
  approvedBy: string | null;
  receiptAttached: boolean;
  description: string | null;
  createdAt: string;
};

type Props = {
  station: StationProps;
  dailySession: DailySessionProps | null;
  expenditures: ExpenditureProps[];
};

type FormState = {
  id?: string;
  linkedToSession: boolean;
  category: string;
  amount: string;
  paymentToBank: string;
  paidBy: string;
  voucherReference: string;
  approvedBy: string;
  receiptAttached: boolean;
  description: string;
};

const blankForm: FormState = {
  linkedToSession: true,
  category: "",
  amount: "",
  paymentToBank: "0",
  paidBy: "",
  voucherReference: "",
  approvedBy: "",
  receiptAttached: false,
  description: "",
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "An unknown error occurred";
}

export default function ExpenditureClient({ station, dailySession, expenditures }: Props) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ExpenditureProps | null>(null);
  const [form, setForm] = useState<FormState>(blankForm);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sessionWritable = !dailySession || dailySession.status === "OPEN" || dailySession.status === "REOPENED";
  const totalNetExpenditure = useMemo(
    () =>
      expenditures
        .filter((expense) => expense.dailySessionId === dailySession?.id)
        .reduce((sum, expense) => sum + expense.amount - expense.paymentToBank, 0),
    [dailySession?.id, expenditures]
  );

  const openCreate = () => {
    setForm({
      ...blankForm,
      linkedToSession: Boolean(dailySession),
    });
    setError(null);
    setIsModalOpen(true);
  };

  const openEdit = (expense: ExpenditureProps) => {
    setForm({
      id: expense.id,
      linkedToSession: Boolean(expense.dailySessionId),
      category: expense.category,
      amount: String(expense.amount),
      paymentToBank: String(expense.paymentToBank),
      paidBy: expense.paidBy,
      voucherReference: expense.voucherReference ?? "",
      approvedBy: expense.approvedBy ?? "",
      receiptAttached: expense.receiptAttached,
      description: expense.description ?? "",
    });
    setError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (isSubmitting) return;
    setIsModalOpen(false);
    setError(null);
  };

  const selectedDailySessionId = form.linkedToSession ? dailySession?.id : undefined;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const payload = {
      stationId: station.id,
      dailySessionId: selectedDailySessionId,
      category: form.category,
      amount: Number(form.amount),
      paymentToBank: Number(form.paymentToBank || 0),
      paidBy: form.paidBy,
      voucherReference: form.voucherReference || undefined,
      approvedBy: form.approvedBy || undefined,
      receiptAttached: form.receiptAttached,
      description: form.description || undefined,
    };

    try {
      const response = form.id
        ? await updateExpenditureAction({ ...payload, id: form.id })
        : await createExpenditureAction(payload);

      if (!response.success) {
        setError(response.error ?? "Unable to save expenditure");
        return;
      }

      setIsModalOpen(false);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await deleteExpenditureAction({
        id: deleteTarget.id,
        stationId: station.id,
        dailySessionId: deleteTarget.dailySessionId ?? undefined,
      });

      if (!response.success) {
        setError(response.error ?? "Unable to delete expenditure");
        return;
      }

      setDeleteTarget(null);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div style={{ marginBottom: "20px" }}>
        <button className="btn btn-primary" onClick={openCreate}>
          <Plus size={16} />
          Add Expenditure
        </button>
      </div>

      {error && (
        <div style={{ color: "var(--ax-red)", marginBottom: 14, fontSize: 14 }}>
          {error}
        </div>
      )}

      <div
        style={{
          background: "white",
          border: "1px solid var(--ax-border)",
          borderRadius: 8,
          marginBottom: 20,
          padding: 16,
        }}
      >
        <div style={{ color: "var(--ax-slate-500)", fontSize: 13, fontWeight: 600, textTransform: "uppercase" }}>
          Expense Register
        </div>
        <div style={{ color: "var(--ax-blue)", fontSize: 24, fontWeight: 700, marginTop: 6 }}>
          {formatCurrency(totalNetExpenditure)}
        </div>
        <div style={{ color: "var(--ax-slate-500)", fontSize: 14, marginTop: 4 }}>
          Session-linked net expenditure for {dailySession ? `${station.name} | ${dailySession.businessDate} | ${dailySession.shift} Shift` : station.name}
        </div>
      </div>

      <div style={{ background: "white", border: "1px solid var(--ax-border)", borderRadius: 8, overflowX: "auto" }}>
        <table className="data-table">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-3 border-b">Scope</th>
              <th className="p-3 border-b">Category</th>
              <th className="p-3 border-b text-right">Amount</th>
              <th className="p-3 border-b text-right">Paid to Bank</th>
              <th className="p-3 border-b text-right">Net</th>
              <th className="p-3 border-b">Paid By</th>
              <th className="p-3 border-b">Receipt</th>
              <th className="p-3 border-b text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {expenditures.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: 28, textAlign: "center", color: "var(--ax-slate-500)" }}>
                  No expenditures recorded for this station.
                </td>
              </tr>
            ) : (
              expenditures.map((expense) => {
                const linkedToCurrentSession = expense.dailySessionId === dailySession?.id;
                const locked = Boolean(expense.dailySessionId) && !sessionWritable;

                return (
                  <tr key={expense.id}>
                    <td>
                      <span style={{
                        borderRadius: 999,
                        padding: "3px 8px",
                        fontSize: 12,
                        fontWeight: 700,
                        color: linkedToCurrentSession ? "var(--ax-blue)" : "var(--ax-slate-500)",
                        background: linkedToCurrentSession ? "color-mix(in srgb, var(--ax-blue) 8%, white)" : "var(--ax-slate-50)",
                      }}>
                        {linkedToCurrentSession ? "Session" : "Standalone"}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 700, color: "var(--ax-blue)" }}>{expense.category}</div>
                      <div style={{ fontSize: 12, color: "var(--ax-slate-500)" }}>{expense.voucherReference || expense.description || "-"}</div>
                    </td>
                    <td style={{ textAlign: "right" }}>{formatCurrency(expense.amount)}</td>
                    <td style={{ textAlign: "right" }}>{formatCurrency(expense.paymentToBank)}</td>
                    <td style={{ textAlign: "right", fontWeight: 700 }}>
                      {formatCurrency(expense.amount - expense.paymentToBank)}
                    </td>
                    <td>{expense.paidBy}</td>
                    <td>{expense.receiptAttached ? "Attached" : "Missing"}</td>
                    <td>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          aria-label="Edit expenditure"
                          disabled={locked}
                          onClick={() => openEdit(expense)}
                          className="btn btn-outline"
                          style={{ width: 34, height: 34, padding: 0 }}
                        >
                          <Edit size={15} />
                        </button>
                        <button
                          type="button"
                          aria-label="Delete expenditure"
                          disabled={locked}
                          onClick={() => setDeleteTarget(expense)}
                          className="btn btn-outline"
                          style={{ width: 34, height: 34, padding: 0, color: "var(--ax-red)" }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={isModalOpen}
        onClose={closeModal}
        title={form.id ? "Edit Expenditure" : "Add Expenditure"}
        size="lg"
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={closeModal} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" form="expenditure-form" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Expenditure"}
            </button>
          </>
        }
      >
        <form id="expenditure-form" onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div style={{ color: "var(--ax-red)", marginBottom: 12, fontSize: 14 }}>
              {error}
            </div>
          )}

          {dailySession && !form.id && (
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "var(--ax-blue)" }}>
              <input
                type="checkbox"
                checked={form.linkedToSession}
                onChange={(event) => setForm((current) => ({ ...current, linkedToSession: event.target.checked }))}
              />
              Link this expenditure to the active daily session
            </label>
          )}

          {form.id && (
            <div style={{ border: "1px solid var(--ax-border)", borderRadius: 8, background: "var(--ax-slate-50)", padding: 12, color: "var(--ax-slate-500)", fontSize: 14 }}>
              Session linkage cannot be changed after creation.
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <label className="form-group">
              <span className="form-label">Category *</span>
              <input
                required
                value={form.category}
                onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                className="form-input"
              />
            </label>
            <label className="form-group">
              <span className="form-label">Paid By *</span>
              <input
                required
                value={form.paidBy}
                onChange={(event) => setForm((current) => ({ ...current, paidBy: event.target.value }))}
                className="form-input"
              />
            </label>
            <label className="form-group">
              <span className="form-label">Amount *</span>
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                value={form.amount}
                onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
                className="form-input"
              />
            </label>
            <label className="form-group">
              <span className="form-label">Payment to Bank</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.paymentToBank}
                onChange={(event) => setForm((current) => ({ ...current, paymentToBank: event.target.value }))}
                className="form-input"
              />
            </label>
            <label className="form-group">
              <span className="form-label">Voucher Reference</span>
              <input
                value={form.voucherReference}
                onChange={(event) => setForm((current) => ({ ...current, voucherReference: event.target.value }))}
                className="form-input"
              />
            </label>
            <label className="form-group">
              <span className="form-label">Approved By</span>
              <input
                value={form.approvedBy}
                onChange={(event) => setForm((current) => ({ ...current, approvedBy: event.target.value }))}
                className="form-input"
              />
            </label>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "var(--ax-blue)" }}>
            <input
              type="checkbox"
              checked={form.receiptAttached}
              onChange={(event) => setForm((current) => ({ ...current, receiptAttached: event.target.checked }))}
            />
            Receipt attached
          </label>

          <label className="form-group" style={{ display: "block" }}>
            <span className="form-label">Description</span>
            <textarea
              rows={3}
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              className="form-textarea"
            />
          </label>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Expenditure"
        message="This expenditure entry will be permanently removed."
        confirmLabel={isSubmitting ? "Deleting..." : "Delete"}
        danger
        onCancel={() => {
          if (!isSubmitting) setDeleteTarget(null);
        }}
        onConfirm={handleDelete}
      />
    </>
  );
}
