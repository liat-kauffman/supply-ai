import { AccountShell } from "@/components/dashboard/account-shell";
import { ProfilePanel } from "@/components/profile/profile-panel";
import { requireSession } from "@/lib/auth/server";
import { displayText } from "@/lib/display";
import { prisma } from "@supply/database";

export default async function ProfilePage() {
  const session = await requireSession();
  const membership = await prisma.member.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
    select: {
      role: true,
      organization: { select: { name: true } },
    },
  });
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { name: true, email: true, createdAt: true },
  });
  const userName = displayText(user.name, "User");
  const companyName = displayText(
    membership?.organization.name,
    "No workspace",
  );

  return (
    <AccountShell
      companyName={companyName}
      subtitle="Manage your account and workspace access."
      title="Profile & settings"
      userName={userName}
    >
      <ProfilePanel
        companyName={companyName}
        email={user.email}
        joinedAt={user.createdAt.toLocaleDateString("en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
        name={userName}
        role={displayText(membership?.role, "member")}
      />
    </AccountShell>
  );
}
