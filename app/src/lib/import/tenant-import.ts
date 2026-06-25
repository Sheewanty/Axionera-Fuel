import bcrypt from "bcryptjs";
import type { Db } from "@/lib/db/types";
import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/db/audit.service";
import {
  calcCashCollectionVariance,
  calcDischargeVariance,
  calcExpectedAmount,
  calcExpectedTankAfterDischarge,
  calcLitresSold,
  calcLubeBayTotalExpected,
  calcLubeBayVariance,
  calcMartNetSales,
  calcMartVariance,
  calcNozzleVariance,
  calcTankVariance,
} from "@/lib/calculations";
import { readXlsxTables, validateImportWorkbookRows, validateImportWorkbookSheets, type WorkbookRow } from "./workbook-validation";

const TEMP_PASSWORD = "ChangeMe123!";

type ImportCounts = {
  tenants: number;
  stations: number;
  users: number;
  products: number;
  prices: number;
  tanks: number;
  pumps: number;
  nozzles: number;
  debtors: number;
  serviceTypes: number;
  momoOperators: number;
  dailySessions: number;
  pumpReadings: number;
  tankDippings: number;
  productDischarges: number;
  stockAdjustments: number;
  expenditures: number;
  martSales: number;
  lubeBaySales: number;
  lubeBaySaleLines: number;
  debtorLedgerEntries: number;
  paymentDetails: number;
  cashCollections: number;
};

export type TenantImportResult = {
  tenantId: string;
  tenantName: string;
  slug: string;
  temporaryPassword: string;
  counts: ImportCounts;
};

function emptyCounts(): ImportCounts {
  return {
    tenants: 0,
    stations: 0,
    users: 0,
    products: 0,
    prices: 0,
    tanks: 0,
    pumps: 0,
    nozzles: 0,
    debtors: 0,
    serviceTypes: 0,
    momoOperators: 0,
    dailySessions: 0,
    pumpReadings: 0,
    tankDippings: 0,
    productDischarges: 0,
    stockAdjustments: 0,
    expenditures: 0,
    martSales: 0,
    lubeBaySales: 0,
    lubeBaySaleLines: 0,
    debtorLedgerEntries: 0,
    paymentDetails: 0,
    cashCollections: 0,
  };
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function sheet(tables: Record<string, WorkbookRow[]>, name: string): WorkbookRow[] {
  return tables[name] ?? [];
}

function cell(row: WorkbookRow, key: string): string | number | boolean | null {
  return row[key] ?? null;
}

function text(row: WorkbookRow, key: string, required = false): string {
  const value = cell(row, key);
  const result = value === null ? "" : String(value).trim();
  if (required && !result) throw new Error(`${key} is required`);
  return result;
}

function optionalText(row: WorkbookRow, key: string): string | null {
  const value = text(row, key);
  return value || null;
}

function numberValue(row: WorkbookRow, key: string, fallback = 0): number {
  const value = cell(row, key);
  if (value === null || value === "") return fallback;
  const parsed = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
  if (!Number.isFinite(parsed)) throw new Error(`${key} must be a valid number`);
  return parsed;
}

function boolValue(row: WorkbookRow, key: string, fallback = false): boolean {
  const value = cell(row, key);
  if (value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  return ["TRUE", "YES", "1"].includes(String(value).trim().toUpperCase());
}

function excelSerialDate(serial: number): Date {
  const utc = Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000;
  return new Date(utc);
}

function dateValue(row: WorkbookRow, key: string): Date {
  const value = cell(row, key);
  if (typeof value === "number") return excelSerialDate(value);
  const raw = String(value ?? "").trim();
  if (!raw) throw new Error(`${key} is required`);
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) throw new Error(`${key} must be a valid date`);
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function sessionKey(stationCode: string, businessDate: Date, shift: string): string {
  return `${stationCode}|${dateKey(businessDate)}|${shift}`;
}

function stationScopedKey(stationCode: string, name: string): string {
  return `${stationCode}|${name}`;
}

function sessionTankKey(dailySessionId: string, tankId: string): string {
  return `${dailySessionId}|${tankId}`;
}

function requireMapValue(map: Map<string, string>, key: string, label: string): string {
  const value = map.get(key);
  if (!value) throw new Error(`${label} was not found: ${key}`);
  return value;
}

function statusValue(row: WorkbookRow, key: string, fallback: string): string {
  return text(row, key) || fallback;
}

async function createSetupRecords(
  tx: Db,
  tables: Record<string, WorkbookRow[]>,
  actorUserId: string,
  counts: ImportCounts
) {
  const companies = sheet(tables, "Companies");
  if (companies.length !== 1) throw new Error("Import workbook must contain exactly one company row");

  const companyRow = companies[0];
  const companyCode = text(companyRow, "CompanyCode", true).toUpperCase();
  const tenantName = text(companyRow, "TenantName", true);
  const slug = slugify(text(companyRow, "Slug") || tenantName);
  if (!slug) throw new Error("Company slug could not be generated");

  const existingTenant = await tx.tenant.findUnique({ where: { slug }, select: { id: true } });
  const tenantData = {
    name: tenantName,
    slug,
    subscriptionStatus: statusValue(companyRow, "SubscriptionStatus", "TRIAL"),
    subscriptionPackage: statusValue(companyRow, "Package", "STARTER"),
    maxStations: numberValue(companyRow, "MaxStations", 1),
    maxTanks: numberValue(companyRow, "MaxTanks", 3),
    maxPumps: numberValue(companyRow, "MaxPumps", 3),
    billingEmail: optionalText(companyRow, "BillingEmail"),
    billingAddress: optionalText(companyRow, "BillingAddress"),
  };

  const tenant = existingTenant
    ? await tx.tenant.update({ where: { id: existingTenant.id }, data: tenantData })
    : await tx.tenant.create({ data: tenantData });

  if (existingTenant) {
    const [stationCount, productCount, sessionCount] = await Promise.all([
      tx.station.count({ where: { tenantId: tenant.id } }),
      tx.product.count({ where: { tenantId: tenant.id } }),
      tx.dailySession.count({ where: { tenantId: tenant.id } }),
    ]);
    if (stationCount > 0 || productCount > 0 || sessionCount > 0) {
      throw new Error(`Tenant '${slug}' already has setup or operational data. Import into existing tenants is only allowed when the tenant shell is empty.`);
    }
  } else {
    counts.tenants += 1;
  }

  const stationIds = new Map<string, string>();
  for (const row of sheet(tables, "Stations")) {
    if (text(row, "CompanyCode").toUpperCase() !== companyCode) continue;
    const code = text(row, "StationCode", true).toUpperCase();
    const station = await tx.station.create({
      data: {
        tenantId: tenant.id,
        code,
        name: text(row, "StationName", true),
        location: optionalText(row, "Location"),
        status: statusValue(row, "Status", "ACTIVE"),
      },
    });
    stationIds.set(code, station.id);
    counts.stations += 1;
  }

  const passwordHash = await bcrypt.hash(TEMP_PASSWORD, 10);
  for (const row of sheet(tables, "Users")) {
    if (text(row, "CompanyCode").toUpperCase() !== companyCode) continue;
    const stationOrEmail = text(row, "StationCode");
    const importedEmail = text(row, "Email") || (stationOrEmail.includes("@") ? stationOrEmail : "");
    const email = importedEmail.trim().toLowerCase();
    if (!email) throw new Error("Email is required");
    const name = text(row, "Name", true);
    const stationCode = stationOrEmail.includes("@") ? "" : stationOrEmail.toUpperCase();
    const userStatus = statusValue(row, "Status", "ACTIVE");
    const forcePasswordChange = boolValue(row, "ForcePasswordChange", true);
    const existingUser = await tx.user.findUnique({ where: { email }, select: { id: true } });
    if (existingUser) {
      const otherMembership = await tx.membership.findFirst({
        where: { userId: existingUser.id, tenantId: { not: tenant.id } },
        select: { id: true },
      });
      if (otherMembership) throw new Error(`User email already belongs to another tenant: ${email}`);
    }

    const user = existingUser
      ? await tx.user.update({
          where: { id: existingUser.id },
          data: {
            name,
            passwordHash,
            avatarInitials: initials(name),
            status: userStatus,
            forcePasswordChange,
          },
        })
      : await tx.user.create({
          data: {
            email,
            name,
            passwordHash,
            avatarInitials: initials(name),
            status: userStatus,
            forcePasswordChange,
          },
        });
    await tx.membership.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        stationId: stationCode ? requireMapValue(stationIds, stationCode, "Station") : "",
        role: text(row, "Role", true).toUpperCase(),
      },
    });
    counts.users += 1;
  }

  const productIds = new Map<string, string>();
  for (const row of sheet(tables, "Products")) {
    if (text(row, "CompanyCode").toUpperCase() !== companyCode) continue;
    const name = text(row, "ProductName", true);
    const product = await tx.product.create({
      data: {
        tenantId: tenant.id,
        name,
        category: statusValue(row, "Category", "FUEL"),
        isActive: boolValue(row, "IsActive", true),
      },
    });
    productIds.set(name, product.id);
    counts.products += 1;
  }

  for (const row of sheet(tables, "Product Prices")) {
    if (text(row, "CompanyCode").toUpperCase() !== companyCode) continue;
    await tx.priceHistory.create({
      data: {
        tenantId: tenant.id,
        stationId: requireMapValue(stationIds, text(row, "StationCode", true).toUpperCase(), "Station"),
        productId: requireMapValue(productIds, text(row, "ProductName", true), "Product"),
        pricePerLitre: numberValue(row, "UnitPrice"),
        effectiveFrom: dateValue(row, "EffectiveFrom"),
        effectiveTo: cell(row, "EffectiveTo") ? dateValue(row, "EffectiveTo") : null,
        createdBy: actorUserId,
      },
    });
    counts.prices += 1;
  }

  const tankIds = new Map<string, string>();
  for (const row of sheet(tables, "Tanks")) {
    if (text(row, "CompanyCode").toUpperCase() !== companyCode) continue;
    const stationCode = text(row, "StationCode", true).toUpperCase();
    const name = text(row, "TankName", true);
    const tank = await tx.tank.create({
      data: {
        tenantId: tenant.id,
        stationId: requireMapValue(stationIds, stationCode, "Station"),
        productId: requireMapValue(productIds, text(row, "ProductName", true), "Product"),
        name,
        capacityLitres: numberValue(row, "CapacityLitres"),
        status: statusValue(row, "Status", "ACTIVE"),
      },
    });
    tankIds.set(stationScopedKey(stationCode, name), tank.id);
    counts.tanks += 1;
  }

  const pumpIds = new Map<string, string>();
  for (const row of sheet(tables, "Pumps")) {
    if (text(row, "CompanyCode").toUpperCase() !== companyCode) continue;
    const stationCode = text(row, "StationCode", true).toUpperCase();
    const name = text(row, "PumpName", true);
    const pump = await tx.pump.create({
      data: {
        tenantId: tenant.id,
        stationId: requireMapValue(stationIds, stationCode, "Station"),
        name,
        status: statusValue(row, "Status", "ACTIVE"),
      },
    });
    pumpIds.set(stationScopedKey(stationCode, name), pump.id);
    counts.pumps += 1;
  }

  const nozzleIds = new Map<string, string>();
  for (const row of sheet(tables, "Nozzles")) {
    if (text(row, "CompanyCode").toUpperCase() !== companyCode) continue;
    const stationCode = text(row, "StationCode", true).toUpperCase();
    const pumpName = text(row, "PumpName", true);
    const nozzleName = text(row, "NozzleName", true);
    const nozzle = await tx.nozzle.create({
      data: {
        tenantId: tenant.id,
        stationId: requireMapValue(stationIds, stationCode, "Station"),
        pumpId: requireMapValue(pumpIds, stationScopedKey(stationCode, pumpName), "Pump"),
        productId: requireMapValue(productIds, text(row, "ProductName", true), "Product"),
        name: nozzleName,
        meterCode: optionalText(row, "MeterCode"),
        status: statusValue(row, "Status", "ACTIVE"),
      },
    });
    nozzleIds.set(`${stationCode}|${pumpName}|${nozzleName}`, nozzle.id);
    counts.nozzles += 1;
  }

  const creditorIds = new Map<string, string>();
  for (const row of sheet(tables, "Debtors")) {
    if (text(row, "CompanyCode").toUpperCase() !== companyCode) continue;
    const stationCode = text(row, "StationCode", true).toUpperCase();
    const name = text(row, "DebtorName", true);
    const creditor = await tx.creditor.create({
      data: {
        tenantId: tenant.id,
        stationId: requireMapValue(stationIds, stationCode, "Station"),
        name,
        phone: optionalText(row, "Phone"),
        email: optionalText(row, "Email"),
        creditLimit: numberValue(row, "CreditLimit", 0),
        openingBalance: numberValue(row, "OpeningBalance", 0),
        status: statusValue(row, "Status", "ACTIVE"),
        notes: optionalText(row, "Notes"),
        createdBy: actorUserId,
      },
    });
    creditorIds.set(stationScopedKey(stationCode, name), creditor.id);
    counts.debtors += 1;
  }

  const serviceTypeIds = new Map<string, string>();
  for (const row of sheet(tables, "Lube Service Types")) {
    if (text(row, "CompanyCode").toUpperCase() !== companyCode) continue;
    const rawStationCode = text(row, "StationCode");
    const stationCode = stationIds.has(rawStationCode.toUpperCase()) ? rawStationCode.toUpperCase() : "";
    const stationId = stationCode ? requireMapValue(stationIds, stationCode, "Station") : null;
    const name = text(row, "ServiceName") || rawStationCode;
    if (!name) throw new Error("ServiceName is required");
    const vehicleCategory = text(row, "VehicleCategory", true);
    const serviceType = await tx.lubeBayServiceType.create({
      data: {
        tenantId: tenant.id,
        stationId,
        name,
        vehicleCategory,
        defaultLabourCharge: numberValue(row, "DefaultLabourCharge"),
        isActive: boolValue(row, "IsActive", true),
        createdBy: actorUserId,
      },
    });
    serviceTypeIds.set(`${name}|${vehicleCategory}`, serviceType.id);
    counts.serviceTypes += 1;
  }

  for (const row of sheet(tables, "MoMo Operators")) {
    if (text(row, "CompanyCode").toUpperCase() !== companyCode) continue;
    const rawStationCode = text(row, "StationCode");
    const stationCode = stationIds.has(rawStationCode.toUpperCase()) ? rawStationCode.toUpperCase() : "";
    const operatorName = text(row, "OperatorName") || rawStationCode;
    if (!operatorName) throw new Error("OperatorName is required");
    await tx.lubeBayMomoOperator.create({
      data: {
        tenantId: tenant.id,
        stationId: stationCode ? requireMapValue(stationIds, stationCode, "Station") : null,
        name: operatorName,
        isActive: boolValue(row, "IsActive", true),
        createdBy: actorUserId,
      },
    });
    counts.momoOperators += 1;
  }

  return { tenant, companyCode, stationIds, productIds, tankIds, pumpIds, nozzleIds, creditorIds, serviceTypeIds };
}

export async function importTenantWorkbook(buffer: Buffer, actorUserId: string): Promise<TenantImportResult> {
  const tables = readXlsxTables(buffer);
  const validation = validateImportWorkbookSheets(Object.keys(tables));
  const rowValidation = validateImportWorkbookRows(tables);
  if (!validation.readyForImport || rowValidation.rowErrors.length > 0) {
    const messages = [
      validation.missingSheets.length > 0
        ? `Workbook is missing required sheets: ${validation.missingSheets.join(", ")}`
        : "",
      rowValidation.rowErrors.length > 0
        ? `Workbook has ${rowValidation.rowErrors.length} row validation error(s). Validate the workbook and correct the listed rows before import.`
        : "",
    ].filter(Boolean);
    throw new Error(messages.join(" "));
  }

  const counts = emptyCounts();

  return prisma.$transaction(async (tx) => {
    const setup = await createSetupRecords(tx, tables, actorUserId, counts);
    const { tenant, companyCode, stationIds, productIds, tankIds, pumpIds, nozzleIds, creditorIds, serviceTypeIds } = setup;
    const sessionIds = new Map<string, string>();
    const stockAdjustmentTotals = new Map<string, { inLitres: number; outLitres: number }>();

    for (const row of sheet(tables, "Daily Sessions")) {
      if (text(row, "CompanyCode").toUpperCase() !== companyCode) continue;
      const stationCode = text(row, "StationCode", true).toUpperCase();
      const businessDate = dateValue(row, "BusinessDate");
      const shift = statusValue(row, "Shift", "DAY").toUpperCase();
      const session = await tx.dailySession.create({
        data: {
          tenantId: tenant.id,
          stationId: requireMapValue(stationIds, stationCode, "Station"),
          businessDate,
          shift,
          status: statusValue(row, "Status", "OPEN"),
          openedBy: actorUserId,
          supervisorNotes: optionalText(row, "SupervisorNotes"),
        },
      });
      sessionIds.set(sessionKey(stationCode, businessDate, shift), session.id);
      counts.dailySessions += 1;
    }

    for (const row of sheet(tables, "Pump Readings")) {
      if (text(row, "CompanyCode").toUpperCase() !== companyCode) continue;
      const stationCode = text(row, "StationCode", true).toUpperCase();
      const businessDate = dateValue(row, "BusinessDate");
      const shift = statusValue(row, "Shift", "DAY").toUpperCase();
      const opening = numberValue(row, "OpeningMeter");
      const closing = numberValue(row, "ClosingMeter");
      const litresSold = calcLitresSold(closing, opening);
      const price = numberValue(row, "UnitPrice");
      const expected = calcExpectedAmount(litresSold, price);
      const cash = numberValue(row, "CashReceived");
      const gocard = numberValue(row, "GOCardVisa");
      const coupon = numberValue(row, "Coupon");
      const ghqr = numberValue(row, "GHQRMoMo");
      const credit = numberValue(row, "CreditSales");

      await tx.pumpReading.create({
        data: {
          tenantId: tenant.id,
          stationId: requireMapValue(stationIds, stationCode, "Station"),
          dailySessionId: requireMapValue(sessionIds, sessionKey(stationCode, businessDate, shift), "Daily session"),
          businessDate,
          shift,
          pumpId: requireMapValue(pumpIds, stationScopedKey(stationCode, text(row, "PumpName", true)), "Pump"),
          nozzleId: requireMapValue(nozzleIds, `${stationCode}|${text(row, "PumpName", true)}|${text(row, "NozzleName", true)}`, "Nozzle"),
          productId: requireMapValue(productIds, text(row, "ProductName", true), "Product"),
          previousLitre: opening,
          currentLitre: closing,
          litresSold,
          pricePerLitre: price,
          amountExpected: expected,
          cashReceived: cash,
          gocardAmount: gocard,
          couponAmount: coupon,
          ghqrAmount: ghqr,
          creditorsAmount: credit,
          variance: calcNozzleVariance(cash, gocard, coupon, ghqr, credit, expected),
          isClosingRecorded: true,
          remarks: optionalText(row, "Remarks"),
          createdBy: actorUserId,
        },
      });
      counts.pumpReadings += 1;
    }

    for (const row of sheet(tables, "Stock Adjustments")) {
      if (text(row, "CompanyCode").toUpperCase() !== companyCode) continue;
      const stationCode = text(row, "StationCode", true).toUpperCase();
      const businessDate = dateValue(row, "BusinessDate");
      const shift = statusValue(row, "Shift", "DAY").toUpperCase();
      const dailySessionId = requireMapValue(sessionIds, sessionKey(stationCode, businessDate, shift), "Daily session");
      const tankId = requireMapValue(tankIds, stationScopedKey(stationCode, text(row, "TankName", true)), "Tank");
      const productId = requireMapValue(productIds, text(row, "ProductName", true), "Product");
      const direction = text(row, "Direction", true).toUpperCase();
      const litres = numberValue(row, "Litres");
      const approvalStatus = statusValue(row, "ApprovalStatus", "APPROVED").toUpperCase();

      await tx.stockAdjustment.create({
        data: {
          tenantId: tenant.id,
          stationId: requireMapValue(stationIds, stationCode, "Station"),
          dailySessionId,
          businessDate,
          tankId,
          productId,
          adjustmentType: text(row, "AdjustmentType", true).toUpperCase(),
          direction,
          litres,
          authorityReason: optionalText(row, "AuthorityReason"),
          reference: optionalText(row, "Reference"),
          recordedByName: optionalText(row, "RecordedBy"),
          approvedByName: optionalText(row, "ApprovedBy"),
          approvalStatus,
          remarks: optionalText(row, "Remarks"),
          createdBy: actorUserId,
        },
      });

      if (approvalStatus === "APPROVED") {
        const key = sessionTankKey(dailySessionId, tankId);
        const totals = stockAdjustmentTotals.get(key) ?? { inLitres: 0, outLitres: 0 };
        if (direction === "IN") totals.inLitres += litres;
        if (direction === "OUT") totals.outLitres += litres;
        stockAdjustmentTotals.set(key, totals);
      }
      counts.stockAdjustments += 1;
    }

    for (const row of sheet(tables, "Tank Dipping")) {
      if (text(row, "CompanyCode").toUpperCase() !== companyCode) continue;
      const stationCode = text(row, "StationCode", true).toUpperCase();
      const businessDate = dateValue(row, "BusinessDate");
      const shift = statusValue(row, "Shift", "DAY").toUpperCase();
      const dailySessionId = requireMapValue(sessionIds, sessionKey(stationCode, businessDate, shift), "Daily session");
      const tankId = requireMapValue(tankIds, stationScopedKey(stationCode, text(row, "TankName", true)), "Tank");
      const adjustments = stockAdjustmentTotals.get(sessionTankKey(dailySessionId, tankId)) ?? { inLitres: 0, outLitres: 0 };
      const opening = numberValue(row, "OpeningStockLitres");
      const receipts = numberValue(row, "ReceiptsLitres");
      const meterSold = numberValue(row, "MeterSoldLitres");
      const closing = numberValue(row, "ClosingStockLitres");
      await tx.tankDipping.create({
        data: {
          tenantId: tenant.id,
          stationId: requireMapValue(stationIds, stationCode, "Station"),
          dailySessionId,
          businessDate,
          tankId,
          productId: requireMapValue(productIds, text(row, "ProductName", true), "Product"),
          openingStockLitres: opening,
          receiptsLitres: receipts,
          meterSoldLitres: meterSold,
          closingStockLitres: closing,
          varianceLitres: calcTankVariance(opening, receipts, meterSold, closing, adjustments.inLitres, adjustments.outLitres),
          closingDipCm: numberValue(row, "ClosingDipCm", 0) || null,
          waterTestStatus: statusValue(row, "WaterTestStatus", "CLEAR"),
          remarks: optionalText(row, "Remarks"),
          createdBy: actorUserId,
        },
      });
      counts.tankDippings += 1;
    }

    for (const row of sheet(tables, "Product Discharge")) {
      if (text(row, "CompanyCode").toUpperCase() !== companyCode) continue;
      const stationCode = text(row, "StationCode", true).toUpperCase();
      const businessDate = dateValue(row, "BusinessDate");
      const shift = statusValue(row, "Shift", "DAY").toUpperCase();
      const before = numberValue(row, "BeforeTankLitres");
      const discharged = numberValue(row, "DischargedLitres");
      const topUp = numberValue(row, "AdjustmentTopUpLitres");
      const expected = calcExpectedTankAfterDischarge(before, discharged, topUp);
      const after = numberValue(row, "AfterTankLitres", expected);
      await tx.productDischarge.create({
        data: {
          tenantId: tenant.id,
          stationId: requireMapValue(stationIds, stationCode, "Station"),
          dailySessionId: requireMapValue(sessionIds, sessionKey(stationCode, businessDate, shift), "Daily session"),
          businessDate,
          tankId: requireMapValue(tankIds, stationScopedKey(stationCode, text(row, "TankName", true)), "Tank"),
          productId: requireMapValue(productIds, text(row, "ProductName", true), "Product"),
          supplierName: text(row, "SupplierName", true),
          invoiceNumber: text(row, "InvoiceNumber", true),
          vehicleRegistrationNumber: optionalText(row, "VehicleReg"),
          driverName: optionalText(row, "DriverName"),
          stationSupervisorName: optionalText(row, "SupervisorName"),
          couplingHeightCm: numberValue(row, "CouplingHeightCm", 0) || null,
          calibrationCertificate: optionalText(row, "CalibrationCertificate"),
          invoiceMeasurement: numberValue(row, "InvoiceMeasurement"),
          stationMeasurement: numberValue(row, "StationMeasurement", 0) || null,
          productDischargedLitres: discharged,
          topUpLitres: topUp,
          beforeTankLitres: before,
          expectedTankAfterDischarge: expected,
          afterTankLitres: after,
          dischargeVarianceLitres: calcDischargeVariance(after, expected),
          tbar: numberValue(row, "TBar", 0) || null,
          tankerWaterTestStatus: statusValue(row, "WaterTestStatus", "CLEAR"),
          receivingTankWaterTestStatus: statusValue(row, "WaterTestStatus", "CLEAR"),
          remarks: optionalText(row, "Remarks"),
          createdBy: actorUserId,
        },
      });
      counts.productDischarges += 1;
    }

    for (const row of sheet(tables, "Expenditure")) {
      if (text(row, "CompanyCode").toUpperCase() !== companyCode) continue;
      const stationCode = text(row, "StationCode", true).toUpperCase();
      const businessDate = dateValue(row, "BusinessDate");
      const shift = statusValue(row, "Shift", "DAY").toUpperCase();
      await tx.expenditure.create({
        data: {
          tenantId: tenant.id,
          stationId: requireMapValue(stationIds, stationCode, "Station"),
          dailySessionId: requireMapValue(sessionIds, sessionKey(stationCode, businessDate, shift), "Daily session"),
          businessDate,
          voucherReference: optionalText(row, "VoucherReference"),
          category: text(row, "Category", true),
          amount: numberValue(row, "Amount"),
          paymentToBank: 0,
          paidBy: text(row, "PaidBy", true),
          approvedBy: optionalText(row, "ApprovedBy"),
          receiptAttached: boolValue(row, "ReceiptAttached"),
          description: optionalText(row, "Description"),
          createdBy: actorUserId,
        },
      });
      counts.expenditures += 1;
    }

    for (const row of sheet(tables, "Mart Sales")) {
      if (text(row, "CompanyCode").toUpperCase() !== companyCode) continue;
      const stationCode = text(row, "StationCode", true).toUpperCase();
      const businessDate = dateValue(row, "BusinessDate");
      const shift = statusValue(row, "Shift", "DAY").toUpperCase();
      const openingCash = numberValue(row, "OpeningCash");
      const cardSales = numberValue(row, "CardSales");
      const cashSales = numberValue(row, "CashSales");
      const momoSales = numberValue(row, "MomoSales");
      const returns = numberValue(row, "Returns");
      const cashCount = numberValue(row, "PhysicalCashCount");
      await tx.martSale.create({
        data: {
          tenantId: tenant.id,
          stationId: requireMapValue(stationIds, stationCode, "Station"),
          dailySessionId: requireMapValue(sessionIds, sessionKey(stationCode, businessDate, shift), "Daily session"),
          businessDate,
          openingCash,
          posSales: cardSales,
          cashSales,
          mobileMoney: momoSales,
          returns,
          netMartSales: calcMartNetSales(cardSales, cashSales, momoSales, returns),
          cashCount,
          variance: calcMartVariance(cashCount, openingCash, cashSales),
          remarks: optionalText(row, "Remarks"),
          createdBy: actorUserId,
        },
      });
      counts.martSales += 1;
    }

    const lineRowsBySale = new Map<string, WorkbookRow[]>();
    for (const row of sheet(tables, "Lube Sale Lines")) {
      const saleRef = text(row, "SaleRef");
      if (!saleRef) continue;
      lineRowsBySale.set(saleRef, [...(lineRowsBySale.get(saleRef) ?? []), row]);
    }

    const lubeSaleIds = new Map<string, string>();
    for (const row of sheet(tables, "Lube Sales")) {
      if (text(row, "CompanyCode").toUpperCase() !== companyCode) continue;
      const stationCode = text(row, "StationCode", true).toUpperCase();
      const businessDate = dateValue(row, "BusinessDate");
      const shift = statusValue(row, "Shift", "DAY").toUpperCase();
      const saleRef = text(row, "SaleRef", true);
      const serviceName = text(row, "ServiceType", true);
      const vehicleCategory = text(row, "VehicleCategory", true);
      const lines = (lineRowsBySale.get(saleRef) ?? []).filter((line) => {
        const productName = text(line, "ProductName");
        return productName && productName !== "0" && numberValue(line, "Quantity") > 0;
      });
      const lineData = lines.map((line) => {
        const quantity = numberValue(line, "Quantity");
        const unitPrice = numberValue(line, "UnitPrice");
        return {
          productId: requireMapValue(productIds, text(line, "ProductName", true), "Product"),
          quantity,
          unitPrice,
          amount: quantity * unitPrice,
        };
      });
      const productTotal = lineData.reduce((sum, line) => sum + line.amount, 0);
      const labour = numberValue(row, "LabourCharge");
      const discount = numberValue(row, "Discount");
      const totalExpected = calcLubeBayTotalExpected(productTotal, labour, 0, discount);
      const paymentMode = statusValue(row, "PaymentMode", "CASH").toUpperCase();
      const cashAmount = numberValue(row, "CashAmount");
      const cardAmount = numberValue(row, "CardAmount");
      const momoAmount = numberValue(row, "MomoAmount");
      const creditAmount = numberValue(row, "CreditAmount");
      const debtorName = paymentMode === "CREDIT" ? text(row, "DebtorName") : "";
      const momoOperator =
        paymentMode === "MOMO"
          ? optionalText(row, "MomoOperator") ?? optionalText(row, "DebtorName")
          : optionalText(row, "MomoOperator");
      const creditorId = debtorName
        ? requireMapValue(creditorIds, stationScopedKey(stationCode, debtorName), "Debtor")
        : null;
      const lubeSale = await tx.lubeBaySale.create({
        data: {
          tenantId: tenant.id,
          stationId: requireMapValue(stationIds, stationCode, "Station"),
          dailySessionId: requireMapValue(sessionIds, sessionKey(stationCode, businessDate, shift), "Daily session"),
          businessDate,
          vehicleReg: text(row, "VehicleReg", true).toUpperCase(),
          customerName: optionalText(row, "CustomerName"),
          serviceTypeId: requireMapValue(serviceTypeIds, `${serviceName}|${vehicleCategory}`, "Service type"),
          serviceType: serviceName,
          vehicleCategory,
          lubricantAmount: productTotal,
          labourCharge: labour,
          partsCharge: 0,
          discount,
          totalExpected,
          cashAmount,
          cardAmount,
          momoAmount,
          creditorAmount: creditAmount,
          creditorId,
          paymentMode,
          momoOperator,
          momoNumber: optionalText(row, "MomoNumber"),
          variance: calcLubeBayVariance(cashAmount, cardAmount, momoAmount, creditAmount, totalExpected),
          supervisorName: optionalText(row, "SupervisorName"),
          remarks: optionalText(row, "Remarks"),
          createdBy: actorUserId,
          lines: { create: lineData.map((line) => ({ tenantId: tenant.id, ...line })) },
        },
      });
      lubeSaleIds.set(saleRef, lubeSale.id);
      counts.lubeBaySales += 1;
      counts.lubeBaySaleLines += lineData.length;

      if (paymentMode === "CREDIT" && creditorId && creditAmount > 0) {
        await tx.creditorLedgerEntry.create({
          data: {
            tenantId: tenant.id,
            stationId: requireMapValue(stationIds, stationCode, "Station"),
            dailySessionId: requireMapValue(sessionIds, sessionKey(stationCode, businessDate, shift), "Daily session"),
            creditorId,
            businessDate,
            type: "SALE",
            amount: creditAmount,
            lubeBaySaleId: lubeSale.id,
            remarks: `Imported lube bay sale ${saleRef}`,
            createdBy: actorUserId,
          },
        });
        counts.debtorLedgerEntries += 1;
      }
    }

    for (const row of sheet(tables, "Debtor Ledger")) {
      if (text(row, "CompanyCode").toUpperCase() !== companyCode) continue;
      const stationCode = text(row, "StationCode", true).toUpperCase();
      const businessDate = dateValue(row, "BusinessDate");
      const shift = statusValue(row, "Shift", "DAY").toUpperCase();
      const type = statusValue(row, "Type", "SALE").toUpperCase();
      await tx.creditorLedgerEntry.create({
        data: {
          tenantId: tenant.id,
          stationId: requireMapValue(stationIds, stationCode, "Station"),
          dailySessionId: requireMapValue(sessionIds, sessionKey(stationCode, businessDate, shift), "Daily session"),
          creditorId: requireMapValue(creditorIds, stationScopedKey(stationCode, text(row, "DebtorName", true)), "Debtor"),
          businessDate,
          type,
          amount: numberValue(row, "Amount"),
          productId:
            type === "SALE" && text(row, "ProductName")
              ? requireMapValue(productIds, text(row, "ProductName"), "Product")
              : null,
          lubeBaySaleId: text(row, "SaleRef") ? lubeSaleIds.get(text(row, "SaleRef")) ?? null : null,
          paymentMethod: optionalText(row, "PaymentMethod"),
          cashReceivedDate: type === "PAYMENT" && text(row, "PaymentMethod").toUpperCase() === "CASH" ? businessDate : null,
          referenceNumber: optionalText(row, "Reference"),
          remarks: optionalText(row, "Remarks"),
          createdBy: actorUserId,
        },
      });
      counts.debtorLedgerEntries += 1;
    }

    for (const row of sheet(tables, "Payment Details")) {
      if (text(row, "CompanyCode").toUpperCase() !== companyCode) continue;
      const stationCode = text(row, "StationCode", true).toUpperCase();
      const businessDate = dateValue(row, "BusinessDate");
      const shift = statusValue(row, "Shift", "DAY").toUpperCase();
      await tx.paymentDetail.create({
        data: {
          tenantId: tenant.id,
          stationId: requireMapValue(stationIds, stationCode, "Station"),
          dailySessionId: requireMapValue(sessionIds, sessionKey(stationCode, businessDate, shift), "Daily session"),
          businessDate,
          channel: text(row, "Channel", true),
          amount: numberValue(row, "Amount"),
          referenceNumber: optionalText(row, "Reference"),
          remarks: optionalText(row, "Remarks"),
          createdBy: actorUserId,
        },
      });
      counts.paymentDetails += 1;
    }

    for (const row of sheet(tables, "Cash Collections")) {
      if (text(row, "CompanyCode").toUpperCase() !== companyCode) continue;
      const stationCode = text(row, "StationCode", true).toUpperCase();
      const businessDate = dateValue(row, "BusinessDate");
      const shift = statusValue(row, "Shift", "DAY").toUpperCase();
      const expected = numberValue(row, "ExpectedCash");
      const amount = numberValue(row, "AmountToBank");
      await tx.cashCollection.create({
        data: {
          tenantId: tenant.id,
          stationId: requireMapValue(stationIds, stationCode, "Station"),
          dailySessionId: requireMapValue(sessionIds, sessionKey(stationCode, businessDate, shift), "Daily session"),
          businessDate,
          expectedCash: expected,
          amountToBank: amount,
          variance: calcCashCollectionVariance(amount, expected),
          bankCollectionDate: dateValue(row, "BankCollectionDate"),
          bankCollectionReference: optionalText(row, "BankReference"),
          bankSignatureName: optionalText(row, "BankSignatureName"),
          supervisorSignatureName: optionalText(row, "SupervisorSignatureName"),
          remarks: optionalText(row, "Remarks"),
          createdBy: actorUserId,
        },
      });
      counts.cashCollections += 1;
    }

    await writeAuditLog(
      {
        tenantId: "__platform__",
        stationId: null,
        actorUserId,
        entityType: "TenantImport",
        entityId: tenant.id,
        action: "CREATE",
        before: null,
        after: { tenantName: tenant.name, slug: tenant.slug, counts },
      },
      tx
    );

    return {
      tenantId: tenant.id,
      tenantName: tenant.name,
      slug: tenant.slug,
      temporaryPassword: TEMP_PASSWORD,
      counts,
    };
  }, { timeout: 20000 });
}
