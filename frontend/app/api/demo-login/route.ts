import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { prisma } from "@supply/database";
import { auth } from "@/lib/auth";

const demoDomain = "demo.supplai-pilot.com";
const demoEmail = process.env.DEMO_USER_EMAIL ?? `maya.cohen@${demoDomain}`;
const demoPassword = process.env.DEMO_USER_PASSWORD;
const demoSuffix = "default";

const demoProductDefinitions = [
  ["House Espresso Beans", "Coffee", "kg", 8, 24, "HIGH"],
  ["Whole Milk", "Dairy", "bottles", 12, 48, "MEDIUM"],
  ["Takeaway Cups 12oz", "Packaging", "cups", 100, 500, "LOW"],
  ["Oat Milk", "Dairy", "cartons", 8, 30, "MEDIUM"],
  ["Paper Lids 12oz", "Packaging", "lids", 100, 500, "LOW"],
  ["Vanilla Syrup", "Syrups", "bottles", 3, 12, "MEDIUM"],
  ["Chocolate Croissants", "Bakery", "units", 12, 48, "HIGH"],
  ["Granola", "Food", "kg", 4, 16, "LOW"],
  ["All-Purpose Cleaner", "Cleaning", "bottles", 2, 8, "LOW"],
  ["Napkins", "Packaging", "packs", 10, 40, "LOW"],
  ["Brown Sugar", "Pantry", "kg", 3, 12, "MEDIUM"],
  ["Sparkling Water", "Beverages", "cases", 4, 16, "MEDIUM"],
] as const;

async function ensureDemoHistory(userId: string, organizationId: string) {
  await prisma.$transaction(
    async (tx) => {
      const business = await tx.businessProfile.findUniqueOrThrow({
        where: { id: organizationId },
      });
      const mainLocation =
        (await tx.location.findFirst({
          where: { businessId: organizationId, name: "Main Café" },
        })) ??
        (await tx.location.create({
          data: {
            id: `demo-location-${demoSuffix}`,
            businessId: organizationId,
            name: "Main Café",
            address: "12 Seaside Avenue",
          },
        }));
      const kitchen =
        (await tx.location.findFirst({
          where: { businessId: organizationId, name: "Production Kitchen" },
        })) ??
        (await tx.location.create({
          data: {
            id: `demo-kitchen-${demoSuffix}`,
            businessId: organizationId,
            name: "Production Kitchen",
            address: "14 Seaside Avenue",
          },
        }));
      const mainStore =
        (await tx.storageArea.findFirst({
          where: { locationId: mainLocation.id, name: "Main Store" },
        })) ??
        (await tx.storageArea.create({
          data: {
            id: `demo-storage-${demoSuffix}`,
            locationId: mainLocation.id,
            name: "Main Store",
            description: "Dry store and service counter",
          },
        }));
      const coldStorage =
        (await tx.storageArea.findFirst({
          where: { locationId: kitchen.id, name: "Cold Storage" },
        })) ??
        (await tx.storageArea.create({
          data: {
            id: `demo-cold-storage-${demoSuffix}`,
            locationId: kitchen.id,
            name: "Cold Storage",
            description: "Milk, bakery, and chilled ingredients",
          },
        }));

      const team = [
        [
          "demo-manager",
          "Daniel Levi",
          "daniel.levi@demo.supplai-pilot.com",
          "manager",
        ],
        [
          "demo-employee",
          "Noa Ben-Ami",
          "noa.benami@demo.supplai-pilot.com",
          "employee",
        ],
      ] as const;
      for (const [id, name, email, role] of team) {
        await tx.user.upsert({
          where: { id },
          update: { name },
          create: { id, name, email, emailVerified: true },
        });
        await tx.member.upsert({
          where: { organizationId_userId: { organizationId, userId: id } },
          update: { role },
          create: {
            id: `demo-member-${id}`,
            organizationId,
            userId: id,
            role,
            createdAt: new Date(Date.now() - 290 * 86400000),
          },
        });
      }

      const supplierDefinitions = [
        ["North Star Foods", [1, 3, 5], "14:00", 1],
        ["Green Valley Dairy", [2, 4], "11:30", 1],
        ["Coastal Packaging", [1, 4], "16:00", 3],
        ["Harbor Bakehouse", [1, 2, 3, 4, 5, 6], "08:00", 1],
      ] as const;
      const suppliers = [];
      for (const [
        index,
        [name, orderDays, cutoffTime, leadDays],
      ] of supplierDefinitions.entries()) {
        const supplier =
          (await tx.supplier.findFirst({
            where: { businessId: organizationId, name },
          })) ??
          (await tx.supplier.create({
            data: {
              id: `demo-supplier-${index + 1}`,
              businessId: organizationId,
              name,
              orderDays: [...orderDays],
              cutoffTime,
              deliveryLeadDays: leadDays,
              minimumOrderValue: index === 2 ? 180 : 250,
              freeDeliveryThreshold: index === 2 ? 350 : 500,
            },
          }));
        suppliers.push(supplier);
      }

      const products = [];
      for (const [
        index,
        [name, category, unit, minimum, target, criticality],
      ] of demoProductDefinitions.entries()) {
        const existing = await tx.product.findFirst({
          where: { businessId: organizationId, name },
        });
        const product =
          existing ??
          (await tx.product.create({
            data: {
              id: `demo-product-${index + 1}`,
              businessId: organizationId,
              name,
              description: `${name} used in daily Harbor Coffee operations`,
              category,
              measurementMode: unit === "kg" ? "WEIGHT" : "UNIT",
              baseUnit: unit,
              primaryStorageAreaId:
                category === "Dairy" || category === "Bakery"
                  ? coldStorage.id
                  : mainStore.id,
              minimumStock: minimum,
              targetStock: target,
              safetyStock: Math.max(1, Math.round(minimum * 0.5)),
              criticality,
            },
          }));
        products.push(product);
      }

      const supplierProducts = new Map<
        string,
        {
          id: string;
          supplierId: string;
          productId: string;
          unitsPerPackage: number;
          latestPackagePrice: number;
        }
      >();
      for (const [index, product] of products.entries()) {
        const supplier = suppliers[index % suppliers.length]!;
        const supplierProduct = await tx.supplierProduct.upsert({
          where: {
            supplierId_productId: {
              supplierId: supplier.id,
              productId: product.id,
            },
          },
          update: {
            latestPackagePrice:
              [92, 7.5, 38, 12, 24, 36, 9, 28, 18, 14, 5, 22][index] ?? 20,
          },
          create: {
            id: `demo-supplier-product-${index + 1}`,
            supplierId: supplier.id,
            productId: product.id,
            supplierSku: `HCF-${String(index + 1).padStart(3, "0")}`,
            unitsPerPackage:
              product.baseUnit === "kg"
                ? 1
                : product.baseUnit === "bottles"
                  ? 6
                  : 50,
            packageSize: product.baseUnit === "kg" ? 1 : 50,
            packageUnit: product.baseUnit,
            latestPackagePrice:
              [92, 7.5, 38, 12, 24, 36, 9, 28, 18, 14, 5, 22][index] ?? 20,
            isPreferred: true,
          },
        });
        supplierProducts.set(product.id, {
          id: supplierProduct.id,
          supplierId: supplier.id,
          productId: product.id,
          unitsPerPackage: Number(supplierProduct.unitsPerPackage),
          latestPackagePrice: Number(supplierProduct.latestPackagePrice ?? 20),
        });
      }

      const now = new Date();
      for (let month = 11; month >= 0; month -= 1) {
        const receiptDate = new Date(now);
        receiptDate.setDate(5);
        receiptDate.setMonth(now.getMonth() - month);
        const receiptId = `demo-receipt-${demoSuffix}-${month}`;
        const receiptLines = products.slice(0, 8).map((product, index) => {
          const supplierProduct = supplierProducts.get(product.id)!;
          const quantity = [30, 120, 500, 45, 500, 8, 80, 12][index] ?? 20;
          return {
            productId: product.id,
            supplierProductId: supplierProduct.id,
            name: product.name,
            category: product.category,
            packageCount: Math.ceil(quantity / supplierProduct.unitsPerPackage),
            unitsPerPackage: supplierProduct.unitsPerPackage,
            quantity,
            unit: product.baseUnit,
            packagePrice: supplierProduct.latestPackagePrice,
            lineTotal:
              Math.ceil(quantity / supplierProduct.unitsPerPackage) *
              supplierProduct.latestPackagePrice,
          };
        });
        await tx.receipt.upsert({
          where: { id: receiptId },
          update: {},
          create: {
            id: receiptId,
            businessId: organizationId,
            supplierId: suppliers[month % suppliers.length]!.id,
            locationId: month % 3 === 0 ? kitchen.id : mainLocation.id,
            receiptDate,
            invoiceNumber: `HCF-${String(2400 + (11 - month)).padStart(4, "0")}`,
            fileName: `harbor-coffee-receipt-${receiptDate.toISOString().slice(0, 7)}.pdf`,
            confidence: 0.93 + (month % 6) / 100,
            vatAmount: 48 + month * 2.5,
            totalAmount: 290 + month * 18.75,
            createdById: month % 4 === 0 ? userId : "demo-manager",
            lines: { create: receiptLines },
          },
        });
        await tx.inventoryMovement.createMany({
          data: products.slice(0, 8).flatMap((product, index) => {
            const quantity = [30, 120, 500, 45, 500, 8, 80, 12][index] ?? 20;
            return [
              {
                businessId: organizationId,
                locationId: month % 3 === 0 ? kitchen.id : mainLocation.id,
                productId: product.id,
                type: "RECEIPT" as const,
                quantityDelta: quantity,
                unit: product.baseUnit,
                sourceType: "Receipt",
                sourceId: receiptId,
                reason: "Supplier delivery received",
                createdById: userId,
                occurredAt: receiptDate,
                idempotencyKey: `demo-history-receipt-${month}-${product.id}`,
              },
              {
                businessId: organizationId,
                locationId: mainLocation.id,
                productId: product.id,
                type: "USAGE_ESTIMATE" as const,
                quantityDelta: -(
                  quantity - Math.max(1, Math.round(quantity * 0.08))
                ),
                unit: product.baseUnit,
                sourceType: "Monthly usage estimate",
                reason: "Routine service usage",
                createdById: "demo-manager",
                occurredAt: new Date(receiptDate.getTime() + 18 * 86400000),
                idempotencyKey: `demo-history-usage-${month}-${product.id}`,
              },
            ];
          }),
          skipDuplicates: true,
        });
      }

      for (let month = 10; month >= 0; month -= 1) {
        const createdAt = new Date(now.getTime() - month * 30 * 86400000);
        const supplier = suppliers[month % suppliers.length]!;
        const status =
          month === 0 ? "PENDING" : month % 5 === 0 ? "REJECTED" : "APPROVED";
        const requestId = `demo-order-${demoSuffix}-${month}`;
        await tx.orderBasketRequest.upsert({
          where: { id: requestId },
          update: {},
          create: {
            id: requestId,
            businessId: organizationId,
            supplierId: supplier.id,
            requestedById: "demo-manager",
            reviewedById: status === "PENDING" ? null : userId,
            status,
            currency: business.currency,
            note:
              status === "PENDING"
                ? "Next delivery window replenishment"
                : "Weekly replenishment review",
            createdAt,
            reviewedAt:
              status === "PENDING"
                ? null
                : new Date(createdAt.getTime() + 86400000),
            lines: {
              create: products
                .slice(month % 3, (month % 3) + 3)
                .map((product, index) => {
                  const supplierProduct = supplierProducts.get(product.id)!;
                  const packages = index + 2;
                  return {
                    productId: product.id,
                    productName: product.name,
                    supplierSku: supplierProduct.id,
                    unit: product.baseUnit,
                    requestedQuantity:
                      packages * supplierProduct.unitsPerPackage,
                    unitsPerPackage: supplierProduct.unitsPerPackage,
                    packageCount: packages,
                    latestPackagePrice: supplierProduct.latestPackagePrice,
                    estimatedCost:
                      packages * supplierProduct.latestPackagePrice,
                  };
                }),
            },
          },
        });
      }

      for (let index = 0; index < 4; index += 1) {
        const scanId = `demo-scan-${demoSuffix}-${index}`;
        const product = products[index]!;
        await tx.inventoryScan.upsert({
          where: { id: scanId },
          update: {},
          create: {
            id: scanId,
            businessId: organizationId,
            storageAreaId: index % 2 ? coldStorage.id : mainStore.id,
            createdById: index % 2 ? "demo-manager" : userId,
            reviewedById: userId,
            status: "APPROVED",
            observations: [
              {
                productId: product.id,
                name: product.name,
                count: 18 + index * 4,
                confidence: 0.91 + index / 100,
              },
            ],
            globalWarnings: [],
            unrecognizedItems: [],
            createdAt: new Date(now.getTime() - (index + 1) * 21 * 86400000),
            reviewedAt: new Date(now.getTime() - (index + 1) * 20 * 86400000),
          },
        });
      }

      await tx.auditEvent.createMany({
        data: (
          [
            [
              "demo-audit-onboarding",
              "workspace.onboarding_completed",
              "Organization",
              organizationId,
            ],
            [
              "demo-audit-first-receipt",
              "receipt.approved",
              "Receipt",
              `demo-receipt-${demoSuffix}-11`,
            ],
            [
              "demo-audit-first-order",
              "order_basket.approved",
              "OrderBasketRequest",
              `demo-order-${demoSuffix}-10`,
            ],
            [
              "demo-audit-latest-scan",
              "inventory_scan.approved",
              "InventoryScan",
              `demo-scan-${demoSuffix}-0`,
            ],
          ] as const
        ).map(([id, action, entityType, entityId], index) => ({
          id,
          businessId: organizationId,
          actorId: index === 0 ? userId : "demo-manager",
          action,
          entityType,
          entityId,
          metadata: { source: "demo-history", yearOfHistory: true },
          occurredAt: new Date(now.getTime() - (365 - index * 90) * 86400000),
        })),
        skipDuplicates: true,
      });
    },
    { maxWait: 10_000, timeout: 60_000 },
  );
}

async function seedWorkspace(userId: string, suffix: string) {
  const now = new Date();
  await prisma.$transaction(
    async (tx) => {
      const organization = await tx.organization.create({
        data: {
          id: `demo-org-${suffix}`,
          name: "Harbor Coffee",
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
              supplierSku: `NSF-${index + 1}`,
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
          invoiceNumber: "INV-1042",
          fileName: "north-star-foods-invoice.pdf",
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
          reason: "Opening stock count",
          createdById: userId,
          idempotencyKey: `demo-${suffix}-${index}`,
        })),
      });
      await tx.orderBasketRequest.create({
        data: {
          businessId: organization.id,
          supplierId: supplier.id,
          requestedById: userId,
          note: "Weekly replenishment request",
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
    },
    {
      maxWait: 10_000,
      timeout: 30_000,
    },
  );
}

export async function POST() {
  if (process.env.ENABLE_DEMO_MODE !== "true")
    return NextResponse.json(
      { error: "Workspace access is not enabled." },
      { status: 404 },
    );
  if (!demoPassword)
    return NextResponse.json(
      { error: "Workspace access is missing its server password." },
      { status: 503 },
    );
  try {
    const existingUser = await prisma.user.findUnique({
      where: { email: demoEmail },
      select: { id: true },
    });
    let userId = existingUser?.id;
    if (!userId) {
      const signup = await auth.api.signUpEmail({
        body: { name: "Maya Cohen", email: demoEmail, password: demoPassword },
        headers: await headers(),
      });
      userId = signup.user?.id;
    }
    if (!userId) throw new Error("Demo signup did not return a user");
    await prisma.user.update({
      where: { id: userId },
      data: { emailVerified: true },
    });
    const existingMembership = await prisma.member.findFirst({
      where: {
        userId,
        organizationId: `demo-org-${demoSuffix}`,
      },
      select: { id: true },
    });
    if (!existingMembership) {
      const existingOrganization = await prisma.organization.findUnique({
        where: { id: `demo-org-${demoSuffix}` },
        select: { id: true },
      });
      if (existingOrganization) {
        await prisma.member.create({
          data: {
            id: `demo-member-${demoSuffix}-${userId.slice(-8)}`,
            organizationId: existingOrganization.id,
            userId,
            role: "owner",
            createdAt: new Date(),
          },
        });
      } else {
        await seedWorkspace(userId, demoSuffix);
      }
    }
    const demoOrganizationId = `demo-org-${demoSuffix}`;
    await ensureDemoHistory(userId, demoOrganizationId);
    await prisma.organization.update({
      where: { id: demoOrganizationId },
      data: { name: "Harbor Coffee" },
    });
    await prisma.receipt.updateMany({
      where: { businessId: demoOrganizationId },
      data: {
        invoiceNumber: "INV-1042",
        fileName: "north-star-foods-invoice.pdf",
      },
    });
    await prisma.inventoryMovement.updateMany({
      where: { businessId: demoOrganizationId },
      data: { reason: "Opening stock count" },
    });
    await prisma.orderBasketRequest.updateMany({
      where: { businessId: demoOrganizationId },
      data: { note: "Weekly replenishment request" },
    });
    const response = await auth.api.signInEmail({
      body: { email: demoEmail, password: demoPassword },
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
      { error: "The workspace could not be opened. Please try again." },
      { status: 503 },
    );
  }
}
