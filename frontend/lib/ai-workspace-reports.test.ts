import { describe, expect, it } from "vitest";

import { reportForPrompt } from "./ai-workspace-reports";

describe("AI workspace report routing", () => {
  it("matches a misspelled weekly pre-VAT receipt request", () => {
    expect(
      reportForPrompt(
        "Make an Excel sheet of reciepts by week with date and before VAT total",
      ),
    ).toBe("receipts-weekly-pre-vat");
  });

  it("uses the inventory report when inventory fields include suppliers", () => {
    expect(
      reportForPrompt(
        "Create an Excel sheet with inventory, suppliers, stock levels, and last updates",
      ),
    ).toBe("inventory");
  });

  it("does not default an unsupported description to another report", () => {
    expect(reportForPrompt("Create an Excel payroll forecast")).toBeNull();
  });
});
