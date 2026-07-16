import { prisma } from "@supply/database";
import Link from "next/link";
import { ArrowLeft, Building2, Users } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireSuperAdmin } from "@/lib/auth/server";

export default async function PlatformAdminPage() {
  await requireSuperAdmin();
  const [companies, users] = await Promise.all([
    prisma.organization.count(),
    prisma.user.count(),
  ]);

  return (
    <main className="settings-page">
      <Link href="/">
        <ArrowLeft /> Dashboard
      </Link>
      <div className="admin-heading">
        <p>PLATFORM ADMINISTRATION</p>
        <h1>Supplying control plane</h1>
        <span>Platform access is separate from every company membership.</span>
      </div>
      <div className="admin-grid">
        <Card>
          <CardHeader>
            <Building2 />
            <CardDescription>Registered companies</CardDescription>
            <CardTitle>{companies}</CardTitle>
          </CardHeader>
          <CardContent>
            Company inventory remains isolated by organization.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Users />
            <CardDescription>Registered identities</CardDescription>
            <CardTitle>{users}</CardTitle>
          </CardHeader>
          <CardContent>
            Company permissions come from membership roles.
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
