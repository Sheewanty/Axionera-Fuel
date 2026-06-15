import { z } from "zod";
import { correctionReasonSchema } from "../corrections";

export const createProductDischargeSchema = z.object({
  stationId: z.string().min(1),
  dailySessionId: z.string().min(1),
  tankId: z.string().min(1),
  productId: z.string().min(1),
  supplierName: z.string().min(1, "Supplier name is required"),
  invoiceNumber: z.string().min(1, "Invoice number is required"),
  invoiceMeasurement: z.number().min(0, "Measurement must be non-negative").finite(),
  productDischargedLitres: z.number().min(0, "Discharged litres must be non-negative").finite(),
  topUpLitres: z.number().min(0, "Top-up must be non-negative").finite(),
  beforeTankLitres: z.number().min(0, "Before tank must be non-negative").finite(),
  afterTankLitres: z.number().min(0, "After tank must be non-negative").finite(),

  // Optionals
  vehicleRegistrationNumber: z.string().optional(),
  driverName: z.string().optional(),
  stationSupervisorName: z.string().optional(),
  couplingHeightCm: z.number().min(0).finite().optional(),
  tbar: z.number().finite().optional(),
  calibrationCertificate: z.string().optional(),
  sealNumbers: z.string().optional(),
  sealNumbersContinued: z.string().optional(),
  compartmentNumber: z.string().optional(),
  stationMeasurement: z.number().min(0).finite().optional(),
  remarks: z.string().optional(),
});

export const updateProductDischargeSchema = createProductDischargeSchema.extend({
  id: z.string().min(1),
  correctionReason: correctionReasonSchema,
});

export const deleteProductDischargeSchema = z.object({
  id: z.string().min(1),
  stationId: z.string().min(1),
  dailySessionId: z.string().min(1),
});
