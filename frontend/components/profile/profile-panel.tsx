"use client";

import { LogOut, Mail, ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";

export function ProfilePanel({
  name,
  email,
  companyName,
  role,
  joinedAt,
}: {
  name: string;
  email: string;
  companyName: string;
  role: string;
  joinedAt: string;
}) {
  const router = useRouter();

  async function signOut() {
    await authClient.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="account-grid">
      <Card>
        <CardHeader>
          <CardTitle>Your profile</CardTitle>
        </CardHeader>
        <CardContent className="profile-details">
          <div className="profile-hero">
            <span className="profile-avatar">
              {name
                .split(/\s+/)
                .map((part) => part[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </span>
            <div>
              <h2>{name}</h2>
              <p>{email}</p>
            </div>
          </div>
          <dl className="profile-facts">
            <div>
              <dt>
                <UserRound /> Account name
              </dt>
              <dd>{name}</dd>
            </div>
            <div>
              <dt>
                <Mail /> Email address
              </dt>
              <dd>{email}</dd>
            </div>
            <div>
              <dt>
                <ShieldCheck /> Member since
              </dt>
              <dd>{joinedAt}</dd>
            </div>
          </dl>
          <Button
            className="sign-out-button"
            onClick={signOut}
            variant="outline"
          >
            <LogOut /> Sign out
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Current workspace</CardTitle>
        </CardHeader>
        <CardContent className="workspace-summary">
          <span className="workspace-mark">{companyName.slice(0, 1)}</span>
          <div>
            <h2>{companyName}</h2>
            <p>{role} access</p>
          </div>
          <Button asChild variant="secondary">
            <Link href="/company/workers">View team</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
