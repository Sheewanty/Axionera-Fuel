"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveLubeBayMomoOperatorAction } from "@/lib/actions/setup.actions";

type ActionResponse = {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

type StationOption = {
  id: string;
  name: string;
};

type MomoOperator = {
  id: string;
  name: string;
  stationId: string | null;
  stationName: string | null;
  isActive: boolean;
};

function FormError({ result }: { result: ActionResponse | null }) {
  if (!result || result.success) return null;

  return (
    <div
      role="alert"
      style={{
        background: "color-mix(in srgb, var(--ax-red) 7%, white)",
        border: "1px solid color-mix(in srgb, var(--ax-red) 30%, white)",
        borderRadius: 8,
        color: "var(--ax-red)",
        fontSize: 14,
        lineHeight: 1.4,
        marginBottom: 14,
        padding: "10px 12px",
      }}
    >
      <strong>{result.error ?? "Unable to save record"}</strong>
      {result.fieldErrors && (
        <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>
          {Object.entries(result.fieldErrors).flatMap(([field, messages]) =>
            messages.map((message) => (
              <li key={`${field}-${message}`}>
                {field}: {message}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

export default function PaymentSetupClient({
  stations,
  momoOperators,
}: {
  stations: StationOption[];
  momoOperators: MomoOperator[];
}) {
  const router = useRouter();
  const [editingOperator, setEditingOperator] = useState<MomoOperator | null>(null);
  const [result, setResult] = useState<ActionResponse | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    startTransition(async () => {
      const response = await saveLubeBayMomoOperatorAction(formData);
      setResult(response);
      if (response.success) {
        form.reset();
        setEditingOperator(null);
        router.refresh();
      }
    });
  };

  return (
    <>
      <div className="dash-panel" style={{ marginBottom: 18 }}>
        <div className="dash-panel-head">
          <div>
            <div className="dash-panel-title">{editingOperator ? "Edit MoMo Operator" : "Add MoMo Operator"}</div>
            <div className="dash-panel-sub">Configure mobile-money operators used across forecourt, mart, lube bay, and debtor payments.</div>
          </div>
        </div>
        <div style={{ padding: "1.25rem" }}>
          <FormError result={result} />
          <form key={editingOperator?.id ?? "new-operator"} onSubmit={submit}>
            {editingOperator && <input type="hidden" name="id" value={editingOperator.id} />}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
              <div className="form-group">
                <label className="form-label">MoMo Operator</label>
                <input className="form-input" name="name" required placeholder="MTN" defaultValue={editingOperator?.name ?? ""} />
              </div>
              <div className="form-group">
                <label className="form-label">Applies To</label>
                <select className="form-select" name="stationId" defaultValue={editingOperator?.stationId ?? ""}>
                  <option value="">All stations</option>
                  {stations.map((station) => (
                    <option key={station.id} value={station.id}>
                      {station.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-select" name="isActive" defaultValue={editingOperator ? String(editingOperator.isActive) : "true"}>
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
              <div style={{ alignSelf: "end", display: "flex", gap: 10 }}>
                <button className="btn btn-primary" disabled={pending} type="submit">
                  {pending ? "Saving..." : editingOperator ? "Update Operator" : "Save Operator"}
                </button>
                {editingOperator && (
                  <button className="btn btn-outline" type="button" onClick={() => setEditingOperator(null)}>
                    Cancel Edit
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>

      <div className="dash-panel">
        <div className="dash-panel-head">
          <div className="dash-panel-title">MoMo Operators</div>
        </div>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Operator</th>
                <th>Applies To</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {momoOperators.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", padding: 24, color: "var(--ax-muted)" }}>
                    No MoMo operators configured.
                  </td>
                </tr>
              ) : (
                momoOperators.map((operator) => (
                  <tr key={operator.id}>
                    <td style={{ fontWeight: 700 }}>{operator.name}</td>
                    <td>{operator.stationName ?? "All stations"}</td>
                    <td>
                      <span className="status-badge" data-status={operator.isActive ? "ACTIVE" : "INACTIVE"}>
                        {operator.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      <button className="btn btn-outline btn-sm" type="button" onClick={() => setEditingOperator(operator)}>
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
