import { NextResponse } from "next/server";

import { apiErrorResponse, requireApiCompany } from "@/lib/auth/api";
import { prisma } from "@supply/database";

export async function POST(request: Request) {
  try {
    const { organizationId, userId } = await requireApiCompany();
    const body = (await request.json()) as {
      messageId?: unknown;
      rating?: unknown;
    };
    const messageId = typeof body.messageId === "string" ? body.messageId : "";
    const rating =
      body.rating === "positive" || body.rating === "negative"
        ? body.rating
        : null;
    if (!messageId || !rating)
      return NextResponse.json(
        { error: "A message and rating are required." },
        { status: 400 },
      );
    const message = await prisma.aiWorkspaceMessage.findFirst({
      where: {
        id: messageId,
        businessId: organizationId,
        userId,
        role: "assistant",
      },
      select: { id: true },
    });
    if (!message)
      return NextResponse.json(
        { error: "Message not found." },
        { status: 404 },
      );
    await prisma.auditEvent.create({
      data: {
        businessId: organizationId,
        actorId: userId,
        action: "ai.answer_feedback",
        entityType: "AiWorkspaceMessage",
        entityId: message.id,
        metadata: { rating },
      },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error, "Unable to save answer feedback");
  }
}
