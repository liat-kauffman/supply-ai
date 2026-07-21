import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { InviteWorkerForm } from "@/components/company/invite-worker-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireCompany } from "@/lib/auth/server";

export default async function WorkersPage() {
  await requireCompany();
  return (
    <main className="settings-page">
      <Link href="/">
        <ArrowLeft /> Dashboard
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>Workers</CardTitle>
          <CardDescription>
            Invite workers by email and assign their company role. Owner access
            cannot be granted here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InviteWorkerForm />
        </CardContent>
      </Card>
    </main>
  );
}
