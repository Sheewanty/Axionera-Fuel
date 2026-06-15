"use server";

import { withMutation } from "../mutation";
import { revalidatePath } from "next/cache";
import {
  createProductDischarge,
  updateProductDischarge,
  deleteProductDischarge,
  type CreateProductDischargeInput,
  type UpdateProductDischargeInput,
} from "../db/product-discharge.service";
import { AuthSession } from "../session";
import { Db } from "../db/types";
import {
  createProductDischargeSchema,
  updateProductDischargeSchema,
  deleteProductDischargeSchema,
} from "../schemas/product-discharge.schema";
import { CORRECTION_ROLES } from "../corrections";

export type ActionResponse = {
  success: boolean;
  error?: string;
  data?: { id: string };
};

export type ClientCreateDischargeInput = Omit<CreateProductDischargeInput, "tenantId" | "createdBy">;
export type ClientUpdateDischargeInput = Omit<UpdateProductDischargeInput, "tenantId" | "updatedBy">;

export const createProductDischargeAction = async (input: ClientCreateDischargeInput): Promise<ActionResponse> => {
  const parsed = createProductDischargeSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const mutation = withMutation(
    {
      entityType: "ProductDischarge",
      action: "CREATE",
      getStationId: () => parsed.data.stationId,
      getEntityId: (result: { id: string }) => result.id,
      roles: ["SUPERVISOR", "STATION_MANAGER", "ADMIN", "OWNER"],
    },
    async (session: AuthSession, tx: Db): Promise<{ id: string }> => {
      const discharge = await createProductDischarge(tx, {
        ...parsed.data,
        tenantId: session.user.tenantId,
        createdBy: session.user.id,
      });
      
      return { id: discharge.id };
    }
  );

  try {
    const result = await mutation();
    revalidatePath("/(dashboard)/forecourt/product-discharge", "page");
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "An unknown error occurred" };
  }
};

export const updateProductDischargeAction = async (input: ClientUpdateDischargeInput): Promise<ActionResponse> => {
  const parsed = updateProductDischargeSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const mutation = withMutation(
    {
      entityType: "ProductDischarge",
      action: "UPDATE",
      getStationId: () => parsed.data.stationId,
      getEntityId: () => parsed.data.id,
      getAfter: () => ({ correctionReason: parsed.data.correctionReason }),
      roles: CORRECTION_ROLES,
    },
    async (session: AuthSession, tx: Db): Promise<{ id: string }> => {
      const discharge = await updateProductDischarge(tx, {
        ...parsed.data,
        tenantId: session.user.tenantId,
        updatedBy: session.user.id,
      });
      
      return { id: discharge.id };
    }
  );

  try {
    const result = await mutation();
    revalidatePath("/(dashboard)/forecourt/product-discharge", "page");
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "An unknown error occurred" };
  }
};

export const deleteProductDischargeAction = async (
  input: { id: string; stationId: string; dailySessionId: string }
): Promise<ActionResponse> => {
  const parsed = deleteProductDischargeSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const mutation = withMutation(
    {
      entityType: "ProductDischarge",
      action: "DELETE",
      getStationId: () => parsed.data.stationId,
      getEntityId: () => parsed.data.id,
      roles: ["SUPERVISOR", "STATION_MANAGER", "ADMIN", "OWNER"],
    },
    async (session: AuthSession, tx: Db): Promise<{ id: string }> => {
      await deleteProductDischarge(
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
    revalidatePath("/(dashboard)/forecourt/product-discharge", "page");
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "An unknown error occurred" };
  }
};
