import { z } from "zod";

export const userRoleSchema = z.enum(["OWNER", "MANAGER", "EMPLOYEE"]);
export type UserRole = z.infer<typeof userRoleSchema>;

export const inventoryMovementTypeSchema = z.enum([
  "RECEIPT",
  "EMERGENCY_PURCHASE",
  "MANUAL_ADDITION",
  "USAGE_ESTIMATE",
  "WASTE",
  "EXPIRED",
  "TRANSFER_IN",
  "TRANSFER_OUT",
  "CORRECTION",
]);

export const inventoryMovementInputSchema = z.object({
  businessId: z.string().min(1),
  locationId: z.string().min(1),
  productId: z.string().min(1),
  type: inventoryMovementTypeSchema,
  quantityDelta: z
    .number()
    .finite()
    .refine((value) => value !== 0, "Quantity cannot be zero"),
  unit: z.string().min(1),
  reason: z.string().trim().max(500).optional(),
  idempotencyKey: z.string().min(8).max(128),
});
export type InventoryMovementInput = z.infer<
  typeof inventoryMovementInputSchema
>;

export const aiProposalSchema = z.object({
  modelId: z.string().min(1),
  promptVersion: z.string().min(1),
  graphVersion: z.string().min(1),
  structuredOutput: z.record(z.string(), z.unknown()),
  confidence: z.number().min(0).max(1),
  evidenceReferences: z.array(z.string()),
  warnings: z.array(z.string()),
  status: z.enum(["PENDING", "NEEDS_REVIEW", "APPROVED", "REJECTED", "FAILED"]),
});
export type AiProposal = z.infer<typeof aiProposalSchema>;

export function canApprove(role: UserRole): boolean {
  return role === "OWNER" || role === "MANAGER";
}
