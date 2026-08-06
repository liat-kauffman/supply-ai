import { prisma } from "@supply/database";
import { NextResponse } from "next/server";
import { z } from "zod";

import { apiErrorResponse, requireApiCompany } from "@/lib/auth/api";
import { getInventoryItem } from "@/lib/inventory";

const createItemSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional().default(""),
  category: z.string().trim().min(1).max(80),
  supplier: z.string().trim().min(1).max(120),
  quantity: z.number().nonnegative().multipleOf(0.5),
  unit: z.string().trim().min(1).max(30),
  minimum: z.number().nonnegative().multipleOf(0.5),
});

export async function POST(request: Request) {
  try {
    const company = await requireApiCompany(["owner", "manager"]);
    const parsed = createItemSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success)
      return NextResponse.json(
        { error: "Check the item details and half-unit quantities" },
        { status: 400 },
      );

    const duplicate = await prisma.product.findFirst({
      where: {
        businessId: company.organizationId,
        name: { equals: parsed.data.name, mode: "insensitive" },
        active: true,
      },
      select: { id: true },
    });
    if (duplicate)
      return NextResponse.json(
        { error: "An inventory item with this name already exists" },
        { status: 409 },
      );

    const location = await prisma.location.findFirst({
      where: { businessId: company.organizationId, active: true },
      orderBy: { id: "asc" },
      include: { storageAreas: { where: { active: true }, take: 1 } },
    });
    if (!location)
      return NextResponse.json(
        { error: "Complete company setup before adding inventory" },
        { status: 409 },
      );

    const productId = await prisma.$transaction(async (tx) => {
      const supplier =
        (await tx.supplier.findFirst({
          where: {
            businessId: company.organizationId,
            name: { equals: parsed.data.supplier, mode: "insensitive" },
            active: true,
          },
        })) ??
        (await tx.supplier.create({
          data: {
            businessId: company.organizationId,
            name: parsed.data.supplier,
            orderDays: [],
          },
        }));

      const product = await tx.product.create({
        data: {
          businessId: company.organizationId,
          name: parsed.data.name,
          description: parsed.data.description || null,
          category: parsed.data.category,
          measurementMode: "MANUAL",
          baseUnit: parsed.data.unit,
          minimumStock: parsed.data.minimum,
          primaryStorageAreaId: location.storageAreas[0]?.id,
          supplierProducts: {
            create: {
              supplierId: supplier.id,
              unitsPerPackage: 1,
              isPreferred: true,
            },
          },
        },
      });

      if (parsed.data.quantity > 0) {
        await tx.inventoryMovement.create({
          data: {
            businessId: company.organizationId,
            locationId: location.id,
            productId: product.id,
            type: "MANUAL_ADDITION",
            quantityDelta: parsed.data.quantity,
            unit: parsed.data.unit,
            sourceType: "manual",
            reason: "Opening count for new item",
            createdById: company.userId,
            idempotencyKey: `item-create:${product.id}:${crypto.randomUUID()}`,
          },
        });
      }

      await tx.auditEvent.create({
        data: {
          businessId: company.organizationId,
          actorId: company.userId,
          action: "inventory.item.created",
          entityType: "Product",
          entityId: product.id,
          metadata: { supplierId: supplier.id, quantity: parsed.data.quantity },
        },
      });
      return product.id;
    });

    return NextResponse.json(
      { item: await getInventoryItem(company.organizationId, productId) },
      { status: 201 },
    );
  } catch (error) {
    return apiErrorResponse(error, "Unable to add this inventory item");
  }
}
