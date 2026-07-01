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

  it("reports missing user email with sheet, row, field, and offending values", () => {
    const result = validateImportWorkbookRows({
      Users: [
        {
          CompanyCode: "NBF",
          StationCode: "ACC",
          Name: "Northbridge Supervisor",
          Role: "STATION_MANAGER",
        },
      ],
    });

    expect(result.rowErrors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sheet: "Users",
          rowNumber: 2,
          field: "Email",
          message: expect.stringContaining("StationCode='ACC'"),
        }),
      ])
    );
  });

  it("accepts common imported user role labels and rejects unknown roles", () => {
    const result = validateImportWorkbookRows({
      Users: [
        {
          CompanyCode: "NBF",
          StationCode: "ACC",
          Email: "manager@example.com",
          Name: "Station Manager",
          Role: "Manager",
        },
        {
          CompanyCode: "NBF",
          StationCode: "ACC",
          Email: "bad-role@example.com",
          Name: "Bad Role",
          Role: "Cashier",
        },
      ],
    });

    expect(result.rowErrors).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rowNumber: 2,
          field: "Role",
        }),
      ])
    );
    expect(result.rowErrors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sheet: "Users",
          rowNumber: 3,
          field: "Role",
          message: expect.stringContaining("Role must be one of"),
        }),
      ])
    );
  });

  it("reports invalid UnitPrice cells with sheet, row, and field", () => {
    const result = validateImportWorkbookRows({
      "Product Prices": [
        {
          __rowNumber: 7,
          "__cell:UnitPrice": "D7",
          CompanyCode: "NBF",
          StationCode: "ACC",
          ProductName: "Ron 95",
          UnitPrice: "16 .87",
          EffectiveFrom: "2026-06-08",
        },
      ],
    });

    expect(result.rowErrors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sheet: "Product Prices",
          rowNumber: 7,
          field: "UnitPrice",
          cells: ["D7"],
          message: expect.stringContaining("16 .87"),
        }),
      ])
    );
  });

  it("reports duplicate pump reading keys with both offending rows and cells", () => {
    const result = validateImportWorkbookRows({
      "Pump Readings": [
        {
          __rowNumber: 14,
          "__cell:StationCode": "B14",
          "__cell:BusinessDate": "C14",
          "__cell:Shift": "D14",
          "__cell:PumpName": "E14",
          "__cell:NozzleName": "F14",
          StationCode: "ACC",
          BusinessDate: "2026-06-21",
          Shift: "DAY",
          PumpName: "PUMP3",
          NozzleName: "Dxp 3",
        },
        {
          __rowNumber: 19,
          "__cell:StationCode": "B19",
          "__cell:BusinessDate": "C19",
          "__cell:Shift": "D19",
          "__cell:PumpName": "E19",
          "__cell:NozzleName": "F19",
          StationCode: "ACC",
          BusinessDate: "2026-06-21",
          Shift: "DAY",
          PumpName: "PUMP3",
          NozzleName: "Dxp 3",
        },
      ],
    });

    expect(result.rowErrors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sheet: "Pump Readings",
          rowNumber: 14,
          field: "StationCode + BusinessDate + Shift + PumpName + NozzleName",
          cells: expect.arrayContaining(["B14", "F14", "B19", "F19"]),
          message: expect.stringContaining("Rows: 14, 19"),
        }),
      ])
    );
  });

  it("reports invalid debtor OpeningBalance cells before import execution", () => {
    const result = validateImportWorkbookRows({
      Debtors: [
        {
          CompanyCode: "NBF",
          StationCode: "ACC",
          DebtorName: "St. Marys International School",
          CreditLimit: 10000,
          OpeningBalance: "not-a-number",
        },
      ],
    });

    expect(result.rowErrors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sheet: "Debtors",
          rowNumber: 2,
          field: "OpeningBalance",
          message: expect.stringContaining("not-a-number"),
        }),
      ])
    );
  });

  it("reports lube sales rows missing SaleRef before import execution", () => {
    const result = validateImportWorkbookRows({
      "Lube Sales": [
        {
          CompanyCode: "NBF",
          StationCode: "ACC",
          BusinessDate: "2026-06-08",
          Shift: "DAY",
          VehicleReg: "GR-100-26",
          ServiceType: "Oil Change",
          VehicleCategory: "SUV and Crossovers",
        },
      ],
    });

    expect(result.rowErrors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sheet: "Lube Sales",
          rowNumber: 2,
          field: "SaleRef",
        }),
      ])
    );
  });

  it("reports debtor ledger sale rows with unknown products before import execution", () => {
    const result = validateImportWorkbookRows({
      Products: [{ CompanyCode: "NBF", ProductName: "Ron 95" }],
      "Debtor Ledger": [
        {
          CompanyCode: "NBF",
          StationCode: "ACC",
          BusinessDate: "2026-06-08",
          Shift: "DAY",
          DebtorName: "NHIA",
          Type: "SALE",
          Amount: 400,
          ProductName: "Sxp 95",
        },
      ],
    });

    expect(result.rowErrors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sheet: "Debtor Ledger",
          rowNumber: 2,
          field: "ProductName",
          message: expect.stringContaining("Sxp 95"),
        }),
      ])
    );
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
