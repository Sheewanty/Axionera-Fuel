"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { createPaymentDetailAction } from "@/lib/actions/payment-detail.actions";
import { formatCurrency } from "@/lib/calculations";

type ProductOption = { id: string; name: string };

type PaymentDetail = {
  id: string;
  channel: string;
  amount: number;
  customerName: string | null;
  attendantName: string | null;
  referenceNumber: string | null;
  serialNumber: string | null;
  status: string;
  createdAt: string;
};

type Props = {
  stationId: string;
  dailySessionId: string;
  products: ProductOption[];
  totals: {
    goCardVisa: number;
    coupons: number;
    ghqrMomo: number;
    debtorCreditSales: number;
    debtorPaymentCash: number;
    debtorPaymentCheque: number;
    debtorPaymentCard: number;
    debtorPaymentMomo: number;
  };
  details: PaymentDetail[];
  sessionWritable: boolean;
};

const channelLabels: Record<string, string> = {
  GO_CARD: "GO Card",
  VISA: "Visa",
  GOIL_COUPON: "GOIL Coupon",
  YY_COUPON: "YY Coupon",
  GHQR: "GHQR / MoMo",
};

function fieldLabel(field: string): string {
  const labels: Record<string, string> = {
    customerName: "Customer",
    referenceNumber: "Reference",
    serialNumber: "Serial number",
  };
  return labels[field] ?? field;
}

export default function PaymentDetailsClient({
  stationId,
  dailySessionId,
  products,
  totals,
  details,
  sessionWritable,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.append("stationId", stationId);
    formData.append("dailySessionId", dailySessionId);

    startTransition(async () => {
      setError(null);
      setFieldErrors({});
      const response = await createPaymentDetailAction(formData);
      if (!response.success) {
        setError(response.error ?? "Unable to save payment detail");
        setFieldErrors(response.fieldErrors ?? {});
        return;
      }
      form.reset();
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      {sessionWritable && (
        <div style={{ marginBottom: 20 }}>
          <button className="btn btn-primary" onClick={() => setOpen(true)}>
            <Plus size={14} />
            Add Payment Detail
          </button>
        </div>
      )}

      <div className="dash-grid cols-4" style={{ marginBottom: 20 }}>
        <div className="dash-card">
          <div className="dash-card-label">GO Card / Visa</div>
          <div className="dash-card-value">{formatCurrency(totals.goCardVisa)}</div>
        </div>
        <div className="dash-card">
          <div className="dash-card-label">Coupons</div>
          <div className="dash-card-value">{formatCurrency(totals.coupons)}</div>
        </div>
        <div className="dash-card">
          <div className="dash-card-label">GHQR / MoMo</div>
          <div className="dash-card-value">{formatCurrency(totals.ghqrMomo)}</div>
        </div>
        <div className="dash-card">
          <div className="dash-card-label">Debtor Credit Sales</div>
          <div className="dash-card-value">{formatCurrency(totals.debtorCreditSales)}</div>
        </div>
      </div>

      <div className="dash-panel" style={{ marginBottom: 20 }}>
        <div className="dash-panel-head">
          <div className="dash-panel-title">Debtor Payments Received</div>
        </div>
        <div className="dash-grid cols-4">
          <div>
            <div className="dash-card-label">Cash</div>
            <div style={{ fontWeight: 800, color: "var(--ax-blue)" }}>{formatCurrency(totals.debtorPaymentCash)}</div>
          </div>
          <div>
            <div className="dash-card-label">Cheque</div>
            <div style={{ fontWeight: 800, color: "var(--ax-blue)" }}>{formatCurrency(totals.debtorPaymentCheque)}</div>
          </div>
          <div>
            <div className="dash-card-label">Card</div>
            <div style={{ fontWeight: 800, color: "var(--ax-blue)" }}>{formatCurrency(totals.debtorPaymentCard)}</div>
          </div>
          <div>
            <div className="dash-card-label">MoMo</div>
            <div style={{ fontWeight: 800, color: "var(--ax-blue)" }}>{formatCurrency(totals.debtorPaymentMomo)}</div>
          </div>
        </div>
      </div>

      <div className="dash-panel">
        <div className="dash-panel-head">
          <div className="dash-panel-title">Daily Payment Details</div>
        </div>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Channel</th>
                <th>Customer / Attendant</th>
                <th>Reference / Serial</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {details.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: 28, color: "var(--ax-muted)" }}>
                    No payment details recorded for this session.
                  </td>
                </tr>
              ) : (
                details.map((detail) => (
                  <tr key={detail.id}>
                    <td style={{ fontWeight: 700 }}>{channelLabels[detail.channel] ?? detail.channel}</td>
                    <td>
                      <div>{detail.customerName || "-"}</div>
                      <div style={{ color: "var(--ax-muted)", fontSize: 12 }}>{detail.attendantName || ""}</div>
                    </td>
                    <td>
                      <div>{detail.referenceNumber || detail.serialNumber || "-"}</div>
                    </td>
                    <td>
                      <span className="status-badge" data-status={detail.status}>{detail.status.replace(/_/g, " ")}</span>
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 700 }}>{formatCurrency(detail.amount)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={open}
        title="Add Payment Detail"
        onClose={() => setOpen(false)}
        size="lg"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setOpen(false)} disabled={isPending}>Cancel</button>
            <button className="btn btn-primary" type="submit" form="payment-detail-form" disabled={isPending}>
              {isPending ? "Saving..." : "Save Detail"}
            </button>
          </>
        }
      >
        {error && (
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
        )}
        <form id="payment-detail-form" onSubmit={handleSubmit}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <label className="form-group">
              <span className="form-label">Channel *</span>
              <select className="form-select" name="channel" required defaultValue="GHQR">
                <option value="GO_CARD">GO Card</option>
                <option value="VISA">Visa</option>
                <option value="GOIL_COUPON">GOIL Coupon</option>
                <option value="YY_COUPON">YY Coupon</option>
                <option value="GHQR">GHQR / MoMo</option>
              </select>
            </label>
            <label className="form-group">
              <span className="form-label">Amount *</span>
              <input className="form-input" name="amount" type="number" min="0.01" step="0.01" required />
            </label>
            <label className="form-group">
              <span className="form-label">Product</span>
              <select className="form-select" name="productId" defaultValue="">
                <option value="">Not product-specific</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>{product.name}</option>
                ))}
              </select>
            </label>
            <label className="form-group">
              <span className="form-label">Customer</span>
              <input className="form-input" name="customerName" />
            </label>
            <label className="form-group">
              <span className="form-label">Attendant Name</span>
              <input className="form-input" name="attendantName" />
            </label>
            <label className="form-group">
              <span className="form-label">Reference / MoMo ID</span>
              <input className="form-input" name="referenceNumber" />
            </label>
            <label className="form-group">
              <span className="form-label">Coupon Serial Number</span>
              <input className="form-input" name="serialNumber" />
            </label>
            <label className="form-group">
              <span className="form-label">Phone Number</span>
              <input className="form-input" name="phoneNumber" />
            </label>
            <label className="form-group">
              <span className="form-label">Status</span>
              <select className="form-select" name="status" defaultValue="PENDING">
                <option value="PENDING">Pending</option>
                <option value="SUBMITTED_TO_HQ">Submitted to HQ</option>
                <option value="SETTLED">Settled</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </label>
            <label className="form-group" style={{ gridColumn: "1/-1" }}>
              <span className="form-label">Remarks</span>
              <textarea className="form-textarea" name="remarks" rows={3} />
            </label>
          </div>
        </form>
      </Modal>
    </>
  );
}
