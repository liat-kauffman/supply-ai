import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { prisma } from "@supply/database";
import { auth } from "@/lib/auth";

const demoDomain = "demo.supplai-pilot.com";

async function seedWorkspace(userId: string, suffix: string) {
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    const organization = await tx.organization.create({
      data: {
        id: `demo-org-${suffix}`,
        name: "Harbor Coffee Demo",
        slug: `harbor-coffee-demo-${suffix}`,
        createdAt: now,
        businessProfile: {
          create: {
            timezone: "Asia/Jerusalem",
            currency: "ILS",
            onboardingCompletedAt: now,
          },
        },
      },
    });
    await tx.member.create({
      data: {
        id: `demo-member-${suffix}`,
        organizationId: organization.id,
        userId,
        role: "owner",
        createdAt: now,
      },
    });
    const location = await tx.location.create({
      data: {
        businessId: organization.id,
        name: "Main Café",
        address: "12 Seaside Avenue",
      },
    });
    const storage = await tx.storageArea.create({
      data: {
        locationId: location.id,
        name: "Main Store",
        description: "Dry store and service counter",
      },
    });
    const supplier = await tx.supplier.create({
      data: {
        businessId: organization.id,
        name: "North Star Foods",
        orderDays: [1, 3, 5],
        cutoffTime: "14:00",
        deliveryLeadDays: 1,
        minimumOrderValue: 250,
      },
    });
    const products = await Promise.all([
      tx.product.create({
        data: {
          businessId: organization.id,
          name: "House Espresso Beans",
          description: "Dark roast blend for espresso service",
          category: "Coffee",
          measurementMode: "PACKAGE",
          baseUnit: "kg",
          primaryStorageAreaId: storage.id,
          minimumStock: 8,
          targetStock: 24,
          safetyStock: 4,
          criticality: "HIGH",
        },
      }),
      tx.product.create({
        data: {
          businessId: organization.id,
          name: "Whole Milk",
          description: "Fresh milk for coffee service",
          category: "Dairy",
          measurementMode: "UNIT",
          baseUnit: "bottles",
          primaryStorageAreaId: storage.id,
          minimumStock: 12,
          targetStock: 48,
          safetyStock: 8,
          criticality: "MEDIUM",
        },
      }),
      tx.product.create({
        data: {
          businessId: organization.id,
          name: "Takeaway Cups 12oz",
          description: "Compostable takeaway cups",
          category: "Packaging",
          measurementMode: "PACKAGE",
          baseUnit: "cups",
          primaryStorageAreaId: storage.id,
          minimumStock: 100,
          targetStock: 500,
          safetyStock: 50,
          criticality: "LOW",
        },
      }),
    ]);
    const supplierProducts = await Promise.all(
      products.map((product, index) =>
        tx.supplierProduct.create({
          data: {
            supplierId: supplier.id,
            productId: product.id,
            supplierSku: `DEMO-${index + 1}`,
            unitsPerPackage: index === 2 ? 50 : 1,
            packageSize: index === 2 ? 50 : 1,
            packageUnit: index === 2 ? "cups" : product.baseUnit,
            latestPackagePrice: [92, 7.5, 38][index],
            isPreferred: true,
          },
        }),
      ),
    );
    const receipt = await tx.receipt.create({
      data: {
        businessId: organization.id,
        supplierId: supplier.id,
        locationId: location.id,
        receiptDate: new Date(now.getTime() - 172800000),
        invoiceNumber: "DEMO-1042",
        fileName: "demo-invoice.pdf",
        confidence: 0.96,
        vatAmount: 31.42,
        totalAmount: 188.52,
        createdById: userId,
        lines: {
          create: products.slice(0, 2).map((product, index) => ({
            productId: product.id,
            supplierProductId: supplierProducts[index]?.id,
            name: product.name,
            category: product.category,
            packageCount: index === 0 ? 12 : 24,
            unitsPerPackage: 1,
            quantity: index === 0 ? 12 : 24,
            unit: product.baseUnit,
            packagePrice: [92, 7.5][index],
            lineTotal: [92, 180][index],
          })),
        },
      },
    });
    await tx.inventoryMovement.createMany({
      data: products.map((product, index) => ({
        businessId: organization.id,
        locationId: location.id,
        productId: product.id,
        type: "RECEIPT" as const,
        quantityDelta: [12, 24, 40][index] ?? 0,
        unit: product.baseUnit,
        sourceType: "Receipt",
        sourceId: receipt.id,
        reason: "Demo opening stock",
        createdById: userId,
        idempotencyKey: `demo-${suffix}-${index}`,
      })),
    });
    await tx.orderBasketRequest.create({
      data: {
        businessId: organization.id,
        supplierId: supplier.id,
        requestedById: userId,
        note: "Demo order awaiting manager approval",
        lines: {
          create: {
            productId: products[0].id,
            productName: products[0].name,
            supplierSku: supplierProducts[0]?.supplierSku,
            unit: products[0].baseUnit,
            requestedQuantity: 12,
            unitsPerPackage: 1,
            packageCount: 12,
            latestPackagePrice: 92,
            estimatedCost: 1104,
          },
        },
      },
    });
  });
}

export async function POST() {
  if (process.env.ENABLE_DEMO_MODE !== "true")
    return NextResponse.json(
      { error: "Demo mode is not enabled." },
      { status: 404 },
    );
  try {
    const suffix = randomUUID().replaceAll("-", "").slice(0, 16);
    const email = `visitor-${suffix}@${demoDomain}`;
    const password = `${randomUUID()}Aa1!`;
    const signup = await auth.api.signUpEmail({
      body: { name: "Demo Visitor", email, password },
      headers: await headers(),
    });
    const userId = signup.user?.id;
    if (!userId) throw new Error("Demo signup did not return a user");
    await prisma.user.update({
      where: { id: userId },
      data: { emailVerified: true },
    });
    await seedWorkspace(userId, suffix);
    const response = await auth.api.signInEmail({
      body: { email, password },
      headers: await headers(),
      asResponse: true,
    });
    const result = NextResponse.json(
      { ok: response.ok },
      { status: response.status },
    );
    for (const cookie of response.headers.getSetCookie())
      result.headers.append("set-cookie", cookie);
    return result;
  } catch (error) {
    console.error("Demo session creation failed", error);
    return NextResponse.json(
      { error: "The demo could not be started. Please try again." },
      { status: 503 },
    );
  }
}
