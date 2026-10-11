import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { auth, roles } from "../middleware/auth.js";

const router = Router();
router.use(auth, roles("ADMIN"));

router.get("/stats", async (req, res, next) => {
  try {
    const [users, providers, partners, services, activeServices, requests, pendingRequests] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: "PROVIDER" } }),
      prisma.user.count({ where: { role: "PARTNER" } }),
      prisma.service.count(),
      prisma.service.count({ where: { active: true } }),
      prisma.serviceRequest.count(),
      prisma.serviceRequest.count({ where: { status: "PENDING" } })
    ]);
    res.json({ users, providers, partners, services, activeServices, requests, pendingRequests });
  } catch (error) { next(error); }
});

router.get("/users", async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 100
    });
    res.json(users);
  } catch (error) { next(error); }
});

router.get("/requests", async (req, res, next) => {
  try {
    const requests = await prisma.serviceRequest.findMany({
      include: {
        service: { select: { id: true, title: true, price: true } },
        partner: { select: { id: true, name: true, email: true } },
        provider: { include: { user: { select: { id: true, name: true, email: true } } } }
      },
      orderBy: { createdAt: "desc" },
      take: 100
    });
    res.json(requests);
  } catch (error) { next(error); }
});

export default router;
