-- Add opt-in contact verification for newly created accounts. Existing accounts remain compatible.
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "verificationRequired" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "verificationMethod" TEXT,
  ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "phoneVerifiedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "verificationCodeHash" TEXT,
  ADD COLUMN IF NOT EXISTS "verificationExpiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "verificationSentAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "verificationAttempts" INTEGER NOT NULL DEFAULT 0;
