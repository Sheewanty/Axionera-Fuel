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

const expenditureCategories = [
  "Salary",
  "Allowance / Bonus",
  "Stationery",
  "Repairs & Maintenance",
  "Utilities",
  "Generator Fuel",
  "Bank Charges",
  "Cleaning",
  "Security",
  "Transport",
  "Lube Bay Supplies",
  "Other",
] as const;

export const createExpenditureSchema = z.object({
  stationId: z.string().min(1, "Station ID is required"),
  dailySessionId: optionalSessionId,
  category: z.string().min(1, "Category is required").refine(
    (value) => (expenditureCategories as readonly string[]).includes(value),
    "Select a valid expenditure category"
  ),
  amount: z.number().finite("Amount must be a valid number").positive("Amount must be greater than zero"),
  // Kept for database/API compatibility during e2e testing. New expenditure flow stores 0.
  paymentToBank: finiteAmount("Payment to bank must be a non-negative number").default(0),
  paidBy: z.string().min(1, "Paid by is required"),
  voucherReference: optionalText,
  approvedBy: optionalText,
  receiptAttached: z.boolean().default(false),
  description: optionalText,
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
