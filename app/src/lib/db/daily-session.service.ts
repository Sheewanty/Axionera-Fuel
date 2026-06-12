import { DailySession } from "@prisma/client";
import { Db } from "./types";

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
      // expenditures: true, // TODO: Expenditure validation
      // martSales: true, // TODO: validate mart sales
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
  if (session.tankDippings.length === 0) {
    throw new Error("Cannot close session: No tank dippings recorded");
  }
  if (session.cashCollections.length === 0) {
    throw new Error("Cannot close session: No cash collections recorded");
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
