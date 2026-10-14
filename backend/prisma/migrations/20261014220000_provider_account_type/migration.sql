CREATE TYPE "ProviderType" AS ENUM ('INDIVIDUAL', 'COMPANY');
ALTER TABLE "ProviderProfile" ADD COLUMN "providerType" "ProviderType" NOT NULL DEFAULT 'INDIVIDUAL';
ALTER TABLE "ProviderProfile" ADD COLUMN "primaryCategory" TEXT;
