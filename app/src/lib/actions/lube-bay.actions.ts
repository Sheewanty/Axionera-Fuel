"use server";

import { revalidatePath } from "next/cache";
import { withMutation } from "../mutation";
import type { AuthSession } from "../session";
import type { Db } from "../db/types";
import { createLubeBaySale, updateLubeBaySale } from "../db/lube-bay.service";
import {
  createLubeBaySaleSchema,
  updateLubeBaySaleSchema,
  type CreateLubeBaySaleInput,
  type UpdateLubeBaySaleInput,
} from "../schemas/lube-bay.schema";
import { CORRECTION_ROLES } from "../corrections";

type ActionResponse = {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  data?: { id: string };
};

function errorResponse(error: unknown): ActionResponse {
  return {
    success: false,
    error: error instanceof Error ? error.message : "An unknown error occurred",
  };
}

const LUBE_ENTRY_ROLES = ["ATTENDANT", "SUPERVISOR", "STATION_MANAGER", "ADMIN", "OWNER"] as const;

export async function createLubeBaySaleAction(input: CreateLubeBaySaleInput): Promise<ActionResponse> {
  const parsed = createLubeBaySaleSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Please correct the highlighted fields",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const mutation = withMutation(
    {
      entityType: "LubeBaySale",
      action: "CREATE",
      getStationId: () => parsed.data.stationId,
      getEntityId: (result: { id: string }) => result.id,
      roles: [...LUBE_ENTRY_ROLES],
    },
    async (session: AuthSession, tx: Db): Promise<{ id: string }> => {
      const sale = await createLubeBaySale(tx, {
        ...parsed.data,
        tenantId: session.user.tenantId,
        createdBy: session.user.id,
      });

      return { id: sale.id };
    }
  );

  try {
    const result = await mutation();
    revalidatePath("/lube-bay/sales");
    revalidatePath("/daily-close");
    return { success: true, data: result };
  } catch (error) {
    return errorResponse(error);
  }
}

export async function updateLubeBaySaleAction(input: UpdateLubeBaySaleInput): Promise<ActionResponse> {
  const parsed = updateLubeBaySaleSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Please correct the highlighted fields",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const mutation = withMutation(
    {
      entityType: "LubeBaySale",
      action: "UPDATE",
      getStationId: () => parsed.data.stationId,
      getEntityId: () => parsed.data.id,
      getAfter: () => ({ correctionReason: parsed.data.correctionReason }),
      roles: CORRECTION_ROLES,
    },
    async (session: AuthSession, tx: Db): Promise<{ id: string }> => {
      const sale = await updateLubeBaySale(tx, {
        ...parsed.data,
        tenantId: session.user.tenantId,
        updatedBy: session.user.id,
      });

      return { id: sale.id };
    }
  );

  try {
    const result = await mutation();
    revalidatePath("/lube-bay/sales");
    revalidatePath("/daily-close");
    return { success: true, data: result };
  } catch (error) {
    return errorResponse(error);
  }
}
