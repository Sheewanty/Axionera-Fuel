import { z } from "zod";
import { correctionReasonSchema } from "../corrections";

export const cashCollectionSchema = z.object({
  stationId: z.string().min(1, "Station ID is required"),
  dailySessionId: z.string().min(1, "Daily Session ID is required"),
  businessDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  
  amountToBank: z.coerce.number().min(0, "Amount to bank cannot be negative"),
  
  bankCollectionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)").optional().or(z.literal("")),
  bankCollectionReference: z.string().optional(),
  bankSignatureName: z.string().optional(),
  supervisorSignatureName: z.string().optional(),
  remarks: z.string().optional(),
});

export const stationCashCollectionSchema = cashCollectionSchema.omit({
  dailySessionId: true,
  businessDate: true,
}).extend({
  amountToBank: z.coerce.number().positive("Amount to bank must be greater than zero"),
});

export const correctCashCollectionSchema = cashCollectionSchema.extend({
  id: z.string().min(1, "Cash collection ID is required"),
  correctionReason: correctionReasonSchema,
});

export type CashCollectionInput = z.infer<typeof cashCollectionSchema>;
export type StationCashCollectionInput = z.infer<typeof stationCashCollectionSchema>;
export type CorrectCashCollectionInput = z.infer<typeof correctCashCollectionSchema>;
