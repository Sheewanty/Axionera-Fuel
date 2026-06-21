import { NextRequest, NextResponse } from "next/server";
import { formatCurrency, formatLitres } from "@/lib/calculations";
import { prisma } from "@/lib/db/prisma";
import { getAccessibleStations } from "@/lib/db/station.service";
import { formatReportDate, toCsv } from "@/lib/reports";
import { getRequiredSession } from "@/lib/session";

const EXPORT_TYPES = new Set(["product-sales", "tank-loss", "banking"]);

export async function GET(request: NextRequest) {
  const session = await getRequiredSession();
  const type = request.nextUrl.searchParams.get("type") ?? "";
  const stationId = request.nextUrl.searchParams.get("stationId") ?? "";

  if (!EXPORT_TYPES.has(type)) {
    return NextResponse.json({ message: "Invalid export type." }, { status: 400 });
  }

  const stations = await getAccessibleStations(session.user.tenantId, session.user.membershipStationId);
  const station = stations.find((item) => item.id === stationId);

  if (!station) {
    return NextResponse.json({ message: "Station is not available for this account." }, { status: 403 });
  }

  const rows = await buildRows(type, session.user.tenantId, station.id);
  const csv = toCsv(rows.length > 0 ? rows : [{ message: "No records found" }]);
  const filename = `fuelstation-os-${type}-${station.code}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

async function buildRows(type: string, tenantId: string, stationId: string) {
  if (type === "product-sales") return buildProductSalesRows(tenantId, stationId);
  if (type === "tank-loss") return buildTankLossRows(tenantId, stationId);
  return buildBankingRows(tenantId, stationId);
}

async function buildProductSalesRows(tenantId: string, stationId: string) {
  const readings = await prisma.pumpReading.findMany({
    where: { tenantId, stationId, isClosingRecorded: true },
    include: {
      station: { select: { name: true } },
      product: { select: { name: true, category: true } },
      dailySession: { select: { businessDate: true, shift: true } },
    },
    orderBy: [{ businessDate: "desc" }, { createdAt: "desc" }],
    take: 1000,
  });

  return readings.map((row) => ({
    "Business Date": formatReportDate(row.dailySession.businessDate),
    Station: row.station.name,
    Shift: row.dailySession.shift,
    Product: row.product.name,
    Category: row.product.category,
    "Litres Sold": formatLitres(Number(row.litresSold)),
    "Expected Revenue": formatCurrency(Number(row.amountExpected)),
    "Cash Received": formatCurrency(Number(row.cashReceived)),
    "GO Card / Visa": formatCurrency(Number(row.gocardAmount)),
    "GOIL Coupon": formatCurrency(Number(row.couponAmount)),
    "GHQR / Mobile Money": formatCurrency(Number(row.ghqrAmount)),
    "Credit Sales": formatCurrency(Number(row.creditorsAmount)),
    Variance: formatCurrency(Number(row.variance)),
  }));
}

async function buildTankLossRows(tenantId: string, stationId: string) {
  const dippings = await prisma.tankDipping.findMany({
    where: { tenantId, stationId },
    include: {
      station: { select: { name: true } },
      tank: { select: { name: true } },
      product: { select: { name: true } },
      dailySession: { select: { businessDate: true, shift: true } },
    },
    orderBy: [{ businessDate: "desc" }, { createdAt: "desc" }],
    take: 1000,
  });

  return dippings.map((row) => ({
    "Business Date": formatReportDate(row.dailySession.businessDate),
    Station: row.station.name,
    Shift: row.dailySession.shift,
    Tank: row.tank.name,
    Product: row.product.name,
    "Opening Stock": formatLitres(Number(row.openingStockLitres)),
    Receipts: formatLitres(Number(row.receiptsLitres)),
    "Meter Sold": formatLitres(Number(row.meterSoldLitres)),
    "Closing Stock": formatLitres(Number(row.closingStockLitres)),
    "Variance Litres": formatLitres(Number(row.varianceLitres)),
    "Water Test": row.waterTestStatus,
  }));
}

async function buildBankingRows(tenantId: string, stationId: string) {
  const collections = await prisma.cashCollection.findMany({
    where: { tenantId, stationId },
    include: {
      station: { select: { name: true } },
      dailySession: { select: { businessDate: true, shift: true, status: true } },
    },
    orderBy: [{ businessDate: "desc" }, { createdAt: "desc" }],
    take: 1000,
  });

  return collections.map((row) => ({
    "Business Date": formatReportDate(row.dailySession.businessDate),
    Station: row.station.name,
    Shift: row.dailySession.shift,
    Status: row.dailySession.status,
    "Bank Collection Date": row.bankCollectionDate ? formatReportDate(row.bankCollectionDate) : "",
    "Collection Reference": row.bankCollectionReference ?? "",
    "Expected Cash": formatCurrency(Number(row.expectedCash)),
    "Amount Banked": formatCurrency(Number(row.amountToBank)),
    Variance: formatCurrency(Number(row.variance)),
    "Bank Signature": row.bankSignatureName ?? "",
    "Supervisor Signature": row.supervisorSignatureName ?? "",
  }));
}
