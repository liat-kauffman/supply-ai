import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.organization.upsert({
    where: { id: "demo-cafe" },
    update: {},
    create: {
      id: "demo-cafe",
      name: "Supply Café",
      slug: "supply-cafe",
      createdAt: new Date(),
      businessProfile: {
        create: {
          timezone: "Asia/Jerusalem",
          currency: "ILS",
          locations: { create: { id: "main-cafe", name: "Main Café" } },
        },
      },
    },
  });
}

main().finally(() => prisma.$disconnect());
