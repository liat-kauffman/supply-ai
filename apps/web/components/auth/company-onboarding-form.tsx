"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function CompanyOnboardingForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const name = String(form.get("companyName"));
    const result = await authClient.organization.create({
      name,
      slug: `${slugify(name)}-${crypto.randomUUID().slice(0, 6)}`,
    });
    setPending(false);
    if (result.error)
      return setError(result.error.message ?? "Unable to create company");
    router.push("/");
    router.refresh();
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <label>
        Company name
        <input
          name="companyName"
          autoComplete="organization"
          placeholder="Supply Café"
          required
        />
      </label>
      <label>
        Primary location
        <input name="location" defaultValue="Main café" disabled />
        <small>You can add more locations later.</small>
      </label>
      <label>
        Timezone
        <select name="timezone" defaultValue="Asia/Jerusalem" disabled>
          <option value="Asia/Jerusalem">Asia/Jerusalem</option>
        </select>
      </label>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <Button disabled={pending} type="submit">
        {pending ? "Creating workspace…" : "Create company workspace"}
      </Button>
    </form>
  );
}
