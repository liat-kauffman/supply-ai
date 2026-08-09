import { prisma } from "@supply/database";
import { NextResponse } from "next/server";
import { z } from "zod";

import { apiErrorResponse, requireApiCompany } from "@/lib/auth/api";
import { displayText, finiteNumber, finiteNumberOrNull } from "@/lib/display";
import { getOrderApprovalRequests } from "@/lib/orders";

const requestSchema = z.object({
  supplierId: z.string().min(1),
  note: z.string().trim().max(500).optional().default(""),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        packageCount: z.number().int().min(0).max(10_000),
        requestedQuantity: z.number().positive().max(1_000_000).optional(),
      }),
    )
    .min(1)
    .max(200),
});

export async function GET() {
  try {
    const { organizationId, role, userId } = await requireApiCompany([
      "owner",
      "manager",
      "employee",
    ]);
    const requests = await getOrderApprovalRequests(
      organizationId,
      userId,
      role,
    );
    return NextResponse.json({ requests });
  } catch (error) {
    return apiErrorResponse(error, "Unable to load supplier orders");
  }
}

export async function POST(request: Request) {
  try {
    const { organizationId, userId } = await requireApiCompany([
      "owner",
      "manager",
      "employee",
    ]);
    const parsed = requestSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success)
      return NextResponse.json(
        { error: "Check the supplier and package quantities" },
        { status: 400 },
      );

    const items = parsed.data.items.filter((item) => item.packageCount > 0);
    if (!items.length)
      return NextResponse.json(
        { error: "Add at least one package before requesting approval" },
        { status: 400 },
      );
    if (new Set(items.map((item) => item.productId)).size !== items.length)
      return NextResponse.json(
        { error: "Each product can appear only once in a basket" },
        { status: 400 },
      );

    const [existing, supplier] = await Promise.all([
      prisma.orderBasketRequest.findFirst({
        where: {
          businessId: organizationId,
          supplierId: parsed.data.supplierId,
          requestedById: userId,
          status: "PENDING",
        },
        select: { id: true },
      }),
      prisma.supplier.findFirst({
        where: {
          id: parsed.data.supplierId,
          businessId: organizationId,
          active: true,
        },
        include: {
          products: {
            where: { productId: { in: items.map((item) => item.productId) } },
            include: {
              product: {
                select: { id: true, name: true, baseUnit: true, active: true },
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
      }),
    ]);

    if (existing)
      return NextResponse.json(
        { error: "This supplier basket is already waiting for approval" },
        { status: 409 },
      );
    if (!supplier)
      return NextResponse.json(
        { error: "The supplier is not available" },
        { status: 404 },
      );

    const products = new Map(
      supplier.products
        .filter((link) => link.product.active)
        .map((link) => [link.productId, link]),
    );
    if (items.some((item) => !products.has(item.productId)))
      return NextResponse.json(
        { error: "One or more items do not belong to this supplier" },
        { status: 400 },
      );

    const created = await prisma.$transaction(async (tx) => {
      const basket = await tx.orderBasketRequest.create({
        data: {
          businessId: organizationId,
          supplierId: supplier.id,
          requestedById: userId,
          currency: displayText(supplier.currency, "ILS"),
          note: displayText(parsed.data.note, "") || null,
          lines: {
            create: items.map((item) => {
              const link = products.get(item.productId)!;
              const unitsPerPackage = Math.max(
                finiteNumber(link.unitsPerPackage, 1),
                1,
              );
              const latestPackagePrice = finiteNumberOrNull(
                link.receiptLines[0]?.packagePrice ?? link.latestPackagePrice,
              );
              return {
                productId: link.product.id,
                productName: displayText(link.product.name, "Item"),
                supplierSku: displayText(link.supplierSku, "") || null,
                unit: displayText(link.product.baseUnit, "units"),
                requestedQuantity:
                  item.requestedQuantity ?? item.packageCount * unitsPerPackage,
                unitsPerPackage,
                packageCount: item.packageCount,
                latestPackagePrice,
                estimatedCost:
                  latestPackagePrice === null
                    ? null
                    : Number(
                        (latestPackagePrice * item.packageCount).toFixed(2),
                      ),
              };
            }),
          },
        },
        select: { id: true },
      });
      await tx.auditEvent.create({
        data: {
          businessId: organizationId,
          actorId: userId,
          action: "order.basket.approval_requested",
          entityType: "OrderBasketRequest",
          entityId: basket.id,
          metadata: {
            supplierId: supplier.id,
            supplierName: displayText(supplier.name, "Supplier"),
            lineCount: items.length,
          },
        },
      });
      return basket;
    });

    return NextResponse.json({ id: created.id, ok: true }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, "Unable to request basket approval");
  }
}
