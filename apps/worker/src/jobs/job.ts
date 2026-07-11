import { z } from "zod";

export const jobEnvelopeSchema = z.object({
  id: z.string().min(8),
  type: z.enum([
    "RECEIPT_UPLOADED",
    "PHOTO_SESSION_READY",
    "BASKET_REVIEW_DUE",
  ]),
  businessId: z.string().min(1),
  occurredAt: z.iso.datetime(),
  payload: z.record(z.string(), z.unknown()),
});

export type JobEnvelope = z.infer<typeof jobEnvelopeSchema>;

export async function processJob(job: JobEnvelope): Promise<void> {
  // Phase 1 deliberately records intake only. Future graphs may create proposals,
  // but deterministic services remain the only path to approved domain writes.
  console.info(
    JSON.stringify({
      level: "info",
      event: "job.accepted",
      jobId: job.id,
      type: job.type,
    }),
  );
}
