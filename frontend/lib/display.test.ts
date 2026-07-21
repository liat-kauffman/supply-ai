import { describe, expect, it } from "vitest";

import {
  displayMoney,
  displayNumber,
  displayPercent,
  displayText,
  finiteNumber,
  finiteNumberOrNull,
} from "./display";

describe("display normalization", () => {
  it("replaces missing and invalid text values", () => {
    expect(displayText(null)).toBe("—");
    expect(displayText(" NaN ")).toBe("—");
    expect(displayText("undefined", "Not available")).toBe("Not available");
  });

  it("never formats non-finite numbers", () => {
    expect(finiteNumber(Number.NaN)).toBe(0);
    expect(finiteNumberOrNull(Number.POSITIVE_INFINITY)).toBeNull();
    expect(displayNumber(Number.NaN)).toBe("—");
    expect(displayPercent(Number.NaN)).toBe("—");
    expect(displayMoney(Number.NaN, "ILS")).toBe("—");
  });

  it("falls back safely for invalid currency codes", () => {
    expect(displayMoney(12.5, "not-a-currency")).toMatch(/12[.,]5/);
  });
});
