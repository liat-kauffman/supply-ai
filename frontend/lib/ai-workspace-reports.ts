export type AiWorkspaceReport =
  "inventory" | "receipts" | "receipts-weekly-pre-vat" | "suppliers";

export function isExcelRequest(prompt: string) {
  return /excel|spreadsheet|xlsx|csv|sheet|report/i.test(prompt);
}

export function mentionsReceipts(prompt: string) {
  return /receipts?|reciepts?|recipts?|receits?|purchase/i.test(prompt);
}

export function wantsWeeklyReceiptPreVatReport(prompt: string) {
  return (
    mentionsReceipts(prompt) &&
    /week/i.test(prompt) &&
    /before\s*(vat|tax)|pre[-\s]?(vat|tax)|excluding\s*(vat|tax)|without\s*(vat|tax)/i.test(
      prompt,
    )
  );
}

export function reportForPrompt(prompt: string): AiWorkspaceReport | null {
  if (!isExcelRequest(prompt)) return null;
  if (wantsWeeklyReceiptPreVatReport(prompt)) return "receipts-weekly-pre-vat";
  if (mentionsReceipts(prompt)) return "receipts";
  if (/inventory|stock|products?|items?/i.test(prompt)) return "inventory";
  if (/suppliers?|vendors?/i.test(prompt)) return "suppliers";
  return null;
}
