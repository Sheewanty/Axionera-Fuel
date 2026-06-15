import { z } from "zod";
import { correctionReasonSchema } from "../corrections";

const basePumpReadingSchema = z.object({
  stationId: z.string().min(1, "Station is required"),
  dailySessionId: z.string().min(1, "Daily Session is required"),
  businessDate: z.string().min(1, "Business Date is required"),
  shift: z.enum(["DAY", "NIGHT"]),
  pumpId: z.string().min(1, "Pump is required"),
  nozzleId: z.string().min(1, "Nozzle is required"),
  productId: z.string().min(1, "Product is required"),
  attendantId: z.string().optional(),
  remarks: z.string().optional(),
});

export const OpenPumpReadingSchema = basePumpReadingSchema.extend({
  openingLitre: z.coerce.number().finite("Opening meter must be a valid number").min(0, "Opening meter cannot be negative"),
});

export const ClosePumpReadingSchema = basePumpReadingSchema.extend({
  currentLitre: z.coerce.number().finite("Closing meter must be a valid number").min(0, "Closing meter cannot be negative"),
  cashReceived: z.coerce.number().finite("Cash received must be a valid number").min(0, "Cash received cannot be negative").default(0),
  gocardAmount: z.coerce.number().finite("GO Card / Visa amount must be a valid number").min(0, "GO Card / Visa amount cannot be negative").default(0),
  couponAmount: z.coerce.number().finite("GOIL Coupon amount must be a valid number").min(0, "GOIL Coupon amount cannot be negative").default(0),
  ghqrAmount: z.coerce.number().finite("GHQR / Mobile Money amount must be a valid number").min(0, "GHQR / Mobile Money amount cannot be negative").default(0),
  creditorsAmount: z.coerce.number().finite("Creditors amount must be a valid number").min(0, "Creditors amount cannot be negative").default(0),
});

export const CorrectPumpReadingSchema = ClosePumpReadingSchema.extend({
  id: z.string().min(1, "Pump reading ID is required"),
  openingLitre: z.coerce.number().finite("Opening meter must be a valid number").min(0, "Opening meter cannot be negative"),
  correctionReason: correctionReasonSchema,
});

export type OpenPumpReadingInput = z.infer<typeof OpenPumpReadingSchema>;
export type ClosePumpReadingInput = z.infer<typeof ClosePumpReadingSchema>;
export type CorrectPumpReadingInput = z.infer<typeof CorrectPumpReadingSchema>;
