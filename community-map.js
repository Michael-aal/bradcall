(() => {
  "use strict";

  const API = (window.BRADCALL_API_URL || (location.hostname === "localhost" || location.hostname === "127.0.0.1" ? "http://localhost:5000" : location.origin)).replace(/\/$/, "");
  const GEOAPIFY_KEY = String(window.BRADCALL_GEOAPIFY_API_KEY || "").trim();
  const root = document.querySelector("[data-community-map]");
  if (!root) return;

  const $ = selector => root.querySelector(selector);
  const mapNode = $("#community-map-canvas");
  const search = $("#community-map-search");
  const button = $("#community-map-submit");
  const caption = $("#community-map-caption");
  const list = $("#community-map-list");
  if (!mapNode || !search) return;

  let map;
  let layer;
  let coverage;
  let routeLayer;
  let searchCenter = { lat: 6.5244, lng: 3.3792 };
  let searchSequence = 0;
  let suggestionTimer;
  let suggestions = [];
  let autocompleteList;

  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));
  const money = value => new Intl.NumberFormat("en-NG", {
    style: "currency", currency: "NGN", maximumFractionDigits: 0
  }).format(Number(value) || 0);
  const say = message => { if (caption) caption.textContent = message; };
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

  function loadLeaflet() {
    return new Promise((resolve, reject) => {
      if (window.L) return resolve();
      if (!document.querySelector('link[data-bradcall-leaflet]')) {
        const css = document.createElement("link");
        css.rel = "stylesheet";
        css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        css.dataset.bradcallLeaflet = "true";
        document.head.appendChild(css);
      }
      const existing = document.querySelector('script[data-bradcall-leaflet]');
      if (existing) {
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", () => reject(new Error("Map library could not load. Check your internet connection.")), { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.dataset.bradcallLeaflet = "true";
      script.onload = resolve;
      script.onerror = () => reject(new Error("Map library could not load. Check your internet connection."));
      document.head.appendChild(script);
    });
  }

  function ensureAutocompleteList() {
    const id = "community-map-suggestions";
    autocompleteList = document.getElementById(id);
    if (!autocompleteList) {
      autocompleteList = document.createElement("datalist");
      autocompleteList.id = id;
      document.body.appendChild(autocompleteList);
    }
    search.setAttribute("list", id);
    search.setAttribute("autocomplete", "off");
  }

  async function geocode(query) {
    if (GEOAPIFY_KEY) {
      const url = new URL("https://api.geoapify.com/v1/geocode/search");
      url.searchParams.set("text", query);
      url.searchParams.set("limit", "1");
      url.searchParams.set("format", "json");
      url.searchParams.set("apiKey", GEOAPIFY_KEY);
      const response = await fetch(url);
      if (!response.ok) throw new Error("Geoapify could not find that area. Check the API key and allowed APIs.");
      const data = await response.json();
      const result = data.results?.[0];
      if (!result) return null;
      return { lat: Number(result.lat), lng: Number(result.lon), label: result.formatted || query };
    }

    // Keeps the existing map usable until a local Geoapify key is configured.
    const url = "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=" + encodeURIComponent(query);
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("Community search is temporarily unavailable.");
    const data = await response.json();
    if (!data.length) return null;
    return { lat: Number(data[0].lat), lng: Number(data[0].lon), label: data[0].display_name };
  }

  async function autocomplete(query) {
    if (!GEOAPIFY_KEY || query.trim().length < 3) {
      suggestions = [];
      if (autocompleteList) autocompleteList.replaceChildren();
      return;
    }
    const url = new URL("https://api.geoapify.com/v1/geocode/autocomplete");
    url.searchParams.set("text", query);
    url.searchParams.set("limit", "6");
    url.searchParams.set("filter", "countrycode:ng");
    url.searchParams.set("apiKey", GEOAPIFY_KEY);
    const response = await fetch(url);
    if (!response.ok) return;
    const data = await response.json();
    suggestions = (data.features || []).map(feature => ({
      label: feature.properties?.formatted || "",
      lat: Number(feature.properties?.lat),
      lng: Number(feature.properties?.lon)
    })).filter(item => item.label && Number.isFinite(item.lat) && Number.isFinite(item.lng));
    autocompleteList.replaceChildren(...suggestions.map(item => {
      const option = document.createElement("option");
      option.value = item.label;
      return option;
    }));
  }

  function popup(service, point) {
    const directions = GEOAPIFY_KEY
      ? '<button type="button" class="map-route-button" data-route-lat="' + point.lat + '" data-route-lng="' + point.lng + '">Show driving route from this area</button>'
      : "";
    return '<div class="map-popup"><strong>' + esc(service.title || service.provider?.displayName || "Local service area") +
      '</strong><p>' + esc(service.category?.name || "Service provider") + '</p><p>' +
      esc(service.location || "Service area") + '</p><p>' + money(service.price) +
      '</p><a href="register.html">Join to request this service</a>' + directions + '</div>';
  }

  function renderList(services) {
    if (!list) return;
    list.innerHTML = services.length
      ? services.slice(0, 6).map(service => '<article class="map-list-item"><strong>' + esc(service.title) +
        '</strong><span>' + esc(service.location) + '</span><small>' +
        esc(service.category?.name || "Service") + " · " + money(service.price) + '</small></article>').join("")
      : '<div class="dash-empty">No public service listings found for this area yet. Try a nearby neighborhood.</div>';
  }

  async function initializeMap() {
    await loadLeaflet();
    if (map) return;
    map = window.L.map(mapNode, { scrollWheelZoom: false }).setView([searchCenter.lat, searchCenter.lng], 12);
    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>'
    }).addTo(map);
    layer = window.L.layerGroup().addTo(map);
    routeLayer = window.L.layerGroup().addTo(map);
    coverage = window.L.circle([searchCenter.lat, searchCenter.lng], {
      radius: 3000, color: "#019E81", weight: 2, fillColor: "#019E81", fillOpacity: .08
    }).addTo(map);
    mapNode.addEventListener("click", async event => {
      const routeButton = event.target.closest("[data-route-lat][data-route-lng]");
      if (!routeButton) return;
      await showRoute(Number(routeButton.dataset.routeLat), Number(routeButton.dataset.routeLng));
    });
  }

  async function showRoute(destinationLat, destinationLng) {
    if (!GEOAPIFY_KEY) {
      say("Add your Geoapify key to local config.js to enable route planning.");
      return;
    }
    if (![searchCenter.lat, searchCenter.lng, destinationLat, destinationLng].every(Number.isFinite)) {
      say("A valid route location could not be found.");
      return;
    }
    say("Calculating a driving route…");
    try {
      const url = new URL("https://api.geoapify.com/v1/routing");
      url.searchParams.set("waypoints", searchCenter.lat + "," + searchCenter.lng + "|" + destinationLat + "," + destinationLng);
      url.searchParams.set("mode", "drive");
      url.searchParams.set("type", "short");
      url.searchParams.set("format", "geojson");
      url.searchParams.set("apiKey", GEOAPIFY_KEY);
      const response = await fetch(url);
      if (!response.ok) throw new Error("Route request failed. Check that Routing API is enabled for your Geoapify key.");
      const data = await response.json();
      const feature = data.features?.[0];
      if (!feature?.geometry?.coordinates?.length) throw new Error("No driving route was found for those locations.");
      routeLayer.clearLayers();
      const line = window.L.geoJSON(feature, { style: { color: "#6B45D9", weight: 5, opacity: .85 } }).addTo(routeLayer);
      map.fitBounds(line.getBounds(), { padding: [24, 24] });
      const properties = feature.properties || {};
      const distanceKm = Number(properties.distance) / 1000;
      const durationMinutes = Number(properties.time) / 60;
      const details = [];
      if (Number.isFinite(distanceKm) && distanceKm > 0) details.push(distanceKm.toFixed(1) + " km");
      if (Number.isFinite(durationMinutes) && durationMinutes > 0) details.push(Math.round(durationMinutes) + " min estimated driving");
      say("Driving route from " + (search.value.trim() || "the searched area") + (details.length ? ": " + details.join(" · ") : "") + ". Travel estimates can change with traffic and road conditions.");
    } catch (error) {
      say(error.message || "Could not calculate this route right now.");
    }
  }

  async function refresh(place, selectedPoint) {
    const sequence = ++searchSequence;
    const query = (place || search.value || "Lagos, Nigeria").trim();
    if (!query) return;
    await initializeMap();
    say("Finding the map area for " + query + "…");

    let center = selectedPoint;
    if (!center) {
      try {
        center = await geocode(query.includes("Nigeria") ? query : query + ", Nigeria");
      } catch (error) {
        say(error.message);
        return;
      }
    }
    if (sequence !== searchSequence) return;
    if (!center) {
      say("We couldn't find that area. Try a neighborhood name plus its city.");
      return;
    }
    searchCenter = { lat: center.lat, lng: center.lng };
    map.setView([center.lat, center.lng], 13);
    coverage.setLatLng([center.lat, center.lng]);
    coverage.setRadius(3000);
    layer.clearLayers();
    routeLayer.clearLayers();

    let services = [];
    try {
      const response = await fetch(API + "/api/services");
      if (response.ok) services = await response.json();
    } catch {
      say("Map loaded, but Bradcall listings could not be reached. Check that the backend is running.");
    }
    if (sequence !== searchSequence) return;

    const areaTerm = query.split(",")[0].trim().toLowerCase();
    const cityTerm = query.split(",").slice(-1)[0].trim().toLowerCase();
    const relevant = services.filter(service => {
      const location = String(service.location || "").toLowerCase();
      return location.includes(areaTerm) || (cityTerm && location.includes(cityTerm));
    });
    renderList(relevant);
    const seen = new Set();
    let marked = 0;
    const maxMarkers = 8;
    for (const service of relevant) {
      if (marked >= maxMarkers) break;
      const area = String(service.location || "").trim();
      if (!area || seen.has(area.toLowerCase())) continue;
      seen.add(area.toLowerCase());
      try {
        if (!GEOAPIFY_KEY) await wait(1100);
        const lookup = area.includes(",") ? area + ", Nigeria" :
          query.toLowerCase().includes(area.toLowerCase()) ? area + ", Lagos, Nigeria" : area + ", " + query + ", Nigeria";
        const point = await geocode(lookup);
        if (!point || sequence !== searchSequence) continue;
        window.L.marker([point.lat, point.lng]).bindPopup(popup(service, point)).addTo(layer);
        marked++;
      } catch {
        // One un-geocodable provider area should not break the rest of the map.
      }
    }
    const providerMessage = marked + " service-area marker" + (marked === 1 ? "" : "s") + " found.";
    say("Map centered on " + query + ". The shaded circle is approximate, not an official boundary. " +
      providerMessage + (GEOAPIFY_KEY ? " Powered by Geoapify geocoding; map tiles © OpenStreetMap." : " Add a Geoapify key in local config.js to enable autocomplete and directions; map data © OpenStreetMap."));
  }

  if (button) button.addEventListener("click", () => refresh(search.value.trim()));
  search.addEventListener("input", () => {
    if (suggestionTimer) clearTimeout(suggestionTimer);
    suggestionTimer = setTimeout(() => autocomplete(search.value).catch(() => {}), 300);
  });
  search.addEventListener("change", () => {
    const match = suggestions.find(item => item.label === search.value);
    if (match) refresh(search.value, match);
  });
  search.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      const match = suggestions.find(item => item.label === search.value);
      refresh(search.value.trim(), match);
    }
  });

  ensureAutocompleteList();
  refresh(search.value || "Lagos, Nigeria").catch(error => say(error.message || "Could not load the community map."));
})();
