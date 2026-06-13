"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import PageTitle from "@/components/ui/PageTitle";
import DataTable from "@/components/ui/DataTable";
import VarianceBadge from "@/components/ui/VarianceBadge";
import Modal from "@/components/ui/Modal";
import { formatCurrency } from "@/lib/calculations";

interface CashCollection {
  id: string;
  date: string;
  shift: string;
  amountToBank: number;
  bankRef: string;
  bankDate: string;
  expectedCash: number;
  variance: number;
  bankSignature: string;
  supervisorSignature: string;
}

const DEMO_COLLECTIONS: CashCollection[] = [
  {
    id: "1", date: "11 Jun 2026", shift: "Day", amountToBank: 177100, bankRef: "FNB-2026-0611-A",
    bankDate: "11 Jun 2026", expectedCash: 178520, variance: 177100 - 178520,
    bankSignature: "R. Naidoo", supervisorSignature: "T. Nkosi",
  },
  {
    id: "2", date: "10 Jun 2026", shift: "Day", amountToBank: 162400, bankRef: "FNB-2026-0610-A",
    bankDate: "10 Jun 2026", expectedCash: 163200, variance: 162400 - 163200,
    bankSignature: "R. Naidoo", supervisorSignature: "T. Nkosi",
  },
];

export default function CashCollectionPage() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <PageTitle
        eyebrow="Cash & Banking"
        title="Cash Collection"
        subtitle="Station Alpha · June 2026"
      />

      <div style={{ marginBottom: "20px" }}>
        <button className="btn btn-primary" onClick={() => setOpen(true)} id="btn-add-collection">
          <Plus size={13} />
          Record Collection
        </button>
      </div>

      <DataTable<CashCollection>
        title="Bank Collection Records"
        columns={[
          { key: "date", header: "Date" },
          { key: "shift", header: "Shift" },
          { key: "amountToBank", header: "Amount to Bank", align: "right", render: (r) => formatCurrency(r.amountToBank) },
          { key: "bankRef", header: "Bank Reference" },
          { key: "bankDate", header: "Bank Date" },
          { key: "expectedCash", header: "Expected Cash", align: "right", computed: true, render: (r) => formatCurrency(r.expectedCash) },
          {
            key: "variance",
            header: "Variance",
            align: "right",
            computed: true,
            render: (r) => <VarianceBadge value={r.variance} format={(v) => formatCurrency(Math.abs(v)) + (v < 0 ? " short" : " over")} />,
          },
          { key: "bankSignature", header: "Bank Rep" },
          { key: "supervisorSignature", header: "Supervisor" },
        ]}
        data={DEMO_COLLECTIONS}
        getRowKey={(r) => r.id}
      />

      <Modal
        open={open}
        title="Record Cash Collection"
        onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn btn-primary">Save Record</button>
          </>
        }
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
          <div className="form-group">
            <label className="form-label">Amount to Bank (R)</label>
            <input className="form-input" type="number" step="0.01" placeholder="e.g. 177100.00" id="cc-amount" />
          </div>
          <div className="form-group">
            <label className="form-label">Bank Collection Date</label>
            <input className="form-input" type="date" id="cc-date" />
          </div>
          <div className="form-group">
            <label className="form-label">Bank Reference</label>
            <input className="form-input" type="text" placeholder="e.g. FNB-2026-0611-A" id="cc-ref" />
          </div>
          <div className="form-group">
            <label className="form-label">Expected Cash (computed)</label>
            <input className="form-input computed" type="text" readOnly value="—" id="cc-expected" />
          </div>
          <div className="form-group">
            <label className="form-label">Variance (computed)</label>
            <input className="form-input computed" type="text" readOnly value="—" id="cc-variance" />
          </div>
          <div className="form-group">
            <label className="form-label">Bank Representative</label>
            <input className="form-input" type="text" placeholder="Name" id="cc-bank-sig" />
          </div>
          <div className="form-group" style={{ gridColumn: "1/-1" }}>
            <label className="form-label">Supervisor Sign-off</label>
            <input className="form-input" type="text" placeholder="Supervisor name" id="cc-supervisor-sig" />
          </div>
          <div className="form-group" style={{ gridColumn: "1/-1" }}>
            <label className="form-label">Remarks</label>
            <textarea className="form-textarea" rows={2} id="cc-remarks" />
          </div>
        </div>
      </Modal>
    </>
  );
}
