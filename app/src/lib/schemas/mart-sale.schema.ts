import { z } from "zod";
import { correctionReasonSchema } from "../corrections";

const optionalText = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().optional()
);

const nonNegativeAmount = (message: string) =>
  z.number().finite(message).min(0, message);

export const createMartSaleSchema = z.object({
  stationId: z.string().min(1, "Station ID is required"),
  dailySessionId: z.string().min(1, "Daily session is required"),
  openingCash: nonNegativeAmount("Opening cash must be a non-negative number").default(0),
  posSales: nonNegativeAmount("Card sales must be a non-negative number").default(0),
  cashSales: nonNegativeAmount("Cash sales must be a non-negative number").default(0),
  mobileMoney: nonNegativeAmount("MoMo sales must be a non-negative number").default(0),
  returns: nonNegativeAmount("Returns must be a non-negative number").default(0),
  cashCount: nonNegativeAmount("Closing physical cash count must be a non-negative number").default(0),
  remarks: optionalText,
});

export const updateMartSaleSchema = createMartSaleSchema.extend({
  id: z.string().min(1, "Mart sale ID is required"),
  correctionReason: correctionReasonSchema,
});

export type CreateMartSaleInput = z.infer<typeof createMartSaleSchema>;
export type UpdateMartSaleInput = z.infer<typeof updateMartSaleSchema>;
