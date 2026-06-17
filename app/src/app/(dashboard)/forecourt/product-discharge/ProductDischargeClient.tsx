"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import { Edit, Plus } from "lucide-react";
import { createProductDischargeAction, updateProductDischargeAction } from "@/lib/actions/product-discharge.actions";
import { useRouter } from "next/navigation";

type DischargeSummary = {
  id: string;
  tankId: string;
  productId: string;
  tank: string;
  product: string;
  supplierName: string;
  invoiceNumber: string;
  invoiceMeasurement: number;
  stationMeasurement: number | null;
  productDischargedLitres: number;
  beforeTankLitres: number;
  afterTankLitres: number;
  dischargeVarianceLitres: number;
  topUpLitres: number;
  expectedTankAfterDischarge: number;
  vehicleRegistrationNumber: string | null;
  driverName: string | null;
  stationSupervisorName: string | null;
  couplingHeightCm: number | null;
  tbar: number | null;
  calibrationCertificate: string | null;
  tankerWaterTestStatus: string;
  receivingTankWaterTestStatus: string;
  waterTestRemarks: string | null;
  sealNumbers: string | null;
  sealNumbersContinued: string | null;
  compartmentNumber: string | null;
  remarks: string | null;
};

type TankDef = {
  id: string;
  name: string;
  productId: string;
  productName: string;
};

type SupervisorOption = {
  id: string;
  name: string;
};

interface Props {
  stationId: string;
  dailySessionId: string;
  sessionStatus: string;
  discharges: DischargeSummary[];
  tanks: TankDef[];
  supervisors: SupervisorOption[];
}

export default function ProductDischargeClient({
  stationId,
  dailySessionId,
  sessionStatus,
  discharges,
  tanks,
  supervisors,
}: Props) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [correctionTarget, setCorrectionTarget] = useState<DischargeSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canEdit = sessionStatus === "OPEN" || sessionStatus === "REOPENED";

  // Form State
  const [tankId, setTankId] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceMeasurement, setInvoiceMeasurement] = useState("");
  const [productDischargedLitres, setProductDischargedLitres] = useState("");
  const [topUpLitres, setTopUpLitres] = useState("0");
  const [beforeTankLitres, setBeforeTankLitres] = useState("");
  const [afterTankLitres, setAfterTankLitres] = useState("");
  
  // Optional fields
  const [vehicleRegistrationNumber, setVehicleRegistrationNumber] = useState("");
  const [driverName, setDriverName] = useState("");
  const [stationSupervisorName, setStationSupervisorName] = useState("");
  const [couplingHeightCm, setCouplingHeightCm] = useState("");
  const [tbar, setTbar] = useState("");
  const [calibrationCertificate, setCalibrationCertificate] = useState("");
  const [tankerWaterTestStatus, setTankerWaterTestStatus] = useState("CLEAR");
  const [receivingTankWaterTestStatus, setReceivingTankWaterTestStatus] = useState("CLEAR");
  const [waterTestRemarks, setWaterTestRemarks] = useState("");
  const [sealNumbers, setSealNumbers] = useState("");
  const [sealNumbersContinued, setSealNumbersContinued] = useState("");
  const [compartmentNumber, setCompartmentNumber] = useState("");
  const [stationMeasurement, setStationMeasurement] = useState("");
  const [remarks, setRemarks] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");

  const selectedTank = tanks.find((t) => t.id === tankId);
  const expectedAfterTankLitres =
    (Number(beforeTankLitres) || 0) +
    (Number(productDischargedLitres) || 0) +
    (Number(topUpLitres) || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!selectedTank) {
      setError("Please select a tank.");
      setLoading(false);
      return;
    }

    const payload = {
      stationId,
      dailySessionId,
      tankId: selectedTank.id,
      productId: selectedTank.productId,
      supplierName,
      invoiceNumber,
      invoiceMeasurement: Number(invoiceMeasurement),
      productDischargedLitres: Number(productDischargedLitres),
      topUpLitres: Number(topUpLitres),
      beforeTankLitres: Number(beforeTankLitres),
      afterTankLitres: Number(afterTankLitres),
      
      // Optionals
      vehicleRegistrationNumber: vehicleRegistrationNumber || undefined,
      driverName: driverName || undefined,
      stationSupervisorName: stationSupervisorName || undefined,
      couplingHeightCm: couplingHeightCm ? Number(couplingHeightCm) : undefined,
      tbar: tbar ? Number(tbar) : undefined,
      calibrationCertificate: calibrationCertificate || undefined,
      tankerWaterTestStatus,
      receivingTankWaterTestStatus,
      waterTestRemarks: waterTestRemarks || undefined,
      sealNumbers: sealNumbers || undefined,
      sealNumbersContinued: sealNumbersContinued || undefined,
      compartmentNumber: compartmentNumber || undefined,
      stationMeasurement: stationMeasurement ? Number(stationMeasurement) : undefined,
      remarks: remarks || undefined,
    };

    try {
      const res = correctionTarget
        ? await updateProductDischargeAction({ ...payload, id: correctionTarget.id, correctionReason })
        : await createProductDischargeAction(payload);
      if (!res.success) {
        throw new Error(res.error || "Failed to create discharge record");
      }
      setIsModalOpen(false);
      setCorrectionTarget(null);
      router.refresh();
      // Reset form (for brevity, keeping simple)
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unknown error occurred.");
      }
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setCorrectionTarget(null);
    setTankId("");
    setSupplierName("");
    setInvoiceNumber("");
    setInvoiceMeasurement("");
    setProductDischargedLitres("");
    setTopUpLitres("0");
    setBeforeTankLitres("");
    setAfterTankLitres("");
    setVehicleRegistrationNumber("");
    setDriverName("");
    setStationSupervisorName("");
    setCouplingHeightCm("");
    setTbar("");
    setCalibrationCertificate("");
    setTankerWaterTestStatus("CLEAR");
    setReceivingTankWaterTestStatus("CLEAR");
    setWaterTestRemarks("");
    setSealNumbers("");
    setSealNumbersContinued("");
    setCompartmentNumber("");
    setStationMeasurement("");
    setRemarks("");
    setCorrectionReason("");
    setError(null);
    setIsModalOpen(true);
  };

  const openCorrection = (discharge: DischargeSummary) => {
    setCorrectionTarget(discharge);
    setTankId(discharge.tankId);
    setSupplierName(discharge.supplierName);
    setInvoiceNumber(discharge.invoiceNumber);
    setInvoiceMeasurement(discharge.invoiceMeasurement.toString());
    setProductDischargedLitres(discharge.productDischargedLitres.toString());
    setTopUpLitres(discharge.topUpLitres.toString());
    setBeforeTankLitres(discharge.beforeTankLitres.toString());
    setAfterTankLitres(discharge.afterTankLitres.toString());
    setVehicleRegistrationNumber(discharge.vehicleRegistrationNumber ?? "");
    setDriverName(discharge.driverName ?? "");
    setStationSupervisorName(discharge.stationSupervisorName ?? "");
    setCouplingHeightCm(discharge.couplingHeightCm?.toString() ?? "");
    setTbar(discharge.tbar?.toString() ?? "");
    setCalibrationCertificate(discharge.calibrationCertificate ?? "");
    setTankerWaterTestStatus(discharge.tankerWaterTestStatus);
    setReceivingTankWaterTestStatus(discharge.receivingTankWaterTestStatus);
    setWaterTestRemarks(discharge.waterTestRemarks ?? "");
    setSealNumbers(discharge.sealNumbers ?? "");
    setSealNumbersContinued(discharge.sealNumbersContinued ?? "");
    setCompartmentNumber(discharge.compartmentNumber ?? "");
    setStationMeasurement(discharge.stationMeasurement?.toString() ?? "");
    setRemarks(discharge.remarks ?? "");
    setCorrectionReason("");
    setError(null);
    setIsModalOpen(true);
  };

  return (
    <div className="mt-6 space-y-6">
      {canEdit && (
        <div style={{ marginBottom: "20px" }}>
          <button className="btn btn-primary" onClick={openCreate}>
            <Plus size={13} />
            Add Discharge Record
          </button>
        </div>
      )}

      {/* Data Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Tank</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Product</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Supplier</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Invoice #</th>
              <th className="px-4 py-3 text-right font-medium text-slate-600">Discharged (L)</th>
              <th className="px-4 py-3 text-right font-medium text-slate-600">Adjustment / Top-up (L)</th>
              <th className="px-4 py-3 text-right font-medium text-slate-600">Expected (L)</th>
              <th className="px-4 py-3 text-right font-medium text-slate-600">Variance (L)</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Water Test</th>
              <th className="px-4 py-3 text-right font-medium text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {discharges.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                  No discharges recorded for this session.
                </td>
              </tr>
            ) : (
              discharges.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{d.tank}</td>
                  <td className="px-4 py-3 text-slate-600">{d.product}</td>
                  <td className="px-4 py-3 text-slate-600">{d.supplierName}</td>
                  <td className="px-4 py-3 text-slate-600">{d.invoiceNumber}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{d.productDischargedLitres.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{d.topUpLitres.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{d.expectedTankAfterDischarge.toFixed(2)}</td>
                  <td className={`px-4 py-3 text-right tabular-nums font-medium ${
                    d.dischargeVarianceLitres < 0 ? "text-red-600" : d.dischargeVarianceLitres > 0 ? "text-green-600" : "text-slate-600"
                  }`}>
                    {d.dischargeVarianceLitres > 0 ? "+" : ""}{d.dischargeVarianceLitres.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {d.tankerWaterTestStatus === "WATER_DETECTED" || d.receivingTankWaterTestStatus === "WATER_DETECTED"
                      ? "Water detected"
                      : "Clear"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      className="btn btn-outline"
                      style={{ width: 34, height: 34, padding: 0 }}
                      aria-label="Correct product discharge"
                      onClick={() => openCorrection(d)}
                    >
                      <Edit size={14} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      <Modal 
        open={isModalOpen} 
        onClose={() => {
          setIsModalOpen(false);
          setCorrectionTarget(null);
        }} 
        title={correctionTarget ? "Correct Product Discharge" : "Record Product Discharge"} 
        size="lg"
        footer={
          <>
            <button 
              type="button" 
              onClick={() => {
                setIsModalOpen(false);
                setCorrectionTarget(null);
              }}
              className="btn btn-outline"
              disabled={loading}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              form="discharge-form"
              disabled={loading}
              className="btn btn-primary disabled:opacity-50"
            >
              {loading ? "Saving..." : correctionTarget ? "Save Correction" : "Save Record"}
            </button>
          </>
        }
      >
        <form id="discharge-form" onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-3 bg-red-50 text-red-600 text-sm border border-red-200 rounded">
              {error}
            </div>
          )}
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Tank *</label>
                <select
                  required
                  value={tankId}
                  onChange={(e) => setTankId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                  disabled={Boolean(correctionTarget)}
                >
                  <option value="">Select Tank...</option>
                  {tanks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.productName})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <hr className="border-slate-200" />
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">Supplier & Invoice Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Supplier Name *</label>
                <input required type="text" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} className="w-full px-3 py-2 border rounded-md" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Invoice Number *</label>
                <input required type="text" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className="w-full px-3 py-2 border rounded-md" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Invoice Measurement *</label>
                <input required type="number" step="0.01" value={invoiceMeasurement} onChange={(e) => setInvoiceMeasurement(e.target.value)} className="w-full px-3 py-2 border rounded-md" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Station Measurement</label>
                <input type="number" step="0.01" value={stationMeasurement} onChange={(e) => setStationMeasurement(e.target.value)} className="w-full px-3 py-2 border rounded-md" />
              </div>
            </div>

            <hr className="border-slate-200" />
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">Vehicle & Driver</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Vehicle Registration</label>
                <input type="text" value={vehicleRegistrationNumber} onChange={(e) => setVehicleRegistrationNumber(e.target.value)} className="w-full px-3 py-2 border rounded-md" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Driver Name</label>
                <input type="text" value={driverName} onChange={(e) => setDriverName(e.target.value)} className="w-full px-3 py-2 border rounded-md" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Station Supervisor</label>
                <select
                  value={stationSupervisorName}
                  onChange={(e) => setStationSupervisorName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="">Select supervisor...</option>
                  {stationSupervisorName && !supervisors.some((supervisor) => supervisor.name === stationSupervisorName) && (
                    <option value={stationSupervisorName}>{stationSupervisorName}</option>
                  )}
                  {supervisors.map((supervisor) => (
                    <option key={supervisor.id} value={supervisor.name}>{supervisor.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Seal Numbers</label>
                <input type="text" value={sealNumbers} onChange={(e) => setSealNumbers(e.target.value)} className="w-full px-3 py-2 border rounded-md" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Seal Numbers (Cont)</label>
                <input type="text" value={sealNumbersContinued} onChange={(e) => setSealNumbersContinued(e.target.value)} className="w-full px-3 py-2 border rounded-md" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Compartment Number</label>
                <input type="text" value={compartmentNumber} onChange={(e) => setCompartmentNumber(e.target.value)} className="w-full px-3 py-2 border rounded-md" />
              </div>
            </div>

            <hr className="border-slate-200" />
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">Measurements & Reconciliation</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Coupling Height (cm)</label>
                <input type="number" step="0.01" value={couplingHeightCm} onChange={(e) => setCouplingHeightCm(e.target.value)} className="w-full px-3 py-2 border rounded-md" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">T-Bar</label>
                <input type="number" step="0.01" value={tbar} onChange={(e) => setTbar(e.target.value)} className="w-full px-3 py-2 border rounded-md" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Calibration Certificate</label>
                <input type="text" value={calibrationCertificate} onChange={(e) => setCalibrationCertificate(e.target.value)} className="w-full px-3 py-2 border rounded-md" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Tanker Water Test</label>
                <select value={tankerWaterTestStatus} onChange={(e) => setTankerWaterTestStatus(e.target.value)} className="w-full px-3 py-2 border rounded-md">
                  <option value="CLEAR">Clear / no water</option>
                  <option value="WATER_DETECTED">Water detected</option>
                  <option value="NOT_TESTED">Not tested</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Receiving Tank Water Test</label>
                <select value={receivingTankWaterTestStatus} onChange={(e) => setReceivingTankWaterTestStatus(e.target.value)} className="w-full px-3 py-2 border rounded-md">
                  <option value="CLEAR">Clear / no water</option>
                  <option value="WATER_DETECTED">Water detected</option>
                  <option value="NOT_TESTED">Not tested</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Water Test Remarks</label>
                <input type="text" value={waterTestRemarks} onChange={(e) => setWaterTestRemarks(e.target.value)} className="w-full px-3 py-2 border rounded-md" />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Before Tank Litres *</label>
                <input required type="number" step="0.01" value={beforeTankLitres} onChange={(e) => setBeforeTankLitres(e.target.value)} className="w-full px-3 py-2 border rounded-md" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Discharged Litres *</label>
                <input required type="number" step="0.01" value={productDischargedLitres} onChange={(e) => setProductDischargedLitres(e.target.value)} className="w-full px-3 py-2 border rounded-md" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Adjustment / Top-up Litres *</label>
                <input required type="number" step="0.01" value={topUpLitres} onChange={(e) => setTopUpLitres(e.target.value)} className="w-full px-3 py-2 border rounded-md" />
                <p className="text-xs text-slate-500">
                  Use 0 unless this delivery includes a shortage correction or extra litres from a previous delivery.
                </p>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Expected After Tank (computed)</label>
                <input
                  type="text"
                  value={`${expectedAfterTankLitres.toFixed(2)} L`}
                  className="w-full px-3 py-2 border rounded-md bg-slate-50 font-semibold"
                  readOnly
                  tabIndex={-1}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">After Tank Litres (measured) *</label>
                <input required type="number" step="0.01" value={afterTankLitres} onChange={(e) => setAfterTankLitres(e.target.value)} className="w-full px-3 py-2 border rounded-md border-primary-500" />
              </div>
            </div>
            
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Remarks</label>
            <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} className="w-full px-3 py-2 border rounded-md" rows={2} />
          </div>
          {correctionTarget && (
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Correction Reason *</label>
              <textarea
                required
                value={correctionReason}
                onChange={(e) => setCorrectionReason(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
                rows={3}
                placeholder="Explain what was wrong and what you corrected."
              />
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
}
