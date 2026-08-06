-- AlterTable
ALTER TABLE "AddressRole" ADD COLUMN     "borrowerId" TEXT;

-- CreateTable
CREATE TABLE "Assessment" (
    "id" TEXT NOT NULL,
    "borrowerId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "score" INTEGER NOT NULL,
    "tier" "Tier" NOT NULL,
    "limitAmount" DECIMAL(20,6) NOT NULL,
    "previousLimit" DECIMAL(20,6) NOT NULL,
    "bindingKey" TEXT NOT NULL,
    "ladder" JSONB NOT NULL,
    "model" TEXT NOT NULL DEFAULT 'riv-uw-2.1',

    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayerSummary" (
    "id" TEXT NOT NULL,
    "borrowerId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "revenue30d" DECIMAL(20,6) NOT NULL,
    "sharePct" DOUBLE PRECISION NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL,
    "requests30d" INTEGER NOT NULL,
    "excluded" BOOLEAN NOT NULL DEFAULT false,
    "exclusionReason" TEXT,

    CONSTRAINT "PayerSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthNonce" (
    "nonce" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),

    CONSTRAINT "AuthNonce_pkey" PRIMARY KEY ("nonce")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor" TEXT NOT NULL,
    "role" "Role",
    "action" TEXT NOT NULL,
    "subject" TEXT,
    "requestId" TEXT,
    "ip" TEXT,
    "metadata" JSONB,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyRecord" (
    "key" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "response" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "AgentPolicy" (
    "id" TEXT NOT NULL,
    "borrowerId" TEXT NOT NULL,
    "maxPayment" DECIMAL(20,6) NOT NULL DEFAULT 100,
    "maxDaily" DECIMAL(20,6) NOT NULL DEFAULT 500,
    "spentToday" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "humanApprovalThreshold" DECIMAL(20,6) NOT NULL DEFAULT 250,
    "allowedCategories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "blockedCategories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "policyChangeDelayHours" INTEGER NOT NULL DEFAULT 24,
    "pendingChangeAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Assessment_borrowerId_at_idx" ON "Assessment"("borrowerId", "at" DESC);

-- CreateIndex
CREATE INDEX "PayerSummary_borrowerId_idx" ON "PayerSummary"("borrowerId");

-- CreateIndex
CREATE UNIQUE INDEX "PayerSummary_borrowerId_label_key" ON "PayerSummary"("borrowerId", "label");

-- CreateIndex
CREATE INDEX "AuthNonce_address_idx" ON "AuthNonce"("address");

-- CreateIndex
CREATE INDEX "AuthNonce_expiresAt_idx" ON "AuthNonce"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "ApiKey_keyHash_idx" ON "ApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "AuditLog_at_idx" ON "AuditLog"("at" DESC);

-- CreateIndex
CREATE INDEX "AuditLog_actor_idx" ON "AuditLog"("actor");

-- CreateIndex
CREATE INDEX "IdempotencyRecord_createdAt_idx" ON "IdempotencyRecord"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AgentPolicy_borrowerId_key" ON "AgentPolicy"("borrowerId");

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "Borrower"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayerSummary" ADD CONSTRAINT "PayerSummary_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "Borrower"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentPolicy" ADD CONSTRAINT "AgentPolicy_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "Borrower"("id") ON DELETE CASCADE ON UPDATE CASCADE;

