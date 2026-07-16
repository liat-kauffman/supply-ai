import {
  createAccessControl,
  type AccessControl,
} from "better-auth/plugins/access";
import {
  adminAc as organizationAdminDefaults,
  defaultStatements,
  memberAc as organizationMemberDefaults,
  ownerAc as organizationOwnerDefaults,
} from "better-auth/plugins/organization/access";
import {
  adminAc as platformAdminDefaults,
  defaultAc as platformAccessControl,
  userAc as platformUserDefaults,
} from "better-auth/plugins/admin/access";

const organizationStatements = {
  ...defaultStatements,
  inventory: ["read", "count", "adjust"],
  receipt: ["read", "upload", "approve"],
  order: ["read", "edit", "approve"],
  worker: ["read", "invite", "update", "remove"],
  settings: ["read", "update"],
  audit: ["read"],
} as const;

export const organizationAccessControl = createAccessControl(
  organizationStatements,
);

export const owner = organizationAccessControl.newRole({
  ...organizationOwnerDefaults.statements,
  inventory: ["read", "count", "adjust"],
  receipt: ["read", "upload", "approve"],
  order: ["read", "edit", "approve"],
  worker: ["read", "invite", "update", "remove"],
  settings: ["read", "update"],
  audit: ["read"],
});

export const manager = organizationAccessControl.newRole({
  ...organizationAdminDefaults.statements,
  inventory: ["read", "count", "adjust"],
  receipt: ["read", "upload", "approve"],
  order: ["read", "edit", "approve"],
  worker: ["read", "invite", "update", "remove"],
  settings: ["read"],
  audit: ["read"],
});

export const employee = organizationAccessControl.newRole({
  ...organizationMemberDefaults.statements,
  inventory: ["read", "count"],
  receipt: ["read", "upload"],
  order: ["read"],
  worker: [],
  settings: ["read"],
  audit: [],
});

export const organizationRoles = { owner, manager, employee };

export const platformUser = platformUserDefaults;
export const superAdmin = platformAccessControl.newRole(
  platformAdminDefaults.statements,
);
export const platformRoles = { user: platformUser, super_admin: superAdmin };
export const adminAccessControl =
  platformAccessControl as unknown as AccessControl;

export type CompanyRole = keyof typeof organizationRoles;
export type PlatformRole = keyof typeof platformRoles;
