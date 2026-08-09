import { AccountShell } from "@/components/dashboard/account-shell";
import { InviteWorkerForm } from "@/components/company/invite-worker-form";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireCompany } from "@/lib/auth/server";
import { displayText } from "@/lib/display";
import { prisma } from "@supply/database";

export default async function WorkersPage() {
  const { organizationId, session } = await requireCompany();
  const [organization, members, invitations] = await Promise.all([
    prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { name: true },
    }),
    prisma.member.findMany({
      where: { organizationId },
      orderBy: { createdAt: "asc" },
      select: {
        role: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
      },
    }),
    prisma.invitation.findMany({
      where: { organizationId, status: "pending" },
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, role: true, expiresAt: true },
    }),
  ]);

  return (
    <AccountShell
      companyName={displayText(organization.name, "Company")}
      subtitle="Invite people and see who has access to this workspace."
      title="Business team"
      userName={displayText(session.user.name, "User")}
    >
      <div className="team-grid">
        <Card>
          <CardHeader>
            <CardTitle>Invite a teammate</CardTitle>
            <CardDescription>
              Add a manager or employee. Owner access is reserved for the
              workspace owner.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <InviteWorkerForm />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Workspace members</CardTitle>
            <CardDescription>{members.length} active members</CardDescription>
          </CardHeader>
          <CardContent className="team-list">
            {members.map((member) => (
              <div className="team-row" key={member.user.email}>
                <span className="team-avatar">
                  {member.user.name
                    .split(/\s+/)
                    .map((part) => part[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </span>
                <div>
                  <strong>{member.user.name}</strong>
                  <span>{member.user.email}</span>
                </div>
                <Badge variant="secondary">{member.role}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Pending invitations</CardTitle>
            <CardDescription>
              Invitations waiting for a teammate to accept.
            </CardDescription>
          </CardHeader>
          <CardContent className="team-list">
            {invitations.length ? (
              invitations.map((invitation) => (
                <div className="team-row" key={invitation.id}>
                  <span className="team-avatar pending">@</span>
                  <div>
                    <strong>{invitation.email}</strong>
                    <span>
                      {invitation.role ?? "employee"} · expires{" "}
                      {invitation.expiresAt.toLocaleDateString("en-GB")}
                    </span>
                  </div>
                  <Badge>Pending</Badge>
                </div>
              ))
            ) : (
              <p className="empty-state">No pending invitations.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AccountShell>
  );
}
