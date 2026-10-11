import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { auth, roles } from "../middleware/auth.js";

const router = Router();
router.use(auth);

router.post("/", roles("PARTNER"), async (req, res, next) => {
  try {
    const serviceId = typeof req.body.serviceId === "string" ? req.body.serviceId.trim() : "";
    const details = typeof req.body.details === "string" ? req.body.details.trim() : "";
    const location = typeof req.body.location === "string" ? req.body.location.trim() : "";
    if (!serviceId || !details || details.length > 3000 || location.length > 120) {
      return res.status(400).json({ message: "A service, request description (up to 3000 characters), and valid location are required." });
    }
    const service = await prisma.service.findFirst({ where: { id: serviceId, active: true } });
    if (!service) return res.status(404).json({ message: "Service not found or no longer available." });
    const request = await prisma.serviceRequest.create({
      data: { serviceId, partnerId: req.user.id, providerId: service.providerId, details, location: location || service.location },
      include: { service: true, provider: { select: { id: true, displayName: true } } }
    });
    res.status(201).json(request);
  } catch (error) { next(error); }
});

router.get("/", async (req, res, next) => {
  try {
    let where;
    if (req.user.role === "ADMIN") where = {};
    else if (req.user.role === "PROVIDER") {
      const provider = await prisma.providerProfile.findUnique({ where: { userId: req.user.id } });
      if (!provider) return res.json([]);
      where = { providerId: provider.id };
    } else where = { partnerId: req.user.id };
    res.json(await prisma.serviceRequest.findMany({
      where,
      include: { service: true, partner: { select: { id: true, name: true } }, provider: { include: { user: { select: { id: true, name: true } } } } },
      orderBy: { createdAt: "desc" },
      take: 100
    }));
  } catch (error) { next(error); }
});

router.patch("/:id", roles("PROVIDER", "ADMIN"), async (req, res, next) => {
  try {
    const status = req.body.status;
    if (!["ACCEPTED", "REJECTED", "IN_PROGRESS", "COMPLETED", "CANCELLED"].includes(status)) {
      return res.status(400).json({ message: "Invalid request status." });
    }
    const request = await prisma.serviceRequest.findUnique({ where: { id: req.params.id } });
    if (!request) return res.status(404).json({ message: "Request not found." });
    if (req.user.role === "PROVIDER") {
      const provider = await prisma.providerProfile.findUnique({ where: { userId: req.user.id } });
      if (request.providerId !== provider?.id) return res.status(403).json({ message: "You cannot update another provider's request." });
    }
    res.json(await prisma.serviceRequest.update({
      where: { id: request.id },
      data: { status },
      include: { service: true, partner: { select: { id: true, name: true } }, provider: { include: { user: { select: { id: true, name: true } } } } }
    }));
  } catch (error) { next(error); }
});

export default router;
