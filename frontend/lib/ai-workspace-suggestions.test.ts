import { describe, expect, it } from "vitest";

import {
  aiWorkspaceRecoverySuggestions,
  needsAiWorkspaceSuggestions,
} from "./ai-workspace-suggestions";

describe("AI workspace recovery suggestions", () => {
  it("offers exactly three supported follow-up actions", () => {
    expect(aiWorkspaceRecoverySuggestions).toHaveLength(3);
  });

  it("recognizes answers that could not be grounded in workspace data", () => {
    expect(
      needsAiWorkspaceSuggestions(
        "I don't have enough structured data to answer that yet.",
      ),
    ).toBe(true);
    expect(
      needsAiWorkspaceSuggestions(
        "I’m here to help with your business. Choose an option below to get started.",
      ),
    ).toBe(true);
    expect(
      needsAiWorkspaceSuggestions(
        "This workspace has 12 active inventory items.",
      ),
    ).toBe(false);
  });
});
