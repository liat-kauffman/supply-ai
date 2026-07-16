import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { requireCompany } from "@/lib/auth/server";

export default async function DashboardPage() {
  await requireCompany();
  return <DashboardShell />;
}
