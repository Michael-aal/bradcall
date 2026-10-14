CREATE TYPE "FinanceEntryType" AS ENUM ('INCOME', 'EXPENSE');

CREATE TABLE "PersonalFinanceEntry" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "FinanceEntryType" NOT NULL,
  "category" TEXT NOT NULL,
  "description" TEXT,
  "amountKobo" INTEGER NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PersonalFinanceEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PersonalFinanceEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "CompanyFinanceEntry" (
  "id" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "type" "FinanceEntryType" NOT NULL,
  "category" TEXT NOT NULL,
  "description" TEXT,
  "amountKobo" INTEGER NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompanyFinanceEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CompanyFinanceEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "PersonalFinanceEntry_userId_occurredAt_idx" ON "PersonalFinanceEntry"("userId", "occurredAt");
CREATE INDEX "PersonalFinanceEntry_userId_type_occurredAt_idx" ON "PersonalFinanceEntry"("userId", "type", "occurredAt");
CREATE INDEX "CompanyFinanceEntry_occurredAt_idx" ON "CompanyFinanceEntry"("occurredAt");
CREATE INDEX "CompanyFinanceEntry_type_occurredAt_idx" ON "CompanyFinanceEntry"("type", "occurredAt");
