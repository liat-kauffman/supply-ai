import { prisma } from "@supply/database";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin, organization } from "better-auth/plugins";

import { sendAuthEmail } from "./auth/email";
import {
  organizationAccessControl,
  organizationRoles,
  adminAccessControl,
  platformRoles,
} from "./auth/permissions";

const baseURL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

export const auth = betterAuth({
  appName: "Supplai",
  baseURL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 12,
    async sendResetPassword({ user, url }) {
      await sendAuthEmail({
        to: user.email,
        subject: "Reset your Supplai password",
        actionUrl: url,
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    async sendVerificationEmail({ user, url }) {
      if (user.email.endsWith("@demo.supplai-pilot.com")) return;
      await sendAuthEmail({
        to: user.email,
        subject: "Verify your Supplai account",
        actionUrl: url,
      });
    },
  },
  plugins: [
    organization({
      ac: organizationAccessControl,
      roles: organizationRoles,
      creatorRole: "owner",
      organizationLimit: 1,
      membershipLimit: 100,
      invitationExpiresIn: 60 * 60 * 48,
      requireEmailVerificationOnInvitation: true,
      disableOrganizationDeletion: true,
      async sendInvitationEmail({
        email,
        id,
        organization: invitedOrganization,
      }) {
        const url = `${baseURL}/accept-invitation/${id}`;
        await sendAuthEmail({
          to: email,
          subject: `Join ${invitedOrganization.name} on Supplai`,
          actionUrl: url,
        });
      },
      organizationHooks: {
        async afterCreateOrganization({ organization: createdOrganization }) {
          await prisma.businessProfile.upsert({
            where: { id: createdOrganization.id },
            update: {},
            create: {
              id: createdOrganization.id,
              timezone: "Asia/Jerusalem",
              currency: "ILS",
            },
          });
        },
      },
    }),
    admin({
      ac: adminAccessControl,
      roles: platformRoles,
      defaultRole: "user",
      adminRoles: ["super_admin"],
      adminUserIds: process.env.SUPER_ADMIN_USER_IDS?.split(",")
        .map((id) => id.trim())
        .filter(Boolean),
    }),
  ],
  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
  },
});
