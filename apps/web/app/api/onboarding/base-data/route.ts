import { prisma } from "@supply/database";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";

const itemSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional().default(""),
  category: z.string().trim().min(1).max(80),
  supplier: z.string().trim().min(1).max(120),
  supplierSku: z.string().trim().max(120).optional().default(""),
  packageCount: z.number().nonnegative().multipleOf(0.001),
  unitsPerPackage: z.number().positive().multipleOf(0.001),
  quantity: z.number().nonnegative().multipleOf(0.001),
  unit: z.string().trim().min(1).max(30),
  minimum: z.number().nonnegative().multipleOf(0.5),
  packagePrice: z.number().nonnegative().optional().default(0),
});

const baseDataSchema = z.object({
  append: z.boolean().optional().default(false),
  location: z.object({
    name: z.string().trim().min(1).max(120),
    address: z.string().trim().max(240).optional().default(""),
  }),
  timezone: z.string().trim().min(1).max(80),
  currency: z
    .string()
    .trim()
    .length(3)
    .transform((value) => value.toUpperCase()),
  suppliers: z.array(z.string().trim().min(1).max(120)).min(1).max(30),
  receipts: z
    .array(
      z.object({
        supplier: z.string().trim().min(1).max(120),
        fileName: z.string().trim().max(255).optional().default(""),
        receiptDate: z.string().trim().max(40).optional().default(""),
        invoiceNumber: z.string().trim().max(80).optional().default(""),
        confidence: z.number().min(0).max(1).optional().default(0),
        vatAmount: z.number().nonnegative().optional().default(0),
        totalAmount: z.number().nonnegative().optional().default(0),
      }),
    )
    .max(30)
    .optional(),
  items: z.array(itemSchema).min(1).max(100),
});

async function createBaseData(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session)
    return NextResponse.json({ error: "Sign in is required" }, { status: 401 });

  const organizationId = session.session.activeOrganizationId;
  if (!organizationId)
    return NextResponse.json(
      { error: "Create a company before adding base data" },
      { status: 403 },
    );

  const membership = await prisma.member.findUnique({
    where: {
      organizationId_userId: {
        organizationId,
        userId: session.user.id,
      },
    },
    select: { role: true },
  });
  if (!membership || !["owner", "manager"].includes(membership.role))
    return NextResponse.json(
      { error: "Only an owner or manager can set up company data" },
      { status: 403 },
    );

  const body = await request.json().catch(() => null);
  const parsed = baseDataSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: "Check the business, supplier, and inventory details" },
      { status: 400 },
    );

  const supplierNames = [
    ...new Set(parsed.data.suppliers.map((name) => name.trim())),
  ];
  const supplierSet = new Set(supplierNames);
  if (parsed.data.items.some((item) => !supplierSet.has(item.supplier)))
    return NextResponse.json(
      { error: "Every inventory item must use one of the listed suppliers" },
      { status: 400 },
    );
  if (
    parsed.data.receipts?.some((receipt) => !supplierSet.has(receipt.supplier))
  )
    return NextResponse.json(
      { error: "Every receipt must use one of the listed suppliers" },
      { status: 400 },
    );
  const receiptSuppliers =
    parsed.data.receipts?.map((receipt) => receipt.supplier.toLowerCase()) ??
    [];
  if (new Set(receiptSuppliers).size !== receiptSuppliers.length)
    return NextResponse.json(
      { error: "Upload one receipt at a time for each supplier" },
      { status: 400 },
    );

  const normalizedNames = parsed.data.items.map((item) =>
    item.name.toLowerCase(),
  );
  if (new Set(normalizedNames).size !== normalizedNames.length)
    return NextResponse.json(
      { error: "Inventory item names must be unique" },
      { status: 400 },
    );

  const existingProfile = await prisma.businessProfile.findUnique({
    where: { id: organizationId },
    select: { onboardingCompletedAt: true },
  });
  if (existingProfile?.onboardingCompletedAt && !parsed.data.append)
    return NextResponse.json(
      { error: "Company setup has already been completed" },
      { status: 409 },
    );

  await prisma.$transaction(async (tx) => {
    if (!parsed.data.append) {
      await tx.businessProfile.upsert({
        where: { id: organizationId },
        update: {
          timezone: parsed.data.timezone,
          currency: parsed.data.currency,
        },
        create: {
          id: organizationId,
          timezone: parsed.data.timezone,
          currency: parsed.data.currency,
        },
      });
    }

    const location = parsed.data.append
      ? await tx.location.findFirst({
          where: { businessId: organizationId, active: true },
          include: { storageAreas: { where: { active: true }, take: 1 } },
        })
      : await tx.location.create({
          data: {
            businessId: organizationId,
            name: parsed.data.location.name,
            address: parsed.data.location.address || null,
            storageAreas: {
              create: {
                name: "Main storage",
                description: "Created during setup",
              },
            },
          },
          include: { storageAreas: { select: { id: true }, take: 1 } },
        });
    if (!location) throw new Error("No active inventory location exists");
    const storageAreaId = location.storageAreas[0]?.id;

    const suppliers = new Map<string, string>();
    for (const name of supplierNames) {
      const supplier =
        (await tx.supplier.findFirst({
          where: {
            businessId: organizationId,
            name: { equals: name, mode: "insensitive" },
            active: true,
          },
          select: { id: true },
        })) ??
        (await tx.supplier.create({
          data: { businessId: organizationId, name, orderDays: [] },
          select: { id: true },
        }));
      suppliers.set(name, supplier.id);
    }

    const receipts = new Map<string, { id: string; receiptDate: Date }>();
    for (const draft of parsed.data.receipts ?? []) {
      const supplierId = suppliers.get(draft.supplier);
      if (!supplierId) throw new Error("Receipt supplier was not created");
      const parsedDate = draft.receiptDate
        ? new Date(`${draft.receiptDate}T12:00:00.000Z`)
        : new Date();
      const receiptDate = Number.isNaN(parsedDate.getTime())
        ? new Date()
        : parsedDate;
      const receipt = await tx.receipt.create({
        data: {
          businessId: organizationId,
          supplierId,
          locationId: location.id,
          receiptDate,
          invoiceNumber: draft.invoiceNumber || null,
          fileName: draft.fileName || null,
          confidence: draft.confidence,
          vatAmount: draft.vatAmount || null,
          totalAmount: draft.totalAmount || null,
          currency: parsed.data.currency,
          createdById: session.user.id,
        },
        select: { id: true },
      });
      receipts.set(draft.supplier, { id: receipt.id, receiptDate });
    }

    for (const item of parsed.data.items) {
      const supplierId = suppliers.get(item.supplier);
      if (!supplierId) throw new Error("Supplier was not created");

      const existingProduct = parsed.data.append
        ? await tx.product.findFirst({
            where: {
              businessId: organizationId,
              name: { equals: item.name, mode: "insensitive" },
              active: true,
            },
            select: { id: true, baseUnit: true },
          })
        : null;
      const product =
        existingProduct ??
        (await tx.product.create({
          data: {
            businessId: organizationId,
            name: item.name,
            description: item.description || null,
            category: item.category,
            measurementMode: "MANUAL",
            baseUnit: item.unit,
            minimumStock: item.minimum,
            primaryStorageAreaId: storageAreaId,
          },
          select: { id: true, baseUnit: true },
        }));

      const supplierProduct = await tx.supplierProduct.upsert({
        where: {
          supplierId_productId: { supplierId, productId: product.id },
        },
        update: {
          supplierSku: item.supplierSku || undefined,
          unitsPerPackage: item.unitsPerPackage,
          latestPackagePrice: item.packagePrice || undefined,
        },
        create: {
          supplierId,
          productId: product.id,
          supplierSku: item.supplierSku || null,
          unitsPerPackage: item.unitsPerPackage,
          latestPackagePrice: item.packagePrice || null,
          isPreferred: !existingProduct,
        },
        select: { id: true },
      });

      const receipt = receipts.get(item.supplier);
      if (receipt)
        await tx.receiptLine.create({
          data: {
            receiptId: receipt.id,
            productId: product.id,
            supplierProductId: supplierProduct.id,
            name: item.name,
            description: item.description || null,
            category: item.category,
            supplierSku: item.supplierSku || null,
            packageCount: item.packageCount,
            unitsPerPackage: item.unitsPerPackage,
            quantity: item.quantity,
            unit: item.unit,
            packagePrice: item.packagePrice || null,
            lineTotal:
              item.packagePrice > 0
                ? Number((item.packageCount * item.packagePrice).toFixed(2))
                : null,
          },
        });

      if (item.quantity > 0) {
        await tx.inventoryMovement.create({
          data: {
            businessId: organizationId,
            locationId: location.id,
            productId: product.id,
            type: parsed.data.append ? "RECEIPT" : "MANUAL_ADDITION",
            quantityDelta: item.quantity,
            unit: product.baseUnit,
            sourceType: parsed.data.append
              ? "supplier-receipt"
              : "onboarding-receipt",
            sourceId: receipt?.id,
            reason: parsed.data.append
              ? "Approved supplier receipt"
              : "Opening count extracted from approved receipt",
            createdById: session.user.id,
            occurredAt: receipt?.receiptDate,
            idempotencyKey: `onboarding:${organizationId}:${crypto.randomUUID()}`,
          },
        });
      }
    }

    await tx.auditEvent.create({
      data: {
        businessId: organizationId,
        actorId: session.user.id,
        action: parsed.data.append
          ? "inventory.receipts.imported"
          : "business.onboarding.completed",
        entityType: "BusinessProfile",
        entityId: organizationId,
        metadata: {
          locationId: location.id,
          supplierCount: supplierNames.length,
          productCount: parsed.data.items.length,
          receipts: parsed.data.receipts ?? [],
        },
      },
    });

    if (!parsed.data.append)
      await tx.businessProfile.update({
        where: { id: organizationId },
        data: { onboardingCompletedAt: new Date() },
      });
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function POST(request: Request) {
  try {
    return await createBaseData(request);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Unable to save the company setup. Please try again." },
      { status: 500 },
    );
  }
}
