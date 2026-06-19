import { z } from "zod";
import { correctionReasonSchema } from "../corrections";

export const LUBE_VEHICLE_CATEGORIES = [
  "Motorcycles & Tricycles",
  "Heavy Duty & Commercial Trucks",
  "Light Commercial Vehicles",
  "SUV and Crossovers",
  "Salon and Sedans",
] as const;

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

const positiveQuantity = z.coerce
  .number()
  .finite("Quantity must be a valid number")
  .positive("Quantity must be greater than zero");

export const lubeBayPaymentModeSchema = z.enum(["CASH", "MOMO", "CARD", "CREDIT"]);
export const lubeBayVehicleCategorySchema = z.enum(LUBE_VEHICLE_CATEGORIES);

export const lubeBayLineSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  quantity: positiveQuantity,
});

export const createLubeBaySaleSchema = z.object({
  stationId: z.string().min(1, "Station is required"),
  dailySessionId: z.string().min(1, "Daily session is required"),
  vehicleReg: z.string().trim().min(2, "Vehicle registration is required").max(30, "Vehicle registration is too long"),
  customerName: optionalText,
  customerPhone: optionalText,
  serviceTypeId: z.string().min(1, "Service type is required"),
  vehicleCategory: lubeBayVehicleCategorySchema,
  lines: z.array(lubeBayLineSchema).min(1, "Add at least one product line"),
  labourCharge: nonNegativeAmount("Labour charge").default(0),
  discount: nonNegativeAmount("Discount").default(0),
  paymentMode: lubeBayPaymentModeSchema.default("CASH"),
  creditorId: optionalId,
  momoOperator: optionalText,
  momoNumber: optionalText,
  cardDetails: optionalText,
  technicianName: optionalText,
  remarks: optionalText,
}).superRefine((value, ctx) => {
  if (value.paymentMode === "CREDIT" && !value.creditorId) {
    ctx.addIssue({ code: "custom", path: ["creditorId"], message: "Select a registered creditor for credit sales" });
  }
  if (value.paymentMode === "MOMO") {
    if (!value.momoOperator) {
      ctx.addIssue({ code: "custom", path: ["momoOperator"], message: "MoMo operator is required" });
    }
    if (!value.momoNumber) {
      ctx.addIssue({ code: "custom", path: ["momoNumber"], message: "MoMo number is required" });
    }
  }
  if (value.paymentMode === "CARD" && !value.cardDetails) {
    ctx.addIssue({ code: "custom", path: ["cardDetails"], message: "Card details are required" });
  }
});

export const updateLubeBaySaleSchema = createLubeBaySaleSchema.extend({
  id: z.string().min(1, "Lube bay sale ID is required"),
  correctionReason: correctionReasonSchema,
});

export const lubeBayServiceTypeSchema = z.object({
  id: z.string().optional(),
  stationId: optionalId,
  name: z.string().trim().min(2, "Service type is required").max(80, "Service type is too long"),
  vehicleCategory: lubeBayVehicleCategorySchema,
  defaultLabourCharge: nonNegativeAmount("Default labour charge").default(0),
  isActive: z.coerce.boolean().default(true),
});

export const lubeBayMomoOperatorSchema = z.object({
  id: z.string().optional(),
  stationId: optionalId,
  name: z.string().trim().min(2, "MoMo operator is required").max(40, "MoMo operator name is too long"),
  isActive: z.coerce.boolean().default(true),
});

export type CreateLubeBaySaleInput = z.infer<typeof createLubeBaySaleSchema>;
export type UpdateLubeBaySaleInput = z.infer<typeof updateLubeBaySaleSchema>;
export type LubeBayServiceTypeInput = z.infer<typeof lubeBayServiceTypeSchema>;
export type LubeBayMomoOperatorInput = z.infer<typeof lubeBayMomoOperatorSchema>;
