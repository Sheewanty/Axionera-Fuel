"use client";

import { useMemo, useState } from "react";
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
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mt-6 space-y-6">
      <div className="bg-white p-6 rounded shadow flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Expense Register</h2>
          <p className="text-gray-600">
            {dailySession
              ? `${station.name} | ${dailySession.businessDate} | ${dailySession.shift} Shift`
              : `${station.name} | No active session found`}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Session-linked net expenditure: {formatCurrency(totalNetExpenditure)}
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow hover:bg-slate-800"
        >
          <Plus size={16} />
          Add Expenditure
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded border border-red-200 text-sm">
          {error}
        </div>
      )}

      <div className="bg-white rounded shadow overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
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
                <td colSpan={8} className="p-8 text-center text-gray-500">
                  No expenditures recorded for this station.
                </td>
              </tr>
            ) : (
              expenditures.map((expense) => {
                const linkedToCurrentSession = expense.dailySessionId === dailySession?.id;
                const locked = Boolean(expense.dailySessionId) && !sessionWritable;

                return (
                  <tr key={expense.id} className="hover:bg-gray-50">
                    <td className="p-3 border-b">
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                        linkedToCurrentSession ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-600"
                      }`}>
                        {linkedToCurrentSession ? "Session" : "Standalone"}
                      </span>
                    </td>
                    <td className="p-3 border-b">
                      <div className="font-medium text-gray-900">{expense.category}</div>
                      <div className="text-xs text-gray-500">{expense.voucherReference || expense.description || "-"}</div>
                    </td>
                    <td className="p-3 border-b text-right tabular-nums">{formatCurrency(expense.amount)}</td>
                    <td className="p-3 border-b text-right tabular-nums">{formatCurrency(expense.paymentToBank)}</td>
                    <td className="p-3 border-b text-right tabular-nums font-medium">
                      {formatCurrency(expense.amount - expense.paymentToBank)}
                    </td>
                    <td className="p-3 border-b">{expense.paidBy}</td>
                    <td className="p-3 border-b">{expense.receiptAttached ? "Attached" : "Missing"}</td>
                    <td className="p-3 border-b">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          aria-label="Edit expenditure"
                          disabled={locked}
                          onClick={() => openEdit(expense)}
                          className="rounded border border-gray-300 p-2 text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Edit size={15} />
                        </button>
                        <button
                          type="button"
                          aria-label="Delete expenditure"
                          disabled={locked}
                          onClick={() => setDeleteTarget(expense)}
                          className="rounded border border-red-200 p-2 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
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
            <div className="bg-red-50 text-red-600 p-3 rounded border border-red-200 text-sm">
              {error}
            </div>
          )}

          {dailySession && !form.id && (
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.linkedToSession}
                onChange={(event) => setForm((current) => ({ ...current, linkedToSession: event.target.checked }))}
              />
              Link this expenditure to the active daily session
            </label>
          )}

          {form.id && (
            <div className="rounded border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
              Session linkage cannot be changed after creation.
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="space-y-1">
              <span className="text-sm font-medium text-gray-700">Category *</span>
              <input
                required
                value={form.category}
                onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                className="w-full border rounded p-2"
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-gray-700">Paid By *</span>
              <input
                required
                value={form.paidBy}
                onChange={(event) => setForm((current) => ({ ...current, paidBy: event.target.value }))}
                className="w-full border rounded p-2"
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-gray-700">Amount *</span>
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                value={form.amount}
                onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
                className="w-full border rounded p-2"
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-gray-700">Payment to Bank</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.paymentToBank}
                onChange={(event) => setForm((current) => ({ ...current, paymentToBank: event.target.value }))}
                className="w-full border rounded p-2"
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-gray-700">Voucher Reference</span>
              <input
                value={form.voucherReference}
                onChange={(event) => setForm((current) => ({ ...current, voucherReference: event.target.value }))}
                className="w-full border rounded p-2"
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-gray-700">Approved By</span>
              <input
                value={form.approvedBy}
                onChange={(event) => setForm((current) => ({ ...current, approvedBy: event.target.value }))}
                className="w-full border rounded p-2"
              />
            </label>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.receiptAttached}
              onChange={(event) => setForm((current) => ({ ...current, receiptAttached: event.target.checked }))}
            />
            Receipt attached
          </label>

          <label className="space-y-1 block">
            <span className="text-sm font-medium text-gray-700">Description</span>
            <textarea
              rows={3}
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              className="w-full border rounded p-2"
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
    </div>
  );
}
