"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function RegisterForm() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const result = await authClient.signUp.email({
      name: String(form.get("name")),
      email: String(form.get("email")),
      password: String(form.get("password")),
      callbackURL: "/onboarding/company",
    });
    setPending(false);
    if (result.error)
      return setError(result.error.message ?? "Unable to create account");
    setMessage(
      "Check your email to verify your account, then continue company setup.",
    );
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <label>
        Your name
        <input name="name" autoComplete="name" required />
      </label>
      <label>
        Work email
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <label>
        Password
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          required
        />
        <small>At least 12 characters</small>
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
      <Button disabled={pending || Boolean(message)} type="submit">
        {pending ? "Creating account…" : "Create owner account"}
      </Button>
      <small>
        Already registered? <Link href="/login">Sign in</Link>
      </small>
    </form>
  );
}
