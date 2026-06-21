"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Upload } from "lucide-react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { importTenantWorkbookAction, validateTenantImportWorkbookAction } from "@/lib/actions/platform.actions";

type ValidationData = {
  fileName: string;
  fileSize: number;
  sheetNames: string[];
  requiredSheets: string[];
  missingSheets: string[];
  extraSheets: string[];
  readyForImport: boolean;
};

type ValidationResponse = {
  success: boolean;
  error?: string;
  data?: ValidationData;
};

type ImportResponse = {
  success: boolean;
  error?: string;
  data?: {
    tenantId: string;
    tenantName: string;
    slug: string;
    temporaryPassword: string;
    counts: Record<string, number>;
  };
};

type ProgressPhase = "idle" | "validating" | "validated" | "importing" | "imported" | "error";

const progressState: Record<ProgressPhase, { percent: number; title: string; detail: string }> = {
  idle: {
    percent: 0,
    title: "Ready",
    detail: "Select a workbook to begin validation.",
  },
  validating: {
    percent: 35,
    title: "Validating workbook",
    detail: "Checking file type, workbook structure, and required sheets.",
  },
  validated: {
    percent: 55,
    title: "Workbook validated",
    detail: "Review the validation result, then import when ready.",
  },
  importing: {
    percent: 82,
    title: "Importing records",
    detail: "Writing tenant setup and transactions in one database transaction.",
  },
  imported: {
    percent: 100,
    title: "Import complete",
    detail: "The workbook has been imported successfully.",
  },
  error: {
    percent: 100,
    title: "Action needs attention",
    detail: "Review the message below, correct the issue, and try again.",
  },
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ImportResultPanel({ result }: { result: ImportResponse | null }) {
  if (!result) return null;

  if (!result.success || !result.data) {
    return (
      <div className="dash-panel" style={{ borderColor: "color-mix(in srgb, var(--ax-red) 30%, white)" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", color: "var(--ax-red)", fontWeight: 800 }}>
          <AlertTriangle size={18} />
          Import failed
        </div>
        <p style={{ margin: "8px 0 0", color: "var(--ax-muted)" }}>{result.error ?? "Unable to import workbook."}</p>
      </div>
    );
  }

  const countEntries = Object.entries(result.data.counts).filter(([, value]) => value > 0);
  return (
    <div className="dash-panel" style={{ borderColor: "color-mix(in srgb, var(--ax-green) 30%, white)" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", color: "var(--ax-green)", fontWeight: 900 }}>
        <CheckCircle2 size={18} />
        Import completed
      </div>
      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        <div>
          <div className="metric-label">Tenant</div>
          <div style={{ fontWeight: 800 }}>{result.data.tenantName}</div>
        </div>
        <div>
          <div className="metric-label">Slug</div>
          <div style={{ fontWeight: 800 }}>{result.data.slug}</div>
        </div>
        <div>
          <div className="metric-label">Temporary Password</div>
          <div style={{ fontWeight: 800 }}>{result.data.temporaryPassword}</div>
        </div>
      </div>
      <div style={{ marginTop: 16 }} className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Record Type</th>
              <th style={{ textAlign: "right" }}>Created</th>
            </tr>
          </thead>
          <tbody>
            {countEntries.map(([key, value]) => (
              <tr key={key}>
                <td>{key}</td>
                <td style={{ textAlign: "right", fontWeight: 800 }}>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ImportProgress({ phase }: { phase: ProgressPhase }) {
  const state = progressState[phase];
  const isError = phase === "error";
  const isComplete = phase === "imported";
  const barColor = isError ? "var(--ax-red)" : isComplete ? "var(--ax-green)" : "var(--ax-gold)";

  return (
    <div
      className="dash-panel"
      style={{
        borderColor:
          phase === "idle"
            ? "var(--ax-border)"
            : isError
              ? "color-mix(in srgb, var(--ax-red) 30%, white)"
              : "color-mix(in srgb, var(--ax-gold) 30%, white)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div>
          <div className="metric-label">Import Progress</div>
          <div style={{ fontWeight: 900, marginTop: 4 }}>{state.title}</div>
        </div>
        <div style={{ color: isError ? "var(--ax-red)" : isComplete ? "var(--ax-green)" : "var(--ax-blue)", fontWeight: 900 }}>
          {state.percent}%
        </div>
      </div>
      <div
        aria-label="Import progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={state.percent}
        role="progressbar"
        style={{
          background: "#F8FAFC",
          border: "1px solid var(--ax-border)",
          borderRadius: 999,
          height: 12,
          marginTop: 12,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            background: barColor,
            height: "100%",
            transition: "width 260ms ease",
            width: `${state.percent}%`,
          }}
        />
      </div>
      <p style={{ margin: "10px 0 0", color: "var(--ax-muted)" }}>{state.detail}</p>
    </div>
  );
}

function StatusPanel({ result }: { result: ValidationResponse | null }) {
  if (!result) return null;

  if (!result.success || !result.data) {
    return (
      <div className="dash-panel" style={{ borderColor: "color-mix(in srgb, var(--ax-red) 30%, white)" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", color: "var(--ax-red)", fontWeight: 800 }}>
          <AlertTriangle size={18} />
          Validation failed
        </div>
        <p style={{ margin: "8px 0 0", color: "var(--ax-muted)" }}>{result.error ?? "Unable to validate workbook."}</p>
      </div>
    );
  }

  const { data } = result;
  return (
    <div
      className="dash-panel"
      style={{
        borderColor: data.readyForImport
          ? "color-mix(in srgb, var(--ax-green) 30%, white)"
          : "color-mix(in srgb, var(--ax-amber) 45%, white)",
      }}
    >
      <div style={{ display: "flex", gap: 10, alignItems: "center", color: data.readyForImport ? "var(--ax-green)" : "var(--ax-amber)", fontWeight: 900 }}>
        {data.readyForImport ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
        {data.readyForImport ? "Workbook structure is valid" : "Workbook needs correction before import"}
      </div>
      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "minmax(260px, 2fr) repeat(3, minmax(130px, 1fr))", gap: 18, alignItems: "start" }}>
        <div style={{ minWidth: 0 }}>
          <div className="metric-label">File</div>
          <div style={{ fontWeight: 800, overflowWrap: "anywhere" }}>{data.fileName}</div>
        </div>
        <div>
          <div className="metric-label">Size</div>
          <div style={{ fontWeight: 800 }}>{formatFileSize(data.fileSize)}</div>
        </div>
        <div>
          <div className="metric-label">Sheets Found</div>
          <div style={{ fontWeight: 800 }}>{data.sheetNames.length}</div>
        </div>
        <div>
          <div className="metric-label">Missing Sheets</div>
          <div style={{ fontWeight: 800 }}>{data.missingSheets.length}</div>
        </div>
      </div>
      {data.missingSheets.length > 0 && (
        <div style={{ marginTop: 14, color: "var(--ax-red)" }}>
          <strong>Missing:</strong> {data.missingSheets.join(", ")}
        </div>
      )}
      {data.readyForImport && <p style={{ margin: "14px 0 0", color: "var(--ax-muted)" }}>Validation is complete. You may now import this workbook.</p>}
    </div>
  );
}

export default function TenantImportClient({ requiredSheets }: { requiredSheets: string[] }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [result, setResult] = useState<ValidationResponse | null>(null);
  const [importResult, setImportResult] = useState<ImportResponse | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<ProgressPhase>("idle");
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const presentSheets = useMemo(() => new Set(result?.data?.sheetNames ?? []), [result]);
  const isBusy = isValidating || isImporting;
  const hasImported = Boolean(importResult?.success);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    setIsValidating(true);
    setPhase("validating");
    setImportResult(null);
    try {
      const response = await validateTenantImportWorkbookAction(formData);
      setResult(response);
      setPhase(response.success && response.data?.readyForImport ? "validated" : "error");
    } finally {
      setIsValidating(false);
    }
  };

  const importWorkbook = async () => {
    const form = formRef.current;
    if (!form || !selectedFile || !result?.data?.readyForImport) return;

    setIsConfirmOpen(false);
    setIsImporting(true);
    setPhase("importing");
    try {
      const response = await importTenantWorkbookAction(new FormData(form));
      setImportResult(response);
      setPhase(response.success ? "imported" : "error");
      if (response.success) {
        router.refresh();
      }
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
        <div className="kpi-card">
          <div className="kpi-card-head">
            <div className="kpi-label">Import Mode</div>
            <div className="kpi-icon"><FileSpreadsheet size={18} /></div>
          </div>
          <div className="kpi-value" style={{ fontSize: 24 }}>Validate First</div>
          <div className="kpi-foot">No tenant data is written during validation.</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-card-head">
            <div className="kpi-label">Required Sheets</div>
            <div className="kpi-icon"><CheckCircle2 size={18} /></div>
          </div>
          <div className="kpi-value" style={{ fontSize: 24 }}>{requiredSheets.length}</div>
          <div className="kpi-foot">Northbridge template contract.</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-card-head">
            <div className="kpi-label">Execution</div>
            <div className="kpi-icon"><AlertTriangle size={18} /></div>
          </div>
          <div className="kpi-value" style={{ fontSize: 24 }}>Locked</div>
          <div className="kpi-foot">Import writes all rows in one transaction after validation.</div>
        </div>
      </div>

      <ImportProgress phase={phase} />

      <div className="dash-panel">
        <div className="dash-panel-head">
          <div>
            <div className="dash-panel-title">Upload Workbook</div>
            <div style={{ color: "var(--ax-muted)", marginTop: 4 }}>
              Select `northbridge_fuels_one_week_import_template.xlsx` or another workbook using the same sheet structure.
            </div>
          </div>
        </div>

        <form ref={formRef} onSubmit={submit} style={{ display: "grid", gap: 16 }}>
          <label
            htmlFor="workbook"
            style={{
              border: "1px dashed var(--ax-border)",
              borderRadius: 8,
              cursor: "pointer",
              display: "grid",
              gap: 8,
              justifyItems: "center",
              padding: 28,
              textAlign: "center",
            }}
          >
            <Upload size={28} color="var(--ax-gold)" />
            <strong>{selectedFile ? selectedFile.name : "Choose Excel workbook"}</strong>
            <span style={{ color: "var(--ax-muted)" }}>
              `.xlsx` only, maximum 10MB. The file is validated server-side.
            </span>
            <input
              id="workbook"
              name="workbook"
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              required
              style={{ display: "none" }}
              onChange={(event) => {
                setSelectedFile(event.currentTarget.files?.[0] ?? null);
                setResult(null);
                setImportResult(null);
                setPhase("idle");
              }}
            />
          </label>

          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ color: "var(--ax-muted)" }}>
              {selectedFile ? `${formatFileSize(selectedFile.size)} selected` : "No file selected"}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                className="btn btn-outline"
              onClick={() => {
                formRef.current?.reset();
                setSelectedFile(null);
                setResult(null);
                setImportResult(null);
                setPhase("idle");
              }}
                disabled={isBusy}
              >
                Clear
              </button>
              <button type="submit" className="btn btn-primary" disabled={isBusy || !selectedFile || hasImported}>
                {isValidating ? "Validating..." : "Validate Workbook"}
              </button>
              <button
                type="button"
                className="btn btn-outline"
                disabled={isBusy || !result?.data?.readyForImport || hasImported}
                onClick={() => setIsConfirmOpen(true)}
              >
                {isImporting ? "Importing..." : hasImported ? "Imported" : "Import Workbook"}
              </button>
            </div>
          </div>
        </form>
      </div>

      <StatusPanel result={result} />
      <ImportResultPanel result={importResult} />

      <div className="dash-panel">
        <div className="dash-panel-head">
          <div className="dash-panel-title">Required Sheet Checklist</div>
        </div>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Sheet</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {requiredSheets.map((sheetName) => {
                const checked = Boolean(result?.data);
                const present = presentSheets.has(sheetName);
                return (
                  <tr key={sheetName}>
                    <td>{sheetName}</td>
                    <td>
                      {!checked ? (
                        <span style={{ color: "var(--ax-muted)" }}>Awaiting upload</span>
                      ) : present ? (
                        <span style={{ color: "var(--ax-green)", fontWeight: 800 }}>Present</span>
                      ) : (
                        <span style={{ color: "var(--ax-red)", fontWeight: 800 }}>Missing</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        open={isConfirmOpen}
        title="Import Workbook"
        message="Import this workbook now? FuelStation OS will create the tenant setup and operational records in one all-or-nothing database transaction."
        confirmLabel={isImporting ? "Importing..." : "Import Workbook"}
        cancelLabel="Review Again"
        onCancel={() => {
          if (!isImporting) setIsConfirmOpen(false);
        }}
        onConfirm={importWorkbook}
      />
    </div>
  );
}
