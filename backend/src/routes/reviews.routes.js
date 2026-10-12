import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { auth, roles } from "../middleware/auth.js";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const providerId = typeof req.query.providerId === "string" ? req.query.providerId.trim() : "";
    const requestId = typeof req.query.requestId === "string" ? req.query.requestId.trim() : "";
    const where = { ...(providerId ? { providerId } : {}), ...(requestId ? { requestId } : {}) };
    const rows = await prisma.review.findMany({
      where,
      include: { reviewer: { select: { id: true, name: true } }, request: { select: { id: true, service: { select: { title: true } } } } },
      orderBy: { createdAt: "desc" },
      take: 100
    });
    res.json(rows);
  } catch (error) { next(error); }
});

router.post("/", auth, roles("PARTNER"), async (req, res, next) => {
  try {
    const requestId = typeof req.body.requestId === "string" ? req.body.requestId.trim() : "";
    const rating = Number(req.body.rating);
    const comment = typeof req.body.comment === "string" ? req.body.comment.trim() : "";
    if (!requestId || !Number.isInteger(rating) || rating < 1 || rating > 5 || comment.length > 1000) {
      return res.status(400).json({ message: "Choose a completed booking, rate it from 1 to 5, and keep feedback under 1000 characters." });
    }
    const request = await prisma.serviceRequest.findUnique({
      where: { id: requestId },
      include: { provider: { select: { id: true } } }
    });
    if (!request || request.partnerId !== req.user.id) return res.status(404).json({ message: "Booking not found." });
    if (request.status !== "COMPLETED") return res.status(409).json({ message: "Reviews are available only after a booking is completed." });
    const existing = await prisma.review.findUnique({ where: { requestId } });
    if (existing) return res.status(409).json({ message: "This booking already has a review." });
    const review = await prisma.review.create({
      data: { requestId, reviewerId: req.user.id, providerId: request.provider.id, rating, comment: comment || null },
      include: { reviewer: { select: { id: true, name: true } }, request: { select: { id: true, service: { select: { title: true } } } } }
    });
    res.status(201).json(review);
  } catch (error) {
    if (error?.code === "P2002") return res.status(409).json({ message: "This booking already has a review." });
    next(error);
  }
});

export default router;
