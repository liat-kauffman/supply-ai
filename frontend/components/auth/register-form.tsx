"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

function readableError(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

export function RegisterForm() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verificationEmail, setVerificationEmail] = useState<string | null>(
    null,
  );
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();

    try {
      const result = await authClient.signUp.email({
        name: String(form.get("name") ?? "").trim(),
        email,
        password: String(form.get("password") ?? ""),
        callbackURL: "/onboarding/company",
      });
      if (result.error) {
        const message =
          result.error.code === "USER_ALREADY_EXISTS"
            ? "An account already exists for this email. Try signing in or reset your password."
            : readableError(
                result.error.message,
                "Unable to create account. Please try again.",
              );
        return setError(message);
      }
      setVerificationEmail(email);
      setMessage(
        "Check your email to verify your account, then continue company setup.",
      );
    } catch {
      setError(
        "We could not reach the registration service. Check your connection and try again.",
      );
    } finally {
      setPending(false);
    }
  }

  async function resendVerificationEmail() {
    if (!verificationEmail) return;
    setPending(true);
    setError(null);
    try {
      const result = await authClient.sendVerificationEmail({
        email: verificationEmail,
        callbackURL: "/onboarding/company",
      });
      if (result.error)
        return setError(
          readableError(
            result.error.message,
            "Unable to resend verification email",
          ),
        );
      setMessage(
        "A new verification email was sent. Check your inbox and spam folder.",
      );
    } catch {
      setError(
        "We could not reach the email service. Check your connection and try again.",
      );
    } finally {
      setPending(false);
    }
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
      {verificationEmail ? (
        <Button
          disabled={pending}
          onClick={resendVerificationEmail}
          type="button"
          variant="secondary"
        >
          {pending ? "Sending…" : "Resend verification email"}
        </Button>
      ) : null}
      <small>
        Already registered? <Link href="/login">Sign in</Link>
      </small>
    </form>
  );
}
