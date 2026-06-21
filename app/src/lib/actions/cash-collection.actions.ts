"use server";

import { revalidatePath } from "next/cache";
import { withMutation } from "../mutation";
import {
  CorrectCashCollectionInput,
  StationCashCollectionInput,
  correctCashCollectionSchema,
  stationCashCollectionSchema,
} from "../schemas/cash-collection.schema";
import { correctCashCollection, createStationCashCollectionSweep } from "../db/cash-collection.service";
import { AuthSession } from "../session";
import { Db } from "../db/types";
import { CORRECTION_ROLES } from "../corrections";

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

  const parsed = stationCashCollectionSchema.safeParse(rawData);
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
    async (session: AuthSession, tx: Db, data: StationCashCollectionInput): Promise<ActionResponse> => {
      const collections = await createStationCashCollectionSweep(session.user.tenantId, session.user.id, data, tx);
      return { success: true, id: collections.map((collection) => collection.id).join(",") };
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

export const correctCashCollectionAction = async (formData: FormData): Promise<ActionResponse> => {
  const rawData = Object.fromEntries(formData.entries());

  const parsed = correctCashCollectionSchema.safeParse(rawData);
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
      action: "UPDATE",
      getStationId: (data) => data.stationId,
      getEntityId: (result) => result?.id ?? "unknown",
      getAfter: () => ({ correctionReason: parsed.data.correctionReason }),
      roles: CORRECTION_ROLES,
    },
    async (session: AuthSession, tx: Db, data: CorrectCashCollectionInput): Promise<ActionResponse> => {
      const collection = await correctCashCollection(session.user.tenantId, session.user.id, data, tx);
      return { success: true, id: collection.id };
    }
  );

  try {
    const res = await mutation(parsed.data);
    if (res.success) {
      revalidatePath("/forecourt/cash-entries");
      revalidatePath("/daily-close");
    }
    return res;
  } catch (error) {
    return errorResponse(error);
  }
};
