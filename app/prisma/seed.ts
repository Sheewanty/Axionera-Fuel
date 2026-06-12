/**
 * Prisma seed script — Demo data for FuelStation OS
 *
 * Context: Ghana / GOIL filling stations
 * Products: Super 91, Super 95, Diesel (standard Ghana pump products)
 * Currency: GHS
 *
 * Run with:  npx prisma db seed
 * Requires:  DATABASE_URL set in environment or .env
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  calcLitresSold,
  calcExpectedAmount,
  calcNozzleVariance,
  calcTankVariance,
  calcMartNetSales,
  calcMartVariance,
  calcNetExpenditure,
} from "../src/lib/calculations";

// ─── Dev-only guard ───────────────────────────────────────────────────────────
// Seeded demo passwords must NEVER be used in production.
// This guard prevents accidental seeding outside development environments.
if (process.env.NODE_ENV === "production") {
  console.error("\n\u274c  ERROR: Refusing to seed with demo passwords in production.");
  console.error("   Set NODE_ENV to \"development\" or run a production migration instead.\n");
  process.exit(1);
}

const prisma = new PrismaClient();

// ─── Demo password ────────────────────────────────────────────────────────────
// Single demo password for all seeded users — development only.
// Change each user's password via the admin panel in staging/production.
const DEMO_PASSWORD = "goil1234";
const DEMO_HASH = bcrypt.hashSync(DEMO_PASSWORD, 10);

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Today at midnight UTC */
function today(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Upsert a Membership record.
 *
 * - Tenant-wide roles (OWNER, ADMIN, ACCOUNTANT, AUDITOR): pass stationId = ""
 * - Station-scoped roles (SUPERVISOR, ATTENDANT, etc.):   pass the real stationId cuid
 *
 * The schema uses non-nullable stationId with sentinel "" to avoid the Postgres
 * NULL != NULL unique-index problem.
 */
async function upsertMembership(
  tenantId: string,
  userId: string,
  role: string,
  stationId: string  // "" for tenant-wide, real cuid for station-scoped
) {
  await prisma.membership.upsert({
    where: {
      tenantId_userId_stationId: { tenantId, userId, stationId },
    },
    update: { role },
    create: { tenantId, userId, role, stationId },
  });
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱  Seeding FuelStation OS demo data (Ghana / GOIL context)…");

  // ── Tenant ─────────────────────────────────────────────────────────────────
  const tenant = await prisma.tenant.upsert({
    where: { slug: "goil-ghana" },
    update: {},
    create: {
      name: "GOIL Ghana Ltd",
      slug: "goil-ghana",
      subscriptionStatus: "ACTIVE",
      billingEmail: "accounts@goil.com.gh",
    },
  });
  console.log("✓  Tenant:", tenant.name);

  // ── Stations ───────────────────────────────────────────────────────────────
  const stationAccra = await prisma.station.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: "GH-ACC-001" } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: "GOIL Accra Central",
      code: "GH-ACC-001",
      location: "Ring Road Central, Accra",
      status: "ACTIVE",
    },
  });

  const stationKumasi = await prisma.station.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: "GH-KSI-001" } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: "GOIL Kumasi Adum",
      code: "GH-KSI-001",
      location: "Adum, Kumasi",
      status: "ACTIVE",
    },
  });
  console.log("✓  Stations:", stationAccra.name, "|", stationKumasi.name);

  // ── Products ───────────────────────────────────────────────────────────────
  const super91 = await prisma.product.upsert({
    where: { id: "prod-super91" },
    update: {},
    create: { id: "prod-super91", tenantId: tenant.id, name: "Super 91", category: "FUEL" },
  });
  const super95 = await prisma.product.upsert({
    where: { id: "prod-super95" },
    update: {},
    create: { id: "prod-super95", tenantId: tenant.id, name: "Super 95", category: "FUEL" },
  });
  const diesel = await prisma.product.upsert({
    where: { id: "prod-diesel" },
    update: {},
    create: { id: "prod-diesel", tenantId: tenant.id, name: "Diesel", category: "FUEL" },
  });
  console.log("✓  Products: Super 91 | Super 95 | Diesel");

  // ── Ghana pump prices (GHS/L — approximate GOIL posted prices) ────────────
  const businessDate = today();

  await prisma.priceHistory.createMany({
    skipDuplicates: true,
    data: [
      { tenantId: tenant.id, stationId: stationAccra.id, productId: super91.id, pricePerLitre: 14.89, effectiveFrom: businessDate, createdBy: "seed" },
      { tenantId: tenant.id, stationId: stationAccra.id, productId: super95.id, pricePerLitre: 15.31, effectiveFrom: businessDate, createdBy: "seed" },
      { tenantId: tenant.id, stationId: stationAccra.id, productId: diesel.id,  pricePerLitre: 14.45, effectiveFrom: businessDate, createdBy: "seed" },
    ],
  });
  console.log("✓  Price history (GHS/L): Super 91 = 14.89 | Super 95 = 15.31 | Diesel = 14.45");

  // ── Pumps & Nozzles (Accra Central) ───────────────────────────────────────
  const pump1 = await prisma.pump.upsert({
    where: { id: "pump-1-accra" },
    update: {},
    create: { id: "pump-1-accra", tenantId: tenant.id, stationId: stationAccra.id, name: "Pump 1", status: "ACTIVE" },
  });
  const pump2 = await prisma.pump.upsert({
    where: { id: "pump-2-accra" },
    update: {},
    create: { id: "pump-2-accra", tenantId: tenant.id, stationId: stationAccra.id, name: "Pump 2", status: "ACTIVE" },
  });
  const pump3 = await prisma.pump.upsert({
    where: { id: "pump-3-accra" },
    update: {},
    create: { id: "pump-3-accra", tenantId: tenant.id, stationId: stationAccra.id, name: "Pump 3", status: "ACTIVE" },
  });

  const n1a = await prisma.nozzle.upsert({
    where: { id: "n1a-accra" },
    update: {},
    create: { id: "n1a-accra", tenantId: tenant.id, stationId: stationAccra.id, pumpId: pump1.id, productId: super95.id, name: "Nozzle A", meterCode: "P1-A" },
  });
  const n1b = await prisma.nozzle.upsert({
    where: { id: "n1b-accra" },
    update: {},
    create: { id: "n1b-accra", tenantId: tenant.id, stationId: stationAccra.id, pumpId: pump1.id, productId: diesel.id, name: "Nozzle B", meterCode: "P1-B" },
  });
  const n2a = await prisma.nozzle.upsert({
    where: { id: "n2a-accra" },
    update: {},
    create: { id: "n2a-accra", tenantId: tenant.id, stationId: stationAccra.id, pumpId: pump2.id, productId: super91.id, name: "Nozzle A", meterCode: "P2-A" },
  });
  const n2b = await prisma.nozzle.upsert({
    where: { id: "n2b-accra" },
    update: {},
    create: { id: "n2b-accra", tenantId: tenant.id, stationId: stationAccra.id, pumpId: pump2.id, productId: super95.id, name: "Nozzle B", meterCode: "P2-B" },
  });
  const n3a = await prisma.nozzle.upsert({
    where: { id: "n3a-accra" },
    update: {},
    create: { id: "n3a-accra", tenantId: tenant.id, stationId: stationAccra.id, pumpId: pump3.id, productId: diesel.id, name: "Nozzle A", meterCode: "P3-A" },
  });
  console.log("✓  Pumps 1–3 with nozzles (Accra Central)");

  // ── Tanks (Accra Central) ─────────────────────────────────────────────────
  const tank1 = await prisma.tank.upsert({
    where: { id: "tank-1-accra" },
    update: {},
    create: { id: "tank-1-accra", tenantId: tenant.id, stationId: stationAccra.id, productId: super95.id, name: "Tank 1 — Super 95", capacityLitres: 25000 },
  });
  const tank2 = await prisma.tank.upsert({
    where: { id: "tank-2-accra" },
    update: {},
    create: { id: "tank-2-accra", tenantId: tenant.id, stationId: stationAccra.id, productId: diesel.id, name: "Tank 2 — Diesel", capacityLitres: 25000 },
  });
  const tank3 = await prisma.tank.upsert({
    where: { id: "tank-3-accra" },
    update: {},
    create: { id: "tank-3-accra", tenantId: tenant.id, stationId: stationAccra.id, productId: super91.id, name: "Tank 3 — Super 91", capacityLitres: 15000 },
  });
  console.log("✓  Tanks 1–3 (Accra Central)");

  // ── Users ──────────────────────────────────────────────────────────────────
  const userOwner = await prisma.user.upsert({
    where: { email: "kwame.mensah@goil.com.gh" },
    update: { passwordHash: DEMO_HASH },
    create: { email: "kwame.mensah@goil.com.gh", name: "Kwame Mensah", avatarInitials: "KM", passwordHash: DEMO_HASH, status: "ACTIVE" },
  });
  const userAdmin = await prisma.user.upsert({
    where: { email: "ama.boateng@goil.com.gh" },
    update: { passwordHash: DEMO_HASH },
    create: { email: "ama.boateng@goil.com.gh", name: "Ama Boateng", avatarInitials: "AB", passwordHash: DEMO_HASH, status: "ACTIVE" },
  });
  const userSupervisor = await prisma.user.upsert({
    where: { email: "kofi.asante@goil.com.gh" },
    update: { passwordHash: DEMO_HASH },
    create: { email: "kofi.asante@goil.com.gh", name: "Kofi Asante", avatarInitials: "KA", passwordHash: DEMO_HASH, status: "ACTIVE" },
  });
  const userAttendant = await prisma.user.upsert({
    where: { email: "abena.osei@goil.com.gh" },
    update: { passwordHash: DEMO_HASH },
    create: { email: "abena.osei@goil.com.gh", name: "Abena Osei", avatarInitials: "AO", passwordHash: DEMO_HASH, status: "ACTIVE" },
  });
  const userAccountant = await prisma.user.upsert({
    where: { email: "yaw.darko@goil.com.gh" },
    update: { passwordHash: DEMO_HASH },
    create: { email: "yaw.darko@goil.com.gh", name: "Yaw Darko", avatarInitials: "YD", passwordHash: DEMO_HASH, status: "ACTIVE" },
  });
  console.log(`✓  Demo users with hashed passwords (password: ${DEMO_PASSWORD}) — DEVELOPMENT ONLY`);
  console.log("    Kwame Mensah (OWNER) | Ama Boateng (ADMIN) | Kofi Asante (SUPERVISOR) | Abena Osei (ATTENDANT) | Yaw Darko (ACCOUNTANT)");


  // ── Memberships ───────────────────────────────────────────────────────────
  // OWNER and ADMIN have tenant-wide scope (stationId = "" sentinel)
  await upsertMembership(tenant.id, userOwner.id, "OWNER", "");
  await upsertMembership(tenant.id, userAdmin.id, "ADMIN", "");
  await upsertMembership(tenant.id, userAccountant.id, "ACCOUNTANT", "");
  // Station-scoped roles use the real stationId cuid
  await upsertMembership(tenant.id, userSupervisor.id, "SUPERVISOR", stationAccra.id);
  await upsertMembership(tenant.id, userAttendant.id, "ATTENDANT", stationAccra.id);
  console.log("✓  Memberships assigned");

  // ── Daily Session (today, Accra Central, Day shift) ───────────────────────
  const session = await prisma.dailySession.upsert({
    where: {
      tenantId_stationId_businessDate_shift: {
        tenantId: tenant.id,
        stationId: stationAccra.id,
        businessDate,
        shift: "DAY",
      },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      stationId: stationAccra.id,
      businessDate,
      shift: "DAY",
      status: "READY_FOR_REVIEW",
      openedBy: userSupervisor.id,
    },
  });
  console.log("✓  Daily session created (READY_FOR_REVIEW)");

  // ── Pump readings ─────────────────────────────────────────────────────────
  // All calculations done server-side using the shared calculations library
  type ReadingDef = {
    nozzleId: string; pumpId: string; productId: string;
    prev: number; curr: number; priceGHS: number; cashGHS: number;
  };

  const readingDefs: ReadingDef[] = [
    { nozzleId: n1a.id, pumpId: pump1.id, productId: super95.id, prev: 48250.50, curr: 48892.30, priceGHS: 15.31, cashGHS: 9822 },
    { nozzleId: n1b.id, pumpId: pump1.id, productId: diesel.id,  prev: 22410.00, curr: 22980.80, priceGHS: 14.45, cashGHS: 8247 },
    { nozzleId: n2a.id, pumpId: pump2.id, productId: super91.id, prev: 31100.00, curr: 31590.40, priceGHS: 14.89, cashGHS: 7303 },
    { nozzleId: n2b.id, pumpId: pump2.id, productId: super95.id, prev: 19850.00, curr: 20240.50, priceGHS: 15.31, cashGHS: 5978 },
    { nozzleId: n3a.id, pumpId: pump3.id, productId: diesel.id,  prev: 41500.00, curr: 42180.20, priceGHS: 14.45, cashGHS: 9832 },
  ];

  for (const r of readingDefs) {
    const litresSold    = calcLitresSold(r.curr, r.prev);
    const amountExpected = calcExpectedAmount(litresSold, r.priceGHS);
    const variance       = calcNozzleVariance(r.cashGHS, 0, 0, 0, 0, amountExpected);

    await prisma.pumpReading.create({
      data: {
        tenantId: tenant.id, stationId: stationAccra.id,
        dailySessionId: session.id, businessDate, shift: "DAY",
        pumpId: r.pumpId, nozzleId: r.nozzleId, productId: r.productId,
        attendantId: userAttendant.id,
        previousLitre: r.prev, currentLitre: r.curr,
        litresSold, pricePerLitre: r.priceGHS,
        amountExpected, cashReceived: r.cashGHS, 
        gocardAmount: 0, couponAmount: 0, ghqrAmount: 0, creditorsAmount: 0,
        variance,
        createdBy: userSupervisor.id,
      },
    });
  }
  console.log("✓  Pump readings seeded (5 nozzles)");

  // ── Tank dippings ─────────────────────────────────────────────────────────
  type DipDef = { tankId: string; productId: string; opening: number; receipts: number; meterSold: number; closing: number };

  const dipDefs: DipDef[] = [
    { tankId: tank1.id, productId: super95.id, opening: 14200, receipts: 10000, meterSold: 8313, closing: 15850 },
    { tankId: tank2.id, productId: diesel.id,  opening: 12800, receipts: 0,     meterSold: 6252, closing: 6520  },
    { tankId: tank3.id, productId: super91.id, opening: 9400,  receipts: 0,     meterSold: 4904, closing: 4510  },
  ];

  for (const d of dipDefs) {
    const varianceLitres = calcTankVariance(d.opening, d.receipts, d.meterSold, d.closing);
    await prisma.tankDipping.create({
      data: {
        tenantId: tenant.id, stationId: stationAccra.id,
        dailySessionId: session.id, businessDate,
        tankId: d.tankId, productId: d.productId,
        openingStockLitres: d.opening, receiptsLitres: d.receipts,
        closingStockLitres: d.closing, meterSoldLitres: d.meterSold,
        varianceLitres, waterTestStatus: "CLEAR",
        createdBy: userSupervisor.id,
      },
    });
  }
  console.log("✓  Tank dippings seeded (3 tanks)");

  // ── Mart sales ────────────────────────────────────────────────────────────
  const pos = 8420, cashSales = 3200, mobile = 1890, returns = 0;
  const netMartSales = calcMartNetSales(pos, cashSales, mobile, returns);
  const cashCount = 13700;
  const martVariance = calcMartVariance(cashCount, cashSales);

  await prisma.martSale.create({
    data: {
      tenantId: tenant.id, stationId: stationAccra.id,
      dailySessionId: session.id, businessDate,
      posSales: pos, cashSales, mobileMoney: mobile, returns,
      netMartSales, cashCount, variance: martVariance,
      createdBy: userSupervisor.id,
    },
  });
  console.log("✓  Mart sales seeded (POS | Cash | MoMo)");

  const expenditureDefs = [
    { category: "Generator Fuel", amount: 350, paymentToBank: 0, paidBy: userSupervisor.name, receiptAttached: true },
    { category: "Staff Meals", amount: 120, paymentToBank: 0, paidBy: userSupervisor.name, receiptAttached: false },
    { category: "Contractor Payment", amount: 800, paymentToBank: 400, paidBy: userSupervisor.name, receiptAttached: true },
  ];

  for (const expense of expenditureDefs) {
    await prisma.expenditure.create({
      data: {
        tenantId: tenant.id,
        stationId: stationAccra.id,
        dailySessionId: session.id,
        businessDate,
        category: expense.category,
        amount: expense.amount,
        paymentToBank: expense.paymentToBank,
        paidBy: expense.paidBy,
        receiptAttached: expense.receiptAttached,
        createdBy: userSupervisor.id,
      },
    });
  }
  const totalNetExpenditure = expenditureDefs.reduce(
    (sum, expense) => sum + calcNetExpenditure(expense.amount, expense.paymentToBank),
    0
  );
  console.log("✓  Expenditures seeded (3 records)");

  // ── Cash collection ───────────────────────────────────────────────────────
  const totalPumpCash = readingDefs.reduce((sum, r) => sum + r.cashGHS, 0);
  const expectedCashToBank = totalPumpCash - totalNetExpenditure;
  const bankingVariance = totalPumpCash - expectedCashToBank;

  await prisma.cashCollection.create({
    data: {
      tenantId: tenant.id, stationId: stationAccra.id,
      dailySessionId: session.id, businessDate,
      amountToBank: totalPumpCash,
      expectedCash: expectedCashToBank,
      variance: bankingVariance,
      bankSignatureName: "Ghana Commercial Bank — Accra Branch",
      supervisorSignatureName: userSupervisor.name,
      createdBy: userSupervisor.id,
    },
  });
  console.log(`✓  Cash collection — GHS ${totalPumpCash.toLocaleString()} to bank | variance GHS ${bankingVariance.toFixed(2)}`);

  console.log("\n🎉  Seed complete!");
  console.log(`    Tenant : ${tenant.name}`);
  console.log(`    Station: ${stationAccra.name}`);
  console.log(`    Date   : ${businessDate.toISOString().slice(0, 10)}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
