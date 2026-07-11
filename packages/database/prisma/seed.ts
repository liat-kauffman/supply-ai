import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.business.upsert({
    where: { id: "demo-cafe" },
    update: {},
    create: {
      id: "demo-cafe",
      name: "Supply Café",
      locations: { create: { id: "main-cafe", name: "Main Café" } },
      users: {
        create: {
          id: "demo-manager",
          name: "Maya",
          email: "manager@supply.local",
          role: "MANAGER",
        },
      },
    },
  });
}

main().finally(() => prisma.$disconnect());
