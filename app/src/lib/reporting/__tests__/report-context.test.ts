import { beforeEach, describe, expect, it, vi } from "vitest";
import { collectReportFacts } from "@/lib/reporting/report-context";

const mocks = vi.hoisted(() => ({
  tenantFindUnique: vi.fn(),
  dailySessionFindMany: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    tenant: { findUnique: mocks.tenantFindUnique },
    dailySession: { findMany: mocks.dailySessionFindMany },
  },
}));

const businessDate = new Date("2026-06-20T00:00:00.000Z");

function baseDay() {
  return {
    id: "session-1",
    tenantId: "tenant-1",
    stationId: "station-1",
    businessDate,
    shift: "DAY",
    status: "APPROVED",
    station: { id: "station-1", name: "Accra Central", code: "ACC" },
    pumpReadings: [
      {
        isClosingRecorded: true,
        product: { name: "Super 95" },
        nozzle: { name: "Nozzle A" },
        litresSold: 100,
        amountExpected: 1550,
        cashReceived: 1000,
        gocardAmount: 100,
        couponAmount: 50,
        ghqrAmount: 200,
        creditorsAmount: 200,
      },
    ],
    tankDippings: [
      {
        tank: { name: "Tank 1" },
        product: { name: "Super 95" },
        businessDate,
        openingStockLitres: 10000,
        receiptsLitres: 5000,
        meterSoldLitres: 100,
        closingStockLitres: 14900,
        varianceLitres: 0,
        waterTestStatus: "CLEAR",
      },
    ],
    cashCollections: [
      {
        amountToBank: 900,
        expectedCash: 950,
        variance: -50,
        bankCollectionDate: businessDate,
        bankCollectionReference: "BNK-001",
      },
    ],
    martSales: [],
    expenditures: [
      {
        category: "Repairs",
        amount: 50,
        paidBy: "Supervisor",
        approvedBy: "Manager",
        receiptAttached: false,
      },
    ],
    productDischarges: [
      {
        tank: { name: "Tank 1" },
        product: { name: "Super 95" },
        productDischargedLitres: 5000,
        topUpLitres: 0,
        expectedTankAfterDischarge: 15000,
        dischargeVarianceLitres: 0,
      },
    ],
    creditorLedger: [
      {
        type: "PAYMENT",
        paymentMethod: "CASH",
        amount: 250,
        creditor: { name: "Test Debtor" },
      },
    ],
    lubeBaySales: [
      {
        serviceType: "Oil Change",
        technicianName: "Kofi Tech",
        totalExpected: 300,
        cashAmount: 200,
        cardAmount: 50,
        momoAmount: 0,
        creditorAmount: 50,
        discount: 10,
        variance: 0,
      },
    ],
  };
}

async function collect(templateKey: Parameters<typeof collectReportFacts>[0]["templateKey"]) {
  return collectReportFacts({
    tenantId: "tenant-1",
    templateKey,
    stationId: "station-1",
    periodFrom: businessDate,
    periodTo: businessDate,
    accessibleStations: [{ id: "station-1", name: "Accra Central", code: "ACC", location: null, status: "ACTIVE" }],
  });
}

describe("report context", () => {
  beforeEach(() => {
    mocks.tenantFindUnique.mockResolvedValue({ name: "Akwaaba Energy Ltd" });
    mocks.dailySessionFindMany.mockResolvedValue([baseDay()]);
  });

  it("builds a tank dip report section", async () => {
    const facts = await collect("tank_dip");

    expect(facts.sections.map((section) => section.title)).toEqual(["Tank Dip Register"]);
    expect(facts.sections[0].bullets[0]).toContain("opening 10000.00 L");
    expect(facts.metrics.some((metric) => metric.value.includes("(GHS)"))).toBe(true);
  });

  it("builds bank deposit and expense sections", async () => {
    const banking = await collect("bank_deposit");
    const expense = await collect("expense");

    expect(banking.sections.map((section) => section.title)).toContain("Bank Deposit Register");
    expect(banking.sections[0].bullets[0]).toContain("(GHS) 900.00");
    expect(expense.sections.map((section) => section.title)).toEqual(["Actual Expenditure"]);
    expect(expense.sections[0].metrics.find((metric) => metric.label === "Missing Receipts")?.value).toBe("1");
  });

  it("builds lube bay and technician sections", async () => {
    const lube = await collect("lube_bay_services");
    const technician = await collect("technician_performance");

    expect(lube.sections[0].title).toBe("Lube Bay Services");
    expect(lube.sections[0].bullets[0]).toContain("Oil Change");
    expect(technician.sections[0].title).toBe("Technician Performance");
    expect(technician.sections[0].bullets[0]).toContain("Kofi Tech");
  });
});
