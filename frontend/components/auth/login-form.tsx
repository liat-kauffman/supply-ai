"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

function readableError(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [demoPending, setDemoPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");

    try {
      const result = await authClient.signIn.email({ email, password });
      if (result.error) {
        const message =
          result.error.code === "EMAIL_NOT_VERIFIED"
            ? "Please verify your email before signing in. Check your inbox and spam folder."
            : result.error.code === "INVALID_EMAIL_OR_PASSWORD"
              ? "The email or password is incorrect."
              : readableError(
                  result.error.message,
                  "Unable to sign in. Please try again.",
                );
        return setError(message);
      }
      router.push(searchParams.get("next") ?? "/");
      router.refresh();
    } catch {
      setError(
        "We could not reach the sign-in service. Check your connection and try again.",
      );
    } finally {
      setPending(false);
    }
  }

  async function tryDemo() {
    setDemoPending(true);
    setError(null);
    try {
      const response = await fetch("/api/demo-login", { method: "POST" });
      const result = (await response.json().catch(() => null)) as {
        error?: unknown;
      } | null;
      if (!response.ok)
        return setError(
          readableError(result?.error, "Unable to open the workspace"),
        );
      router.push(searchParams.get("next") ?? "/");
      router.refresh();
    } catch {
      setError(
        "We could not reach the workspace service. Check your connection and try again.",
      );
    } finally {
      setDemoPending(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <label>
        Email
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <label>
        Password
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          minLength={12}
          required
        />
      </label>
      <small>
        <Link href="/forgot-password">Forgot your password?</Link>
      </small>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <Button disabled={pending} type="submit">
        {pending ? "Signing in…" : "Sign in"}
      </Button>
      <Button
        disabled={pending || demoPending}
        onClick={tryDemo}
        type="button"
        variant="outline"
      >
        {demoPending ? "Opening workspace…" : "Explore the workspace"}
      </Button>
      <small>
        Registering a company?{" "}
        <Link href="/register">Create an owner account</Link>
      </small>
    </form>
  );
}
