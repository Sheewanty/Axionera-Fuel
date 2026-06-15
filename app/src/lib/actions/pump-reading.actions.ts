"use server";

import { revalidatePath } from "next/cache";
import {
  ClosePumpReadingInput,
  ClosePumpReadingSchema,
  OpenPumpReadingInput,
  OpenPumpReadingSchema,
} from "../schemas/pump-reading.schema";
import { recordClosingPumpReading, recordOpeningPumpReading } from "../db/pump-reading.service";
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

function validationError(fieldErrors: Record<string, string[]>): ActionResponse {
  return {
    success: false,
    error: "Invalid input data",
    fieldErrors,
  };
}

export async function submitOpeningPumpReading(stationId: string, formData: FormData): Promise<ActionResponse> {
  const rawData = Object.fromEntries(formData.entries());
  const parsed = OpenPumpReadingSchema.safeParse(rawData);

  if (!parsed.success) {
    return validationError(parsed.error.flatten().fieldErrors);
  }

  if (parsed.data.stationId !== stationId) {
    return { success: false, error: "Station ID mismatch" };
  }

  const mutation = withMutation(
    {
      entityType: "PumpReading",
      action: "CREATE",
      getStationId: (data) => data.stationId,
      getEntityId: (result) => result?.id ?? "unknown",
    },
    async (session: AuthSession, tx: Db, data: OpenPumpReadingInput): Promise<ActionResponse> => {
      const reading = await recordOpeningPumpReading(session.user.tenantId, session.user.id, data, tx);
      return { success: true, id: reading.id };
    }
  );

  try {
    const res = await mutation(parsed.data);
    if (res.success) {
      revalidatePath("/forecourt/pump-readings");
      revalidatePath("/daily-close");
    }
    return res;
  } catch (error) {
    return errorResponse(error);
  }
}

export async function submitClosingPumpReading(stationId: string, formData: FormData): Promise<ActionResponse> {
  const rawData = Object.fromEntries(formData.entries());
  const parsed = ClosePumpReadingSchema.safeParse(rawData);

  if (!parsed.success) {
    return validationError(parsed.error.flatten().fieldErrors);
  }

  if (parsed.data.stationId !== stationId) {
    return { success: false, error: "Station ID mismatch" };
  }

  const mutation = withMutation(
    {
      entityType: "PumpReading",
      action: "UPDATE",
      getStationId: (data) => data.stationId,
      getEntityId: (result) => result?.id ?? "unknown",
    },
    async (session: AuthSession, tx: Db, data: ClosePumpReadingInput): Promise<ActionResponse> => {
      const reading = await recordClosingPumpReading(session.user.tenantId, session.user.id, data, tx);
      return { success: true, id: reading.id };
    }
  );

  try {
    const res = await mutation(parsed.data);
    if (res.success) {
      revalidatePath("/forecourt/pump-readings");
      revalidatePath("/daily-close");
    }
    return res;
  } catch (error) {
    return errorResponse(error);
  }
}
