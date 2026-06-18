import { z } from "zod";
import { correctionReasonSchema } from "../corrections";

const optionalText = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().trim().optional()
);

const optionalId = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().optional()
);

const nonNegativeAmount = (label: string) =>
  z.coerce.number().finite(`${label} must be a valid number`).min(0, `${label} cannot be negative`);

export const createLubeBaySaleSchema = z.object({
  stationId: z.string().min(1, "Station is required"),
  dailySessionId: z.string().min(1, "Daily session is required"),
  vehicleReg: z.string().trim().min(2, "Vehicle registration is required").max(30, "Vehicle registration is too long"),
  customerName: optionalText,
  customerPhone: optionalText,
  serviceType: z.string().trim().min(2, "Service type is required").max(80, "Service type is too long"),
  lubricantProductId: optionalId,
  quantity: nonNegativeAmount("Quantity").default(0),
  unitPrice: nonNegativeAmount("Unit price").default(0),
  labourCharge: nonNegativeAmount("Labour charge").default(0),
  partsCharge: nonNegativeAmount("Parts charge").default(0),
  discount: nonNegativeAmount("Discount").default(0),
  cashAmount: nonNegativeAmount("Cash amount").default(0),
  cardAmount: nonNegativeAmount("Card amount").default(0),
  momoAmount: nonNegativeAmount("MoMo amount").default(0),
  creditorAmount: nonNegativeAmount("Creditor amount").default(0),
  creditorId: optionalId,
  technicianName: optionalText,
  supervisorName: optionalText,
  remarks: optionalText,
}).superRefine((value, ctx) => {
  if (value.quantity > 0 && !value.lubricantProductId) {
    ctx.addIssue({ code: "custom", path: ["lubricantProductId"], message: "Select the lubricant product used" });
  }
  if (value.quantity > 0 && value.unitPrice <= 0) {
    ctx.addIssue({ code: "custom", path: ["unitPrice"], message: "Unit price is required when quantity is entered" });
  }
  if (value.creditorAmount > 0 && !value.creditorId) {
    ctx.addIssue({ code: "custom", path: ["creditorId"], message: "Select a registered creditor for credit sales" });
  }
  if (value.creditorId && value.creditorAmount <= 0) {
    ctx.addIssue({ code: "custom", path: ["creditorAmount"], message: "Enter the credit sale amount for the selected creditor" });
  }
});

export const updateLubeBaySaleSchema = createLubeBaySaleSchema.extend({
  id: z.string().min(1, "Lube bay sale ID is required"),
  correctionReason: correctionReasonSchema,
});

export type CreateLubeBaySaleInput = z.infer<typeof createLubeBaySaleSchema>;
export type UpdateLubeBaySaleInput = z.infer<typeof updateLubeBaySaleSchema>;
