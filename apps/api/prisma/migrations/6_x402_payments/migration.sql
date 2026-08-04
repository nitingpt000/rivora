-- CreateTable
CREATE TABLE "X402Payment" (
    "id" TEXT NOT NULL,
    "borrowerId" TEXT NOT NULL,
    "payer" TEXT NOT NULL,
    "amount" DECIMAL(20,6) NOT NULL,
    "nonce" TEXT NOT NULL,
    "validBefore" TIMESTAMP(3) NOT NULL,
    "resource" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "X402Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "X402Payment_nonce_key" ON "X402Payment"("nonce");

-- CreateIndex
CREATE INDEX "X402Payment_borrowerId_at_idx" ON "X402Payment"("borrowerId", "at" DESC);

-- CreateIndex
CREATE INDEX "X402Payment_payer_idx" ON "X402Payment"("payer");

-- AddForeignKey
ALTER TABLE "X402Payment" ADD CONSTRAINT "X402Payment_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "Borrower"("id") ON DELETE CASCADE ON UPDATE CASCADE;
