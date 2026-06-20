"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getRequiredSession, requireSuperAdmin } from "@/lib/session";
import { writeAuditLog } from "@/lib/db/audit.service";

type ActionResponse = {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  data?: { id: string };
};

const subscriptionStatusSchema = z.enum(["TRIAL", "ACTIVE", "SUSPENDED", "CANCELLED"]);
const subscriptionPackageSchema = z.enum(["STARTER", "GROWTH", "PRO", "ENTERPRISE"]);

const platformTenantSchema = z.object({
  companyName: z.string().trim().min(2, "Company name is required"),
  slug: z.string().trim().min(2, "Slug is required").max(50, "Slug is too long").optional().or(z.literal("")),
  billingEmail: z.string().trim().email("Billing email must be valid").optional().or(z.literal("")),
  billingAddress: z.string().trim().optional().or(z.literal("")),
  subscriptionStatus: subscriptionStatusSchema.default("TRIAL"),
  subscriptionPackage: subscriptionPackageSchema.default("STARTER"),
  maxStations: z.coerce.number().int().min(1, "At least one station is required").max(999),
  maxTanks: z.coerce.number().int().min(1, "At least one tank is required").max(999),
  maxPumps: z.coerce.number().int().min(1, "At least one pump is required").max(999),
  ownerName: z.string().trim().min(2, "Owner name is required"),
  ownerEmail: z.string().trim().email("Owner email must be valid").toLowerCase(),
  ownerPassword: z.string().min(8, "Owner password must be at least 8 characters"),
  forcePasswordChange: z.coerce.boolean().default(false),
  stationName: z.string().trim().optional().or(z.literal("")),
  stationCode: z.string().trim().optional().or(z.literal("")),
  stationLocation: z.string().trim().optional().or(z.literal("")),
}).superRefine((data, ctx) => {
  if ((data.stationName && !data.stationCode) || (!data.stationName && data.stationCode)) {
    ctx.addIssue({
      code: "custom",
      path: ["stationName"],
      message: "Provide both station name and station code, or leave both blank",
    });
  }
});

const platformTenantUpdateSchema = z.object({
  tenantId: z.string().min(1, "Tenant is required"),
  name: z.string().trim().min(2, "Tenant name is required"),
  billingEmail: z.string().trim().email("Billing email must be valid").optional().or(z.literal("")),
  billingAddress: z.string().trim().optional().or(z.literal("")),
  subscriptionStatus: subscriptionStatusSchema,
  subscriptionPackage: subscriptionPackageSchema,
  maxStations: z.coerce.number().int().min(1).max(999),
  maxTanks: z.coerce.number().int().min(1).max(999),
  maxPumps: z.coerce.number().int().min(1).max(999),
});

function validationError(error: z.ZodError): ActionResponse {
  return {
    success: false,
    error: "Please correct the highlighted fields.",
    fieldErrors: error.flatten().fieldErrors,
  };
}

function errorResponse(error: unknown): ActionResponse {
  return {
    success: false,
    error: error instanceof Error ? error.message : "An unknown error occurred",
  };
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

export async function createPlatformTenantAction(formData: FormData): Promise<ActionResponse> {
  const parsed = platformTenantSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return validationError(parsed.error);

  try {
    const session = await getRequiredSession();
    requireSuperAdmin(session);
    const data = parsed.data;
    const slug = slugify(data.slug || data.companyName);
    if (!slug) {
      return { success: false, error: "Please correct the highlighted fields.", fieldErrors: { slug: ["Slug is required"] } };
    }

    const passwordHash = await bcrypt.hash(data.ownerPassword, 10);

    const result = await prisma.$transaction(async (tx) => {
      const existingTenant = await tx.tenant.findUnique({ where: { slug } });
      if (existingTenant) throw new Error("A company with this slug already exists");

      const existingUser = await tx.user.findUnique({ where: { email: data.ownerEmail } });
      if (existingUser) throw new Error("A user with this owner email already exists");

      const tenant = await tx.tenant.create({
        data: {
          name: data.companyName,
          slug,
          billingEmail: data.billingEmail || data.ownerEmail,
          billingAddress: data.billingAddress || null,
          subscriptionStatus: data.subscriptionStatus,
          subscriptionPackage: data.subscriptionPackage,
          maxStations: data.maxStations,
          maxTanks: data.maxTanks,
          maxPumps: data.maxPumps,
        },
      });

      const owner = await tx.user.create({
        data: {
          email: data.ownerEmail,
          name: data.ownerName,
          passwordHash,
          avatarInitials: initials(data.ownerName),
          status: "ACTIVE",
          forcePasswordChange: data.forcePasswordChange,
        },
      });

      await tx.membership.create({
        data: {
          tenantId: tenant.id,
          userId: owner.id,
          stationId: "",
          role: "OWNER",
        },
      });

      let stationId: string | null = null;
      if (data.stationName && data.stationCode) {
        const station = await tx.station.create({
          data: {
            tenantId: tenant.id,
            name: data.stationName,
            code: data.stationCode.toUpperCase(),
            location: data.stationLocation || null,
            status: "ACTIVE",
          },
        });
        stationId = station.id;
      }

      await writeAuditLog(
        {
          tenantId: "__platform__",
          stationId: null,
          actorUserId: session.user.id,
          entityType: "Tenant",
          entityId: tenant.id,
          action: "CREATE",
          before: null,
          after: {
            name: tenant.name,
            slug: tenant.slug,
            ownerEmail: owner.email,
            billingEmail: tenant.billingEmail,
            billingAddress: tenant.billingAddress,
            subscriptionStatus: tenant.subscriptionStatus,
            subscriptionPackage: tenant.subscriptionPackage,
            maxStations: tenant.maxStations,
            maxTanks: tenant.maxTanks,
            maxPumps: tenant.maxPumps,
            stationId,
          },
        },
        tx
      );

      return { id: tenant.id };
    });

    revalidatePath("/platform");
    revalidatePath("/platform/subscriptions");
    return { success: true, data: result };
  } catch (error) {
    return errorResponse(error);
  }
}

export async function updatePlatformTenantAction(formData: FormData): Promise<ActionResponse> {
  const parsed = platformTenantUpdateSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return validationError(parsed.error);

  try {
    const session = await getRequiredSession();
    requireSuperAdmin(session);
    const data = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      const before = await tx.tenant.findUnique({ where: { id: data.tenantId } });
      if (!before) throw new Error("Company was not found");

      const tenant = await tx.tenant.update({
        where: { id: data.tenantId },
        data: {
          subscriptionStatus: data.subscriptionStatus,
          name: data.name,
          billingEmail: data.billingEmail || null,
          billingAddress: data.billingAddress || null,
          subscriptionPackage: data.subscriptionPackage,
          maxStations: data.maxStations,
          maxTanks: data.maxTanks,
          maxPumps: data.maxPumps,
        },
      });

      await writeAuditLog(
        {
          tenantId: "__platform__",
          stationId: null,
          actorUserId: session.user.id,
          entityType: "Tenant",
          entityId: tenant.id,
          action: "UPDATE",
          before: {
            subscriptionStatus: before.subscriptionStatus,
            name: before.name,
            billingEmail: before.billingEmail,
            billingAddress: before.billingAddress,
            subscriptionPackage: before.subscriptionPackage,
            maxStations: before.maxStations,
            maxTanks: before.maxTanks,
            maxPumps: before.maxPumps,
          },
          after: {
            subscriptionStatus: tenant.subscriptionStatus,
            name: tenant.name,
            billingEmail: tenant.billingEmail,
            billingAddress: tenant.billingAddress,
            subscriptionPackage: tenant.subscriptionPackage,
            maxStations: tenant.maxStations,
            maxTanks: tenant.maxTanks,
            maxPumps: tenant.maxPumps,
          },
        },
        tx
      );

      return { id: tenant.id };
    });

    revalidatePath("/platform");
    revalidatePath("/platform/subscriptions");
    return { success: true, data: result };
  } catch (error) {
    return errorResponse(error);
  }
}
