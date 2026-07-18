import { prisma } from "@supply/database";
import { NextResponse } from "next/server";
import { z } from "zod";

import { ApiAccessError, requireApiCompany } from "@/lib/auth/api";
import { finiteNumber, finiteNumberOrNull } from "@/lib/display";

const approvalSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        packageCount: z.number().int().min(1).max(10_000),
        requestedQuantity: z.number().positive().max(1_000_000),
      }),
    )
    .min(1)
    .max(200),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { organizationId, userId } = await requireApiCompany([
      "owner",
      "manager",
    ]);
    const parsed = approvalSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success)
      return NextResponse.json(
        { error: "Check the package quantities" },
        { status: 400 },
      );
    if (
      new Set(parsed.data.items.map((item) => item.productId)).size !==
      parsed.data.items.length
    )
      return NextResponse.json(
        { error: "Each basket line can appear only once" },
        { status: 400 },
      );
    const { id } = await context.params;
    const basket = await prisma.orderBasketRequest.findFirst({
      where: { id, businessId: organizationId, status: "PENDING" },
      include: {
        supplier: {
          include: {
            products: {
              where: {
                productId: {
                  in: parsed.data.items.map((item) => item.productId),
                },
                product: { active: true },
              },
              include: {
                product: {
                  select: { id: true, name: true, baseUnit: true },
                },
                receiptLines: {
                  orderBy: [
                    { receipt: { receiptDate: "desc" } },
                    { createdAt: "desc" },
                  ],
                  take: 1,
                  select: { packagePrice: true },
                },
              },
            },
          },
        },
      },
    });
    if (!basket)
      return NextResponse.json(
        { error: "The pending basket was not found" },
        { status: 404 },
      );

    const products = new Map(
      basket.supplier.products.map((link) => [link.productId, link]),
    );
    if (parsed.data.items.some((item) => !products.has(item.productId)))
      return NextResponse.json(
        { error: "One or more items do not belong to this supplier" },
        { status: 400 },
      );

    const reviewedAt = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.orderBasketRequestLine.deleteMany({
        where: { requestId: basket.id },
      });
      await tx.orderBasketRequestLine.createMany({
        data: parsed.data.items.map((item) => {
          const link = products.get(item.productId)!;
          const unitsPerPackage = Math.max(
            finiteNumber(link.unitsPerPackage, 1),
            1,
          );
          const price = finiteNumberOrNull(
            link.receiptLines[0]?.packagePrice ?? link.latestPackagePrice,
          );
          return {
            requestId: basket.id,
            productId: link.product.id,
            productName: link.product.name,
            supplierSku: link.supplierSku,
            unit: link.product.baseUnit,
            packageCount: item.packageCount,
            requestedQuantity: item.requestedQuantity,
            unitsPerPackage,
            latestPackagePrice: price,
            estimatedCost:
              price === null
                ? null
                : Number((price * item.packageCount).toFixed(2)),
          };
        }),
      });
      await tx.orderBasketRequest.update({
        where: { id: basket.id },
        data: {
          status: "APPROVED",
          reviewedById: userId,
          reviewedAt,
        },
      });
      await tx.auditEvent.create({
        data: {
          businessId: organizationId,
          actorId: userId,
          action: "order.basket.approved",
          entityType: "OrderBasketRequest",
          entityId: basket.id,
          metadata: {
            supplierId: basket.supplierId,
            supplierName: basket.supplier.name,
            requestedById: basket.requestedById,
            lineCount: parsed.data.items.length,
          },
        },
      });
    });

    return NextResponse.json({ ok: true, reviewedAt });
  } catch (error) {
    if (error instanceof ApiAccessError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    console.error(error);
    return NextResponse.json(
      { error: "Unable to approve the supplier basket" },
      { status: 500 },
    );
  }
}
