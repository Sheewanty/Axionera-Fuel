import { z } from "zod";

export const CreateTankDippingSchema = z.object({
  stationId: z.string().min(1, "Station is required"),
  dailySessionId: z.string().min(1, "Daily Session is required"),
  businessDate: z.string().min(1, "Business Date is required"),
  tankId: z.string().min(1, "Tank is required"),
  productId: z.string().min(1, "Product is required"),
  
  openingStockLitres: z.coerce.number().min(0, "Opening stock cannot be negative"),
  receiptsLitres: z.coerce.number().min(0, "Receipts cannot be negative").default(0),
  meterSoldLitres: z.coerce.number().min(0, "Meter sold cannot be negative"),
  closingStockLitres: z.coerce.number().min(0, "Closing stock cannot be negative"),
  closingDipCm: z.coerce.number().min(0).optional(),
  
  waterTestStatus: z.enum(["CLEAR", "DETECTED", "NOT_TESTED"]),
  remarks: z.string().optional(),
});

export type CreateTankDippingInput = z.infer<typeof CreateTankDippingSchema>;
