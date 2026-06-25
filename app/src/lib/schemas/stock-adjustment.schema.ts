import { z } from "zod";

export const stockAdjustmentTypeSchema = z.enum([
  "REGULATORY_INSPECTION",
  "STOCK_CORRECTION",
  "EVAPORATION",
  "OTHER",
]);

export const stockAdjustmentDirectionSchema = z.enum(["IN", "OUT"]);
export const stockAdjustmentApprovalStatusSchema = z.enum(["PENDING", "APPROVED", "REJECTED"]);

export const createStockAdjustmentSchema = z
  .object({
    stationId: z.string().min(1, "Station is required"),
    dailySessionId: z.string().min(1, "Daily session is required"),
    tankId: z.string().min(1, "Tank is required"),
    productId: z.string().min(1, "Product is required"),
    businessDate: z.coerce.date(),
    adjustmentType: stockAdjustmentTypeSchema,
    direction: stockAdjustmentDirectionSchema,
    litres: z.coerce.number().positive("Litres must be greater than 0").finite(),
    authorityReason: z.string().trim().optional().or(z.literal("")),
    reference: z.string().trim().optional().or(z.literal("")),
    recordedByName: z.string().trim().optional().or(z.literal("")),
    approvedByName: z.string().trim().optional().or(z.literal("")),
    approvalStatus: stockAdjustmentApprovalStatusSchema.default("APPROVED"),
    remarks: z.string().trim().optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    if (data.adjustmentType === "REGULATORY_INSPECTION" && data.direction !== "OUT") {
      ctx.addIssue({
        code: "custom",
        path: ["direction"],
        message: "Regulatory inspection draw-offs must use Direction OUT",
      });
    }
  });

export type CreateStockAdjustmentSchemaInput = z.infer<typeof createStockAdjustmentSchema>;
