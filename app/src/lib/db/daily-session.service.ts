import { DailySession } from "@prisma/client";
import { Db } from "./types";

function businessDateToday(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export async function openTodaySession(
  tenantId: string,
  stationId: string,
  userId: string,
  db: Db
): Promise<DailySession> {
  const station = await db.station.findFirst({
    where: { id: stationId, tenantId, status: "ACTIVE" },
  });

  if (!station) {
    throw new Error("Station not found or inactive");
  }

  const businessDate = businessDateToday();
  const existing = await db.dailySession.findUnique({
    where: {
      tenantId_stationId_businessDate_shift: {
        tenantId,
        stationId,
        businessDate,
        shift: "DAY",
      },
    },
  });

  if (existing) {
    if (existing.status === "APPROVED") {
      throw new Error("Today's session is already approved and cannot be reopened from the opening flow");
    }
    return existing;
  }

  return db.dailySession.create({
    data: {
      tenantId,
      stationId,
      businessDate,
      shift: "DAY",
      status: "OPEN",
      openedBy: userId,
    },
  });
}

export async function closeSession(
  tenantId: string,
  stationId: string,
  userId: string,
  sessionId: string,
  db: Db
): Promise<DailySession> {
  const session = await db.dailySession.findUnique({
    where: { id: sessionId },
    include: {
      pumpReadings: true,
      tankDippings: true,
      cashCollections: true,
      productDischarges: true,
      expenditures: true,
      martSales: true,
    },
  });

  if (!session || session.tenantId !== tenantId) {
    throw new Error("Session not found or tenant mismatch");
  }

  if (session.stationId !== stationId) {
    throw new Error("Station mismatch: session does not belong to the target station");
  }

  if (session.status !== "OPEN" && session.status !== "REOPENED") {
    throw new Error(`Cannot close session from status: ${session.status}`);
  }

  // Validation: Check that required operational data exists
  if (session.pumpReadings.length === 0) {
    throw new Error("Cannot close session: No pump readings recorded");
  }

  const activeNozzles = await db.nozzle.findMany({
    where: { tenantId, stationId, status: "ACTIVE" },
    select: { id: true, name: true },
  });
  const closedNozzleIds = new Set(
    session.pumpReadings
      .filter((reading) => reading.isClosingRecorded)
      .map((reading) => reading.nozzleId)
  );
  const missingClosedNozzles = activeNozzles.filter((nozzle) => !closedNozzleIds.has(nozzle.id));
  if (missingClosedNozzles.length > 0) {
    throw new Error(
      `Cannot close session: Closing pump readings missing for ${missingClosedNozzles.map((nozzle) => nozzle.name).join(", ")}`
    );
  }

  if (session.tankDippings.length === 0) {
    throw new Error("Cannot close session: No tank dippings recorded");
  }
  if (session.martSales.length === 0) {
    throw new Error("Cannot close session: No mart sales summary recorded");
  }

  // Validation: Product Discharge vs Tank Dipping receipts
  const DISCHARGE_RECEIPT_TOLERANCE_LITRES = 0.01;

  for (const dipping of session.tankDippings) {
    const receipts = Number(dipping.receiptsLitres);
    if (receipts > 0) {
      // Find discharges for this tank in this session
      const discharges = session.productDischarges.filter(d => d.tankId === dipping.tankId);
      
      if (discharges.length === 0) {
        throw new Error(`Cannot close session: Tank dipping declares receipts > 0 but no Product Discharge recorded for tank ${dipping.tankId}`);
      }

      // Sum productDischargedLitres + topUpLitres
      const totalDischarged = discharges.reduce((sum, d) => sum + Number(d.productDischargedLitres) + Number(d.topUpLitres), 0);

      if (Math.abs(receipts - totalDischarged) > DISCHARGE_RECEIPT_TOLERANCE_LITRES) {
        throw new Error(`Cannot close session: Product discharge total (${totalDischarged} L) does not match tank dipping receipts (${receipts} L) for tank ${dipping.tankId}`);
      }
    }
  }

  return db.dailySession.update({
    where: { id: sessionId },
    data: {
      status: "READY_FOR_REVIEW",
      closedAt: new Date(),
      closedBy: userId,
    },
  });
}

export async function approveSession(
  tenantId: string,
  stationId: string,
  userId: string,
  sessionId: string,
  db: Db
): Promise<DailySession> {
  const session = await db.dailySession.findUnique({
    where: { id: sessionId },
  });

  if (!session || session.tenantId !== tenantId) {
    throw new Error("Session not found or tenant mismatch");
  }

  if (session.stationId !== stationId) {
    throw new Error("Station mismatch: session does not belong to the target station");
  }

  if (session.status !== "READY_FOR_REVIEW") {
    throw new Error(`Cannot approve session from status: ${session.status}`);
  }

  return db.dailySession.update({
    where: { id: sessionId },
    data: {
      status: "APPROVED",
    },
  });
}

export async function reopenSession(
  tenantId: string,
  stationId: string,
  userId: string,
  sessionId: string,
  reason: string,
  db: Db
): Promise<DailySession> {
  const session = await db.dailySession.findUnique({
    where: { id: sessionId },
  });

  if (!session || session.tenantId !== tenantId) {
    throw new Error("Session not found or tenant mismatch");
  }

  if (session.stationId !== stationId) {
    throw new Error("Station mismatch: session does not belong to the target station");
  }

  if (session.status !== "APPROVED") {
    throw new Error(`Cannot reopen session from status: ${session.status}`);
  }

  if (!reason || reason.trim().length === 0) {
    throw new Error("A reason must be provided to reopen a session");
  }

  // We append the reopen reason to supervisorNotes
  const newNotes = session.supervisorNotes 
    ? `${session.supervisorNotes}\n\nReopened: ${reason}`
    : `Reopened: ${reason}`;

  return db.dailySession.update({
    where: { id: sessionId },
    data: {
      status: "REOPENED",
      supervisorNotes: newNotes,
    },
  });
}
