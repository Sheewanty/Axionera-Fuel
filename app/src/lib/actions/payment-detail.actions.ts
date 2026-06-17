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

const paymentDetailSchema = z.object({
  stationId: z.string().min(1, "Station is required"),
  dailySessionId: z.string().min(1, "Daily session is required"),
  productId: z.string().optional(),
  channel: z.enum(["GO_CARD", "VISA", "GOIL_COUPON", "YY_COUPON", "GHQR", "CREDITOR"]),
  amount: z.coerce.number().finite("Amount must be valid").positive("Amount must be greater than zero"),
  customerName: z.string().trim().optional(),
  attendantName: z.string().trim().optional(),
  referenceNumber: z.string().trim().optional(),
  serialNumber: z.string().trim().optional(),
  phoneNumber: z.string().trim().optional(),
  status: z.enum(["PENDING", "SUBMITTED_TO_HQ", "SETTLED", "CANCELLED"]).default("PENDING"),
  remarks: z.string().trim().optional(),
}).superRefine((data, ctx) => {
  if (data.channel === "YY_COUPON" && !data.serialNumber) {
    ctx.addIssue({ code: "custom", path: ["serialNumber"], message: "YY Coupon serial number is required" });
  }
  if (data.channel === "GHQR" && !data.referenceNumber) {
    ctx.addIssue({ code: "custom", path: ["referenceNumber"], message: "GHQR/MoMo reference is required" });
  }
  if (data.channel === "CREDITOR" && !data.customerName) {
    ctx.addIssue({ code: "custom", path: ["customerName"], message: "Creditor/customer name is required" });
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

export async function createPaymentDetailAction(formData: FormData): Promise<ActionResponse> {
  const parsed = paymentDetailSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return validationError(parsed.error);

  const mutation = withMutation(
    {
      entityType: "PaymentDetail",
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
        throw new Error(`Cannot record payment detail while session is ${dailySession.status}`);
      }

      if (parsed.data.productId) {
        const product = await tx.product.findFirst({
          where: { id: parsed.data.productId, tenantId: session.user.tenantId },
        });
        if (!product) throw new Error("Product was not found for this company");
      }

      const detail = await tx.paymentDetail.create({
        data: {
          tenantId: session.user.tenantId,
          stationId: parsed.data.stationId,
          dailySessionId: dailySession.id,
          businessDate: dailySession.businessDate,
          productId: parsed.data.productId || null,
          channel: parsed.data.channel,
          amount: parsed.data.amount,
          customerName: parsed.data.customerName || null,
          attendantName: parsed.data.attendantName || null,
          referenceNumber: parsed.data.referenceNumber || null,
          serialNumber: parsed.data.serialNumber || null,
          phoneNumber: parsed.data.phoneNumber || null,
          status: parsed.data.status,
          remarks: parsed.data.remarks || null,
          createdBy: session.user.id,
        },
      });
      return { id: detail.id };
    }
  );

  try {
    const result = await mutation();
    revalidatePath("/cash/payment-details");
    revalidatePath("/daily-close");
    return { success: true, data: result };
  } catch (error) {
    return errorResponse(error);
  }
}
