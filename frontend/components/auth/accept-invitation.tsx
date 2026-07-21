"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function AcceptInvitation({ invitationId }: { invitationId: string }) {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (isPending) return <p>Checking your account…</p>;
  if (!session)
    return (
      <div className="auth-form">
        <p>Sign in with the email address that received this invitation.</p>
        <Button asChild>
          <Link href={`/login?next=/accept-invitation/${invitationId}`}>
            Sign in to accept
          </Link>
        </Button>
      </div>
    );

  async function accept() {
    setPending(true);
    const result = await authClient.organization.acceptInvitation({
      invitationId,
    });
    setPending(false);
    if (result.error)
      return setError(result.error.message ?? "Unable to accept invitation");
    router.push("/");
    router.refresh();
  }

  return (
    <div className="auth-form">
      <p>
        You are signed in as <strong>{session.user.email}</strong>.
      </p>
      {error ? <p className="form-error">{error}</p> : null}
      <Button disabled={pending} onClick={accept}>
        {pending ? "Joining…" : "Accept company invitation"}
      </Button>
    </div>
  );
}
