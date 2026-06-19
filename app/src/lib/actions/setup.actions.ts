"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withMutation } from "@/lib/mutation";
import type { Db } from "@/lib/db/types";
import { getRequiredSession, requireSuperAdmin, type AuthSession } from "@/lib/session";
import { writeAuditLog } from "@/lib/db/audit.service";
import { saveLubeBayMomoOperator, saveLubeBayServiceType } from "@/lib/db/lube-bay.service";
import { lubeBayMomoOperatorSchema, lubeBayServiceTypeSchema } from "@/lib/schemas/lube-bay.schema";

type ActionResponse = {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  data?: { id: string };
};

const WRITE_ROLES = ["OWNER", "ADMIN"] as const;

const statusSchema = z.enum(["ACTIVE", "INACTIVE"]);
const productCategorySchema = z.enum(["FUEL", "LUBRICANT", "OTHER"]);
const roleSchema = z.enum([
  "OWNER",
  "ADMIN",
  "STATION_MANAGER",
  "SUPERVISOR",
  "ATTENDANT",
  "ACCOUNTANT",
  "AUDITOR",
]);

const optionalText = z.string().trim().optional().transform((value) => value || null);

const companySchema = z.object({
  name: z.string().trim().min(2, "Company name is required"),
  billingEmail: z.string().trim().email("Billing email must be valid").optional().or(z.literal("")),
});

const createTenantSchema = z.object({
  companyName: z.string().trim().min(2, "Company name is required"),
  slug: z.string().trim().min(2, "Slug is required").max(50, "Slug is too long").optional().or(z.literal("")),
  billingEmail: z.string().trim().email("Billing email must be valid").optional().or(z.literal("")),
  ownerName: z.string().trim().min(2, "Owner name is required"),
  ownerEmail: z.string().trim().email("Owner email must be valid").toLowerCase(),
  ownerPassword: z.string().min(8, "Owner password must be at least 8 characters"),
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

const stationSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Station name is required"),
  code: z.string().trim().min(2, "Station code is required").max(20, "Station code is too long"),
  location: optionalText,
  status: statusSchema.default("ACTIVE"),
});

const productSchema = z.object({
  id: z.string().optional(),
  stationId: z.string().min(1, "Station is required"),
  name: z.string().trim().min(2, "Product name is required"),
  category: productCategorySchema.default("FUEL"),
  isActive: z.coerce.boolean().default(true),
  pricePerLitre: z.coerce
    .number()
    .finite("Price must be a valid number")
    .positive("Price must be greater than zero")
    .optional(),
});

const priceSchema = z.object({
  stationId: z.string().min(1, "Station is required"),
  productId: z.string().min(1, "Product is required"),
  pricePerLitre: z.coerce
    .number()
    .finite("Price must be a valid number")
    .positive("Price must be greater than zero"),
});

const tankSchema = z.object({
  id: z.string().optional(),
  stationId: z.string().min(1, "Station is required"),
  productId: z.string().min(1, "Product is required"),
  name: z.string().trim().min(2, "Tank name is required"),
  capacityLitres: z.coerce
    .number()
    .finite("Capacity must be a valid number")
    .positive("Capacity must be greater than zero"),
  status: statusSchema.default("ACTIVE"),
});

const pumpSchema = z.object({
  id: z.string().optional(),
  stationId: z.string().min(1, "Station is required"),
  name: z.string().trim().min(2, "Pump name is required"),
  status: statusSchema.default("ACTIVE"),
});

const nozzleSchema = z.object({
  id: z.string().optional(),
  stationId: z.string().min(1, "Station is required"),
  pumpId: z.string().min(1, "Pump is required"),
  productId: z.string().min(1, "Product is required"),
  name: z.string().trim().min(1, "Nozzle name is required"),
  meterCode: optionalText,
  status: statusSchema.default("ACTIVE"),
});

const userSchema = z.object({
  name: z.string().trim().min(2, "Name is required"),
  email: z.string().trim().email("Email must be valid").toLowerCase(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: roleSchema,
  stationId: z.string().optional().default(""),
  status: statusSchema.default("ACTIVE"),
});

function parseForm<TSchema extends z.ZodType>(schema: TSchema, formData: FormData) {
  return schema.safeParse(Object.fromEntries(formData.entries()));
}

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

async function assertStation(tx: Db, tenantId: string, stationId: string) {
  const station = await tx.station.findFirst({ where: { id: stationId, tenantId } });
  if (!station) throw new Error("Station was not found for this company");
  return station;
}

async function assertProduct(tx: Db, tenantId: string, productId: string) {
  const product = await tx.product.findFirst({ where: { id: productId, tenantId } });
  if (!product) throw new Error("Product was not found for this company");
  return product;
}

async function assertTenantCanAdd(tx: Db, tenantId: string, resource: "station" | "tank" | "pump") {
  const tenant = await tx.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new Error("Company was not found");
  if (tenant.subscriptionStatus === "SUSPENDED" || tenant.subscriptionStatus === "CANCELLED") {
    throw new Error("This company is deactivated. Contact Axionera support.");
  }

  if (resource === "station") {
    const count = await tx.station.count({ where: { tenantId } });
    if (count >= tenant.maxStations) {
      throw new Error(`Station limit reached for the ${tenant.subscriptionPackage} package (${tenant.maxStations}).`);
    }
  }

  if (resource === "tank") {
    const count = await tx.tank.count({ where: { tenantId } });
    if (count >= tenant.maxTanks) {
      throw new Error(`Tank limit reached for the ${tenant.subscriptionPackage} package (${tenant.maxTanks}).`);
    }
  }

  if (resource === "pump") {
    const count = await tx.pump.count({ where: { tenantId } });
    if (count >= tenant.maxPumps) {
      throw new Error(`Pump limit reached for the ${tenant.subscriptionPackage} package (${tenant.maxPumps}).`);
    }
  }
}

export async function updateCompanyAction(formData: FormData): Promise<ActionResponse> {
  const parsed = parseForm(companySchema, formData);
  if (!parsed.success) return validationError(parsed.error);
  const data = parsed.data as z.infer<typeof companySchema>;

  const mutation = withMutation(
    {
      entityType: "Tenant",
      action: "UPDATE",
      getEntityId: (result: { id: string }) => result.id,
      roles: [...WRITE_ROLES],
    },
    async (session: AuthSession, tx: Db) => {
      const tenant = await tx.tenant.update({
        where: { id: session.user.tenantId },
        data: {
          name: data.name,
          billingEmail: data.billingEmail || null,
        },
      });
      return { id: tenant.id };
    }
  );

  try {
    const result = await mutation();
    revalidatePath("/setup/company");
    return { success: true, data: result };
  } catch (error) {
    return errorResponse(error);
  }
}

export async function createTenantAction(formData: FormData): Promise<ActionResponse> {
  const parsed = parseForm(createTenantSchema, formData);
  if (!parsed.success) return validationError(parsed.error);
  const data = parsed.data as z.infer<typeof createTenantSchema>;

  try {
    const session = await getRequiredSession();
    requireSuperAdmin(session);

    const slug = slugify(data.slug || data.companyName);
    if (!slug) {
      return {
        success: false,
        error: "Please correct the highlighted fields.",
        fieldErrors: { slug: ["Slug is required"] },
      };
    }

    const passwordHash = await bcrypt.hash(data.ownerPassword, 10);

    const result = await prisma.$transaction(async (tx) => {
      const existingTenant = await tx.tenant.findUnique({ where: { slug } });
      if (existingTenant) throw new Error("A company with this slug already exists");

      const existingUser = await tx.user.findUnique({ where: { email: data.ownerEmail } });
      if (existingUser) {
        throw new Error("A user with this owner email already exists. Use a different owner email.");
      }

      const tenant = await tx.tenant.create({
        data: {
          name: data.companyName,
          slug,
          billingEmail: data.billingEmail || data.ownerEmail,
          subscriptionStatus: "TRIAL",
        },
      });

      const owner = await tx.user.create({
        data: {
          email: data.ownerEmail,
          name: data.ownerName,
          passwordHash,
          avatarInitials: initials(data.ownerName),
          status: "ACTIVE",
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

export async function saveStationAction(formData: FormData): Promise<ActionResponse> {
  const parsed = parseForm(stationSchema, formData);
  if (!parsed.success) return validationError(parsed.error);
  const data = parsed.data as z.infer<typeof stationSchema>;

  const mutation = withMutation(
    {
      entityType: "Station",
      action: data.id ? "UPDATE" : "CREATE",
      getStationId: () => data.id,
      getEntityId: (result: { id: string }) => result.id,
      roles: [...WRITE_ROLES],
    },
    async (session: AuthSession, tx: Db) => {
      if (!data.id) await assertTenantCanAdd(tx, session.user.tenantId, "station");
      const station = data.id
        ? await tx.station.update({
            where: { id: data.id, tenantId: session.user.tenantId },
            data: {
              name: data.name,
              code: data.code.toUpperCase(),
              location: data.location,
              status: data.status,
            },
          })
        : await tx.station.create({
            data: {
              tenantId: session.user.tenantId,
              name: data.name,
              code: data.code.toUpperCase(),
              location: data.location,
              status: data.status,
            },
          });
      return { id: station.id };
    }
  );

  try {
    const result = await mutation();
    revalidatePath("/setup/stations");
    return { success: true, data: result };
  } catch (error) {
    return errorResponse(error);
  }
}

export async function saveProductAction(formData: FormData): Promise<ActionResponse> {
  const parsed = parseForm(productSchema, formData);
  if (!parsed.success) return validationError(parsed.error);
  const data = parsed.data as z.infer<typeof productSchema>;

  const mutation = withMutation(
    {
      entityType: "Product",
      action: data.id ? "UPDATE" : "CREATE",
      getStationId: () => data.stationId,
      getEntityId: (result: { id: string }) => result.id,
      roles: [...WRITE_ROLES],
    },
    async (session: AuthSession, tx: Db) => {
      await assertStation(tx, session.user.tenantId, data.stationId);

      const product = data.id
        ? await tx.product.update({
            where: { id: data.id, tenantId: session.user.tenantId },
            data: {
              name: data.name,
              category: data.category,
              isActive: data.isActive,
            },
          })
        : await tx.product.create({
            data: {
              tenantId: session.user.tenantId,
              name: data.name,
              category: data.category,
              isActive: data.isActive,
            },
          });

      if (data.pricePerLitre) {
        await tx.priceHistory.updateMany({
          where: {
            tenantId: session.user.tenantId,
            stationId: data.stationId,
            productId: product.id,
            effectiveTo: null,
          },
          data: { effectiveTo: new Date() },
        });
        await tx.priceHistory.create({
          data: {
            tenantId: session.user.tenantId,
            stationId: data.stationId,
            productId: product.id,
            pricePerLitre: data.pricePerLitre,
            effectiveFrom: new Date(),
            createdBy: session.user.id,
          },
        });
      }

      return { id: product.id };
    }
  );

  try {
    const result = await mutation();
    revalidatePath("/setup/products");
    return { success: true, data: result };
  } catch (error) {
    return errorResponse(error);
  }
}

export async function setProductPriceAction(formData: FormData): Promise<ActionResponse> {
  const parsed = parseForm(priceSchema, formData);
  if (!parsed.success) return validationError(parsed.error);
  const data = parsed.data as z.infer<typeof priceSchema>;

  const mutation = withMutation(
    {
      entityType: "PriceHistory",
      action: "CREATE",
      getStationId: () => data.stationId,
      getEntityId: (result: { id: string }) => result.id,
      roles: [...WRITE_ROLES],
    },
    async (session: AuthSession, tx: Db) => {
      await assertStation(tx, session.user.tenantId, data.stationId);
      await assertProduct(tx, session.user.tenantId, data.productId);

      await tx.priceHistory.updateMany({
        where: {
          tenantId: session.user.tenantId,
          stationId: data.stationId,
          productId: data.productId,
          effectiveTo: null,
        },
        data: { effectiveTo: new Date() },
      });
      const price = await tx.priceHistory.create({
        data: {
          tenantId: session.user.tenantId,
          stationId: data.stationId,
          productId: data.productId,
          pricePerLitre: data.pricePerLitre,
          effectiveFrom: new Date(),
          createdBy: session.user.id,
        },
      });
      return { id: price.id };
    }
  );

  try {
    const result = await mutation();
    revalidatePath("/setup/products");
    return { success: true, data: result };
  } catch (error) {
    return errorResponse(error);
  }
}

export async function saveLubeBayServiceTypeAction(formData: FormData): Promise<ActionResponse> {
  const parsed = parseForm(lubeBayServiceTypeSchema, formData);
  if (!parsed.success) return validationError(parsed.error);
  const data = parsed.data;

  const mutation = withMutation(
    {
      entityType: "LubeBayServiceType",
      action: data.id ? "UPDATE" : "CREATE",
      getStationId: () => data.stationId,
      getEntityId: (result: { id: string }) => result.id,
      roles: [...WRITE_ROLES],
    },
    async (session: AuthSession, tx: Db) => {
      const serviceType = await saveLubeBayServiceType(tx, {
        ...data,
        tenantId: session.user.tenantId,
        userId: session.user.id,
      });
      return { id: serviceType.id };
    }
  );

  try {
    const result = await mutation();
    revalidatePath("/setup/lube-bay");
    revalidatePath("/lube-bay/sales");
    return { success: true, data: result };
  } catch (error) {
    return errorResponse(error);
  }
}

export async function saveLubeBayMomoOperatorAction(formData: FormData): Promise<ActionResponse> {
  const parsed = parseForm(lubeBayMomoOperatorSchema, formData);
  if (!parsed.success) return validationError(parsed.error);
  const data = parsed.data;

  const mutation = withMutation(
    {
      entityType: "LubeBayMomoOperator",
      action: data.id ? "UPDATE" : "CREATE",
      getStationId: () => data.stationId,
      getEntityId: (result: { id: string }) => result.id,
      roles: [...WRITE_ROLES],
    },
    async (session: AuthSession, tx: Db) => {
      const operator = await saveLubeBayMomoOperator(tx, {
        ...data,
        tenantId: session.user.tenantId,
        userId: session.user.id,
      });
      return { id: operator.id };
    }
  );

  try {
    const result = await mutation();
    revalidatePath("/setup/lube-bay");
    revalidatePath("/lube-bay/sales");
    return { success: true, data: result };
  } catch (error) {
    return errorResponse(error);
  }
}

export async function saveTankAction(formData: FormData): Promise<ActionResponse> {
  const parsed = parseForm(tankSchema, formData);
  if (!parsed.success) return validationError(parsed.error);
  const data = parsed.data as z.infer<typeof tankSchema>;

  const mutation = withMutation(
    {
      entityType: "Tank",
      action: data.id ? "UPDATE" : "CREATE",
      getStationId: () => data.stationId,
      getEntityId: (result: { id: string }) => result.id,
      roles: [...WRITE_ROLES],
    },
    async (session: AuthSession, tx: Db) => {
      await assertStation(tx, session.user.tenantId, data.stationId);
      await assertProduct(tx, session.user.tenantId, data.productId);
      if (!data.id) await assertTenantCanAdd(tx, session.user.tenantId, "tank");
      const tank = data.id
        ? await tx.tank.update({
            where: { id: data.id, tenantId: session.user.tenantId, stationId: data.stationId },
            data: {
              name: data.name,
              productId: data.productId,
              capacityLitres: data.capacityLitres,
              status: data.status,
            },
          })
        : await tx.tank.create({
            data: {
              tenantId: session.user.tenantId,
              stationId: data.stationId,
              productId: data.productId,
              name: data.name,
              capacityLitres: data.capacityLitres,
              status: data.status,
            },
          });
      return { id: tank.id };
    }
  );

  try {
    const result = await mutation();
    revalidatePath("/setup/tanks");
    return { success: true, data: result };
  } catch (error) {
    return errorResponse(error);
  }
}

export async function savePumpAction(formData: FormData): Promise<ActionResponse> {
  const parsed = parseForm(pumpSchema, formData);
  if (!parsed.success) return validationError(parsed.error);
  const data = parsed.data as z.infer<typeof pumpSchema>;

  const mutation = withMutation(
    {
      entityType: "Pump",
      action: data.id ? "UPDATE" : "CREATE",
      getStationId: () => data.stationId,
      getEntityId: (result: { id: string }) => result.id,
      roles: [...WRITE_ROLES],
    },
    async (session: AuthSession, tx: Db) => {
      await assertStation(tx, session.user.tenantId, data.stationId);
      if (!data.id) await assertTenantCanAdd(tx, session.user.tenantId, "pump");
      const pump = data.id
        ? await tx.pump.update({
            where: { id: data.id, tenantId: session.user.tenantId, stationId: data.stationId },
            data: { name: data.name, status: data.status },
          })
        : await tx.pump.create({
            data: {
              tenantId: session.user.tenantId,
              stationId: data.stationId,
              name: data.name,
              status: data.status,
            },
          });
      return { id: pump.id };
    }
  );

  try {
    const result = await mutation();
    revalidatePath("/setup/pumps");
    return { success: true, data: result };
  } catch (error) {
    return errorResponse(error);
  }
}

export async function saveNozzleAction(formData: FormData): Promise<ActionResponse> {
  const parsed = parseForm(nozzleSchema, formData);
  if (!parsed.success) return validationError(parsed.error);
  const data = parsed.data as z.infer<typeof nozzleSchema>;

  const mutation = withMutation(
    {
      entityType: "Nozzle",
      action: data.id ? "UPDATE" : "CREATE",
      getStationId: () => data.stationId,
      getEntityId: (result: { id: string }) => result.id,
      roles: [...WRITE_ROLES],
    },
    async (session: AuthSession, tx: Db) => {
      await assertStation(tx, session.user.tenantId, data.stationId);
      await assertProduct(tx, session.user.tenantId, data.productId);
      const pump = await tx.pump.findFirst({
        where: { id: data.pumpId, stationId: data.stationId, tenantId: session.user.tenantId },
      });
      if (!pump) throw new Error("Pump was not found for this station");

      const nozzle = data.id
        ? await tx.nozzle.update({
            where: { id: data.id, tenantId: session.user.tenantId, stationId: data.stationId },
            data: {
              pumpId: data.pumpId,
              productId: data.productId,
              name: data.name,
              meterCode: data.meterCode,
              status: data.status,
            },
          })
        : await tx.nozzle.create({
            data: {
              tenantId: session.user.tenantId,
              stationId: data.stationId,
              pumpId: data.pumpId,
              productId: data.productId,
              name: data.name,
              meterCode: data.meterCode,
              status: data.status,
            },
          });
      return { id: nozzle.id };
    }
  );

  try {
    const result = await mutation();
    revalidatePath("/setup/pumps");
    return { success: true, data: result };
  } catch (error) {
    return errorResponse(error);
  }
}

export async function createUserMembershipAction(formData: FormData): Promise<ActionResponse> {
  const parsed = parseForm(userSchema, formData);
  if (!parsed.success) return validationError(parsed.error);
  const data = parsed.data as z.infer<typeof userSchema>;

  const tenantWideRoles = new Set(["OWNER", "ADMIN", "ACCOUNTANT", "AUDITOR"]);
  const stationId = tenantWideRoles.has(data.role) ? "" : data.stationId;
  if (!stationId && !tenantWideRoles.has(data.role)) {
    return {
      success: false,
      error: "Please correct the highlighted fields.",
      fieldErrors: { stationId: ["Station is required for this role"] },
    };
  }

  const mutation = withMutation(
    {
      entityType: "Membership",
      action: "CREATE",
      getStationId: () => stationId || undefined,
      getEntityId: (result: { id: string }) => result.id,
      roles: [...WRITE_ROLES],
    },
    async (session: AuthSession, tx: Db) => {
      if (stationId) await assertStation(tx, session.user.tenantId, stationId);
      const passwordHash = await bcrypt.hash(data.password, 10);
      const user = await tx.user.upsert({
        where: { email: data.email },
        update: {
          name: data.name,
          status: data.status,
          passwordHash,
          avatarInitials: initials(data.name),
        },
        create: {
          email: data.email,
          name: data.name,
          status: data.status,
          passwordHash,
          avatarInitials: initials(data.name),
        },
      });
      const membership = await tx.membership.upsert({
        where: {
          tenantId_userId_stationId: {
            tenantId: session.user.tenantId,
            userId: user.id,
            stationId,
          },
        },
        update: { role: data.role },
        create: {
          tenantId: session.user.tenantId,
          userId: user.id,
          stationId,
          role: data.role,
        },
      });
      return { id: membership.id };
    }
  );

  try {
    const result = await mutation();
    revalidatePath("/setup/users");
    return { success: true, data: result };
  } catch (error) {
    return errorResponse(error);
  }
}
