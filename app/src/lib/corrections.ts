import { z } from "zod";
import type { Role } from "./nav-config";

export const CORRECTION_ROLES: Role[] = ["SUPERVISOR", "STATION_MANAGER", "ADMIN", "OWNER"];

export const correctionReasonSchema = z.string()
  .trim()
  .min(8, "Correction reason must explain what is being fixed")
  .max(500, "Correction reason is too long");

export function appendCorrectionNote(existing: string | null | undefined, reason: string): string {
  const note = `Correction: ${reason.trim()}`;
  return existing?.trim() ? `${existing.trim()}\n\n${note}` : note;
}
