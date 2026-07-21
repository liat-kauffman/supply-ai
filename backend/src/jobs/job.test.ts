import { describe, expect, it } from "vitest";
import { jobEnvelopeSchema } from "./job";

describe("job envelope", () => {
  it("requires a tenant and known job type", () => {
    expect(
      jobEnvelopeSchema.safeParse({
        id: "job-12345",
        type: "UNKNOWN",
        payload: {},
      }).success,
    ).toBe(false);
  });
});
