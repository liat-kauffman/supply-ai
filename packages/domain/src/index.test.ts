import { describe, expect, it } from "vitest";
import { canApprove, inventoryMovementInputSchema } from "./index";

describe("domain safeguards", () => {
  it("only lets managers and owners approve", () => {
    expect(canApprove("MANAGER")).toBe(true);
    expect(canApprove("EMPLOYEE")).toBe(false);
  });

  it("rejects zero-value inventory movements", () => {
    expect(
      inventoryMovementInputSchema.safeParse({
        businessId: "biz_1",
        locationId: "loc_1",
        productId: "prod_1",
        type: "CORRECTION",
        quantityDelta: 0,
        unit: "unit",
        idempotencyKey: "correction-123",
      }).success,
    ).toBe(false);
  });
});
