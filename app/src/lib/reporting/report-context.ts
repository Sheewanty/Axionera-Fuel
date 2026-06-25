import { formatLitres } from "@/lib/calculations";
import { prisma } from "@/lib/db/prisma";
import type { StationSummary } from "@/lib/db/station.service";
import { formatReportDate } from "@/lib/reports";
import { getReportTemplate, type ReportTemplateKey } from "@/lib/reporting/report-templates";

export interface ReportMetric {
  label: string;
  value: string;
  note?: string;
  status?: "positive" | "neutral" | "warning" | "critical";
}

export interface ReportSection {
  title: string;
  body: string;
  bullets: string[];
  metrics: ReportMetric[];
}

export interface ReportSource {
  sourceType: string;
  sourceId?: string;
  sourceLabel?: string;
  sourceSnapshot?: Record<string, string | number | boolean | null>;
}

export interface ReportFacts {
  title: string;
  subtitle: string;
  templateKey: ReportTemplateKey;
  tenantName: string;
  stationName: string;
  generatedAt: string;
  periodFrom: string;
  periodTo: string;
  metrics: ReportMetric[];
  sections: ReportSection[];
  sources: ReportSource[];
  totals: Record<string, number>;
}

export interface CollectReportContextInput {
  tenantId: string;
  templateKey: ReportTemplateKey;
  stationId?: string;
  periodFrom: Date;
  periodTo: Date;
  accessibleStations: StationSummary[];
}

type DailySessionRow = Awaited<ReturnType<typeof loadDailySessions>>[number];

function toNumber(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  return Number(value);
}

function sum<T>(items: T[], picker: (item: T) => number): number {
  return items.reduce((total, item) => total + picker(item), 0);
}

function statusForVariance(value: number): ReportMetric["status"] {
  if (Math.abs(value) < 0.01) return "positive";
  return Math.abs(value) > 500 ? "critical" : "warning";
}

function formatReportCurrency(amount: number): string {
  const absolute = Math.abs(amount).toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${amount < 0 ? "-" : ""}(GHS) ${absolute}`;
}

function dateSubtitle(from: Date, to: Date): string {
  const left = formatReportDate(from);
  const right = formatReportDate(to);
  return left === right ? left : `${left} to ${right}`;
}

async function loadDailySessions(tenantId: string, stationIds: string[], from: Date, to: Date) {
  return prisma.dailySession.findMany({
    where: {
      tenantId,
      stationId: { in: stationIds },
      businessDate: { gte: from, lte: to },
    },
    include: {
      station: { select: { id: true, name: true, code: true } },
      pumpReadings: { include: { product: { select: { name: true } }, nozzle: { select: { name: true } } } },
      tankDippings: { include: { tank: { select: { name: true } }, product: { select: { name: true } } } },
      stockAdjustments: { include: { tank: { select: { name: true } }, product: { select: { name: true } } } },
      cashCollections: true,
      martSales: true,
      expenditures: true,
      productDischarges: { include: { tank: { select: { name: true } }, product: { select: { name: true } } } },
      creditorLedger: { include: { creditor: { select: { name: true } } } },
      lubeBaySales: true,
    },
    orderBy: [{ businessDate: "asc" }, { station: { name: "asc" } }],
  });
}

function buildTotals(days: DailySessionRow[]) {
  const pumpReadings = days.flatMap((day) => day.pumpReadings).filter((row) => row.isClosingRecorded);
  const tankDippings = days.flatMap((day) => day.tankDippings);
  const stockAdjustments = days.flatMap((day) => day.stockAdjustments ?? []).filter((row) => row.approvalStatus === "APPROVED");
  const cashCollections = days.flatMap((day) => day.cashCollections);
  const expenditures = days.flatMap((day) => day.expenditures);
  const martSales = days.flatMap((day) => day.martSales);
  const creditorLedger = days.flatMap((day) => day.creditorLedger);
  const lubeBaySales = days.flatMap((day) => day.lubeBaySales);

  const pumpCash = sum(pumpReadings, (row) => toNumber(row.cashReceived));
  const debtorCashPayments = sum(
    creditorLedger.filter((row) => row.type === "PAYMENT" && row.paymentMethod === "CASH"),
    (row) => toNumber(row.amount)
  );
  const lubeBayCashSales = sum(lubeBaySales, (row) => toNumber(row.cashAmount));
  const actualExpenditure = sum(expenditures, (row) => toNumber(row.amount));
  const expectedBankableCash = pumpCash + debtorCashPayments + lubeBayCashSales - actualExpenditure;
  const cashBanked = sum(cashCollections, (row) => toNumber(row.amountToBank));

  return {
    litresSold: sum(pumpReadings, (row) => toNumber(row.litresSold)),
    expectedRevenue: sum(pumpReadings, (row) => toNumber(row.amountExpected)),
    pumpCash,
    hqDirectSales: sum(
      pumpReadings,
      (row) => toNumber(row.gocardAmount) + toNumber(row.couponAmount) + toNumber(row.ghqrAmount)
    ),
    creditSales: sum(pumpReadings, (row) => toNumber(row.creditorsAmount)) + sum(lubeBaySales, (row) => toNumber(row.creditorAmount)),
    debtorCashPayments,
    lubeBayCashSales,
    lubeBayTotalSales: sum(lubeBaySales, (row) => toNumber(row.totalExpected)),
    actualExpenditure,
    expectedBankableCash,
    cashBanked,
    bankingVariance: cashBanked - expectedBankableCash,
    tankVarianceLitres: sum(tankDippings, (row) => toNumber(row.varianceLitres)),
    stockAdjustmentInLitres: sum(stockAdjustments.filter((row) => row.direction === "IN"), (row) => toNumber(row.litres)),
    stockAdjustmentOutLitres: sum(stockAdjustments.filter((row) => row.direction === "OUT"), (row) => toNumber(row.litres)),
    martNetSales: sum(martSales, (row) => toNumber(row.netMartSales)),
    sessionCount: days.length,
    openSessionCount: days.filter((day) => day.status === "OPEN" || day.status === "REOPENED").length,
    waterDetections: tankDippings.filter((row) => row.waterTestStatus === "WATER_DETECTED").length,
    dischargeCount: days.flatMap((day) => day.productDischarges).length,
    bankDepositCount: cashCollections.length,
    expenseCount: expenditures.length,
    lubeBaySaleCount: lubeBaySales.length,
  };
}

function buildMetrics(totals: ReturnType<typeof buildTotals>): ReportMetric[] {
  return [
    { label: "Total Litres", value: formatLitres(totals.litresSold), note: "Closing pump readings", status: "neutral" },
    { label: "Expected Revenue", value: formatReportCurrency(totals.expectedRevenue), note: "Meter sales value", status: "neutral" },
    { label: "Cash Banked", value: formatReportCurrency(totals.cashBanked), note: "Cash collection records", status: "neutral" },
    {
      label: "Banking Variance",
      value: formatReportCurrency(totals.bankingVariance),
      note: "Banked minus expected bankable cash",
      status: statusForVariance(totals.bankingVariance),
    },
    {
      label: "Tank Variance",
      value: formatLitres(totals.tankVarianceLitres),
      note: "After approved stock adjustments",
      status: totals.tankVarianceLitres === 0 ? "positive" : "warning",
    },
    { label: "Mart Net Sales", value: formatReportCurrency(totals.martNetSales), note: "Card + cash + momo - returns", status: "neutral" },
  ];
}

function buildProductSection(days: DailySessionRow[]): ReportSection[] {
  const productMap = new Map<string, { litres: number; expected: number; cash: number; direct: number; credit: number }>();

  for (const reading of days.flatMap((day) => day.pumpReadings).filter((row) => row.isClosingRecorded)) {
    const product = reading.product.name;
    const row = productMap.get(product) ?? { litres: 0, expected: 0, cash: 0, direct: 0, credit: 0 };
    row.litres += toNumber(reading.litresSold);
    row.expected += toNumber(reading.amountExpected);
    row.cash += toNumber(reading.cashReceived);
    row.direct += toNumber(reading.gocardAmount) + toNumber(reading.couponAmount) + toNumber(reading.ghqrAmount);
    row.credit += toNumber(reading.creditorsAmount);
    productMap.set(product, row);
  }

  const bullets = Array.from(productMap.entries()).map(
    ([product, row]) =>
      `${product}: ${formatLitres(row.litres)} sold, ${formatReportCurrency(row.expected)} expected revenue, ${formatReportCurrency(row.cash)} cash.`
  );

  return [
    {
      title: "Product Sales",
      body: "Fuel sales are grouped by product from closing pump readings. Direct-to-HQ channels and credit sales are separated from physical cash.",
      bullets: bullets.length ? bullets : ["No closing pump readings were recorded in this period."],
      metrics: [],
    },
  ];
}

function buildTankSection(days: DailySessionRow[]): ReportSection {
  const rows = days.flatMap((day) => day.tankDippings);
  const adjustments = days.flatMap((day) => day.stockAdjustments ?? []).filter((row) => row.approvalStatus === "APPROVED");
  const highest = [...rows].sort((a, b) => Math.abs(toNumber(b.varianceLitres)) - Math.abs(toNumber(a.varianceLitres))).slice(0, 8);

  return {
    title: "Tank Variance and Water Checks",
    body: "Tank variance is calculated from tank dipping records after approved stock adjustments such as NPA inspection draw-offs. It is not the same as litres sold.",
    bullets: highest.length
      ? highest.map(
          (row) =>
            `${formatReportDate(row.businessDate)} ${row.tank.name} (${row.product.name}): ${formatLitres(toNumber(row.varianceLitres))}; water test ${row.waterTestStatus}.`
        )
      : ["No tank dipping records were found for this period."],
    metrics: [
      { label: "Dipping Records", value: String(rows.length), note: "Tank records captured" },
      { label: "Water Detections", value: String(rows.filter((row) => row.waterTestStatus === "WATER_DETECTED").length), note: "Requires investigation" },
      {
        label: "Adjustment Out",
        value: formatLitres(sum(adjustments.filter((row) => row.direction === "OUT"), (row) => toNumber(row.litres))),
        note: "Approved non-sales stock movement",
      },
    ],
  };
}

function buildTankDipRegisterSection(days: DailySessionRow[]): ReportSection {
  const rows = days
    .flatMap((day) => day.tankDippings.map((dipping) => ({ day, dipping })))
    .sort((a, b) => Math.abs(toNumber(b.dipping.varianceLitres)) - Math.abs(toNumber(a.dipping.varianceLitres)));

  return {
    title: "Tank Dip Register",
    body: "Opening stock is system-derived from the previous closing stock. Receipts and closing stock are operator-entered, and variance includes approved stock adjustment in/out records.",
    bullets: rows.length
      ? rows.slice(0, 12).map(({ day, dipping }) =>
          `${formatReportDate(day.businessDate)} ${day.station.name} - ${dipping.tank.name} (${dipping.product.name}): opening ${formatLitres(toNumber(dipping.openingStockLitres))}, receipts ${formatLitres(toNumber(dipping.receiptsLitres))}, meter sold ${formatLitres(toNumber(dipping.meterSoldLitres))}, closing ${formatLitres(toNumber(dipping.closingStockLitres))}, variance ${formatLitres(toNumber(dipping.varianceLitres))}.`
        )
      : ["No tank dipping records were found for this period."],
    metrics: [
      { label: "Dip Records", value: String(rows.length), note: "Tank readings captured" },
      {
        label: "Receipts",
        value: formatLitres(sum(rows, (row) => toNumber(row.dipping.receiptsLitres))),
        note: "Declared physical receipts",
      },
      {
        label: "Closing Stock",
        value: formatLitres(sum(rows, (row) => toNumber(row.dipping.closingStockLitres))),
        note: "Aggregate closing dip stock",
      },
      {
        label: "Variance",
        value: formatLitres(sum(rows, (row) => toNumber(row.dipping.varianceLitres))),
        note: "Calculated dip variance",
        status: statusForVariance(sum(rows, (row) => toNumber(row.dipping.varianceLitres))),
      },
    ],
  };
}

function buildProductDischargeSection(days: DailySessionRow[]): ReportSection {
  const rows = days.flatMap((day) => day.productDischarges.map((discharge) => ({ day, discharge })));

  return {
    title: "Product Discharge Evidence",
    body: "Discharge variance compares the tank level expected after delivery against the measured after-tank litres, including adjustment / top-up litres.",
    bullets: rows.length
      ? rows.slice(0, 10).map(({ day, discharge }) =>
          `${formatReportDate(day.businessDate)} ${day.station.name} - ${discharge.tank.name} (${discharge.product.name}): discharged ${formatLitres(toNumber(discharge.productDischargedLitres))}, adjustment/top-up ${formatLitres(toNumber(discharge.topUpLitres))}, expected after tank ${formatLitres(toNumber(discharge.expectedTankAfterDischarge))}, variance ${formatLitres(toNumber(discharge.dischargeVarianceLitres))}.`
        )
      : ["No product discharge records were found for this period."],
    metrics: [
      { label: "Discharges", value: String(rows.length), note: "Delivery records" },
      {
        label: "Discharged Litres",
        value: formatLitres(sum(rows, (row) => toNumber(row.discharge.productDischargedLitres))),
        note: "Station-recorded receipt quantity",
      },
      {
        label: "Adjustment / Top-up",
        value: formatLitres(sum(rows, (row) => toNumber(row.discharge.topUpLitres))),
        note: "Delivery adjustment litres",
      },
      {
        label: "Discharge Variance",
        value: formatLitres(sum(rows, (row) => toNumber(row.discharge.dischargeVarianceLitres))),
        note: "After-tank less expected",
      },
    ],
  };
}

function buildBankingSection(days: DailySessionRow[], totals: ReturnType<typeof buildTotals>): ReportSection {
  const collections = days.flatMap((day) => day.cashCollections);
  return {
    title: "Banking Reconciliation",
    body: "Bankable cash uses the approved station rule: pump cash plus debtor cash payments plus lube bay cash sales, less actual expenditure and already banked collections.",
    bullets: [
      `Pump cash: ${formatReportCurrency(totals.pumpCash)}.`,
      `Debtor cash payments: ${formatReportCurrency(totals.debtorCashPayments)}.`,
      `Lube bay cash sales: ${formatReportCurrency(totals.lubeBayCashSales)}.`,
      `Actual expenditure: ${formatReportCurrency(totals.actualExpenditure)}.`,
      `Cash banked: ${formatReportCurrency(totals.cashBanked)} across ${collections.length} collection record(s).`,
    ],
    metrics: [
      { label: "Expected Bankable Cash", value: formatReportCurrency(totals.expectedBankableCash), note: "Before comparing banked cash" },
      { label: "Banking Variance", value: formatReportCurrency(totals.bankingVariance), note: "Banked minus expected", status: statusForVariance(totals.bankingVariance) },
    ],
  };
}

function buildBankDepositRegisterSection(days: DailySessionRow[]): ReportSection {
  const rows = days.flatMap((day) => day.cashCollections.map((collection) => ({ day, collection })));

  return {
    title: "Bank Deposit Register",
    body: "Business date and bank collection date remain separate. This register shows the recorded bank collection evidence and variance for each banking entry.",
    bullets: rows.length
      ? rows.slice(0, 12).map(({ day, collection }) =>
          `${formatReportDate(day.businessDate)} ${day.station.name}: banked ${formatReportCurrency(toNumber(collection.amountToBank))}, expected ${formatReportCurrency(toNumber(collection.expectedCash))}, variance ${formatReportCurrency(toNumber(collection.variance))}, bank date ${collection.bankCollectionDate ? formatReportDate(collection.bankCollectionDate) : "not recorded"}, ref ${collection.bankCollectionReference || "not recorded"}.`
        )
      : ["No bank collection records were found for this period."],
    metrics: [
      { label: "Deposit Records", value: String(rows.length), note: "Cash collection entries" },
      {
        label: "Amount Banked",
        value: formatReportCurrency(sum(rows, (row) => toNumber(row.collection.amountToBank))),
        note: "Recorded bank deposits",
      },
      {
        label: "Expected Cash",
        value: formatReportCurrency(sum(rows, (row) => toNumber(row.collection.expectedCash))),
        note: "Expected per entry",
      },
      {
        label: "Deposit Variance",
        value: formatReportCurrency(sum(rows, (row) => toNumber(row.collection.variance))),
        note: "Banked less expected",
        status: statusForVariance(sum(rows, (row) => toNumber(row.collection.variance))),
      },
    ],
  };
}

function buildExpenseSection(days: DailySessionRow[]): ReportSection {
  const rows = days.flatMap((day) => day.expenditures.map((expense) => ({ day, expense })));
  const categoryMap = new Map<string, number>();

  for (const row of rows) {
    categoryMap.set(row.expense.category, (categoryMap.get(row.expense.category) ?? 0) + toNumber(row.expense.amount));
  }

  return {
    title: "Actual Expenditure",
    body: "The approved rule is to record only the actual expenditure used. Returned imprest or unused cash should be handled outside expenditure.",
    bullets: rows.length
      ? rows.slice(0, 12).map(({ day, expense }) =>
          `${formatReportDate(day.businessDate)} ${day.station.name}: ${expense.category} ${formatReportCurrency(toNumber(expense.amount))}, paid by ${expense.paidBy}, approved by ${expense.approvedBy || "not recorded"}, receipt ${expense.receiptAttached ? "attached" : "not attached"}.`
        )
      : ["No expenditure records were found for this period."],
    metrics: [
      { label: "Expense Records", value: String(rows.length), note: "Recorded actual expenses" },
      {
        label: "Total Expenses",
        value: formatReportCurrency(sum(rows, (row) => toNumber(row.expense.amount))),
        note: "Actual expenditure only",
      },
      {
        label: "Categories",
        value: String(categoryMap.size),
        note: Array.from(categoryMap.entries()).slice(0, 2).map(([category, amount]) => `${category}: ${formatReportCurrency(amount)}`).join("; "),
      },
      {
        label: "Missing Receipts",
        value: String(rows.filter((row) => !row.expense.receiptAttached).length),
        note: "Requires follow-up",
        status: rows.some((row) => !row.expense.receiptAttached) ? "warning" : "positive",
      },
    ],
  };
}

function buildDebtorSection(days: DailySessionRow[]): ReportSection {
  const ledger = days.flatMap((day) => day.creditorLedger);
  const sales = ledger.filter((entry) => entry.type === "SALE");
  const payments = ledger.filter((entry) => entry.type === "PAYMENT");
  return {
    title: "Debtors and Credit Control",
    body: "Credit exposure is based on debtor ledger entries recorded against the tenant and period.",
    bullets: [
      `Credit sales recorded: ${formatReportCurrency(sum(sales, (row) => toNumber(row.amount)))}.`,
      `Debtor payments recorded: ${formatReportCurrency(sum(payments, (row) => toNumber(row.amount)))}.`,
      `Cash debtor payments included in bankable cash: ${formatReportCurrency(sum(payments.filter((row) => row.paymentMethod === "CASH"), (row) => toNumber(row.amount)))}.`,
    ],
    metrics: [
      { label: "Ledger Entries", value: String(ledger.length), note: "Sales and payments" },
      { label: "Debtor Payments", value: formatReportCurrency(sum(payments, (row) => toNumber(row.amount))), note: "All payment methods" },
    ],
  };
}

function buildLubeBayServicesSection(days: DailySessionRow[]): ReportSection {
  const rows = days.flatMap((day) => day.lubeBaySales.map((sale) => ({ day, sale })));
  const serviceMap = new Map<string, { count: number; total: number; cash: number; card: number; momo: number; credit: number }>();

  for (const row of rows) {
    const key = row.sale.serviceType || "Unspecified service";
    const current = serviceMap.get(key) ?? { count: 0, total: 0, cash: 0, card: 0, momo: 0, credit: 0 };
    current.count += 1;
    current.total += toNumber(row.sale.totalExpected);
    current.cash += toNumber(row.sale.cashAmount);
    current.card += toNumber(row.sale.cardAmount);
    current.momo += toNumber(row.sale.momoAmount);
    current.credit += toNumber(row.sale.creditorAmount);
    serviceMap.set(key, current);
  }

  const ranked = Array.from(serviceMap.entries()).sort((a, b) => b[1].total - a[1].total);

  return {
    title: "Lube Bay Services",
    body: "Lube bay revenue includes service labour, product lines, discounts, and settlement by cash, card, momo, or credit.",
    bullets: ranked.length
      ? ranked.slice(0, 10).map(([service, value]) =>
          `${service}: ${value.count} service(s), expected ${formatReportCurrency(value.total)}, cash ${formatReportCurrency(value.cash)}, card ${formatReportCurrency(value.card)}, momo ${formatReportCurrency(value.momo)}, credit ${formatReportCurrency(value.credit)}.`
        )
      : ["No lube bay sales were found for this period."],
    metrics: [
      { label: "Services", value: String(rows.length), note: "Lube bay sale records" },
      {
        label: "Total Expected",
        value: formatReportCurrency(sum(rows, (row) => toNumber(row.sale.totalExpected))),
        note: "After discount",
      },
      {
        label: "Cash Sales",
        value: formatReportCurrency(sum(rows, (row) => toNumber(row.sale.cashAmount))),
        note: "Included in bankable cash",
      },
      {
        label: "Variance",
        value: formatReportCurrency(sum(rows, (row) => toNumber(row.sale.variance))),
        note: "Collected less expected",
        status: statusForVariance(sum(rows, (row) => toNumber(row.sale.variance))),
      },
    ],
  };
}

function buildTechnicianPerformanceSection(days: DailySessionRow[]): ReportSection {
  const rows = days.flatMap((day) => day.lubeBaySales.map((sale) => ({ day, sale })));
  const techMap = new Map<string, { count: number; expected: number; discount: number; variance: number }>();

  for (const row of rows) {
    const technician = row.sale.technicianName?.trim() || "Unassigned";
    const current = techMap.get(technician) ?? { count: 0, expected: 0, discount: 0, variance: 0 };
    current.count += 1;
    current.expected += toNumber(row.sale.totalExpected);
    current.discount += toNumber(row.sale.discount);
    current.variance += toNumber(row.sale.variance);
    techMap.set(technician, current);
  }

  const ranked = Array.from(techMap.entries()).sort((a, b) => b[1].expected - a[1].expected);

  return {
    title: "Technician Performance",
    body: "Technician ranking uses recorded lube bay sales. Unassigned records should be corrected so accountability remains clear.",
    bullets: ranked.length
      ? ranked.slice(0, 10).map(([technician, value]) =>
          `${technician}: ${value.count} service(s), expected ${formatReportCurrency(value.expected)}, discount ${formatReportCurrency(value.discount)}, variance ${formatReportCurrency(value.variance)}.`
        )
      : ["No technician-linked lube bay sales were found for this period."],
    metrics: [
      { label: "Technicians", value: String(techMap.size), note: "Including unassigned if present" },
      { label: "Service Records", value: String(rows.length), note: "Lube bay sales" },
      {
        label: "Expected Revenue",
        value: formatReportCurrency(sum(rows, (row) => toNumber(row.sale.totalExpected))),
        note: "Technician-linked value",
      },
      {
        label: "Unassigned",
        value: String(rows.filter((row) => !row.sale.technicianName?.trim()).length),
        note: "Needs correction",
        status: rows.some((row) => !row.sale.technicianName?.trim()) ? "warning" : "positive",
      },
    ],
  };
}

function buildSectionsForTemplate(
  templateKey: ReportTemplateKey,
  days: DailySessionRow[],
  totals: ReturnType<typeof buildTotals>
): ReportSection[] {
  if (templateKey === "pump_sales") return buildProductSection(days);
  if (templateKey === "tank_dip") return [buildTankDipRegisterSection(days)];
  if (templateKey === "tank_loss") return [buildTankSection(days), buildProductDischargeSection(days)];
  if (templateKey === "banking_reconciliation") return [buildBankingSection(days, totals), buildBankDepositRegisterSection(days)];
  if (templateKey === "bank_deposit") return [buildBankDepositRegisterSection(days), buildBankingSection(days, totals)];
  if (templateKey === "debtors_exposure") return [buildDebtorSection(days)];
  if (templateKey === "expense") return [buildExpenseSection(days)];
  if (templateKey === "lube_bay_services") return [buildLubeBayServicesSection(days)];
  if (templateKey === "technician_performance") return [buildTechnicianPerformanceSection(days), buildLubeBayServicesSection(days)];

  return [
    ...buildProductSection(days),
    buildTankSection(days),
    buildProductDischargeSection(days),
    buildBankingSection(days, totals),
    buildDebtorSection(days),
    buildExpenseSection(days),
    buildLubeBayServicesSection(days),
  ];
}

function buildSources(days: DailySessionRow[]): ReportSource[] {
  return days.slice(0, 80).map((day) => ({
    sourceType: "DailySession",
    sourceId: day.id,
    sourceLabel: `${day.station.name} ${formatReportDate(day.businessDate)} ${day.shift}`,
    sourceSnapshot: {
      station: day.station.name,
      businessDate: formatReportDate(day.businessDate),
      status: day.status,
      pumpReadings: day.pumpReadings.length,
      tankDippings: day.tankDippings.length,
      cashCollections: day.cashCollections.length,
    },
  }));
}

export async function collectReportFacts(input: CollectReportContextInput): Promise<ReportFacts> {
  const template = getReportTemplate(input.templateKey);
  if (!template) throw new Error("Unknown report template.");

  const tenant = await prisma.tenant.findUnique({
    where: { id: input.tenantId },
    select: { name: true },
  });

  const stations = input.stationId
    ? input.accessibleStations.filter((station) => station.id === input.stationId)
    : input.accessibleStations;

  if (stations.length === 0) {
    throw new Error("No accessible station found for the requested report scope.");
  }

  const days = await loadDailySessions(input.tenantId, stations.map((station) => station.id), input.periodFrom, input.periodTo);
  const totals = buildTotals(days);
  const stationName = input.stationId ? stations[0]?.name ?? "Selected station" : `${stations.length} station${stations.length === 1 ? "" : "s"}`;
  const periodLabel = dateSubtitle(input.periodFrom, input.periodTo);

  const sections: ReportSection[] = buildSectionsForTemplate(input.templateKey, days, totals);

  if (days.length === 0) {
    sections.unshift({
      title: "No Operational Records",
      body: "No daily sessions were found for the selected scope and period.",
      bullets: ["Confirm the station, business date range, and whether a daily session has been opened."],
      metrics: [],
    });
  }

  return {
    title: template.title,
    subtitle: `${tenant?.name ?? "Company"} | ${stationName} | ${periodLabel}`,
    templateKey: input.templateKey,
    tenantName: tenant?.name ?? "Company",
    stationName,
    generatedAt: new Date().toISOString(),
    periodFrom: input.periodFrom.toISOString(),
    periodTo: input.periodTo.toISOString(),
    metrics: buildMetrics(totals),
    sections,
    sources: buildSources(days),
    totals,
  };
}
