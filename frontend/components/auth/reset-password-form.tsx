"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(
    token ? null : "This password reset link is missing or invalid.",
  );
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;

    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password"));
    const confirmation = String(form.get("passwordConfirmation"));
    if (password !== confirmation) {
      setPending(false);
      return setError("Passwords do not match.");
    }

    const result = await authClient.resetPassword({
      newPassword: password,
      token,
    });
    setPending(false);
    if (result.error)
      return setError(result.error.message ?? "Unable to reset password");
    setMessage("Your password has been reset. You can now sign in.");
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <label>
        New password
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          required
        />
        <small>At least 12 characters</small>
      </label>
      <label>
        Confirm new password
        <input
          name="passwordConfirmation"
          type="password"
          autoComplete="new-password"
          minLength={12}
          required
        />
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
      <Button disabled={pending || Boolean(message) || !token} type="submit">
        {pending ? "Updating password…" : "Set new password"}
      </Button>
      <small>
        <Link href="/login">Back to sign in</Link>
      </small>
    </form>
  );
}
