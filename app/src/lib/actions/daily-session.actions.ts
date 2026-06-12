"use server";

import { revalidatePath } from "next/cache";
import { withMutation, withApproval } from "../mutation";
import { openTodaySession, closeSession, approveSession, reopenSession } from "../db/daily-session.service";
import { AuthSession, requireRole } from "../session";
import { Db } from "../db/types";

export type ActionResponse = {
  success: boolean;
  error?: string;
};

export const openTodaySessionAction = async (stationId: string): Promise<ActionResponse> => {
  const mutation = withMutation(
    {
      entityType: "DailySession",
      action: "CREATE",
      getStationId: () => stationId,
      getEntityId: (result) => result.id,
      roles: ["SUPERVISOR", "STATION_MANAGER", "ADMIN", "OWNER"],
    },
    async (session: AuthSession, tx: Db) => {
      return openTodaySession(session.user.tenantId, stationId, session.user.id, tx);
    }
  );

  try {
    await mutation();
    revalidatePath("/daily-close");
    revalidatePath("/command-center");
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "An error occurred" };
  }
};

export const closeSessionAction = async (stationId: string, sessionId: string): Promise<ActionResponse> => {
  const mutation = withMutation(
    {
      entityType: "DailySession",
      action: "UPDATE",
      getStationId: () => stationId,
      getEntityId: () => sessionId,
    },
    async (session: AuthSession, tx: Db): Promise<ActionResponse> => {
      requireRole(session, ["SUPERVISOR", "STATION_MANAGER", "ADMIN", "OWNER"]);
      await closeSession(session.user.tenantId, stationId, session.user.id, sessionId, tx);
      return { success: true };
    }
  );

  try {
    const res = await mutation();
    if (res.success) revalidatePath("/daily-close");
    return res;
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "An error occurred" };
  }
};

export const approveSessionAction = async (stationId: string, sessionId: string): Promise<ActionResponse> => {
  const mutation = withApproval(
    {
      entityType: "DailySession",
      action: "APPROVE",
      getStationId: () => stationId,
      getEntityId: () => sessionId,
    },
    async (session: AuthSession, tx: Db): Promise<ActionResponse> => {
      requireRole(session, ["STATION_MANAGER", "ADMIN", "OWNER"]);
      await approveSession(session.user.tenantId, stationId, session.user.id, sessionId, tx);
      return { success: true };
    }
  );

  try {
    const res = await mutation();
    if (res.success) revalidatePath("/daily-close");
    return res;
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "An error occurred" };
  }
};

export const reopenSessionAction = async (
  stationId: string,
  sessionId: string,
  reason: string
): Promise<ActionResponse> => {
  const mutation = withApproval(
    {
      entityType: "DailySession",
      action: "REOPEN",
      getStationId: () => stationId,
      getEntityId: () => sessionId,
    },
    async (session: AuthSession, tx: Db): Promise<ActionResponse> => {
      requireRole(session, ["ADMIN", "OWNER"]);
      await reopenSession(session.user.tenantId, stationId, session.user.id, sessionId, reason, tx);
      return { success: true };
    }
  );

  try {
    const res = await mutation();
    if (res.success) revalidatePath("/daily-close");
    return res;
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "An error occurred" };
  }
};
