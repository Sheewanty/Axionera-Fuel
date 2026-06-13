"use server";

import { revalidatePath } from "next/cache";
import { CreateTankDippingSchema, CreateTankDippingInput } from "../schemas/tank-dipping.schema";
import { createTankDipping } from "../db/tank-dipping.service";
import { withMutation } from "../mutation";
import { Db } from "../db/types";
import { AuthSession } from "../session";

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

export async function submitTankDipping(stationId: string, formData: FormData): Promise<ActionResponse> {
  const rawData = Object.fromEntries(formData.entries());
  const parsed = CreateTankDippingSchema.safeParse(rawData);

  if (!parsed.success) {
    return {
      success: false,
      error: "Invalid input data",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  if (parsed.data.stationId !== stationId) {
    return { success: false, error: "Station ID mismatch" };
  }

  const mutation = withMutation(
    {
      entityType: "TankDipping",
      action: "CREATE",
      getStationId: (data) => data.stationId,
      getEntityId: (result) => result?.id ?? "unknown",
    },
    async (session: AuthSession, tx: Db, data: CreateTankDippingInput): Promise<ActionResponse> => {
      const dipping = await createTankDipping(session.user.tenantId, session.user.id, data, tx);
      return { success: true, id: dipping.id };
    }
  );

  try {
    const res = await mutation(parsed.data);
    if (res.success) {
      revalidatePath("/forecourt/tank-dipping");
    }
    return res;
  } catch (error) {
    return errorResponse(error);
  }
}
