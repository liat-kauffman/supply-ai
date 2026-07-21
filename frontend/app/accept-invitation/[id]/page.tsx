import { AuthShell } from "@/components/auth/auth-shell";
import { AcceptInvitation } from "@/components/auth/accept-invitation";

export default async function AcceptInvitationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <AuthShell
      title="Company invitation"
      description="Join your team workspace with the assigned role."
    >
      <AcceptInvitation invitationId={id} />
    </AuthShell>
  );
}
