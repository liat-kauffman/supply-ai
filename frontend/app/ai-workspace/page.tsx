import { AiWorkspaceShell } from "@/components/ai-workspace/ai-workspace-shell";
import { requireOnboardedCompany } from "@/lib/auth/server";
import { displayText } from "@/lib/display";
import { prisma } from "@supply/database";

export default async function AiWorkspacePage() {
  const { organizationId, session } = await requireOnboardedCompany();
  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { name: true },
  });

  return (
    <AiWorkspaceShell
      companyName={displayText(organization.name, "Company")}
      userName={displayText(session.user.name, "User")}
    />
  );
}
