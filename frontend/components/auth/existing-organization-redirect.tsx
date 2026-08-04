"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { authClient } from "@/lib/auth-client";

export function ExistingOrganizationRedirect({
  organizationId,
  organizationName,
}: {
  organizationId: string;
  organizationName: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function activateOrganization() {
      const result = await authClient.organization.setActive({
        organizationId,
      });
      if (cancelled) return;
      if (result.error) {
        setError(
          result.error.message ?? "Unable to open your existing workspace",
        );
        return;
      }
      router.replace("/");
      router.refresh();
    }

    void activateOrganization();
    return () => {
      cancelled = true;
    };
  }, [organizationId, router]);

  return (
    <AuthShell
      title={error ? "Unable to open workspace" : "Opening your workspace"}
      description={
        error
          ? "There was a problem selecting your existing company."
          : `Signing you in to ${organizationName}.`
      }
    >
      {error ? <p className="form-error">{error}</p> : <p>One moment…</p>}
    </AuthShell>
  );
}
