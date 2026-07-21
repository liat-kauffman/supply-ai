import { prisma } from "@supply/database";
import { NextResponse } from "next/server";
import { z } from "zod";

import { ApiAccessError, requireApiCompany } from "@/lib/auth/api";
import { getInventoryItem } from "@/lib/inventory";

function isKnownPrismaError(error: unknown): error is { code: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  );
}

const updateItemSchema = z
  .object({
    minimum: z.number().nonnegative().multipleOf(0.5).optional(),
    active: z.boolean().optional(),
  })
  .strict()
  .refine(
    (data) =>
      typeof data.minimum === "number" || typeof data.active === "boolean",
    { message: "Provide a minimum or active status update" },
  );

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const company = await requireApiCompany(["owner", "manager"]);
    const { id } = await context.params;
    const parsed = updateItemSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success)
      return NextResponse.json(
        { error: "Use a non-negative minimum in half-unit increments" },
        { status: 400 },
      );

    const product = await prisma.product.findFirst({
      where: { id, businessId: company.organizationId },
      select: { id: true, active: true, minimumStock: true },
    });
    if (!product)
      return NextResponse.json({ error: "Item not found" }, { status: 404 });

    const updates: { minimumStock?: number; active?: boolean } = {};
    const metadata: {
      previousMinimum?: number;
      minimum?: number;
      previousActive?: boolean;
      active?: boolean;
    } = {};

    if (typeof parsed.data.minimum === "number") {
      updates.minimumStock = parsed.data.minimum;
      metadata.previousMinimum = Number(product.minimumStock ?? 0);
      metadata.minimum = parsed.data.minimum;
    }

    if (typeof parsed.data.active === "boolean") {
      updates.active = parsed.data.active;
      metadata.previousActive = product.active;
      metadata.active = parsed.data.active;
    }

    await prisma.$transaction([
      prisma.product.update({
        where: { id: product.id },
        data: updates,
      }),
      prisma.auditEvent.create({
        data: {
          businessId: company.organizationId,
          actorId: company.userId,
          action: "inventory.item.updated",
          entityType: "Product",
          entityId: product.id,
          metadata,
        },
      }),
    ]);

    return NextResponse.json({
      item: await getInventoryItem(company.organizationId, product.id, {
        includeInactive: true,
      }),
    });
  } catch (error) {
    if (error instanceof ApiAccessError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    console.error(error);
    return NextResponse.json(
      { error: "Unable to update this inventory item" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const company = await requireApiCompany(["owner", "manager"]);
    const { id } = await context.params;
    const product = await prisma.product.findFirst({
      where: { id, businessId: company.organizationId },
      select: { id: true, active: true },
    });
    if (!product)
      return NextResponse.json({ error: "Item not found" }, { status: 404 });

    try {
      await prisma.$transaction([
        prisma.auditEvent.create({
          data: {
            businessId: company.organizationId,
            actorId: company.userId,
            action: "inventory.item.deleted",
            entityType: "Product",
            entityId: product.id,
            metadata: {},
          },
        }),
        prisma.product.delete({ where: { id: product.id } }),
      ]);
      return NextResponse.json({ ok: true, archived: false });
    } catch (error) {
      if (isKnownPrismaError(error)) {
        if (error.code === "P2003" || error.code === "P2014") {
          await prisma.$transaction([
            prisma.product.update({
              where: { id: product.id },
              data: { active: false },
            }),
            prisma.auditEvent.create({
              data: {
                businessId: company.organizationId,
                actorId: company.userId,
                action: "inventory.item.archived",
                entityType: "Product",
                entityId: product.id,
                metadata: {
                  reason: "Delete requested but history must be preserved",
                  previousActive: product.active,
                },
              },
            }),
          ]);
          return NextResponse.json({ ok: true, archived: true });
        }
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof ApiAccessError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    console.error(error);
    return NextResponse.json(
      { error: "Unable to delete this inventory item" },
      { status: 500 },
    );
  }
}
