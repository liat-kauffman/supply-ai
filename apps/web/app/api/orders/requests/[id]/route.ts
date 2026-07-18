import { prisma } from "@supply/database";
import { NextResponse } from "next/server";
import { z } from "zod";

import { ApiAccessError, requireApiCompany } from "@/lib/auth/api";
import { finiteNumber, finiteNumberOrNull } from "@/lib/display";

const approvalSchema = z.object({
  items: z
    .array(
      z.object({
        lineId: z.string().min(1),
        packageCount: z.number().int().min(0).max(10_000),
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
      new Set(parsed.data.items.map((item) => item.lineId)).size !==
      parsed.data.items.length
    )
      return NextResponse.json(
        { error: "Each basket line can appear only once" },
        { status: 400 },
      );
    if (!parsed.data.items.some((item) => item.packageCount > 0))
      return NextResponse.json(
        { error: "An approved basket must contain at least one package" },
        { status: 400 },
      );

    const { id } = await context.params;
    const basket = await prisma.orderBasketRequest.findFirst({
      where: { id, businessId: organizationId, status: "PENDING" },
      include: { lines: true, supplier: { select: { name: true } } },
    });
    if (!basket)
      return NextResponse.json(
        { error: "The pending basket was not found" },
        { status: 404 },
      );

    const submitted = new Map(
      parsed.data.items.map((item) => [item.lineId, item.packageCount]),
    );
    if (
      submitted.size !== basket.lines.length ||
      basket.lines.some((line) => !submitted.has(line.id))
    )
      return NextResponse.json(
        { error: "The basket changed. Refresh before approving it." },
        { status: 409 },
      );

    const reviewedAt = new Date();
    await prisma.$transaction(async (tx) => {
      for (const line of basket.lines) {
        const packageCount = submitted.get(line.id)!;
        const unitsPerPackage = Math.max(
          finiteNumber(line.unitsPerPackage, 1),
          1,
        );
        const price = finiteNumberOrNull(line.latestPackagePrice);
        await tx.orderBasketRequestLine.update({
          where: { id: line.id },
          data: {
            packageCount,
            requestedQuantity: packageCount * unitsPerPackage,
            estimatedCost:
              price === null ? null : Number((price * packageCount).toFixed(2)),
          },
        });
      }
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
            lineCount: basket.lines.length,
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
