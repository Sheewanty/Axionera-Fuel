"use server";

import { revalidatePath } from "next/cache";
import { withMutation } from "../mutation";
import type { AuthSession } from "../session";
import type { Db } from "../db/types";
import { createMartSale, updateMartSale } from "../db/mart-sale.service";
import {
  createMartSaleSchema,
  updateMartSaleSchema,
  type CreateMartSaleInput,
  type UpdateMartSaleInput,
} from "../schemas/mart-sale.schema";
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

const MART_ENTRY_ROLES = ["ATTENDANT", "SUPERVISOR", "STATION_MANAGER", "ADMIN", "OWNER"] as const;

export async function createMartSaleAction(input: CreateMartSaleInput): Promise<ActionResponse> {
  const parsed = createMartSaleSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const mutation = withMutation(
    {
      entityType: "MartSale",
      action: "CREATE",
      getStationId: () => parsed.data.stationId,
      getEntityId: (result: { id: string }) => result.id,
      roles: [...MART_ENTRY_ROLES],
    },
    async (session: AuthSession, tx: Db): Promise<{ id: string }> => {
      const martSale = await createMartSale(tx, {
        ...parsed.data,
        tenantId: session.user.tenantId,
        createdBy: session.user.id,
      });

      return { id: martSale.id };
    }
  );

  try {
    const result = await mutation();
    revalidatePath("/mart/sales");
    return { success: true, data: result };
  } catch (error) {
    return errorResponse(error);
  }
}

export async function updateMartSaleAction(input: UpdateMartSaleInput): Promise<ActionResponse> {
  const parsed = updateMartSaleSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const mutation = withMutation(
    {
      entityType: "MartSale",
      action: "UPDATE",
      getStationId: () => parsed.data.stationId,
      getEntityId: () => parsed.data.id,
      getAfter: () => ({ correctionReason: parsed.data.correctionReason }),
      roles: CORRECTION_ROLES,
    },
    async (session: AuthSession, tx: Db): Promise<{ id: string }> => {
      const martSale = await updateMartSale(tx, {
        ...parsed.data,
        tenantId: session.user.tenantId,
        updatedBy: session.user.id,
      });

      return { id: martSale.id };
    }
  );

  try {
    const result = await mutation();
    revalidatePath("/mart/sales");
    return { success: true, data: result };
  } catch (error) {
    return errorResponse(error);
  }
}
