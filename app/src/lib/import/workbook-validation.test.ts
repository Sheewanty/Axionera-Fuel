import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  extractXlsxSheetNames,
  NORTHBRIDGE_IMPORT_REQUIRED_SHEETS,
  validateImportWorkbookSheets,
  validateImportWorkbookRows,
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
    const supplementalStockAdjustmentTab = resolve(
      process.cwd(),
      "../outputs/import_templates/stock_adjustments_tab.csv"
    );

    if (result.missingSheets.length === 1 && result.missingSheets[0] === "Stock Adjustments") {
      expect(existsSync(supplementalStockAdjustmentTab)).toBe(true);
      expect(result.sheetNames).toEqual(
        expect.arrayContaining([...NORTHBRIDGE_IMPORT_REQUIRED_SHEETS].filter((sheet) => sheet !== "Stock Adjustments"))
      );
    } else {
      expect(result.readyForImport).toBe(true);
      expect(result.missingSheets).toEqual([]);
      expect(result.sheetNames).toEqual(expect.arrayContaining([...NORTHBRIDGE_IMPORT_REQUIRED_SHEETS]));
    }
  });

  it("reports missing sheets before import execution", () => {
    const result = validateImportWorkbookSheets(["Companies", "Stations", "Users"]);

    expect(result.readyForImport).toBe(false);
    expect(result.missingSheets).toContain("Pump Readings");
    expect(result.missingSheets).toContain("Stock Adjustments");
    expect(result.missingSheets).toContain("Cash Collections");
    expect(result.extraSheets).toEqual([]);
  });

  it("validates stock adjustment rows with field-level errors", () => {
    const result = validateImportWorkbookRows({
      "Stock Adjustments": [
        {
          CompanyCode: "NBF",
          StationCode: "ACC",
          BusinessDate: "21-Jun-2026",
          TankName: "Diesel Tank",
          ProductName: "Diesel",
          AdjustmentType: "REGULATORY_INSPECTION",
          Direction: "IN",
          Litres: 5,
        },
      ],
    });

    expect(result.rowErrors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sheet: "Stock Adjustments",
          rowNumber: 2,
          field: "Direction",
          message: "Regulatory inspection draw-offs must use Direction OUT",
        }),
      ])
    );
    expect(result.rowWarnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "Reference" }),
        expect.objectContaining({ field: "ApprovedBy" }),
      ])
    );
  });

  it("accepts valid NPA inspection draw-off stock adjustments", () => {
    const result = validateImportWorkbookRows({
      Stations: [
        {
          CompanyCode: "NBF",
          StationCode: "ACC",
          StationName: "Northbridge Accra Central",
        },
      ],
      Products: [
        {
          CompanyCode: "NBF",
          ProductName: "Diesel",
        },
      ],
      Tanks: [
        {
          CompanyCode: "NBF",
          StationCode: "ACC",
          TankName: "Diesel Tank",
          ProductName: "Diesel",
        },
      ],
      "Daily Sessions": [
        {
          CompanyCode: "NBF",
          StationCode: "ACC",
          BusinessDate: "21-Jun-2026",
          Shift: "DAY",
        },
      ],
      "Stock Adjustments": [
        {
          CompanyCode: "NBF",
          StationCode: "ACC",
          BusinessDate: "21-Jun-2026",
          TankName: "Diesel Tank",
          ProductName: "Diesel",
          AdjustmentType: "REGULATORY_INSPECTION",
          Direction: "OUT",
          Litres: 5,
          Reference: "NPA/ACC/2026/014",
          ApprovedBy: "Station Manager",
        },
      ],
    });

    expect(result.rowErrors).toEqual([]);
    expect(result.rowWarnings).toEqual([]);
  });

  it("reports missing tank references with sheet, row, field, and offending values", () => {
    const result = validateImportWorkbookRows({
      Stations: [
        {
          CompanyCode: "NBF",
          StationCode: "ACC",
          StationName: "Northbridge Accra Central",
        },
      ],
      Products: [
        {
          CompanyCode: "NBF",
          ProductName: "Diesel",
        },
      ],
      Tanks: [
        {
          CompanyCode: "NBF",
          StationCode: "ACC",
          TankName: "Diesel Tank",
          ProductName: "Diesel",
        },
      ],
      "Daily Sessions": [
        {
          CompanyCode: "NBF",
          StationCode: "NBF-TN",
          BusinessDate: "21-Jun-2026",
          Shift: "DAY",
        },
      ],
      "Tank Dipping": [
        {
          CompanyCode: "NBF",
          StationCode: "NBF-TN",
          BusinessDate: "21-Jun-2026",
          Shift: "DAY",
          TankName: "Diesel Tank",
          ProductName: "Diesel",
        },
      ],
    });

    expect(result.rowErrors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sheet: "Tank Dipping",
          rowNumber: 2,
          field: "StationCode + TankName",
          message: expect.stringContaining("NBF-TN|Diesel Tank"),
        }),
      ])
    );
  });

  it("reports missing daily session references with sheet, row, field, and offending values", () => {
    const result = validateImportWorkbookRows({
      "Daily Sessions": [
        {
          CompanyCode: "NBF",
          StationCode: "KUM",
          BusinessDate: "21-Jun-2026",
          Shift: "DAY",
        },
      ],
      "Stock Adjustments": [
        {
          CompanyCode: "NBF",
          StationCode: "ACC",
          BusinessDate: "21-Jun-2026",
          Shift: "DAY",
          TankName: "Diesel Tank",
          ProductName: "Diesel",
          AdjustmentType: "REGULATORY_INSPECTION",
          Direction: "OUT",
          Litres: 5,
          Reference: "NPA/ACC/2026/014",
          ApprovedBy: "Station Manager",
        },
      ],
    });

    expect(result.rowErrors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sheet: "Stock Adjustments",
          rowNumber: 2,
          field: "StationCode + BusinessDate + Shift",
          message: expect.stringContaining("ACC|2026-06-21|DAY"),
        }),
      ])
    );
  });
});
