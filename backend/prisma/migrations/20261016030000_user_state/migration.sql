-- State is a broad service-discovery area, not a public exact-location pin.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "state" TEXT;
