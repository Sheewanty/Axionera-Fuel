"use server";

import { revalidatePath } from "next/cache";
import { CreatePumpReadingSchema, CreatePumpReadingInput } from "../schemas/pump-reading.schema";
import { createPumpReading } from "../db/pump-reading.service";
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

export async function submitPumpReading(stationId: string, formData: FormData): Promise<ActionResponse> {
  const rawData = Object.fromEntries(formData.entries());
  const parsed = CreatePumpReadingSchema.safeParse(rawData);

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

  // Create the mutation pipeline for the validated data
  const mutation = withMutation(
    {
      entityType: "PumpReading",
      action: "CREATE",
      getStationId: (data) => data.stationId,
      getEntityId: (result) => result?.id ?? "unknown",
    },
    async (session: AuthSession, tx: Db, data: CreatePumpReadingInput): Promise<ActionResponse> => {
      const reading = await createPumpReading(session.user.tenantId, session.user.id, data, tx);
      return { success: true, id: reading.id };
    }
  );

  try {
    const res = await mutation(parsed.data);
    if (res.success) {
      revalidatePath("/forecourt/pump-readings");
    }
    return res;
  } catch (error) {
    return errorResponse(error);
  }
}
