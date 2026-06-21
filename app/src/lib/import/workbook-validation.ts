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
  readyForImport: boolean;
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
    readyForImport: missingSheets.length === 0,
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
