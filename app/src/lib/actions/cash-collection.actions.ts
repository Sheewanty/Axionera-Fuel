"use server";

import { revalidatePath } from "next/cache";
import { withMutation } from "../mutation";
import { cashCollectionSchema, CashCollectionInput } from "../schemas/cash-collection.schema";
import { createCashCollection } from "../db/cash-collection.service";
import { AuthSession } from "../session";
import { Db } from "../db/types";

export type ActionResponse = {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  id?: string;
};

function errorResponse(error: unknown): ActionResponse {
  return {
    success: false,
    error: error instanceof Error ? error.message : "An unknown error occurred",
  };
}

export const submitCashCollection = async (formData: FormData): Promise<ActionResponse> => {
  const rawData = Object.fromEntries(formData.entries());

  const parsed = cashCollectionSchema.safeParse(rawData);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const mutation = withMutation(
    {
      entityType: "CashCollection",
      action: "CREATE",
      getStationId: (data) => data.stationId,
      getEntityId: (result) => result?.id ?? "unknown",
    },
    async (session: AuthSession, tx: Db, data: CashCollectionInput): Promise<ActionResponse> => {
      const collection = await createCashCollection(session.user.tenantId, session.user.id, data, tx);
      return { success: true, id: collection.id };
    }
  );

  try {
    const res = await mutation(parsed.data);
    if (res.success) {
      revalidatePath("/forecourt/cash-entries");
    }
    return res;
  } catch (error) {
    return errorResponse(error);
  }
};
