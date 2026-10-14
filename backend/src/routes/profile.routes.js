import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { auth } from "../middleware/auth.js";

const router = Router();
const validCoordinates = (lat, lon) => Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
const clean = (value, max) => typeof value === "string" ? value.trim().slice(0, max) : "";

router.get("/", auth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id }, include: { provider: true } });
    if (!user) return res.status(404).json({ message: "Account not found." });
    res.json({ profile: {
      id: user.id, name: user.name, email: user.email, phone: user.phone,
      location: user.location, latitude: user.latitude, longitude: user.longitude, interests: user.interests,
      profileCompletedAt: user.profileCompletedAt, profileComplete: Boolean(user.profileCompletedAt),
      role: user.role,
      provider: user.provider ? {
        id: user.provider.id, displayName: user.provider.displayName,
        providerType: user.provider.providerType, companyName: user.provider.companyName,
        phone: user.provider.phone, bio: user.provider.bio, skills: user.provider.skills,
        yearsExperience: user.provider.yearsExperience, location: user.provider.location,
        latitude: user.provider.latitude, longitude: user.provider.longitude,
        serviceRadiusKm: user.provider.serviceRadiusKm, available: user.provider.available,
        verified: user.provider.verified
      } : null
    }});
  } catch (error) { next(error); }
});

router.patch("/", auth, async (req, res, next) => {
  try {
    const name = clean(req.body.name, 100);
    const phone = clean(req.body.phone, 30);
    const location = clean(req.body.location, 200);
    const bio = clean(req.body.bio, 1000);
    const providerType = req.body.providerType === "COMPANY" ? "COMPANY" : "INDIVIDUAL";
    const companyName = clean(req.body.companyName, 120);
    const displayName = clean(req.body.displayName, 120) || (providerType === "COMPANY" ? companyName : name);
    const interests = Array.isArray(req.body.interests) ? [...new Set(req.body.interests.filter(v => typeof v === "string").map(v => v.trim()).filter(Boolean))].slice(0, 20) : [];
    const skills = Array.isArray(req.body.skills) ? [...new Set(req.body.skills.filter(v => typeof v === "string").map(v => v.trim()).filter(Boolean))].slice(0, 20) : [];
    const yearsExperience = req.body.yearsExperience === "" || req.body.yearsExperience == null ? null : Number(req.body.yearsExperience);
    const serviceRadiusKm = req.body.serviceRadiusKm === "" || req.body.serviceRadiusKm == null ? 10 : Number(req.body.serviceRadiusKm);
    const available = req.body.available === false || req.body.available === "false" ? false : true;
    const hasLat = req.body.latitude !== undefined && req.body.latitude !== "";
    const hasLon = req.body.longitude !== undefined && req.body.longitude !== "";
    let latitude = null, longitude = null;
    if (hasLat || hasLon) {
      latitude = Number(req.body.latitude); longitude = Number(req.body.longitude);
      if (!validCoordinates(latitude, longitude)) return res.status(400).json({ message: "The selected location is invalid. Choose the area again." });
      // Store approximate coordinates for discovery, not a public home pin.
      latitude = Math.round(latitude * 1000) / 1000;
      longitude = Math.round(longitude * 1000) / 1000;
    }
    if (!name || !phone || !location) return res.status(400).json({ message: "Enter your name, phone number, and service area to continue." });
    if (!/^\+?[0-9 ()-]{7,30}$/.test(phone)) return res.status(400).json({ message: "Enter a valid phone number." });
    if (req.user.role === "PROVIDER") {
      if (providerType === "COMPANY" && !companyName) return res.status(400).json({ message: "Enter your company name." });
      if (!displayName) return res.status(400).json({ message: "Enter a profile or business name." });
      if (bio.length > 1000) return res.status(400).json({ message: "Your description is too long." });
      if (!Number.isFinite(serviceRadiusKm) || serviceRadiusKm < 1 || serviceRadiusKm > 50) return res.status(400).json({ message: "Choose a service radius between 1 and 50 km." });
      if (yearsExperience !== null && (!Number.isInteger(yearsExperience) || yearsExperience < 0 || yearsExperience > 80)) return res.status(400).json({ message: "Enter a valid number of years of experience." });
    }
    const profileComplete = req.user.role === "PROVIDER"
      ? Boolean(location && phone && displayName && (providerType !== "COMPANY" || companyName))
      : Boolean(location && phone);
    const user = await prisma.user.update({ where: { id: req.user.id }, data: {
      name, phone, location, latitude, longitude, interests,
      profileCompletedAt: profileComplete ? new Date() : null
    }});
    let provider = null;
    if (req.user.role === "PROVIDER") {
      provider = await prisma.providerProfile.update({ where: { userId: req.user.id }, data: {
        displayName, providerType, companyName: providerType === "COMPANY" ? companyName : null,
        phone, bio: bio || null, skills, yearsExperience, location, latitude, longitude,
        serviceRadiusKm, available
      }});
    }
    res.json({ profile: {
      id: user.id, name: user.name, email: user.email, phone: user.phone,
      location: user.location, latitude: user.latitude, longitude: user.longitude,
      profileCompletedAt: user.profileCompletedAt, profileComplete: Boolean(user.profileCompletedAt),
      role: user.role,
      provider: provider ? {
        id: provider.id, displayName: provider.displayName, providerType: provider.providerType,
        companyName: provider.companyName, phone: provider.phone, bio: provider.bio,
        skills: provider.skills, yearsExperience: provider.yearsExperience, location: provider.location,
        latitude: provider.latitude, longitude: provider.longitude, serviceRadiusKm: provider.serviceRadiusKm,
        available: provider.available, verified: provider.verified
      } : null
    }});
  } catch (error) { next(error); }
});

export default router;
