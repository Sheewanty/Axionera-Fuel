"use server";

import { revalidatePath } from "next/cache";
import { withMutation } from "@/lib/mutation";
import type { AuthSession } from "@/lib/session";
import type { Db } from "@/lib/db/types";
import { createStockAdjustment } from "@/lib/db/stock-adjustment.service";
import { recalculateTankDippingsForSessionProduct } from "@/lib/db/tank-dipping.service";
import {
  createStockAdjustmentSchema,
  type CreateStockAdjustmentSchemaInput,
} from "@/lib/schemas/stock-adjustment.schema";

export type StockAdjustmentActionResponse = {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  data?: { id: string };
};

function errorResponse(error: unknown): StockAdjustmentActionResponse {
  return {
    success: false,
    error: error instanceof Error ? error.message : "An unknown error occurred",
  };
}

export async function createStockAdjustmentAction(
  input: CreateStockAdjustmentSchemaInput
): Promise<StockAdjustmentActionResponse> {
  const parsed = createStockAdjustmentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Invalid input data",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const mutation = withMutation(
    {
      entityType: "StockAdjustment",
      action: "CREATE",
      getStationId: () => parsed.data.stationId,
      getEntityId: (result: { id: string }) => result.id,
      roles: ["SUPERVISOR", "STATION_MANAGER", "ADMIN", "OWNER"],
    },
    async (session: AuthSession, tx: Db): Promise<{ id: string }> => {
      const adjustment = await createStockAdjustment(tx, {
        ...parsed.data,
        tenantId: session.user.tenantId,
        authorityReason: parsed.data.authorityReason || null,
        reference: parsed.data.reference || null,
        recordedByName: parsed.data.recordedByName || null,
        approvedByName: parsed.data.approvedByName || null,
        remarks: parsed.data.remarks || null,
        createdBy: session.user.id,
      });

      await recalculateTankDippingsForSessionProduct(
        session.user.tenantId,
        parsed.data.dailySessionId,
        parsed.data.productId,
        tx
      );

      return { id: adjustment.id };
    }
  );

  try {
    const result = await mutation();
    revalidatePath("/forecourt/stock-adjustments");
    revalidatePath("/forecourt/tank-dipping");
    revalidatePath("/forecourt/variance-review");
    revalidatePath("/daily-close");
    revalidatePath("/reports/tank-loss");
    return { success: true, data: result };
  } catch (error) {
    return errorResponse(error);
  }
}
