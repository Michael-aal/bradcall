import { Router } from "express";

const router = Router();
const GEOAPIFY_BASE = "https://api.geoapify.com/v1";

function getApiKey() {
  return typeof process.env.MAPS_API_KEY === "string" ? process.env.MAPS_API_KEY.trim() : "";
}

function validCoordinates(lat, lon) {
  return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

async function geoapifyRequest(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) {
    const error = new Error("The location service is temporarily unavailable.");
    error.status = response.status === 429 ? 429 : 502;
    throw error;
  }
  return response.json();
}

function requireKey(res) {
  if (getApiKey()) return true;
  res.status(503).json({ message: "Location search is not configured on the server." });
  return false;
}

router.get("/autocomplete", async (req, res) => {
  if (!requireKey(res)) return;
  const text = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
  if (text.length < 2) return res.json({ suggestions: [] });
  try {
    const url = new URL(GEOAPIFY_BASE + "/geocode/autocomplete");
    url.searchParams.set("text", text);
    url.searchParams.set("limit", "6");
    url.searchParams.set("format", "json");
    url.searchParams.set("filter", "countrycode:ng");
    url.searchParams.set("apiKey", getApiKey());
    const data = await geoapifyRequest(url);
    const suggestions = (Array.isArray(data.results) ? data.results : [])
      .filter(item => validCoordinates(Number(item.lat), Number(item.lon)))
      .map(item => ({ lat: Number(item.lat), lon: Number(item.lon), formatted: String(item.formatted || item.address_line1 || text).slice(0, 200) }));
    res.set("Cache-Control", "private, max-age=60");
    res.json({ suggestions });
  } catch (error) {
    res.status(error.status || 502).json({ message: "Address suggestions are temporarily unavailable." });
  }
});

router.get("/geocode", async (req, res) => {
  if (!requireKey(res)) return;
  const text = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 120) : "";
  if (!text) return res.status(400).json({ message: "Enter an area or address to search." });
  try {
    const url = new URL(GEOAPIFY_BASE + "/geocode/search");
    url.searchParams.set("text", text);
    url.searchParams.set("limit", "1");
    url.searchParams.set("format", "json");
    url.searchParams.set("filter", "countrycode:ng");
    url.searchParams.set("apiKey", getApiKey());
    const data = await geoapifyRequest(url);
    const item = data.results?.[0];
    if (!item || !validCoordinates(Number(item.lat), Number(item.lon))) {
      return res.status(404).json({ message: "We couldn't find that area. Try a nearby landmark or town." });
    }
    res.set("Cache-Control", "private, max-age=300");
    res.json({ lat: Number(item.lat), lon: Number(item.lon), formatted: String(item.formatted || text).slice(0, 200) });
  } catch (error) {
    res.status(error.status || 502).json({ message: "Area lookup is temporarily unavailable." });
  }
});

router.get("/reverse", async (req, res) => {
  if (!requireKey(res)) return;
  const lat = Number(req.query.lat), lon = Number(req.query.lon);
  if (!validCoordinates(lat, lon)) return res.status(400).json({ message: "Valid coordinates are required." });
  try {
    const url = new URL(GEOAPIFY_BASE + "/geocode/reverse");
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lon));
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "1");
    url.searchParams.set("apiKey", getApiKey());
    const data = await geoapifyRequest(url);
    const item = data.results?.[0];
    res.json({ formatted: String(item?.formatted || "").slice(0, 200) });
  } catch (error) {
    res.status(error.status || 502).json({ message: "Reverse area lookup is temporarily unavailable." });
  }
});

router.post("/route", async (req, res) => {
  if (!requireKey(res)) return;
  const origin = req.body?.origin || {};
  const destination = req.body?.destination || {};
  const originLat = Number(origin.lat), originLon = Number(origin.lon);
  const destinationLat = Number(destination.lat), destinationLon = Number(destination.lon);
  if (!validCoordinates(originLat, originLon) || !validCoordinates(destinationLat, destinationLon)) {
    return res.status(400).json({ message: "Valid origin and destination coordinates are required." });
  }
  try {
    const url = new URL(GEOAPIFY_BASE + "/routing");
    url.searchParams.set("waypoints", originLat + "," + originLon + "|" + destinationLat + "," + destinationLon);
    url.searchParams.set("mode", "drive");
    url.searchParams.set("format", "geojson");
    url.searchParams.set("apiKey", getApiKey());
    const data = await geoapifyRequest(url);
    const feature = data.features?.[0];
    const coordinates = feature?.geometry?.coordinates;
    if (!Array.isArray(coordinates) || !coordinates.length) {
      return res.status(404).json({ message: "No driving route was found for these locations." });
    }
    const properties = feature.properties || {};
    res.json({
      coordinates: coordinates.filter(point => Array.isArray(point) && Number.isFinite(Number(point[0])) && Number.isFinite(Number(point[1]))),
      distanceMeters: Number(properties.distance) || null,
      timeSeconds: Number(properties.time) || null
    });
  } catch (error) {
    res.status(error.status || 502).json({ message: "Driving directions are temporarily unavailable." });
  }
});

export default router;
