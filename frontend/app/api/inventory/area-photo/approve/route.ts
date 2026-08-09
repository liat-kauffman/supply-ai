import { prisma } from "@supply/database";
import { NextResponse } from "next/server";
import { z } from "zod";

import { apiErrorResponse, requireApiCompany } from "@/lib/auth/api";
import { getInventoryItem } from "@/lib/inventory";

const countsSchema = z
  .array(
    z.object({
      productId: z.string().min(1),
      quantity: z.number().nonnegative().multipleOf(0.5),
    }),
  )
  .max(80)
  .refine(
    (counts) =>
      new Set(counts.map((count) => count.productId)).size === counts.length,
    "Each product can only be approved once",
  );

const approveSchema = z.object({
  scanId: z.string().min(1).optional(),
  counts: countsSchema.optional().default([]),
});

export async function POST(request: Request) {
  try {
    const company = await requireApiCompany(["owner", "manager"]);
    const parsed = approveSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success)
      return NextResponse.json(
        {
          error:
            "Review at least one count using non-negative half-unit values.",
        },
        { status: 400 },
      );

    let counts = parsed.data.counts;
    const requestScanId = parsed.data.scanId;
    if (requestScanId && !counts.length) {
      const scan = await prisma.inventoryScan.findFirst({
        where: {
          id: requestScanId,
          businessId: company.organizationId,
          status: "PENDING",
        },
        select: { observations: true },
      });
      if (!scan)
        return NextResponse.json(
          { error: "This area scan is no longer awaiting approval." },
          { status: 409 },
        );
      const storedCounts = z
        .array(
          z.object({
            productId: z.string().min(1),
            count: z.number().nonnegative(),
            confidence: z.number().min(0).max(1),
          }),
        )
        .parse(scan.observations)
        .filter((observation) => observation.confidence >= 0.85);
      counts = storedCounts.map((observation) => ({
        productId: observation.productId,
        quantity: observation.count,
      }));
    }
    if (!counts.length)
      return NextResponse.json(
        { error: "Select at least one count to approve." },
        { status: 400 },
      );

    const productIds = counts.map((count) => count.productId);
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        businessId: company.organizationId,
        active: true,
      },
      select: {
        id: true,
        baseUnit: true,
        movements: { select: { quantityDelta: true } },
        primaryStorageArea: { select: { locationId: true } },
      },
    });
    if (products.length !== new Set(productIds).size)
      return NextResponse.json(
        { error: "One or more selected products are no longer active." },
        { status: 409 },
      );

    const fallbackLocation = await prisma.location.findFirst({
      where: { businessId: company.organizationId, active: true },
      select: { id: true },
    });
    if (!fallbackLocation)
      return NextResponse.json(
        { error: "No active inventory location is configured" },
        { status: 409 },
      );

    const productById = new Map(
      products.map((product) => [product.id, product]),
    );
    const movementScanId = requestScanId ?? crypto.randomUUID();
    await prisma.$transaction(
      counts.flatMap((count) => {
        const product = productById.get(count.productId);
        if (!product) return [];
        const currentQuantity = product.movements.reduce(
          (total, movement) => total + Number(movement.quantityDelta),
          0,
        );
        const delta = count.quantity - currentQuantity;
        if (delta === 0) return [];
        return [
          prisma.inventoryMovement.create({
            data: {
              businessId: company.organizationId,
              locationId:
                product.primaryStorageArea?.locationId ?? fallbackLocation.id,
              productId: product.id,
              type: "CORRECTION",
              quantityDelta: delta,
              unit: product.baseUnit,
              sourceType: "area-photo",
              sourceId: movementScanId,
              reason: "Approved area photo count",
              createdById: company.userId,
              idempotencyKey: `area-photo:${movementScanId}:${product.id}`,
            },
          }),
          prisma.auditEvent.create({
            data: {
              businessId: company.organizationId,
              actorId: company.userId,
              action: "inventory.area_photo.updated",
              entityType: "Product",
              entityId: product.id,
              metadata: {
                source: "area-photo",
                scanId: movementScanId,
                previousQuantity: currentQuantity,
                quantity: count.quantity,
                delta,
              },
            },
          }),
        ];
      }),
    );

    if (requestScanId) {
      await prisma.inventoryScan.update({
        where: { id: requestScanId },
        data: {
          status: "APPROVED",
          reviewedById: company.userId,
          reviewedAt: new Date(),
        },
      });
    }

    const items = await Promise.all(
      productIds.map((productId) =>
        getInventoryItem(company.organizationId, productId),
      ),
    );
    return NextResponse.json({ items: items.filter(Boolean) });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        { error: "The submitted counts are invalid" },
        { status: 400 },
      );
    return apiErrorResponse(error, "Unable to approve the area photo counts");
  }
}
