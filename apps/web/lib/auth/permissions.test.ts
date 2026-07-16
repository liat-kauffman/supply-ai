import { describe, expect, it } from "vitest";

import { employee, manager, owner, superAdmin } from "./permissions";

describe("authentication role boundaries", () => {
  it("allows owners and managers to approve receipts", () => {
    expect(owner.authorize({ receipt: ["approve"] }).success).toBe(true);
    expect(manager.authorize({ receipt: ["approve"] }).success).toBe(true);
  });

  it("does not allow employees to approve receipts or orders", () => {
    expect(employee.authorize({ receipt: ["approve"] }).success).toBe(false);
    expect(employee.authorize({ order: ["approve"] }).success).toBe(false);
  });

  it("keeps platform administration independent from company roles", () => {
    expect(superAdmin.authorize({ user: ["list", "ban"] }).success).toBe(true);
  });
});
