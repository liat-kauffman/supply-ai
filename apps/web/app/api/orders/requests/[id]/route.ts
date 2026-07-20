import { prisma } from "@supply/database";
import { NextResponse } from "next/server";
import { z } from "zod";

import { ApiAccessError, requireApiCompany } from "@/lib/auth/api";
import { displayText, finiteNumber, finiteNumberOrNull } from "@/lib/display";

const mutationSchema = z.object({
  action: z.enum(["save", "approve"]).optional().default("approve"),
  note: z.string().trim().max(500).optional(),
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
    const { organizationId, role, userId } = await requireApiCompany([
      "owner",
      "manager",
      "employee",
    ]);
    const parsed = mutationSchema.safeParse(
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
      where: {
        id,
        businessId: organizationId,
        status: { in: ["PENDING", "APPROVED"] },
      },
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
        { error: "The editable order was not found" },
        { status: 404 },
      );
    const canReview = role === "owner" || role === "manager";
    if (
      !canReview &&
      (basket.requestedById !== userId || basket.status !== "PENDING")
    )
      return NextResponse.json(
        { error: "You can only edit your own pending orders" },
        { status: 403 },
      );
    if (parsed.data.action === "approve" && !canReview)
      return NextResponse.json(
        { error: "A manager must approve this order" },
        { status: 403 },
      );
    if (parsed.data.action === "approve" && basket.status !== "PENDING")
      return NextResponse.json(
        { error: "This order is already approved" },
        { status: 409 },
      );

    const products = new Map(
      basket.supplier.products.map((link) => [link.productId, link]),
    );
    if (parsed.data.items.some((item) => !products.has(item.productId)))
      return NextResponse.json(
        { error: "One or more items do not belong to this supplier" },
        { status: 400 },
      );

    const isApproval = parsed.data.action === "approve";
    const reviewedAt = isApproval ? new Date() : null;
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
          ...(parsed.data.note === undefined
            ? {}
            : { note: displayText(parsed.data.note, "") || null }),
          status: isApproval ? "APPROVED" : basket.status,
          ...(isApproval ? { reviewedById: userId, reviewedAt } : {}),
        },
      });
      await tx.auditEvent.create({
        data: {
          businessId: organizationId,
          actorId: userId,
          action: isApproval
            ? "order.basket.approved"
            : basket.status === "APPROVED"
              ? "order.basket.updated_after_approval"
              : "order.basket.updated",
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
      { error: "Unable to update the supplier order" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { organizationId, role, userId } = await requireApiCompany([
      "owner",
      "manager",
      "employee",
    ]);
    const { id } = await context.params;
    const basket = await prisma.orderBasketRequest.findFirst({
      where: { id, businessId: organizationId },
      include: { supplier: { select: { name: true } } },
    });
    if (!basket)
      return NextResponse.json(
        { error: "The order was not found" },
        { status: 404 },
      );

    const canManageAll = role === "owner" || role === "manager";
    if (
      !canManageAll &&
      (basket.requestedById !== userId || basket.status !== "PENDING")
    )
      return NextResponse.json(
        { error: "You can only delete your own pending orders" },
        { status: 403 },
      );

    await prisma.$transaction(async (tx) => {
      await tx.orderBasketRequest.delete({ where: { id: basket.id } });
      await tx.auditEvent.create({
        data: {
          businessId: organizationId,
          actorId: userId,
          action: "order.basket.deleted",
          entityType: "OrderBasketRequest",
          entityId: basket.id,
          metadata: {
            supplierId: basket.supplierId,
            supplierName: displayText(basket.supplier.name, "Supplier"),
            previousStatus: basket.status,
            requestedById: basket.requestedById,
          },
        },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ApiAccessError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    console.error(error);
    return NextResponse.json(
      { error: "Unable to delete the supplier order" },
      { status: 500 },
    );
  }
}
