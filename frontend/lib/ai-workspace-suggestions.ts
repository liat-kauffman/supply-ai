export const aiWorkspaceRecoverySuggestions = [
  "Which inventory items are below minimum stock?",
  "What was the recorded purchasing spend this month?",
  "Create an Excel inventory report.",
] as const;

export const aiWorkspaceReportSuggestions = [
  "Create an Excel inventory report.",
  "Create an Excel receipt report.",
  "Create an Excel supplier report.",
] as const;

export function suggestionsForAiWorkspaceAnswer(answer: string) {
  const normalized = answer.toLowerCase().replaceAll("’", "'");
  if (normalized.includes("choose which report you want to create"))
    return aiWorkspaceReportSuggestions;
  if (needsAiWorkspaceSuggestions(answer))
    return aiWorkspaceRecoverySuggestions;
  return null;
}

export function needsAiWorkspaceSuggestions(answer: string) {
  const normalized = answer.toLowerCase().replaceAll("’", "'");
  return (
    normalized.includes("choose an option below to get started") ||
    normalized.includes("i don't have enough structured data to answer") ||
    normalized.includes("i do not have enough structured data to answer") ||
    normalized.includes("unable to answer from workspace data") ||
    /(?:can't|cannot|couldn't|could not) answer/.test(normalized) ||
    /data (?:does not|doesn't) contain the answer/.test(normalized)
  );
}
