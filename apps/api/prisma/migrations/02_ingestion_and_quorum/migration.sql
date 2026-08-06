-- AlterTable
ALTER TABLE "public"."ApiKey" ADD COLUMN     "ownerAddress" TEXT;

-- AlterTable
ALTER TABLE "public"."Assessment" ADD COLUMN     "atDay" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "public"."VaultState" ADD COLUMN     "protocolSpreadPct" DOUBLE PRECISION NOT NULL DEFAULT 3,
ADD COLUMN     "subsidyApyPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "subsidyEnds" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "public"."AllowlistEntry" (
    "id" TEXT NOT NULL,
    "borrowerId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AllowlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Anomaly" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "borrowerId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "washAmount" DECIMAL(20,6) NOT NULL,
    "payerCount" INTEGER NOT NULL,
    "daysSpanned" INTEGER NOT NULL,
    "netEconomicRevenue" DECIMAL(20,6) NOT NULL,
    "evidenceHash" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "fundedWallets" JSONB NOT NULL,
    "afterEligibleRevenue" DECIMAL(20,6) NOT NULL,
    "afterScore" INTEGER NOT NULL,
    "afterTier" "public"."Tier" NOT NULL,
    "afterLimit" DECIMAL(20,6) NOT NULL,
    "afterRepaymentBps" INTEGER NOT NULL,

    CONSTRAINT "Anomaly_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ApiKeyUsage" (
    "id" TEXT NOT NULL,
    "apiKeyId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "route" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "status" INTEGER NOT NULL,
    "subjectHandle" TEXT,
    "billable" BOOLEAN NOT NULL DEFAULT false,
    "durationMs" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ApiKeyUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DefaultApproval" (
    "id" TEXT NOT NULL,
    "declarationId" TEXT NOT NULL,
    "operator" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DefaultApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DefaultDeclaration" (
    "id" TEXT NOT NULL,
    "borrowerId" TEXT NOT NULL,
    "principal" DECIMAL(20,6) NOT NULL,
    "trigger" TEXT NOT NULL,
    "evidenceHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "committedAt" TIMESTAMP(3),

    CONSTRAINT "DefaultDeclaration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PolicyDecision" (
    "id" TEXT NOT NULL,
    "borrowerId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recipient" TEXT NOT NULL,
    "amount" DECIMAL(20,6) NOT NULL,
    "category" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "PolicyDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ReserveEvent" (
    "id" TEXT NOT NULL,
    "borrowerId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "amount" DECIMAL(20,6) NOT NULL,
    "balance" DECIMAL(20,6) NOT NULL,
    "txHash" TEXT,
    "note" TEXT,

    CONSTRAINT "ReserveEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RevenueDay" (
    "id" TEXT NOT NULL,
    "borrowerId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "settled" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "excluded" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "requests" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RevenueDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RevenueDayPayer" (
    "id" TEXT NOT NULL,
    "revenueDayId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DECIMAL(20,6) NOT NULL,
    "requests" INTEGER NOT NULL DEFAULT 0,
    "excluded" BOOLEAN NOT NULL DEFAULT false,
    "exclusionReason" TEXT,

    CONSTRAINT "RevenueDayPayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UpstreamDependency" (
    "id" TEXT NOT NULL,
    "borrowerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "declaredCostPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sharePct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "substitutable" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "UpstreamDependency_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AllowlistEntry_borrowerId_address_key" ON "public"."AllowlistEntry"("borrowerId" ASC, "address" ASC);

-- CreateIndex
CREATE INDEX "Anomaly_borrowerId_detectedAt_idx" ON "public"."Anomaly"("borrowerId" ASC, "detectedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Anomaly_reference_key" ON "public"."Anomaly"("reference" ASC);

-- CreateIndex
CREATE INDEX "ApiKeyUsage_apiKeyId_at_idx" ON "public"."ApiKeyUsage"("apiKeyId" ASC, "at" DESC);

-- CreateIndex
CREATE INDEX "ApiKeyUsage_apiKeyId_billable_at_idx" ON "public"."ApiKeyUsage"("apiKeyId" ASC, "billable" ASC, "at" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "DefaultApproval_declarationId_operator_key" ON "public"."DefaultApproval"("declarationId" ASC, "operator" ASC);

-- CreateIndex
CREATE INDEX "DefaultDeclaration_borrowerId_status_idx" ON "public"."DefaultDeclaration"("borrowerId" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "PolicyDecision_borrowerId_at_idx" ON "public"."PolicyDecision"("borrowerId" ASC, "at" DESC);

-- CreateIndex
CREATE INDEX "ReserveEvent_borrowerId_at_idx" ON "public"."ReserveEvent"("borrowerId" ASC, "at" DESC);

-- CreateIndex
CREATE INDEX "RevenueDay_borrowerId_date_idx" ON "public"."RevenueDay"("borrowerId" ASC, "date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "RevenueDay_borrowerId_date_key" ON "public"."RevenueDay"("borrowerId" ASC, "date" ASC);

-- CreateIndex
CREATE INDEX "RevenueDayPayer_label_idx" ON "public"."RevenueDayPayer"("label" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "RevenueDayPayer_revenueDayId_label_key" ON "public"."RevenueDayPayer"("revenueDayId" ASC, "label" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "UpstreamDependency_borrowerId_name_key" ON "public"."UpstreamDependency"("borrowerId" ASC, "name" ASC);

-- CreateIndex
CREATE INDEX "ApiKey_ownerAddress_idx" ON "public"."ApiKey"("ownerAddress" ASC);

-- AddForeignKey
ALTER TABLE "public"."AllowlistEntry" ADD CONSTRAINT "AllowlistEntry_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "public"."Borrower"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Anomaly" ADD CONSTRAINT "Anomaly_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "public"."Borrower"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ApiKeyUsage" ADD CONSTRAINT "ApiKeyUsage_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "public"."ApiKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DefaultApproval" ADD CONSTRAINT "DefaultApproval_declarationId_fkey" FOREIGN KEY ("declarationId") REFERENCES "public"."DefaultDeclaration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DefaultDeclaration" ADD CONSTRAINT "DefaultDeclaration_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "public"."Borrower"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PolicyDecision" ADD CONSTRAINT "PolicyDecision_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "public"."Borrower"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReserveEvent" ADD CONSTRAINT "ReserveEvent_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "public"."Borrower"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RevenueDay" ADD CONSTRAINT "RevenueDay_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "public"."Borrower"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RevenueDayPayer" ADD CONSTRAINT "RevenueDayPayer_revenueDayId_fkey" FOREIGN KEY ("revenueDayId") REFERENCES "public"."RevenueDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UpstreamDependency" ADD CONSTRAINT "UpstreamDependency_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "public"."Borrower"("id") ON DELETE CASCADE ON UPDATE CASCADE;

