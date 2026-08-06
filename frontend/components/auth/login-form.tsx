"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

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
    const result = await authClient.signIn.email({
      email: String(form.get("email")),
      password: String(form.get("password")),
    });
    setPending(false);
    if (result.error)
      return setError(result.error.message ?? "Unable to sign in");
    router.push(searchParams.get("next") ?? "/");
    router.refresh();
  }

  async function tryDemo() {
    setDemoPending(true);
    setError(null);
    const response = await fetch("/api/demo-login", { method: "POST" });
    const result = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    setDemoPending(false);
    if (!response.ok)
      return setError(result?.error ?? "Unable to start the demo");
    router.push(searchParams.get("next") ?? "/");
    router.refresh();
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
        {demoPending ? "Opening demo…" : "Explore the demo"}
      </Button>
      <small>
        Registering a company?{" "}
        <Link href="/register">Create an owner account</Link>
      </small>
    </form>
  );
}
