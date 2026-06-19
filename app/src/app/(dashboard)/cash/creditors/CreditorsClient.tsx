"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { createCreditorAction, createCreditorLedgerEntryAction } from "@/lib/actions/creditor.actions";
import { formatCurrency } from "@/lib/calculations";

type Creditor = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  creditLimit: number | null;
  status: string;
  balance: number;
};

type Product = {
  id: string;
  name: string;
};

type Entry = {
  id: string;
  creditorName: string;
  productName: string | null;
  type: string;
  paymentMethod: string | null;
  amount: number;
  referenceNumber: string | null;
  createdAt: string;
};

type Props = {
  mode: "setup" | "transactions";
  stationId: string;
  dailySessionId: string | null;
  sessionWritable: boolean;
  creditors: Creditor[];
  products: Product[];
  entries: Entry[];
};

function fieldLabel(field: string): string {
  const labels: Record<string, string> = {
    name: "Debtor name",
    creditorId: "Debtor",
    paymentMethod: "Payment method",
    chequeNumber: "Cheque number",
    chequeName: "Cheque name",
    chequeBank: "Cheque bank",
    chequeBranch: "Cheque branch",
    chequeClearingDate: "Cheque clearing date",
    cashReceivedDate: "Cash payment date",
    cardDetails: "Card details",
    momoOperator: "MoMo operator",
    momoNumber: "MoMo number",
    amount: "Amount",
  };
  return labels[field] ?? field;
}

function ErrorBlock({
  error,
  fieldErrors,
}: {
  error: string | null;
  fieldErrors: Record<string, string[]>;
}) {
  if (!error) return null;
  return (
    <div style={{ color: "var(--ax-red)", marginBottom: 12, fontSize: 14 }}>
      <strong>{error}</strong>
      {Object.keys(fieldErrors).length > 0 && (
        <ul style={{ margin: "6px 0 0 18px" }}>
          {Object.entries(fieldErrors).flatMap(([field, messages]) =>
            messages.map((message) => <li key={`${field}-${message}`}>{fieldLabel(field)}: {message}</li>)
          )}
        </ul>
      )}
    </div>
  );
}

export default function CreditorsClient({
  stationId,
  mode,
  dailySessionId,
  sessionWritable,
  creditors,
  products,
  entries,
}: Props) {
  const router = useRouter();
  const [registerOpen, setRegisterOpen] = useState(false);
  const [entryOpen, setEntryOpen] = useState(false);
  const [entryType, setEntryType] = useState<"SALE" | "PAYMENT">("SALE");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "CHEQUE" | "CARD" | "MOMO">("CASH");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const resetErrors = () => {
    setError(null);
    setFieldErrors({});
  };

  const handleCreditorSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.append("stationId", stationId);

    startTransition(async () => {
      resetErrors();
      const response = await createCreditorAction(formData);
      if (!response.success) {
        setError(response.error ?? "Unable to save debtor");
        setFieldErrors(response.fieldErrors ?? {});
        return;
      }
      form.reset();
      setRegisterOpen(false);
      router.refresh();
    });
  };

  const handleEntrySubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!dailySessionId) {
      setError("Open a daily session before recording debtor entries.");
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.append("stationId", stationId);
    formData.append("dailySessionId", dailySessionId);

    startTransition(async () => {
      resetErrors();
      const response = await createCreditorLedgerEntryAction(formData);
      if (!response.success) {
        setError(response.error ?? "Unable to save debtor entry");
        setFieldErrors(response.fieldErrors ?? {});
        return;
      }
      form.reset();
      setEntryOpen(false);
      router.refresh();
    });
  };

  const openRegister = () => {
    resetErrors();
    setRegisterOpen(true);
  };

  const openEntry = () => {
    resetErrors();
    setEntryType("SALE");
    setPaymentMethod("CASH");
    setEntryOpen(true);
  };

  return (
    <div className="mt-6 space-y-6">
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        {mode === "setup" && (
          <button type="button" className="btn btn-primary" onClick={openRegister}>
            <Plus size={14} />
            Add Debtor
          </button>
        )}
        {mode === "transactions" && (
          <button type="button" className="btn btn-primary" onClick={openEntry} disabled={!sessionWritable || creditors.length === 0}>
            <Plus size={14} />
            Record Credit Sale / Payment
          </button>
        )}
      </div>

      {mode === "transactions" && !dailySessionId && (
        <div className="dash-panel" style={{ padding: 16, color: "var(--ax-muted)" }}>
          Open today&apos;s session before recording debtor sales or payments.
        </div>
      )}

      <div className="dash-panel">
        <div className="dash-panel-head">
          <div className="dash-panel-title">Registered Debtors</div>
        </div>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Contact</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Credit Limit</th>
                <th style={{ textAlign: "right" }}>Balance Owed</th>
              </tr>
            </thead>
            <tbody>
              {creditors.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: 28, color: "var(--ax-muted)" }}>
                    No debtors registered for this station.
                  </td>
                </tr>
              ) : (
                creditors.map((creditor) => (
                  <tr key={creditor.id}>
                    <td style={{ fontWeight: 700 }}>{creditor.name}</td>
                    <td>
                      <div>{creditor.phone || "-"}</div>
                      <div style={{ color: "var(--ax-muted)", fontSize: 12 }}>{creditor.email || ""}</div>
                    </td>
                    <td><span className="status-badge" data-status={creditor.status}>{creditor.status}</span></td>
                    <td style={{ textAlign: "right" }}>{creditor.creditLimit ? formatCurrency(creditor.creditLimit) : "-"}</td>
                    <td style={{ textAlign: "right", fontWeight: 800 }}>{formatCurrency(creditor.balance)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {mode === "transactions" && (
      <div className="dash-panel">
        <div className="dash-panel-head">
          <div className="dash-panel-title">Today&apos;s Debtor Entries</div>
        </div>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Debtor</th>
                <th>Type</th>
                <th>Method / Product</th>
                <th>Reference</th>
                <th style={{ textAlign: "right" }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: 28, color: "var(--ax-muted)" }}>
                    No debtor sales or payments recorded for this session.
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.createdAt}</td>
                    <td style={{ fontWeight: 700 }}>{entry.creditorName}</td>
                    <td>{entry.type === "SALE" ? "Credit sale" : "Payment"}</td>
                    <td>{entry.paymentMethod || entry.productName || "-"}</td>
                    <td>{entry.referenceNumber || "-"}</td>
                    <td style={{ textAlign: "right", fontWeight: 700 }}>{formatCurrency(entry.amount)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      <Modal
        open={registerOpen}
        title="Add Debtor"
        onClose={() => setRegisterOpen(false)}
        size="lg"
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={() => setRegisterOpen(false)} disabled={isPending}>Cancel</button>
            <button className="btn btn-primary" type="submit" form="creditor-form" disabled={isPending}>
              {isPending ? "Saving..." : "Save Debtor"}
            </button>
          </>
        }
      >
        <ErrorBlock error={error} fieldErrors={fieldErrors} />
        <form id="creditor-form" onSubmit={handleCreditorSubmit}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <label className="form-group">
              <span className="form-label">Debtor Name *</span>
              <input className="form-input" name="name" required />
            </label>
            <label className="form-group">
              <span className="form-label">Phone</span>
              <input className="form-input" name="phone" />
            </label>
            <label className="form-group">
              <span className="form-label">Email</span>
              <input className="form-input" name="email" type="email" />
            </label>
            <label className="form-group">
              <span className="form-label">Credit Limit</span>
              <input className="form-input" name="creditLimit" type="number" min="0" step="0.01" />
            </label>
            <label className="form-group" style={{ gridColumn: "1/-1" }}>
              <span className="form-label">Notes</span>
              <textarea className="form-textarea" name="notes" rows={3} />
            </label>
          </div>
        </form>
      </Modal>

      <Modal
        open={entryOpen}
        title="Record Credit Sale / Payment"
        onClose={() => setEntryOpen(false)}
        size="lg"
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={() => setEntryOpen(false)} disabled={isPending}>Cancel</button>
            <button className="btn btn-primary" type="submit" form="creditor-entry-form" disabled={isPending}>
              {isPending ? "Saving..." : "Save Entry"}
            </button>
          </>
        }
      >
        <ErrorBlock error={error} fieldErrors={fieldErrors} />
        <form id="creditor-entry-form" onSubmit={handleEntrySubmit}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <label className="form-group">
              <span className="form-label">Debtor *</span>
              <select className="form-select" name="creditorId" required defaultValue="">
                <option value="">Select debtor</option>
                {creditors.filter((creditor) => creditor.status === "ACTIVE").map((creditor) => (
                  <option key={creditor.id} value={creditor.id}>{creditor.name}</option>
                ))}
              </select>
            </label>
            <label className="form-group">
              <span className="form-label">Entry Type *</span>
              <select
                className="form-select"
                name="type"
                value={entryType}
                onChange={(event) => setEntryType(event.target.value as "SALE" | "PAYMENT")}
                required
              >
                <option value="SALE">Credit sale</option>
                <option value="PAYMENT">Debtor payment</option>
              </select>
            </label>
            <label className="form-group">
              <span className="form-label">Amount *</span>
              <input className="form-input" name="amount" type="number" min="0.01" step="0.01" required />
            </label>
            {entryType === "SALE" && (
              <label className="form-group">
                <span className="form-label">Product</span>
                <select className="form-select" name="productId" defaultValue="">
                  <option value="">Not product-specific</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>{product.name}</option>
                  ))}
                </select>
              </label>
            )}
            {entryType === "PAYMENT" && (
              <>
                <label className="form-group">
                  <span className="form-label">Payment Method *</span>
                  <select
                    className="form-select"
                    name="paymentMethod"
                    value={paymentMethod}
                    onChange={(event) => setPaymentMethod(event.target.value as "CASH" | "CHEQUE" | "CARD" | "MOMO")}
                    required
                  >
                    <option value="CASH">Cash</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="CARD">Card</option>
                    <option value="MOMO">MoMo</option>
                  </select>
                </label>
                {paymentMethod === "CASH" && (
                  <label className="form-group">
                    <span className="form-label">Cash Payment Date *</span>
                    <input className="form-input" name="cashReceivedDate" type="date" required />
                  </label>
                )}
                {paymentMethod === "CHEQUE" && (
                  <>
                    <label className="form-group">
                      <span className="form-label">Cheque Number *</span>
                      <input className="form-input" name="chequeNumber" required />
                    </label>
                    <label className="form-group">
                      <span className="form-label">Cheque Name *</span>
                      <input className="form-input" name="chequeName" required />
                    </label>
                    <label className="form-group">
                      <span className="form-label">Bank *</span>
                      <input className="form-input" name="chequeBank" required />
                    </label>
                    <label className="form-group">
                      <span className="form-label">Branch *</span>
                      <input className="form-input" name="chequeBranch" required />
                    </label>
                    <label className="form-group">
                      <span className="form-label">Clearing Date *</span>
                      <input className="form-input" name="chequeClearingDate" type="date" required />
                    </label>
                  </>
                )}
                {paymentMethod === "CARD" && (
                  <label className="form-group">
                    <span className="form-label">Card Details *</span>
                    <input className="form-input" name="cardDetails" required />
                  </label>
                )}
                {paymentMethod === "MOMO" && (
                  <>
                    <label className="form-group">
                      <span className="form-label">MoMo Operator *</span>
                      <select className="form-select" name="momoOperator" required defaultValue="">
                        <option value="">Select operator</option>
                        <option value="MTN">MTN</option>
                        <option value="Telecel">Telecel</option>
                        <option value="AT">AT</option>
                      </select>
                    </label>
                    <label className="form-group">
                      <span className="form-label">MoMo Number *</span>
                      <input className="form-input" name="momoNumber" required />
                    </label>
                  </>
                )}
              </>
            )}
            <label className="form-group">
              <span className="form-label">Reference Number</span>
              <input className="form-input" name="referenceNumber" />
            </label>
            <label className="form-group" style={{ gridColumn: "1/-1" }}>
              <span className="form-label">Remarks</span>
              <textarea className="form-textarea" name="remarks" rows={3} />
            </label>
          </div>
        </form>
      </Modal>
    </div>
  );
}
