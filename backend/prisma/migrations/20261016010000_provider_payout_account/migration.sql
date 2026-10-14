ALTER TABLE "ProviderProfile"
  ADD COLUMN "payoutBankName" TEXT,
  ADD COLUMN "payoutBankCode" TEXT,
  ADD COLUMN "payoutAccountName" TEXT,
  ADD COLUMN "payoutAccountNumberMasked" TEXT,
  ADD COLUMN "paystackRecipientCode" TEXT,
  ADD COLUMN "payoutAccountVerifiedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "ProviderProfile_paystackRecipientCode_key"
  ON "ProviderProfile"("paystackRecipientCode");
