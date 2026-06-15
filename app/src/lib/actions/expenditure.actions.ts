"use server";

import { revalidatePath } from "next/cache";
import { withMutation } from "../mutation";
import type { AuthSession } from "../session";
import type { Db } from "../db/types";
import {
  createExpenditure,
  updateExpenditure,
  deleteExpenditure,
} from "../db/expenditure.service";
import {
  createExpenditureSchema,
  updateExpenditureSchema,
  deleteExpenditureSchema,
  type CreateExpenditureInput,
  type UpdateExpenditureInput,
  type DeleteExpenditureInput,
} from "../schemas/expenditure.schema";
import { CORRECTION_ROLES } from "../corrections";

type ActionResponse = {
  success: boolean;
  error?: string;
  data?: { id: string };
};

function errorResponse(error: unknown): ActionResponse {
  return {
    success: false,
    error: error instanceof Error ? error.message : "An unknown error occurred",
  };
}

export async function createExpenditureAction(input: CreateExpenditureInput): Promise<ActionResponse> {
  const parsed = createExpenditureSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const mutation = withMutation(
    {
      entityType: "Expenditure",
      action: "CREATE",
      getStationId: () => parsed.data.stationId,
      getEntityId: (result: { id: string }) => result.id,
      roles: ["SUPERVISOR", "STATION_MANAGER", "ADMIN", "OWNER"],
    },
    async (session: AuthSession, tx: Db): Promise<{ id: string }> => {
      const expenditure = await createExpenditure(tx, {
        ...parsed.data,
        tenantId: session.user.tenantId,
        createdBy: session.user.id,
      });

      return { id: expenditure.id };
    }
  );

  try {
    const result = await mutation();
    revalidatePath("/cash/expenditure");
    return { success: true, data: result };
  } catch (error) {
    return errorResponse(error);
  }
}

export async function updateExpenditureAction(input: UpdateExpenditureInput): Promise<ActionResponse> {
  const parsed = updateExpenditureSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const mutation = withMutation(
    {
      entityType: "Expenditure",
      action: "UPDATE",
      getStationId: () => parsed.data.stationId,
      getEntityId: () => parsed.data.id,
      getAfter: () => ({ correctionReason: parsed.data.correctionReason }),
      roles: CORRECTION_ROLES,
    },
    async (session: AuthSession, tx: Db): Promise<{ id: string }> => {
      const expenditure = await updateExpenditure(tx, {
        ...parsed.data,
        tenantId: session.user.tenantId,
        updatedBy: session.user.id,
      });

      return { id: expenditure.id };
    }
  );

  try {
    const result = await mutation();
    revalidatePath("/cash/expenditure");
    return { success: true, data: result };
  } catch (error) {
    return errorResponse(error);
  }
}

export async function deleteExpenditureAction(input: DeleteExpenditureInput): Promise<ActionResponse> {
  const parsed = deleteExpenditureSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const mutation = withMutation(
    {
      entityType: "Expenditure",
      action: "DELETE",
      getStationId: () => parsed.data.stationId,
      getEntityId: () => parsed.data.id,
      roles: ["SUPERVISOR", "STATION_MANAGER", "ADMIN", "OWNER"],
    },
    async (session: AuthSession, tx: Db): Promise<{ id: string }> => {
      await deleteExpenditure(
        tx,
        parsed.data.id,
        session.user.tenantId,
        parsed.data.stationId,
        parsed.data.dailySessionId
      );

      return { id: parsed.data.id };
    }
  );

  try {
    const result = await mutation();
    revalidatePath("/cash/expenditure");
    return { success: true, data: result };
  } catch (error) {
    return errorResponse(error);
  }
}
