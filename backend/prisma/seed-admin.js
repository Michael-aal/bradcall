import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const name = process.env.ADMIN_NAME?.trim();
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
if (!name || !email || !password) {
  console.error("Set ADMIN_NAME, ADMIN_EMAIL, and ADMIN_PASSWORD before running npm run admin:seed.");
  process.exitCode = 1;
} else if (password.length < 12 || password.length > 128) {
  console.error("ADMIN_PASSWORD must be between 12 and 128 characters.");
  process.exitCode = 1;
} else {
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const admin = await prisma.user.upsert({
      where: { email },
      update: { name, passwordHash, role: "ADMIN" },
      create: { name, email, passwordHash, role: "ADMIN" }
    });
    console.log("Admin account provisioned:", admin.email);
  } catch (error) {
    console.error("Could not provision admin account:", error.message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}
