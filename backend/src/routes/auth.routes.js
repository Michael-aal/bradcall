import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";
import { auth } from "../middleware/auth.js";

const router = Router();
const publicUser = user => ({ id: user.id, name: user.name, email: user.email, role: user.role, provider: user.provider || undefined });
const sign = user => {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error("JWT_SECRET must be configured with at least 32 characters");
  return jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" });
};

router.post("/register", async (req, res, next) => {
  try {
    const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
    const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body.password === "string" ? req.body.password : "";
    const role = req.body.role || "PARTNER";
    if (!name || name.length > 100 || !email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password) {
      return res.status(400).json({ message: "Enter a valid name, email, and password." });
    }
    if (password.length < 8 || password.length > 128) return res.status(400).json({ message: "Password must be between 8 and 128 characters." });
    if (!["PARTNER", "PROVIDER"].includes(role)) return res.status(400).json({ message: "Invalid role." });
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ message: "Email already registered." });
    const user = await prisma.user.create({
      data: {
        name, email, passwordHash: await bcrypt.hash(password, 12), role,
        provider: role === "PROVIDER" ? { create: { displayName: name } } : undefined
      },
      include: { provider: true }
    });
    return res.status(201).json({ user: publicUser(user), token: sign(user) });
  } catch (error) { next(error); }
});

router.post("/login", async (req, res, next) => {
  try {
    const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body.password === "string" ? req.body.password : "";
    if (!email || !password) return res.status(400).json({ message: "Email and password are required." });
    const user = await prisma.user.findUnique({ where: { email }, include: { provider: true } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ message: "Invalid email or password." });
    return res.json({ user: publicUser(user), token: sign(user) });
  } catch (error) { next(error); }
});

router.get("/me", auth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id }, include: { provider: true } });
    if (!user) return res.status(404).json({ message: "Account not found." });
    return res.json({ user: publicUser(user) });
  } catch (error) { next(error); }
});

export default router;
