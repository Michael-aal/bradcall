import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { auth, roles } from "../middleware/auth.js";
import { distanceKm, validCoordinates } from "../lib/geo.js";

const router = Router();

router.get("/mine", auth, roles("PROVIDER", "ADMIN"), async (req, res, next) => {
  try {
    const provider = await prisma.providerProfile.findUnique({ where: { userId: req.user.id } });
    if (!provider && req.user.role !== "ADMIN") return res.json([]);
    const where = req.user.role === "ADMIN" ? {} : { providerId: provider.id };
    res.json(await prisma.service.findMany({
      where,
      include: { provider: { select: { id: true, displayName: true, verified: true } }, category: true },
      orderBy: { createdAt: "desc" }
    }));
  } catch (error) { next(error); }
});

router.get("/", async (req, res, next) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
    const category = typeof req.query.category === "string" ? req.query.category.trim().slice(0, 80) : "";
    const location = typeof req.query.location === "string" ? req.query.location.trim().slice(0, 120) : "";
    const hasCoordinates = req.query.latitude !== undefined || req.query.longitude !== undefined;
    const latitude = Number(req.query.latitude), longitude = Number(req.query.longitude);
    const radiusKm = Math.min(50, Math.max(1, Number(req.query.radiusKm) || 10));
    if (hasCoordinates && !validCoordinates(latitude, longitude)) return res.status(400).json({ message: "A valid latitude and longitude are required for nearby search." });
    const where = { active: true, provider: { available: true },
      ...(category ? { category: { name: { contains: category, mode: "insensitive" } } } : {}),
      ...(location ? { location: { contains: location, mode: "insensitive" } } : {}),
      ...(q ? { OR: [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { category: { name: { contains: q, mode: "insensitive" } } }
      ] } : {})
    };
    const services = await prisma.service.findMany({where,include:{provider:{select:{id:true,displayName:true,verified:true,location:true,latitude:true,longitude:true,serviceRadiusKm:true,available:true}},category:true},orderBy:{createdAt:"desc"},take:200});
    const results=services.map(item=>{const p=item.provider;const d=hasCoordinates&&Number.isFinite(p.latitude)&&Number.isFinite(p.longitude)?distanceKm(latitude,longitude,p.latitude,p.longitude):null;const {latitude:_lat,longitude:_lon,...safeProvider}=p;return {...item,provider:safeProvider,...(d===null?{}:{distanceKm:Math.round(d*10)/10})};}).filter(item=>!hasCoordinates||(item.distanceKm!==undefined&&item.distanceKm<=radiusKm&&item.distanceKm<=(item.provider.serviceRadiusKm||10))).sort((a,b)=>hasCoordinates?a.distanceKm-b.distanceKm:new Date(b.createdAt)-new Date(a.createdAt));
    res.json(results.slice(0,100));
  } catch (error) { next(error); }
});

router.get("/:id", async (req, res, next) => {
  try {
    const service = await prisma.service.findUnique({
      where: { id: req.params.id },
      include: { provider: { select: { id: true, displayName: true, verified: true, location: true, available: true } }, category: true }
    });
    if (!service || !service.active) return res.status(404).json({ message: "Service not found" });
    res.json(service);
  } catch (error) { next(error); }
});

router.post("/", auth, roles("PROVIDER", "ADMIN"), async (req, res, next) => {
  try {
    const title = typeof req.body.title === "string" ? req.body.title.trim() : "";
    const description = typeof req.body.description === "string" ? req.body.description.trim() : "";
    const category = typeof req.body.category === "string" ? req.body.category.trim() : "";
    const location = typeof req.body.location === "string" ? req.body.location.trim() : "";
    const price = Number(req.body.price);
    if (!title || title.length > 120 || !description || description.length > 1500 || !category || category.length > 80 || !location || location.length > 120) {
      return res.status(400).json({ message: "Enter a title, description, category, and service area within the allowed lengths." });
    }
    if (req.body.price === "" || req.body.price == null || !Number.isFinite(price) || price < 0) {
      return res.status(400).json({ message: "Price must be a valid non-negative number." });
    }
    const provider = await prisma.providerProfile.findUnique({ where: { userId: req.user.id } });
    if (!provider) return res.status(400).json({ message: "Provider profile not found." });
    const cat = await prisma.category.upsert({ where: { name: category }, update: {}, create: { name: category } });
    res.status(201).json(await prisma.service.create({
      data: { title, description, price, location, categoryId: cat.id, providerId: provider.id },
      include: { category: true, provider: { select: { id: true, displayName: true, verified: true, location: true } } }
    }));
  } catch (error) { next(error); }
});

router.patch("/:id", auth, roles("PROVIDER", "ADMIN"), async (req, res, next) => {
  try {
    const service = await prisma.service.findUnique({ where: { id: req.params.id } });
    if (!service) return res.status(404).json({ message: "Service not found" });
    const provider = await prisma.providerProfile.findUnique({ where: { userId: req.user.id } });
    if (req.user.role !== "ADMIN" && service.providerId !== provider?.id) return res.status(403).json({ message: "Not your service" });
    const data = {};
    for (const field of ["title", "description", "location"]) {
      if (req.body[field] !== undefined) {
        if (typeof req.body[field] !== "string" || !req.body[field].trim()) return res.status(400).json({ message: field + " cannot be empty." });
        const max = field === "title" ? 120 : field === "description" ? 1500 : 120;
        if (req.body[field].trim().length > max) return res.status(400).json({ message: field + " is too long." });
        data[field] = req.body[field].trim();
      }
    }
    if (req.body.price !== undefined) {
      const price = Number(req.body.price);
      if (req.body.price === "" || !Number.isFinite(price) || price < 0) return res.status(400).json({ message: "Price must be a valid non-negative number." });
      data.price = price;
    }
    if (req.body.active !== undefined) {
      if (typeof req.body.active !== "boolean") return res.status(400).json({ message: "active must be true or false." });
      data.active = req.body.active;
    }
    res.json(await prisma.service.update({ where: { id: service.id }, data, include: { category: true, provider: { select: { id: true, displayName: true, verified: true } } } }));
  } catch (error) { next(error); }
});

router.delete("/:id", auth, roles("PROVIDER", "ADMIN"), async (req, res, next) => {
  try {
    const service = await prisma.service.findUnique({ where: { id: req.params.id } });
    if (!service) return res.status(404).json({ message: "Service not found" });
    const provider = await prisma.providerProfile.findUnique({ where: { userId: req.user.id } });
    if (req.user.role !== "ADMIN" && service.providerId !== provider?.id) return res.status(403).json({ message: "Not your service" });
    await prisma.service.update({ where: { id: service.id }, data: { active: false } });
    res.status(204).end();
  } catch (error) { next(error); }
});

export default router;
