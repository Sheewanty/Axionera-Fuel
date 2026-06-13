import { z } from "zod";

export const CreatePumpReadingSchema = z.object({
  stationId: z.string().min(1, "Station is required"),
  dailySessionId: z.string().min(1, "Daily Session is required"),
  businessDate: z.string().min(1, "Business Date is required"),
  shift: z.enum(["DAY", "NIGHT"]),
  pumpId: z.string().min(1, "Pump is required"),
  nozzleId: z.string().min(1, "Nozzle is required"),
  productId: z.string().min(1, "Product is required"),
  attendantId: z.string().optional(),
  
  // Readings & Cash
  previousLitre: z.coerce.number().min(0, "Previous meter cannot be negative"),
  currentLitre: z.coerce.number().min(0, "Current meter cannot be negative"),
  pricePerLitre: z.coerce.number().min(0.01, "Price per litre must be greater than zero"),
  cashReceived: z.coerce.number().min(0, "Cash received cannot be negative").default(0),
  
  // HQ Settlement
  gocardAmount: z.coerce.number().min(0, "GO Card / Visa amount cannot be negative").default(0),
  couponAmount: z.coerce.number().min(0, "GOIL Coupon amount cannot be negative").default(0),
  ghqrAmount: z.coerce.number().min(0, "GHQR / Mobile Money amount cannot be negative").default(0),
  creditorsAmount: z.coerce.number().min(0, "Creditors amount cannot be negative").default(0),
  
  remarks: z.string().optional(),
}).refine(data => data.currentLitre >= data.previousLitre, {
  message: "Current meter reading cannot be less than previous",
  path: ["currentLitre"],
});

export type CreatePumpReadingInput = z.infer<typeof CreatePumpReadingSchema>;
