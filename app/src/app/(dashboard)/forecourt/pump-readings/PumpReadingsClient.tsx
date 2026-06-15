"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Plus } from "lucide-react";
import DataTable from "@/components/ui/DataTable";
import VarianceBadge from "@/components/ui/VarianceBadge";
import Modal from "@/components/ui/Modal";
import { formatCurrency, formatLitres } from "@/lib/calculations";
import { submitClosingPumpReading, submitOpeningPumpReading } from "@/lib/actions/pump-reading.actions";

type NozzleInfo = {
  id: string;
  name: string;
  pumpId: string;
  pumpName: string;
  productId: string;
  productName: string;
  pricePerLitre: number;
  previousMeter: number;
};

type PumpReadingView = {
  id: string;
  pump: string;
  nozzle: string;
  nozzleId: string;
  product: string;
  productId: string;
  pumpId: string;
  openingMeter: number;
  closingMeter: number;
  litresSold: number;
  pricePerLitre: number;
  amountExpected: number;
  cashReceived: number;
  gocardAmount: number;
  couponAmount: number;
  ghqrAmount: number;
  creditorsAmount: number;
  variance: number;
  isClosingRecorded: boolean;
};

const fieldLabels: Record<string, string> = {
  stationId: "Station",
  dailySessionId: "Daily session",
  businessDate: "Business date",
  shift: "Shift",
  pumpId: "Pump",
  nozzleId: "Nozzle",
  productId: "Product",
  openingLitre: "Opening meter",
  currentLitre: "Closing meter",
  cashReceived: "Cash received",
  gocardAmount: "GO Card / Visa",
  couponAmount: "GOIL Coupon",
  ghqrAmount: "GHQR / Mobile Money",
  creditorsAmount: "Creditors",
  remarks: "Remarks",
};

function fieldLabel(field: string): string {
  return fieldLabels[field] ?? field;
}

function ErrorMessage({
  error,
  fieldErrors,
}: {
  error: string | null;
  fieldErrors: Record<string, string[]>;
}) {
  if (!error) return null;

  return (
    <div
      role="alert"
      style={{
        color: "var(--ax-red)",
        border: "1px solid color-mix(in srgb, var(--ax-red) 30%, transparent)",
        borderRadius: 8,
        background: "color-mix(in srgb, var(--ax-red) 7%, white)",
        padding: "10px 12px",
        marginBottom: "14px",
        fontSize: 14,
        lineHeight: 1.4,
      }}
    >
      <div style={{ fontWeight: 700 }}>{error}</div>
      {Object.keys(fieldErrors).length > 0 && (
        <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>
          {Object.entries(fieldErrors).flatMap(([field, messages]) =>
            messages.map((message) => (
              <li key={`${field}-${message}`}>
                <strong>{fieldLabel(field)}:</strong> {message}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

export default function PumpReadingsClient({
  stationId,
  dailySessionId,
  businessDate,
  readings,
  nozzles,
}: {
  stationId: string;
  dailySessionId: string;
  businessDate: string;
  readings: PumpReadingView[];
  nozzles: NozzleInfo[];
}) {
  const router = useRouter();
  const [openingOpen, setOpeningOpen] = useState(false);
  const [closingOpen, setClosingOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const openedNozzleIds = new Set(readings.map((reading) => reading.nozzleId));
  const openingNozzles = nozzles.filter((nozzle) => !openedNozzleIds.has(nozzle.id));
  const closingReadings = readings.filter((reading) => !reading.isClosingRecorded);

  const [selectedOpeningNozzleId, setSelectedOpeningNozzleId] = useState(openingNozzles[0]?.id || "");
  const [openingMeter, setOpeningMeter] = useState("");
  const [selectedClosingReadingId, setSelectedClosingReadingId] = useState(closingReadings[0]?.id || "");
  const [closingMeter, setClosingMeter] = useState("");
  const [cashReceived, setCashReceived] = useState("");
  const [gocardAmount, setGocardAmount] = useState("");
  const [couponAmount, setCouponAmount] = useState("");
  const [ghqrAmount, setGhqrAmount] = useState("");
  const [creditorsAmount, setCreditorsAmount] = useState("");

  const selectedOpeningNozzle = openingNozzles.find((nozzle) => nozzle.id === selectedOpeningNozzleId) ?? openingNozzles[0];
  const selectedClosingReading =
    closingReadings.find((reading) => reading.id === selectedClosingReadingId) ?? closingReadings[0];

  const parsedClosing = parseFloat(closingMeter) || 0;
  const closingLitresSold = selectedClosingReading
    ? Math.max(0, parsedClosing - selectedClosingReading.openingMeter)
    : 0;
  const expectedAmount = selectedClosingReading ? closingLitresSold * selectedClosingReading.pricePerLitre : 0;

  const resetFeedback = () => {
    setError(null);
    setFieldErrors({});
  };

  const buildBaseFormData = (source: NozzleInfo | PumpReadingView) => {
    const formData = new FormData();
    formData.append("stationId", stationId);
    formData.append("dailySessionId", dailySessionId);
    formData.append("businessDate", businessDate);
    formData.append("shift", "DAY");
    formData.append("pumpId", source.pumpId);
    formData.append("nozzleId", "id" in source && "openingMeter" in source ? source.nozzleId : source.id);
    formData.append("productId", source.productId);
    return formData;
  };

  const openOpeningModal = () => {
    resetFeedback();
    const firstNozzle = openingNozzles[0];
    setSelectedOpeningNozzleId(firstNozzle?.id || "");
    setOpeningMeter(firstNozzle ? firstNozzle.previousMeter.toFixed(2) : "");
    setOpeningOpen(true);
  };

  const openClosingModal = () => {
    resetFeedback();
    const firstReading = closingReadings[0];
    setSelectedClosingReadingId(firstReading?.id || "");
    setClosingMeter(firstReading ? firstReading.openingMeter.toFixed(2) : "");
    setCashReceived("");
    setGocardAmount("");
    setCouponAmount("");
    setGhqrAmount("");
    setCreditorsAmount("");
    setClosingOpen(true);
  };

  const handleOpeningSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedOpeningNozzle) return;

    resetFeedback();
    const formData = buildBaseFormData(selectedOpeningNozzle);
    formData.append("openingLitre", openingMeter);

    startTransition(async () => {
      const res = await submitOpeningPumpReading(stationId, formData);
      if (res.success) {
        setOpeningOpen(false);
        router.refresh();
      } else {
        setError(res.fieldErrors ? "Please correct the highlighted fields." : res.error || "Failed to save opening meter");
        setFieldErrors(res.fieldErrors ?? {});
      }
    });
  };

  const handleClosingSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedClosingReading) return;

    resetFeedback();
    const formData = buildBaseFormData(selectedClosingReading);
    formData.append("currentLitre", closingMeter);
    formData.append("cashReceived", cashReceived || "0");
    formData.append("gocardAmount", gocardAmount || "0");
    formData.append("couponAmount", couponAmount || "0");
    formData.append("ghqrAmount", ghqrAmount || "0");
    formData.append("creditorsAmount", creditorsAmount || "0");

    startTransition(async () => {
      const res = await submitClosingPumpReading(stationId, formData);
      if (res.success) {
        setClosingOpen(false);
        router.refresh();
      } else {
        setError(res.fieldErrors ? "Please correct the highlighted fields." : res.error || "Failed to save closing sales");
        setFieldErrors(res.fieldErrors ?? {});
      }
    });
  };

  return (
    <>
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <button className="btn btn-primary" onClick={openOpeningModal} disabled={openingNozzles.length === 0}>
          <Plus size={13} />
          Record Opening Meters
        </button>
        <button className="btn btn-outline" onClick={openClosingModal} disabled={closingReadings.length === 0}>
          <CheckCircle size={14} />
          Record Closing Sales
        </button>
      </div>

      <DataTable<PumpReadingView>
        title="Nozzle Session Readings"
        columns={[
          { key: "pump", header: "Pump" },
          { key: "nozzle", header: "Nozzle" },
          { key: "product", header: "Product" },
          {
            key: "isClosingRecorded",
            header: "Status",
            render: (r) => (r.isClosingRecorded ? "Closed" : "Opening recorded"),
          },
          { key: "openingMeter", header: "Opening Meter (L)", align: "right", render: (r) => r.openingMeter.toFixed(2) },
          {
            key: "closingMeter",
            header: "Closing Meter (L)",
            align: "right",
            render: (r) => (r.isClosingRecorded ? r.closingMeter.toFixed(2) : "-"),
          },
          {
            key: "litresSold",
            header: "Litres Sold",
            align: "right",
            computed: true,
            render: (r) => (r.isClosingRecorded ? formatLitres(r.litresSold) : "-"),
          },
          { key: "pricePerLitre", header: "Price/L", align: "right", render: (r) => `GHS ${r.pricePerLitre.toFixed(4)}` },
          {
            key: "amountExpected",
            header: "Expected",
            align: "right",
            computed: true,
            render: (r) => (r.isClosingRecorded ? formatCurrency(r.amountExpected) : "-"),
          },
          {
            key: "cashReceived",
            header: "Cash",
            align: "right",
            render: (r) => (r.isClosingRecorded ? formatCurrency(r.cashReceived) : "-"),
          },
          {
            key: "gocardAmount",
            header: "GO Card",
            align: "right",
            render: (r) => (r.isClosingRecorded && r.gocardAmount ? formatCurrency(r.gocardAmount) : "-"),
          },
          {
            key: "couponAmount",
            header: "Coupon",
            align: "right",
            render: (r) => (r.isClosingRecorded && r.couponAmount ? formatCurrency(r.couponAmount) : "-"),
          },
          {
            key: "variance",
            header: "Variance",
            align: "right",
            computed: true,
            render: (r) =>
              r.isClosingRecorded ? (
                <VarianceBadge
                  value={r.variance}
                  format={(v) => formatCurrency(Math.abs(v)) + (v < 0 ? " short" : " over")}
                  warningThreshold={200}
                  dangerThreshold={1000}
                />
              ) : (
                "-"
              ),
          },
        ]}
        data={readings}
        getRowKey={(r) => r.id}
      />

      <Modal
        open={openingOpen}
        title="Record Opening Meter"
        onClose={() => setOpeningOpen(false)}
        size="md"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setOpeningOpen(false)} disabled={isPending}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleOpeningSubmit} disabled={isPending || !selectedOpeningNozzle}>
              {isPending ? "Saving..." : "Save Opening Meter"}
            </button>
          </>
        }
      >
        <ErrorMessage error={error} fieldErrors={fieldErrors} />
        <form onSubmit={handleOpeningSubmit}>
          <div className="form-group">
            <label className="form-label">Pump / Nozzle</label>
            <select
              className="form-select"
              value={selectedOpeningNozzleId}
              onChange={(event) => {
                const nozzle = openingNozzles.find((item) => item.id === event.target.value);
                setSelectedOpeningNozzleId(event.target.value);
                setOpeningMeter(nozzle ? nozzle.previousMeter.toFixed(2) : "");
              }}
              disabled={isPending}
            >
              {openingNozzles.map((nozzle) => (
                <option key={nozzle.id} value={nozzle.id}>
                  {nozzle.pumpName} - {nozzle.name} ({nozzle.productName})
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Opening Meter (L)</label>
            <input
              className="form-input"
              type="number"
              step="0.01"
              value={openingMeter}
              onChange={(event) => setOpeningMeter(event.target.value)}
              disabled={isPending}
            />
          </div>
        </form>
      </Modal>

      <Modal
        open={closingOpen}
        title="Record Closing Sales"
        onClose={() => setClosingOpen(false)}
        size="lg"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setClosingOpen(false)} disabled={isPending}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleClosingSubmit} disabled={isPending || !selectedClosingReading}>
              {isPending ? "Saving..." : "Save Closing Sales"}
            </button>
          </>
        }
      >
        <ErrorMessage error={error} fieldErrors={fieldErrors} />
        <form onSubmit={handleClosingSubmit}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            <div className="form-group" style={{ gridColumn: "1/-1" }}>
              <label className="form-label">Pump / Nozzle</label>
              <select
                className="form-select"
                value={selectedClosingReadingId}
                onChange={(event) => {
                  const reading = closingReadings.find((item) => item.id === event.target.value);
                  setSelectedClosingReadingId(event.target.value);
                  setClosingMeter(reading ? reading.openingMeter.toFixed(2) : "");
                }}
                disabled={isPending}
              >
                {closingReadings.map((reading) => (
                  <option key={reading.id} value={reading.id}>
                    {reading.pump} - {reading.nozzle} ({reading.product})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Opening Meter (L)</label>
              <input className="form-input computed" type="text" readOnly value={selectedClosingReading?.openingMeter.toFixed(2) ?? "0.00"} />
            </div>
            <div className="form-group">
              <label className="form-label">Closing Meter (L)</label>
              <input
                className="form-input"
                type="number"
                step="0.01"
                value={closingMeter}
                onChange={(event) => setClosingMeter(event.target.value)}
                disabled={isPending}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Litres Sold (computed)</label>
              <input className="form-input computed" type="text" readOnly value={formatLitres(closingLitresSold)} />
            </div>
            <div className="form-group">
              <label className="form-label">Expected Amount (computed)</label>
              <input className="form-input computed" type="text" readOnly value={formatCurrency(expectedAmount)} />
            </div>

            <div className="form-group">
              <label className="form-label">Cash Received</label>
              <input className="form-input" type="number" step="0.01" value={cashReceived} onChange={(event) => setCashReceived(event.target.value)} disabled={isPending} />
            </div>
            <div className="form-group">
              <label className="form-label">GO Card / Visa</label>
              <input className="form-input" type="number" step="0.01" value={gocardAmount} onChange={(event) => setGocardAmount(event.target.value)} disabled={isPending} />
            </div>
            <div className="form-group">
              <label className="form-label">GOIL Coupon</label>
              <input className="form-input" type="number" step="0.01" value={couponAmount} onChange={(event) => setCouponAmount(event.target.value)} disabled={isPending} />
            </div>
            <div className="form-group">
              <label className="form-label">GHQR / Mobile Money</label>
              <input className="form-input" type="number" step="0.01" value={ghqrAmount} onChange={(event) => setGhqrAmount(event.target.value)} disabled={isPending} />
            </div>
            <div className="form-group">
              <label className="form-label">Creditors (Credit Sales)</label>
              <input className="form-input" type="number" step="0.01" value={creditorsAmount} onChange={(event) => setCreditorsAmount(event.target.value)} disabled={isPending} />
            </div>
          </div>
        </form>
      </Modal>
    </>
  );
}
