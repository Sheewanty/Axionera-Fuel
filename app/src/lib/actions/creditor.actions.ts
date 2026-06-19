"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withMutation } from "@/lib/mutation";
import type { AuthSession } from "@/lib/session";
import type { Db } from "@/lib/db/types";

type ActionResponse = {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  data?: { id: string };
};

const optionalText = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().optional()
);

const optionalNumber = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.coerce.number().finite().min(0).optional()
);

const createCreditorSchema = z.object({
  stationId: z.string().min(1, "Station is required"),
  name: z.string().trim().min(1, "Debtor name is required"),
  phone: optionalText,
  email: optionalText,
  creditLimit: optionalNumber,
  notes: optionalText,
});

const creditorLedgerSchema = z.object({
  stationId: z.string().min(1, "Station is required"),
  dailySessionId: z.string().min(1, "Daily session is required"),
  creditorId: z.string().min(1, "Debtor is required"),
  type: z.enum(["SALE", "PAYMENT"]),
  amount: z.coerce.number().finite("Amount must be valid").positive("Amount must be greater than zero"),
  productId: optionalText,
  paymentMethod: z.enum(["CASH", "CHEQUE", "CARD", "MOMO"]).optional(),
  chequeNumber: optionalText,
  chequeName: optionalText,
  chequeBank: optionalText,
  chequeBranch: optionalText,
  chequeClearingDate: optionalText,
  cashReceivedDate: optionalText,
  cardDetails: optionalText,
  momoOperator: optionalText,
  momoNumber: optionalText,
  referenceNumber: optionalText,
  remarks: optionalText,
}).superRefine((data, ctx) => {
  if (data.type === "PAYMENT" && !data.paymentMethod) {
    ctx.addIssue({ code: "custom", path: ["paymentMethod"], message: "Payment method is required" });
  }
  if (data.type === "SALE" && data.paymentMethod) {
    ctx.addIssue({ code: "custom", path: ["paymentMethod"], message: "Payment method is only used for payments" });
  }
  if (data.paymentMethod === "CHEQUE") {
    for (const field of ["chequeNumber", "chequeName", "chequeBank", "chequeBranch", "chequeClearingDate"] as const) {
      if (!data[field]) {
        ctx.addIssue({ code: "custom", path: [field], message: "Required for cheque payments" });
      }
    }
  }
  if (data.paymentMethod === "CASH" && !data.cashReceivedDate) {
    ctx.addIssue({ code: "custom", path: ["cashReceivedDate"], message: "Cash payment date is required" });
  }
  if (data.paymentMethod === "CARD" && !data.cardDetails) {
    ctx.addIssue({ code: "custom", path: ["cardDetails"], message: "Card details are required" });
  }
  if (data.paymentMethod === "MOMO") {
    if (!data.momoOperator) {
      ctx.addIssue({ code: "custom", path: ["momoOperator"], message: "MoMo operator is required" });
    }
    if (!data.momoNumber) {
      ctx.addIssue({ code: "custom", path: ["momoNumber"], message: "MoMo number is required" });
    }
  }
});

function validationError(error: z.ZodError): ActionResponse {
  return {
    success: false,
    error: "Please correct the highlighted fields.",
    fieldErrors: error.flatten().fieldErrors,
  };
}

function errorResponse(error: unknown): ActionResponse {
  return {
    success: false,
    error: error instanceof Error ? error.message : "An unknown error occurred",
  };
}

export async function createCreditorAction(formData: FormData): Promise<ActionResponse> {
  const parsed = createCreditorSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return validationError(parsed.error);

  const mutation = withMutation(
    {
      entityType: "Creditor",
      action: "CREATE",
      getStationId: () => parsed.data.stationId,
      getEntityId: (result: { id: string }) => result.id,
      roles: ["SUPERVISOR", "STATION_MANAGER", "ADMIN", "OWNER", "ACCOUNTANT"],
    },
    async (session: AuthSession, tx: Db): Promise<{ id: string }> => {
      const station = await tx.station.findFirst({
        where: { id: parsed.data.stationId, tenantId: session.user.tenantId, status: "ACTIVE" },
      });
      if (!station) throw new Error("Station was not found for this company");

      const creditor = await tx.creditor.create({
        data: {
          tenantId: session.user.tenantId,
          stationId: parsed.data.stationId,
          name: parsed.data.name,
          phone: parsed.data.phone ?? null,
          email: parsed.data.email ?? null,
          creditLimit: parsed.data.creditLimit ?? null,
          notes: parsed.data.notes ?? null,
          createdBy: session.user.id,
        },
      });
      return { id: creditor.id };
    }
  );

  try {
    const result = await mutation();
    revalidatePath("/cash/creditors");
    revalidatePath("/setup/debtors");
    return { success: true, data: result };
  } catch (error) {
    return errorResponse(error);
  }
}

export async function createCreditorLedgerEntryAction(formData: FormData): Promise<ActionResponse> {
  const parsed = creditorLedgerSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return validationError(parsed.error);

  const mutation = withMutation(
    {
      entityType: "CreditorLedgerEntry",
      action: "CREATE",
      getStationId: () => parsed.data.stationId,
      getEntityId: (result: { id: string }) => result.id,
      roles: ["SUPERVISOR", "STATION_MANAGER", "ADMIN", "OWNER", "ACCOUNTANT"],
    },
    async (session: AuthSession, tx: Db): Promise<{ id: string }> => {
      const dailySession = await tx.dailySession.findFirst({
        where: {
          id: parsed.data.dailySessionId,
          tenantId: session.user.tenantId,
          stationId: parsed.data.stationId,
        },
      });
      if (!dailySession) throw new Error("Daily session was not found");
      if (dailySession.status !== "OPEN" && dailySession.status !== "REOPENED") {
        throw new Error(`Cannot record creditor entry while session is ${dailySession.status}`);
      }

      const creditor = await tx.creditor.findFirst({
        where: {
          id: parsed.data.creditorId,
          tenantId: session.user.tenantId,
          stationId: parsed.data.stationId,
          status: "ACTIVE",
        },
      });
      if (!creditor) throw new Error("Active debtor was not found for this station");

      if (parsed.data.productId) {
        const product = await tx.product.findFirst({
          where: { id: parsed.data.productId, tenantId: session.user.tenantId, isActive: true },
        });
        if (!product) throw new Error("Product was not found for this company");
      }

      const entry = await tx.creditorLedgerEntry.create({
        data: {
          tenantId: session.user.tenantId,
          stationId: parsed.data.stationId,
          dailySessionId: dailySession.id,
          creditorId: parsed.data.creditorId,
          businessDate: dailySession.businessDate,
          type: parsed.data.type,
          amount: parsed.data.amount,
          productId: parsed.data.productId ?? null,
          paymentMethod: parsed.data.type === "PAYMENT" ? parsed.data.paymentMethod ?? null : null,
          chequeNumber: parsed.data.chequeNumber ?? null,
          chequeName: parsed.data.chequeName ?? null,
          chequeBank: parsed.data.chequeBank ?? null,
          chequeBranch: parsed.data.chequeBranch ?? null,
          chequeClearingDate: parsed.data.chequeClearingDate ? new Date(parsed.data.chequeClearingDate) : null,
          cashReceivedDate: parsed.data.cashReceivedDate ? new Date(parsed.data.cashReceivedDate) : null,
          cardDetails: parsed.data.cardDetails ?? null,
          momoOperator: parsed.data.momoOperator ?? null,
          momoNumber: parsed.data.momoNumber ?? null,
          referenceNumber: parsed.data.referenceNumber ?? null,
          remarks: parsed.data.remarks ?? null,
          createdBy: session.user.id,
        },
      });
      return { id: entry.id };
    }
  );

  try {
    const result = await mutation();
    revalidatePath("/cash/creditors");
    revalidatePath("/setup/debtors");
    revalidatePath("/forecourt/cash-entries");
    revalidatePath("/daily-close");
    return { success: true, data: result };
  } catch (error) {
    return errorResponse(error);
  }
}
