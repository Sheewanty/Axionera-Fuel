import { inflateRawSync } from "node:zlib";

export const NORTHBRIDGE_IMPORT_REQUIRED_SHEETS = [
  "Import Guide",
  "Companies",
  "Stations",
  "Users",
  "Products",
  "Product Prices",
  "Tanks",
  "Pumps",
  "Nozzles",
  "Debtors",
  "Lube Service Types",
  "MoMo Operators",
  "Daily Sessions",
  "Pump Readings",
  "Tank Dipping",
  "Product Discharge",
  "Stock Adjustments",
  "Expenditure",
  "Mart Sales",
  "Lube Sale Lines",
  "Lube Sales",
  "Debtor Ledger",
  "Payment Details",
  "Cash Collections",
] as const;

export type ImportWorkbookValidation = {
  sheetNames: string[];
  requiredSheets: string[];
  missingSheets: string[];
  extraSheets: string[];
  rowErrors: ImportRowIssue[];
  rowWarnings: ImportRowIssue[];
  readyForImport: boolean;
};

export type ImportRowIssue = {
  sheet: string;
  rowNumber: number;
  field: string;
  message: string;
};

export type WorkbookCellValue = string | number | boolean | null;
export type WorkbookRow = Record<string, WorkbookCellValue>;
export type WorkbookTables = Record<string, WorkbookRow[]>;

type ZipEntry = {
  fileName: string;
  compressionMethod: number;
  compressedSize: number;
  localHeaderOffset: number;
};

type WorkbookSheetRef = {
  name: string;
  relationshipId: string;
};

function decodeXml(value: string): string {
  return value
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function readUInt16(buffer: Buffer, offset: number): number {
  if (offset + 2 > buffer.length) throw new Error("Invalid XLSX file structure");
  return buffer.readUInt16LE(offset);
}

function readUInt32(buffer: Buffer, offset: number): number {
  if (offset + 4 > buffer.length) throw new Error("Invalid XLSX file structure");
  return buffer.readUInt32LE(offset);
}

function findEndOfCentralDirectory(buffer: Buffer): number {
  const signature = 0x06054b50;
  const minOffset = Math.max(0, buffer.length - 66000);
  for (let offset = buffer.length - 22; offset >= minOffset; offset -= 1) {
    if (readUInt32(buffer, offset) === signature) return offset;
  }
  throw new Error("Invalid XLSX file: ZIP directory was not found");
}

function listZipEntries(buffer: Buffer): Map<string, ZipEntry> {
  const eocdOffset = findEndOfCentralDirectory(buffer);
  const totalEntries = readUInt16(buffer, eocdOffset + 10);
  const centralDirectoryOffset = readUInt32(buffer, eocdOffset + 16);
  const entries = new Map<string, ZipEntry>();

  let offset = centralDirectoryOffset;
  for (let index = 0; index < totalEntries; index += 1) {
    if (readUInt32(buffer, offset) !== 0x02014b50) {
      throw new Error("Invalid XLSX file: central directory is corrupt");
    }

    const compressionMethod = readUInt16(buffer, offset + 10);
    const compressedSize = readUInt32(buffer, offset + 20);
    const fileNameLength = readUInt16(buffer, offset + 28);
    const extraLength = readUInt16(buffer, offset + 30);
    const commentLength = readUInt16(buffer, offset + 32);
    const localHeaderOffset = readUInt32(buffer, offset + 42);
    const fileName = buffer.toString("utf8", offset + 46, offset + 46 + fileNameLength);

    entries.set(fileName, { fileName, compressionMethod, compressedSize, localHeaderOffset });
    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function readZipEntry(buffer: Buffer, entry: ZipEntry): Buffer {
  const offset = entry.localHeaderOffset;
  if (readUInt32(buffer, offset) !== 0x04034b50) {
    throw new Error("Invalid XLSX file: local file header is corrupt");
  }

  const fileNameLength = readUInt16(buffer, offset + 26);
  const extraLength = readUInt16(buffer, offset + 28);
  const dataOffset = offset + 30 + fileNameLength + extraLength;
  const compressedData = buffer.subarray(dataOffset, dataOffset + entry.compressedSize);

  if (entry.compressionMethod === 0) return compressedData;
  if (entry.compressionMethod === 8) return inflateRawSync(compressedData);
  throw new Error(`Unsupported XLSX compression method: ${entry.compressionMethod}`);
}

function getWorkbookXml(buffer: Buffer): string {
  const entries = listZipEntries(buffer);
  const workbookEntry = entries.get("xl/workbook.xml");
  if (!workbookEntry) throw new Error("Invalid XLSX file: workbook metadata was not found");
  return readZipEntry(buffer, workbookEntry).toString("utf8");
}

function extractWorkbookSheetRefs(workbookXml: string): WorkbookSheetRef[] {
  const sheets: WorkbookSheetRef[] = [];
  const sheetPattern = /<(?:\w+:)?sheet\b[^>]*\/?>/g;
  let match: RegExpExecArray | null;
  while ((match = sheetPattern.exec(workbookXml)) !== null) {
    const tag = match[0];
    const name = /\bname=(?:"([^"]+)"|'([^']+)')/.exec(tag);
    const relationship = /\br:id=(?:"([^"]+)"|'([^']+)')/.exec(tag);
    if (!name) continue;
    sheets.push({
      name: decodeXml(name[1] ?? name[2] ?? ""),
      relationshipId: relationship ? decodeXml(relationship[1] ?? relationship[2] ?? "") : "",
    });
  }

  if (sheets.length === 0) throw new Error("No worksheets were found in the uploaded workbook");
  return sheets;
}

export function extractXlsxSheetNames(buffer: Buffer): string[] {
  return extractWorkbookSheetRefs(getWorkbookXml(buffer)).map((sheet) => sheet.name);
}

export function validateImportWorkbookSheets(sheetNames: string[]): ImportWorkbookValidation {
  const requiredSheets = [...NORTHBRIDGE_IMPORT_REQUIRED_SHEETS];
  const uploaded = new Set(sheetNames);
  const required = new Set<string>(requiredSheets);
  const missingSheets = requiredSheets.filter((sheet) => !uploaded.has(sheet));
  const extraSheets = sheetNames.filter((sheet) => !required.has(sheet));

  return {
    sheetNames,
    requiredSheets,
    missingSheets,
    extraSheets,
    rowErrors: [],
    rowWarnings: [],
    readyForImport: missingSheets.length === 0,
  };
}

const STOCK_ADJUSTMENT_TYPES = new Set(["REGULATORY_INSPECTION", "STOCK_CORRECTION", "EVAPORATION", "OTHER"]);
const STOCK_ADJUSTMENT_DIRECTIONS = new Set(["IN", "OUT"]);
const STOCK_ADJUSTMENT_APPROVAL_STATUSES = new Set(["PENDING", "APPROVED", "REJECTED"]);
const SESSION_REFERENCING_SHEETS = [
  "Pump Readings",
  "Tank Dipping",
  "Product Discharge",
  "Stock Adjustments",
  "Expenditure",
  "Mart Sales",
  "Lube Sales",
  "Debtor Ledger",
  "Payment Details",
  "Cash Collections",
] as const;

const STATION_SCOPED_TRANSACTION_SHEETS = [
  "Expenditure",
  "Mart Sales",
  "Lube Sales",
  "Debtor Ledger",
  "Payment Details",
  "Cash Collections",
] as const;

function issue(sheet: string, rowNumber: number, field: string, message: string): ImportRowIssue {
  return { sheet, rowNumber, field, message };
}

function rowText(row: WorkbookRow, key: string): string {
  const value = row[key];
  return value === null || value === undefined ? "" : String(value).trim();
}

function rowNumberValue(row: WorkbookRow, key: string): number | null {
  const value = row[key];
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function excelSerialDate(serial: number): Date {
  const utc = Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000;
  return new Date(utc);
}

function rowDateKey(row: WorkbookRow, key: string): string | null {
  const value = row[key];
  if (typeof value === "number") return excelSerialDate(value).toISOString().slice(0, 10);

  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate())).toISOString().slice(0, 10);
}

function rowSessionKey(row: WorkbookRow): string | null {
  const stationCode = rowText(row, "StationCode").toUpperCase();
  const businessDate = rowDateKey(row, "BusinessDate");
  const shift = (rowText(row, "Shift") || "DAY").toUpperCase();
  if (!stationCode || !businessDate || !shift) return null;
  return `${stationCode}|${businessDate}|${shift}`;
}

function stationScopedKey(stationCode: string, name: string): string {
  return `${stationCode}|${name}`;
}

function nozzleKey(stationCode: string, pumpName: string, nozzleName: string): string {
  return `${stationCode}|${pumpName}|${nozzleName}`;
}

function addMissingReferenceIssue(
  errors: ImportRowIssue[],
  sheet: string,
  rowNumber: number,
  field: string,
  key: string,
  label: string,
  sourceSheet: string
) {
  errors.push(
    issue(
      sheet,
      rowNumber,
      field,
      `${label} was not found for '${key}'. Offending data: ${field}='${key}'. Add or correct the matching row in ${sourceSheet}.`
    )
  );
}

function validateEntityReferences(tables: WorkbookTables): ImportRowIssue[] {
  const errors: ImportRowIssue[] = [];
  const stations = new Set<string>();
  const products = new Set<string>();
  const tanks = new Set<string>();
  const pumps = new Set<string>();
  const nozzles = new Set<string>();
  const debtors = new Set<string>();
  const serviceTypes = new Set<string>();

  (tables["Stations"] ?? []).forEach((row) => {
    const stationCode = rowText(row, "StationCode").toUpperCase();
    if (stationCode) stations.add(stationCode);
  });

  (tables["Products"] ?? []).forEach((row) => {
    const productName = rowText(row, "ProductName");
    if (productName) products.add(productName);
  });

  function validateStation(sheetName: string, row: WorkbookRow, rowNumber: number): string {
    const stationCode = rowText(row, "StationCode").toUpperCase();
    if (!stationCode) {
      errors.push(issue(sheetName, rowNumber, "StationCode", "StationCode is required"));
      return "";
    }
    if (!stations.has(stationCode)) {
      addMissingReferenceIssue(errors, sheetName, rowNumber, "StationCode", stationCode, "Station", "Stations");
    }
    return stationCode;
  }

  function validateProduct(sheetName: string, row: WorkbookRow, rowNumber: number): string {
    const productName = rowText(row, "ProductName");
    if (!productName) {
      errors.push(issue(sheetName, rowNumber, "ProductName", "ProductName is required"));
      return "";
    }
    if (!products.has(productName)) {
      addMissingReferenceIssue(errors, sheetName, rowNumber, "ProductName", productName, "Product", "Products");
    }
    return productName;
  }

  (tables["Product Prices"] ?? []).forEach((row, index) => {
    const rowNumber = index + 2;
    validateStation("Product Prices", row, rowNumber);
    validateProduct("Product Prices", row, rowNumber);
  });

  (tables["Tanks"] ?? []).forEach((row, index) => {
    const rowNumber = index + 2;
    const stationCode = validateStation("Tanks", row, rowNumber);
    validateProduct("Tanks", row, rowNumber);
    const tankName = rowText(row, "TankName");
    if (!tankName) {
      errors.push(issue("Tanks", rowNumber, "TankName", "TankName is required"));
      return;
    }
    if (stationCode) tanks.add(stationScopedKey(stationCode, tankName));
  });

  (tables["Pumps"] ?? []).forEach((row, index) => {
    const rowNumber = index + 2;
    const stationCode = validateStation("Pumps", row, rowNumber);
    const pumpName = rowText(row, "PumpName");
    if (!pumpName) {
      errors.push(issue("Pumps", rowNumber, "PumpName", "PumpName is required"));
      return;
    }
    if (stationCode) pumps.add(stationScopedKey(stationCode, pumpName));
  });

  (tables["Nozzles"] ?? []).forEach((row, index) => {
    const rowNumber = index + 2;
    const stationCode = validateStation("Nozzles", row, rowNumber);
    validateProduct("Nozzles", row, rowNumber);
    const pumpName = rowText(row, "PumpName");
    const nozzleName = rowText(row, "NozzleName");
    if (!pumpName) {
      errors.push(issue("Nozzles", rowNumber, "PumpName", "PumpName is required"));
    } else if (stationCode && !pumps.has(stationScopedKey(stationCode, pumpName))) {
      addMissingReferenceIssue(errors, "Nozzles", rowNumber, "StationCode + PumpName", stationScopedKey(stationCode, pumpName), "Pump", "Pumps");
    }
    if (!nozzleName) {
      errors.push(issue("Nozzles", rowNumber, "NozzleName", "NozzleName is required"));
      return;
    }
    if (stationCode && pumpName) nozzles.add(nozzleKey(stationCode, pumpName, nozzleName));
  });

  (tables["Debtors"] ?? []).forEach((row, index) => {
    const rowNumber = index + 2;
    const stationCode = validateStation("Debtors", row, rowNumber);
    const debtorName = rowText(row, "DebtorName");
    if (!debtorName) {
      errors.push(issue("Debtors", rowNumber, "DebtorName", "DebtorName is required"));
      return;
    }
    if (stationCode) debtors.add(stationScopedKey(stationCode, debtorName));
  });

  (tables["Lube Service Types"] ?? []).forEach((row, index) => {
    const rowNumber = index + 2;
    const stationCode = rowText(row, "StationCode").toUpperCase();
    if (stationCode && !stations.has(stationCode)) {
      addMissingReferenceIssue(errors, "Lube Service Types", rowNumber, "StationCode", stationCode, "Station", "Stations");
    }
    const serviceName = rowText(row, "ServiceName") || rowText(row, "StationCode");
    const vehicleCategory = rowText(row, "VehicleCategory");
    if (!serviceName) errors.push(issue("Lube Service Types", rowNumber, "ServiceName", "ServiceName is required"));
    if (!vehicleCategory) errors.push(issue("Lube Service Types", rowNumber, "VehicleCategory", "VehicleCategory is required"));
    if (serviceName && vehicleCategory) serviceTypes.add(`${serviceName}|${vehicleCategory}`);
  });

  (tables["MoMo Operators"] ?? []).forEach((row, index) => {
    const rowNumber = index + 2;
    const stationCode = rowText(row, "StationCode").toUpperCase();
    if (stationCode && !stations.has(stationCode)) {
      addMissingReferenceIssue(errors, "MoMo Operators", rowNumber, "StationCode", stationCode, "Station", "Stations");
    }
  });

  (tables["Pump Readings"] ?? []).forEach((row, index) => {
    const rowNumber = index + 2;
    const stationCode = validateStation("Pump Readings", row, rowNumber);
    validateProduct("Pump Readings", row, rowNumber);
    const pumpName = rowText(row, "PumpName");
    const nozzleName = rowText(row, "NozzleName");
    if (stationCode && pumpName && !pumps.has(stationScopedKey(stationCode, pumpName))) {
      addMissingReferenceIssue(errors, "Pump Readings", rowNumber, "StationCode + PumpName", stationScopedKey(stationCode, pumpName), "Pump", "Pumps");
    }
    if (stationCode && pumpName && nozzleName && !nozzles.has(nozzleKey(stationCode, pumpName, nozzleName))) {
      addMissingReferenceIssue(
        errors,
        "Pump Readings",
        rowNumber,
        "StationCode + PumpName + NozzleName",
        nozzleKey(stationCode, pumpName, nozzleName),
        "Nozzle",
        "Nozzles"
      );
    }
  });

  ["Tank Dipping", "Product Discharge", "Stock Adjustments"].forEach((sheetName) => {
    (tables[sheetName] ?? []).forEach((row, index) => {
      const rowNumber = index + 2;
      const stationCode = validateStation(sheetName, row, rowNumber);
      validateProduct(sheetName, row, rowNumber);
      const tankName = rowText(row, "TankName");
      if (!tankName) {
        errors.push(issue(sheetName, rowNumber, "TankName", "TankName is required"));
      } else if (stationCode && !tanks.has(stationScopedKey(stationCode, tankName))) {
        addMissingReferenceIssue(errors, sheetName, rowNumber, "StationCode + TankName", stationScopedKey(stationCode, tankName), "Tank", "Tanks");
      }
    });
  });

  STATION_SCOPED_TRANSACTION_SHEETS.forEach((sheetName) => {
    (tables[sheetName] ?? []).forEach((row, index) => {
      validateStation(sheetName, row, index + 2);
    });
  });

  (tables["Debtor Ledger"] ?? []).forEach((row, index) => {
    const rowNumber = index + 2;
    const stationCode = rowText(row, "StationCode").toUpperCase();
    const debtorName = rowText(row, "DebtorName");
    if (stationCode && debtorName && !debtors.has(stationScopedKey(stationCode, debtorName))) {
      addMissingReferenceIssue(errors, "Debtor Ledger", rowNumber, "StationCode + DebtorName", stationScopedKey(stationCode, debtorName), "Debtor", "Debtors");
    }
  });

  (tables["Payment Details"] ?? []).forEach((row, index) => {
    const rowNumber = index + 2;
    const stationCode = rowText(row, "StationCode").toUpperCase();
    const debtorName = rowText(row, "DebtorName");
    if (stationCode && debtorName && !debtors.has(stationScopedKey(stationCode, debtorName))) {
      addMissingReferenceIssue(errors, "Payment Details", rowNumber, "StationCode + DebtorName", stationScopedKey(stationCode, debtorName), "Debtor", "Debtors");
    }
  });

  (tables["Lube Sales"] ?? []).forEach((row, index) => {
    const rowNumber = index + 2;
    const serviceName = rowText(row, "ServiceType");
    const vehicleCategory = rowText(row, "VehicleCategory");
    if (serviceName && vehicleCategory && !serviceTypes.has(`${serviceName}|${vehicleCategory}`)) {
      addMissingReferenceIssue(errors, "Lube Sales", rowNumber, "ServiceType + VehicleCategory", `${serviceName}|${vehicleCategory}`, "Service type", "Lube Service Types");
    }
  });

  return errors;
}

function validateDailySessionReferences(tables: WorkbookTables): ImportRowIssue[] {
  const errors: ImportRowIssue[] = [];
  const sessionKeys = new Set<string>();

  (tables["Daily Sessions"] ?? []).forEach((row) => {
    const key = rowSessionKey(row);
    if (key) sessionKeys.add(key);
  });

  SESSION_REFERENCING_SHEETS.forEach((sheetName) => {
    (tables[sheetName] ?? []).forEach((row, index) => {
      const rowNumber = index + 2;
      const stationCode = rowText(row, "StationCode").toUpperCase();
      const businessDate = rowDateKey(row, "BusinessDate");
      const rawBusinessDate = rowText(row, "BusinessDate");
      const shift = (rowText(row, "Shift") || "DAY").toUpperCase();

      if (!stationCode) {
        errors.push(issue(sheetName, rowNumber, "StationCode", "StationCode is required to match a Daily Sessions row"));
        return;
      }
      if (!businessDate) {
        errors.push(issue(sheetName, rowNumber, "BusinessDate", `BusinessDate is invalid or missing: '${rawBusinessDate}'`));
        return;
      }

      const key = `${stationCode}|${businessDate}|${shift}`;
      if (!sessionKeys.has(key)) {
        errors.push(
          issue(
            sheetName,
            rowNumber,
            "StationCode + BusinessDate + Shift",
            `Daily session was not found for '${key}'. Offending values: StationCode='${stationCode}', BusinessDate='${businessDate}', Shift='${shift}'. Add a matching row in Daily Sessions.`
          )
        );
      }
    });
  });

  return errors;
}

function validateStockAdjustmentRows(rows: WorkbookRow[]): { errors: ImportRowIssue[]; warnings: ImportRowIssue[] } {
  const errors: ImportRowIssue[] = [];
  const warnings: ImportRowIssue[] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const requiredFields = [
      "CompanyCode",
      "StationCode",
      "BusinessDate",
      "TankName",
      "ProductName",
      "AdjustmentType",
      "Direction",
      "Litres",
    ];

    requiredFields.forEach((field) => {
      if (!rowText(row, field)) {
        errors.push(issue("Stock Adjustments", rowNumber, field, `${field} is required`));
      }
    });

    const adjustmentType = rowText(row, "AdjustmentType").toUpperCase();
    const direction = rowText(row, "Direction").toUpperCase();
    const approvalStatus = rowText(row, "ApprovalStatus").toUpperCase();
    const litres = rowNumberValue(row, "Litres");

    if (adjustmentType && !STOCK_ADJUSTMENT_TYPES.has(adjustmentType)) {
      errors.push(
        issue(
          "Stock Adjustments",
          rowNumber,
          "AdjustmentType",
          "AdjustmentType must be REGULATORY_INSPECTION, STOCK_CORRECTION, EVAPORATION, or OTHER"
        )
      );
    }

    if (direction && !STOCK_ADJUSTMENT_DIRECTIONS.has(direction)) {
      errors.push(issue("Stock Adjustments", rowNumber, "Direction", "Direction must be IN or OUT"));
    }

    if (litres === null || litres <= 0) {
      errors.push(issue("Stock Adjustments", rowNumber, "Litres", "Litres must be greater than 0"));
    }

    if (approvalStatus && !STOCK_ADJUSTMENT_APPROVAL_STATUSES.has(approvalStatus)) {
      errors.push(issue("Stock Adjustments", rowNumber, "ApprovalStatus", "ApprovalStatus must be PENDING, APPROVED, or REJECTED"));
    }

    if (adjustmentType === "REGULATORY_INSPECTION" && direction && direction !== "OUT") {
      errors.push(issue("Stock Adjustments", rowNumber, "Direction", "Regulatory inspection draw-offs must use Direction OUT"));
    }

    if (adjustmentType === "REGULATORY_INSPECTION" && !rowText(row, "Reference")) {
      warnings.push(issue("Stock Adjustments", rowNumber, "Reference", "Add the NPA inspection reference where available"));
    }

    if (!rowText(row, "ApprovedBy")) {
      warnings.push(issue("Stock Adjustments", rowNumber, "ApprovedBy", "ApprovedBy is recommended for audit control"));
    }
  });

  return { errors, warnings };
}

export function validateImportWorkbookRows(tables: WorkbookTables): Pick<ImportWorkbookValidation, "rowErrors" | "rowWarnings"> {
  const stockAdjustments = tables["Stock Adjustments"] ?? [];
  const stockAdjustmentIssues = validateStockAdjustmentRows(stockAdjustments);
  return {
    rowErrors: [...validateDailySessionReferences(tables), ...validateEntityReferences(tables), ...stockAdjustmentIssues.errors],
    rowWarnings: stockAdjustmentIssues.warnings,
  };
}

function getRelationshipTargets(buffer: Buffer): Map<string, string> {
  const entries = listZipEntries(buffer);
  const relsEntry = entries.get("xl/_rels/workbook.xml.rels");
  if (!relsEntry) throw new Error("Invalid XLSX file: workbook relationships were not found");

  const xml = readZipEntry(buffer, relsEntry).toString("utf8");
  const targets = new Map<string, string>();
  const relPattern = /<(?:\w+:)?Relationship\b[^>]*>/g;
  let match: RegExpExecArray | null;
  while ((match = relPattern.exec(xml)) !== null) {
    const tag = match[0];
    const id = /\bId=(?:"([^"]+)"|'([^']+)')/.exec(tag);
    const target = /\bTarget=(?:"([^"]+)"|'([^']+)')/.exec(tag);
    if (id && target) {
      const targetValue = decodeXml(target[1] ?? target[2] ?? "");
      targets.set(decodeXml(id[1] ?? id[2] ?? ""), targetValue.startsWith("/") ? targetValue.slice(1) : `xl/${targetValue}`);
    }
  }
  return targets;
}

function getSharedStrings(buffer: Buffer, entries: Map<string, ZipEntry>): string[] {
  const entry = entries.get("xl/sharedStrings.xml");
  if (!entry) return [];

  const xml = readZipEntry(buffer, entry).toString("utf8");
  const values: string[] = [];
  const itemPattern = /<(?:\w+:)?si\b[^>]*>([\s\S]*?)<\/(?:\w+:)?si>/g;
  let item: RegExpExecArray | null;
  while ((item = itemPattern.exec(xml)) !== null) {
    const textParts = [...item[1].matchAll(/<(?:\w+:)?t\b[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/g)];
    values.push(decodeXml(textParts.map((part) => part[1]).join("")));
  }
  return values;
}

function columnIndexFromCellRef(cellRef: string): number {
  const letters = /^[A-Z]+/i.exec(cellRef)?.[0] ?? "";
  return letters.toUpperCase().split("").reduce((sum, letter) => sum * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

function extractCellValue(cellXml: string, sharedStrings: string[]): WorkbookCellValue {
  const type = /\bt=(?:"([^"]+)"|'([^']+)')/.exec(cellXml);
  const cellType = type ? type[1] ?? type[2] : "";
  const valueMatch = /<(?:\w+:)?v\b[^>]*>([\s\S]*?)<\/(?:\w+:)?v>/.exec(cellXml);
  const inlineMatches = [...cellXml.matchAll(/<(?:\w+:)?t\b[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/g)];

  if (inlineMatches.length > 0 && !valueMatch) {
    return decodeXml(inlineMatches.map((part) => part[1]).join(""));
  }
  if (!valueMatch) return null;

  const raw = decodeXml(valueMatch[1]);
  if (cellType === "s") return sharedStrings[Number(raw)] ?? "";
  if (cellType === "str" || cellType === "inlineStr") return raw;
  if (cellType === "b") return raw === "1";

  const numeric = Number(raw);
  return Number.isFinite(numeric) ? numeric : raw;
}

function parseWorksheetRows(xml: string, sharedStrings: string[]): WorkbookCellValue[][] {
  const rows: WorkbookCellValue[][] = [];
  const rowPattern = /<(?:\w+:)?row\b[^>]*>([\s\S]*?)<\/(?:\w+:)?row>/g;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowPattern.exec(xml)) !== null) {
    const cells: WorkbookCellValue[] = [];
    const cellPattern = /<(?:\w+:)?c\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?c>/g;
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellPattern.exec(rowMatch[1])) !== null) {
      const attributes = cellMatch[1];
      const cellRef = /\br=(?:"([^"]+)"|'([^']+)')/.exec(attributes);
      const columnIndex = cellRef ? columnIndexFromCellRef(cellRef[1] ?? cellRef[2] ?? "") : cells.length;
      cells[columnIndex] = extractCellValue(cellMatch[0], sharedStrings);
    }
    rows.push(cells);
  }
  return rows;
}

function trimHeader(value: WorkbookCellValue): string {
  return String(value ?? "").trim();
}

export function readXlsxTables(buffer: Buffer): WorkbookTables {
  const entries = listZipEntries(buffer);
  const sheetRefs = extractWorkbookSheetRefs(getWorkbookXml(buffer));
  const targets = getRelationshipTargets(buffer);
  const sharedStrings = getSharedStrings(buffer, entries);
  const tables: WorkbookTables = {};

  for (const sheet of sheetRefs) {
    const target = targets.get(sheet.relationshipId);
    if (!target) continue;
    const entry = entries.get(target);
    if (!entry) continue;

    const rows = parseWorksheetRows(readZipEntry(buffer, entry).toString("utf8"), sharedStrings);
    const headerIndex = rows.findIndex((row) => {
      const headers = new Set(row.map(trimHeader));
      return headers.has("CompanyCode") || (headers.has("SaleRef") && headers.has("ProductName") && headers.has("Quantity"));
    });
    if (headerIndex === -1) {
      tables[sheet.name] = [];
      continue;
    }

    const headers = rows[headerIndex].map(trimHeader);
    const hasCompanyCode = headers.includes("CompanyCode");
    const dataRows = rows.slice(headerIndex + 1)
      .filter((row) => row.some((cell) => cell !== null && cell !== undefined && String(cell).trim() !== ""))
      .map((row) => {
        const record: WorkbookRow = {};
        headers.forEach((header, index) => {
          if (header) record[header] = row[index] ?? null;
        });
        return record;
      })
      .filter((record) => !hasCompanyCode || String(record.CompanyCode ?? "").trim() !== "");
    tables[sheet.name] = dataRows;
  }

  return tables;
}
