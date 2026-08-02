-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "BorrowerStatus" AS ENUM ('OBSERVATION', 'ELIGIBLE', 'ACTIVE', 'WATCH', 'RESTRICTED', 'DELINQUENT', 'DEFAULTED', 'REPAID');

-- CreateEnum
CREATE TYPE "Tier" AS ENUM ('Prime', 'Strong', 'Standard', 'Restricted', 'Ineligible');

-- CreateEnum
CREATE TYPE "CustodyModel" AS ENUM ('A', 'B', 'C');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('borrower', 'lp', 'ops', 'partner');

-- CreateTable
CREATE TABLE "Borrower" (
    "id" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "endpointHash" TEXT,
    "routerAddress" TEXT,
    "operatingWallet" TEXT NOT NULL,
    "ownerWallet" TEXT NOT NULL,
    "custody" "CustodyModel" NOT NULL DEFAULT 'A',
    "operator" TEXT,
    "jurisdiction" TEXT,
    "kybVerifiedAt" TIMESTAMP(3),
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Borrower_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditLine" (
    "id" TEXT NOT NULL,
    "borrowerId" TEXT NOT NULL,
    "status" "BorrowerStatus" NOT NULL DEFAULT 'OBSERVATION',
    "tier" "Tier" NOT NULL DEFAULT 'Standard',
    "score" INTEGER NOT NULL DEFAULT 0,
    "previousScore" INTEGER NOT NULL DEFAULT 0,
    "limitAmount" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "previousLimit" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "restrictedFromLimit" DECIMAL(20,6),
    "principal" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "accruedInterest" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "pendingDraws" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "reserve" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "reserveTarget" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "repaymentBps" INTEGER NOT NULL DEFAULT 2000,
    "reserveBps" INTEGER NOT NULL DEFAULT 200,
    "completedCycles" INTEGER NOT NULL DEFAULT 0,
    "historyDays" INTEGER NOT NULL DEFAULT 0,
    "watchReason" TEXT NOT NULL DEFAULT '',
    "restrictReason" TEXT NOT NULL DEFAULT '',
    "anomalyDetected" BOOLEAN NOT NULL DEFAULT false,
    "principalRepaid" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RevenueWindow" (
    "id" TEXT NOT NULL,
    "borrowerId" TEXT NOT NULL,
    "eligible" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "gross" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "excluded" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "dailyMean" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "growthPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "largestPayerPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hhi" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "uniquePayers" INTEGER NOT NULL DEFAULT 0,
    "repeatPayers" INTEGER NOT NULL DEFAULT 0,
    "windowStart" TIMESTAMP(3),
    "windowEnd" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RevenueWindow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceHealth" (
    "id" TEXT NOT NULL,
    "borrowerId" TEXT NOT NULL,
    "coverageRatio" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "uptimePct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "successPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "refundRatePct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "bindingOk" BOOLEAN NOT NULL DEFAULT true,
    "endpointUp" BOOLEAN NOT NULL DEFAULT true,
    "factorS" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "factorC" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "factorV" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "factorD" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "factorM" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "factorG" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceHealth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VaultState" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "totalAssets" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "availableLiquidity" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "protocolReserve" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "firstLossTranche" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "queueTotal" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "realizedLosses" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "activeBorrowers" INTEGER NOT NULL DEFAULT 0,
    "onWatch" INTEGER NOT NULL DEFAULT 0,
    "routedRevenue30d" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "principalRepaid" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "interestGenerated" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "sharePrice" DECIMAL(20,8) NOT NULL DEFAULT 1,
    "day" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VaultState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LpPosition" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "walletBalance" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "supplied" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "shares" DECIMAL(20,8) NOT NULL DEFAULT 0,
    "queued" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "queueFunded" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "depositedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LpPosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AddressRole" (
    "address" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AddressRole_pkey" PRIMARY KEY ("address")
);

-- CreateTable
CREATE TABLE "ActivityEvent" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "who" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "note" TEXT,
    "borrowerId" TEXT,

    CONSTRAINT "ActivityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "icon" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "unread" BOOLEAN NOT NULL DEFAULT true,
    "txHash" TEXT,
    "href" TEXT,
    "cta" TEXT,
    "borrowerId" TEXT,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DefaultRecord" (
    "id" TEXT NOT NULL,
    "borrowerId" TEXT NOT NULL,
    "declaredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "curedAt" TIMESTAMP(3),
    "principal" DECIMAL(20,6) NOT NULL,
    "recovered" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "trigger" TEXT NOT NULL,
    "evidenceHash" TEXT NOT NULL,
    "automatic" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "DefaultRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Borrower_handle_key" ON "Borrower"("handle");

-- CreateIndex
CREATE INDEX "Borrower_handle_idx" ON "Borrower"("handle");

-- CreateIndex
CREATE UNIQUE INDEX "CreditLine_borrowerId_key" ON "CreditLine"("borrowerId");

-- CreateIndex
CREATE UNIQUE INDEX "RevenueWindow_borrowerId_key" ON "RevenueWindow"("borrowerId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceHealth_borrowerId_key" ON "ServiceHealth"("borrowerId");

-- CreateIndex
CREATE UNIQUE INDEX "LpPosition_address_key" ON "LpPosition"("address");

-- CreateIndex
CREATE INDEX "ActivityEvent_at_idx" ON "ActivityEvent"("at" DESC);

-- CreateIndex
CREATE INDEX "ActivityEvent_borrowerId_idx" ON "ActivityEvent"("borrowerId");

-- CreateIndex
CREATE INDEX "Alert_at_idx" ON "Alert"("at" DESC);

-- CreateIndex
CREATE INDEX "DefaultRecord_borrowerId_idx" ON "DefaultRecord"("borrowerId");

-- AddForeignKey
ALTER TABLE "CreditLine" ADD CONSTRAINT "CreditLine_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "Borrower"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevenueWindow" ADD CONSTRAINT "RevenueWindow_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "Borrower"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceHealth" ADD CONSTRAINT "ServiceHealth_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "Borrower"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "Borrower"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "Borrower"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DefaultRecord" ADD CONSTRAINT "DefaultRecord_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "Borrower"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

