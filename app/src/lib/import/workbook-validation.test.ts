import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  extractXlsxSheetNames,
  NORTHBRIDGE_IMPORT_REQUIRED_SHEETS,
  validateImportWorkbookSheets,
} from "./workbook-validation";

describe("workbook import validation", () => {
  it("validates the Northbridge import workbook sheet contract when the local artifact exists", () => {
    const workbookPath = resolve(
      process.cwd(),
      "../outputs/northbridge_import_pack/northbridge_fuels_one_week_import_template.xlsx"
    );

    if (!existsSync(workbookPath)) {
      return;
    }

    const sheetNames = extractXlsxSheetNames(readFileSync(workbookPath));
    const result = validateImportWorkbookSheets(sheetNames);

    expect(result.readyForImport).toBe(true);
    expect(result.missingSheets).toEqual([]);
    expect(result.sheetNames).toEqual(expect.arrayContaining([...NORTHBRIDGE_IMPORT_REQUIRED_SHEETS]));
  });

  it("reports missing sheets before import execution", () => {
    const result = validateImportWorkbookSheets(["Companies", "Stations", "Users"]);

    expect(result.readyForImport).toBe(false);
    expect(result.missingSheets).toContain("Pump Readings");
    expect(result.missingSheets).toContain("Cash Collections");
    expect(result.extraSheets).toEqual([]);
  });
});
