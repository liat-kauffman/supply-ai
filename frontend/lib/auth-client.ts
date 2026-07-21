import { createAuthClient } from "better-auth/react";
import { adminClient, organizationClient } from "better-auth/client/plugins";

import {
  organizationAccessControl,
  organizationRoles,
  adminAccessControl,
  platformRoles,
} from "./auth/permissions";

export const authClient = createAuthClient({
  plugins: [
    organizationClient({
      ac: organizationAccessControl,
      roles: organizationRoles,
    }),
    adminClient({ ac: adminAccessControl, roles: platformRoles }),
  ],
});

export const { signIn, signOut, signUp, useSession } = authClient;
