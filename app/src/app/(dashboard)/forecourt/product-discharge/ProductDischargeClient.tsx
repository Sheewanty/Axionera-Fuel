"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import { Plus, Info } from "lucide-react";
import { createProductDischargeAction } from "@/lib/actions/product-discharge.actions";
import { useRouter } from "next/navigation";

type DischargeSummary = {
  id: string;
  tank: string;
  product: string;
  supplierName: string;
  invoiceNumber: string;
  productDischargedLitres: number;
  dischargeVarianceLitres: number;
  topUpLitres: number;
  expectedTankAfterDischarge: number;
};

type TankDef = {
  id: string;
  name: string;
  productId: string;
  productName: string;
};

interface Props {
  stationId: string;
  dailySessionId: string;
  sessionStatus: string;
  discharges: DischargeSummary[];
  tanks: TankDef[];
}

export default function ProductDischargeClient({
  stationId,
  dailySessionId,
  sessionStatus,
  discharges,
  tanks,
}: Props) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
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
  const [sealNumbers, setSealNumbers] = useState("");
  const [sealNumbersContinued, setSealNumbersContinued] = useState("");
  const [compartmentNumber, setCompartmentNumber] = useState("");
  const [stationMeasurement, setStationMeasurement] = useState("");
  const [remarks, setRemarks] = useState("");

  const selectedTank = tanks.find((t) => t.id === tankId);

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
      sealNumbers: sealNumbers || undefined,
      sealNumbersContinued: sealNumbersContinued || undefined,
      compartmentNumber: compartmentNumber || undefined,
      stationMeasurement: stationMeasurement ? Number(stationMeasurement) : undefined,
      remarks: remarks || undefined,
    };

    try {
      const res = await createProductDischargeAction(payload);
      if (!res.success) {
        throw new Error(res.error || "Failed to create discharge record");
      }
      setIsModalOpen(false);
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

  return (
    <div className="mt-6 space-y-6">
      {/* Action Bar */}
      <div className="flex justify-between items-center bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
        <div className="text-sm text-slate-600">
          <Info className="inline-block w-4 h-4 mr-2" />
          Product discharges track fuel received from suppliers.
        </div>
        {canEdit && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow hover:bg-slate-800"
          >
            <Plus className="w-4 h-4 mr-2" /> Record Discharge
          </button>
        )}
      </div>

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
              <th className="px-4 py-3 text-right font-medium text-slate-600">Top-up (L)</th>
              <th className="px-4 py-3 text-right font-medium text-slate-600">Expected (L)</th>
              <th className="px-4 py-3 text-right font-medium text-slate-600">Variance (L)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {discharges.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
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
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      <Modal 
        open={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title="Record Product Discharge" 
        size="lg"
        footer={
          <>
            <button 
              type="button" 
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              form="discharge-form"
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-md shadow hover:bg-slate-800 disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save Record"}
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
                <input type="text" value={stationSupervisorName} onChange={(e) => setStationSupervisorName(e.target.value)} className="w-full px-3 py-2 border rounded-md" />
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
                <label className="text-sm font-medium text-slate-700">Before Tank Litres *</label>
                <input required type="number" step="0.01" value={beforeTankLitres} onChange={(e) => setBeforeTankLitres(e.target.value)} className="w-full px-3 py-2 border rounded-md" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Discharged Litres *</label>
                <input required type="number" step="0.01" value={productDischargedLitres} onChange={(e) => setProductDischargedLitres(e.target.value)} className="w-full px-3 py-2 border rounded-md" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Top-up Litres *</label>
                <input required type="number" step="0.01" value={topUpLitres} onChange={(e) => setTopUpLitres(e.target.value)} className="w-full px-3 py-2 border rounded-md" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">After Tank Litres *</label>
                <input required type="number" step="0.01" value={afterTankLitres} onChange={(e) => setAfterTankLitres(e.target.value)} className="w-full px-3 py-2 border rounded-md border-primary-500" />
              </div>
            </div>
            
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Remarks</label>
            <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} className="w-full px-3 py-2 border rounded-md" rows={2} />
          </div>
        </form>
      </Modal>
    </div>
  );
}
