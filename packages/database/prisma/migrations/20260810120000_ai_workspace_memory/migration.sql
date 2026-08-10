CREATE TABLE "AiWorkspaceMessage" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiWorkspaceMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiWorkspaceMessage_businessId_userId_createdAt_idx"
ON "AiWorkspaceMessage"("businessId", "userId", "createdAt");

ALTER TABLE "AiWorkspaceMessage"
ADD CONSTRAINT "AiWorkspaceMessage_businessId_fkey"
FOREIGN KEY ("businessId") REFERENCES "BusinessProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AiWorkspaceMessage"
ADD CONSTRAINT "AiWorkspaceMessage_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
