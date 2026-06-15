import { z } from "zod";
import { correctionReasonSchema } from "../corrections";

const optionalText = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().optional()
);

const optionalSessionId = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.string().min(1).optional()
);

const finiteAmount = (message: string) =>
  z.number().finite(message).min(0, message);

export const createExpenditureSchema = z.object({
  stationId: z.string().min(1, "Station ID is required"),
  dailySessionId: optionalSessionId,
  category: z.string().min(1, "Category is required"),
  amount: z.number().finite("Amount must be a valid number").positive("Amount must be greater than zero"),
  paymentToBank: finiteAmount("Payment to bank must be a non-negative number").default(0),
  paidBy: z.string().min(1, "Paid by is required"),
  voucherReference: optionalText,
  approvedBy: optionalText,
  receiptAttached: z.boolean().default(false),
  description: optionalText,
}).refine((data) => data.paymentToBank <= data.amount, {
  message: "Payment to bank cannot exceed expenditure amount",
  path: ["paymentToBank"],
});

export const updateExpenditureSchema = createExpenditureSchema.extend({
  id: z.string().min(1, "Expenditure ID is required"),
  correctionReason: correctionReasonSchema,
});

export const deleteExpenditureSchema = z.object({
  id: z.string().min(1, "Expenditure ID is required"),
  stationId: z.string().min(1, "Station ID is required"),
  dailySessionId: optionalSessionId,
});

export type CreateExpenditureInput = z.infer<typeof createExpenditureSchema>;
export type UpdateExpenditureInput = z.infer<typeof updateExpenditureSchema>;
export type DeleteExpenditureInput = z.infer<typeof deleteExpenditureSchema>;
