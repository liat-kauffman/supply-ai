import { prisma } from "@supply/database";
import { NextResponse } from "next/server";
import { z } from "zod";

import { apiErrorResponse, requireApiCompany } from "@/lib/auth/api";
import { getInventoryItem } from "@/lib/inventory";

const updateSchema = z.object({
  quantity: z.number().nonnegative().multipleOf(0.5),
  source: z.enum(["manual", "photo"]),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const company = await requireApiCompany(["owner", "manager"]);
    const { id } = await context.params;
    const parsed = updateSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success)
      return NextResponse.json(
        { error: "Use a non-negative count in half-unit increments" },
        { status: 400 },
      );

    const product = await prisma.product.findFirst({
      where: { id, businessId: company.organizationId, active: true },
      include: {
        movements: { select: { quantityDelta: true } },
        primaryStorageArea: { select: { locationId: true } },
      },
    });
    if (!product)
      return NextResponse.json({ error: "Item not found" }, { status: 404 });

    const locationId =
      product.primaryStorageArea?.locationId ??
      (
        await prisma.location.findFirst({
          where: { businessId: company.organizationId, active: true },
          select: { id: true },
        })
      )?.id;
    if (!locationId)
      return NextResponse.json(
        { error: "No active inventory location is configured" },
        { status: 409 },
      );

    const currentQuantity = product.movements.reduce(
      (total, movement) => total + Number(movement.quantityDelta),
      0,
    );
    const delta = parsed.data.quantity - currentQuantity;

    if (delta !== 0) {
      await prisma.$transaction([
        prisma.inventoryMovement.create({
          data: {
            businessId: company.organizationId,
            locationId,
            productId: product.id,
            type: "CORRECTION",
            quantityDelta: delta,
            unit: product.baseUnit,
            sourceType: parsed.data.source,
            reason:
              parsed.data.source === "photo"
                ? "Approved photo count"
                : "Verified manual count",
            createdById: company.userId,
            idempotencyKey: `count:${product.id}:${crypto.randomUUID()}`,
          },
        }),
        prisma.auditEvent.create({
          data: {
            businessId: company.organizationId,
            actorId: company.userId,
            action: "inventory.count.updated",
            entityType: "Product",
            entityId: product.id,
            metadata: {
              source: parsed.data.source,
              previousQuantity: currentQuantity,
              quantity: parsed.data.quantity,
              delta,
            },
          },
        }),
      ]);
    }

    return NextResponse.json({
      item: await getInventoryItem(company.organizationId, product.id),
    });
  } catch (error) {
    return apiErrorResponse(error, "Unable to update this inventory count");
  }
}
