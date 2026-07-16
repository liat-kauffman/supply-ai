"use client";

import { FormEvent, useState } from "react";
import { UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import type { CompanyRole } from "@/lib/auth/permissions";

const assignableRoles: Exclude<CompanyRole, "owner">[] = [
  "manager",
  "employee",
];

export function InviteWorkerForm() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setPending(true);
    setMessage(null);
    setError(null);
    const form = new FormData(formElement);
    const email = String(form.get("email"));
    const role = String(form.get("role")) as Exclude<CompanyRole, "owner">;
    if (!assignableRoles.includes(role)) {
      setPending(false);
      return setError("Invalid worker role");
    }
    const result = await authClient.organization.inviteMember({
      email,
      role,
      resend: true,
    });
    setPending(false);
    if (result.error)
      return setError(result.error.message ?? "Unable to invite worker");
    formElement.reset();
    setMessage(`Invitation sent to ${email}.`);
  }

  return (
    <form className="worker-form" onSubmit={submit}>
      <label>
        Worker email
        <input type="email" name="email" required />
      </label>
      <label>
        Company role
        <select name="role" defaultValue="employee">
          <option value="employee">Employee</option>
          <option value="manager">Manager</option>
        </select>
      </label>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="form-success" role="status">
          {message}
        </p>
      ) : null}
      <Button disabled={pending} type="submit">
        <UserPlus />
        {pending ? "Sending…" : "Invite worker"}
      </Button>
    </form>
  );
}
