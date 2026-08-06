-- CreateTable
CREATE TABLE "ChainSync" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "lastBlock" BIGINT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChainSync_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChainEvent" (
    "id" TEXT NOT NULL,
    "seenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "blockNumber" BIGINT NOT NULL,
    "logIndex" INTEGER NOT NULL,
    "txHash" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "args" JSONB NOT NULL,
    "reconciled" TEXT NOT NULL,

    CONSTRAINT "ChainEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChainEvent_reconciled_idx" ON "ChainEvent"("reconciled");

-- CreateIndex
CREATE UNIQUE INDEX "ChainEvent_txHash_logIndex_key" ON "ChainEvent"("txHash", "logIndex");

