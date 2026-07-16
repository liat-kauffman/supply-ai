import { prisma } from "../packages/database/src/client";

const email = process.argv[2]?.trim().toLowerCase();
if (!email)
  throw new Error("Usage: pnpm auth:bootstrap-admin <verified-user-email>");

const user = await prisma.user.findUnique({ where: { email } });
if (!user)
  throw new Error(
    `No Better Auth user exists for ${email}. Register and verify the account first.`,
  );

await prisma.user.update({
  where: { id: user.id },
  data: { role: "super_admin" },
});
console.info(`Granted super_admin to ${email} (${user.id}).`);
await prisma.$disconnect();
