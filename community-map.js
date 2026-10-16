(() => {
  "use strict";

  const API = (window.BRADCALL_API_URL || (location.hostname === "localhost" || location.hostname === "127.0.0.1" ? "http://localhost:5000" : location.origin)).replace(/\/$/, "");
  const root = document.querySelector("[data-community-map]");
  if (!root) return;

  const $ = selector => root.querySelector(selector);
  const mapNode = $("#community-map-canvas");
  const search = $("#community-map-search");
  const button = $("#community-map-submit");
  const radiusSelect = $("#community-map-radius");
  const locationStatus = $("#community-map-location-status");
  const caption = $("#community-map-caption");
  const list = $("#community-map-list");
  if (!mapNode || !search) return;

  const DEFAULT_CENTER = { lat: 9.0820, lng: 8.6753 };
  let map;
  let layer;
  let coverage;
  let routeLayer;
  let geoRouteLine = null;
  let suggestionBox = null;
  let autocompleteTimer = null;
  let autocompleteSequence = 0;
  let searchCenter = null;
  let searchRadiusKm = 10;
  let searchSequence = 0;
  let viewportTimer = null;
  const geocodeCache = new Map();

  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));
  const money = value => new Intl.NumberFormat("en-NG", {
    style: "currency", currency: "NGN", maximumFractionDigits: 0
  }).format(Number(value) || 0);
  const say = message => { if (caption) caption.textContent = message; };
  const selectedRadius = () => { const value = Number(radiusSelect?.value || 10); return [5, 10, 25, 50].includes(value) ? value : 10; };
  const zoomForRadius = km => km <= 5 ? 13 : km <= 10 ? 12 : km <= 25 ? 10 : 8;



  async function loadLeaflet() {
    if (window.L) return;

    // Use a second CDN so a blocked or unavailable unpkg host doesn't leave a blank map.
    if (!document.querySelector("link[data-bradcall-leaflet-css]")) {
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css";
      css.dataset.bradcallLeafletCss = "true";
      document.head.appendChild(css);
      const fallbackCss = document.createElement("link");
      fallbackCss.rel = "stylesheet";
      fallbackCss.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css";
      fallbackCss.dataset.bradcallLeafletCssFallback = "true";
      document.head.appendChild(fallbackCss);
    }

    const sources = [
      "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js",
      "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js",
      "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
    ];
    let lastError;
    for (const src of sources) {
      try {
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = src;
          script.async = true;
          script.dataset.bradcallLeafletRuntime = "true";
          script.onload = () => window.L ? resolve() : reject(new Error("Leaflet loaded without initializing."));
          script.onerror = () => {
            script.remove();
            reject(new Error("A map library CDN could not be reached."));
          };
          document.head.appendChild(script);
        });
        if (window.L) return;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error("The map library could not load. Check your internet connection and retry.");
  }

  async function initializeMap() {
    if (map) return;
    await loadLeaflet();
    map = window.L.map(mapNode, { scrollWheelZoom: true }).setView([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], 6);

    // Use Geoapify map tiles through Bradcall's backend. The API key stays on Render.
    const geoapifyTiles = window.L.tileLayer(API + "/api/maps/tiles/{z}/{x}/{y}.png", {
      maxZoom: 20,
      attribution: '&copy; <a href="https://www.geoapify.com/" target="_blank" rel="noreferrer">Geoapify</a> &middot; &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>',
      crossOrigin: true
    }).addTo(map);
    geoapifyTiles.on("tileerror", () => {
      say("Geoapify map tiles could not load. Check the Render MAPS_API_KEY and backend logs.");
    });
    geoapifyTiles.once("load", () => {
      say("Street map ready. Use the map control to switch between Street and Satellite.");
    });

    // Satellite imagery is proxied by the backend so the MapTiler key never
    // appears in browser code. Street mode remains the default and keeps working
    // even when MAPTILER_API_KEY has not been configured yet.
    const satelliteTiles = window.L.tileLayer(API + "/api/maps/satellite-tiles/{z}/{x}/{y}", {
      maxZoom: 20,
      attribution: '&copy; <a href="https://www.maptiler.com/copyright/" target="_blank" rel="noreferrer">MapTiler</a>',
      crossOrigin: true
    });
    satelliteTiles.on("tileerror", () => {
      say("Satellite imagery could not load. Check the Render MAPTILER_API_KEY and MapTiler account limits.");
    });
    window.L.control.layers(
      { "Street": geoapifyTiles, "Satellite": satelliteTiles },
      null,
      { collapsed: true }
    ).addTo(map);
    map.setMaxZoom(20);

    layer = window.L.layerGroup().addTo(map);
    routeLayer = window.L.layerGroup().addTo(map);
    coverage = window.L.circle([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], {
      radius: 10000, color: "#0e5135", weight: 2, fillColor: "#0e5135", fillOpacity: 0.08
    });
    mapNode.addEventListener("click", async event => {
      const routeButton = event.target.closest("[data-route-lat][data-route-lng]");
      if (routeButton) await showRoute(Number(routeButton.dataset.routeLat), Number(routeButton.dataset.routeLng));
    });
  }

  async function geocode(query) {
    const key = query.trim().toLowerCase();
    if (geocodeCache.has(key)) return geocodeCache.get(key);
    let point = null;
    const response = await fetch(API + "/api/maps/geocode?q=" + encodeURIComponent(query));
    const data = await response.json().catch(() => ({}));
    if (response.ok && Number.isFinite(Number(data.lat)) && Number.isFinite(Number(data.lon))) {
      point = { lat: Number(data.lat), lng: Number(data.lon), label: data.formatted || query };
    }
    if (point && Number.isFinite(point.lat) && Number.isFinite(point.lng)) geocodeCache.set(key, point);
    return point;
  }

  function clearMarkers() {
    layer.clearLayers();
    routeLayer.clearLayers();
    geoRouteLine = null;
  }

  function addMarker(service, point) {
    const title = esc(service.title || service.provider?.displayName || "Local service area");
    const profileHref = "provider-profile.html?id=" + encodeURIComponent(service.provider?.id || "") + "&service=" + encodeURIComponent(service.id || "");
    const details = '<div class="map-popup"><strong>' + title + '</strong><p>' +
      esc(service.category?.name || "Service provider") + '</p><p>' +
      esc(service.location || "Approximate service area") + '</p><p>' + money(service.price) +
      '</p><a class="map-profile-link" href="' + esc(profileHref) + '">View provider profile</a><p><button type="button" class="map-route-button" data-route-lat="' + point.lat + '" data-route-lng="' + point.lng + '">Show Geoapify driving route</button></p></div>';
    const initial = esc(String(service.provider?.displayName || service.title || "P").trim().slice(0, 1).toUpperCase());
    const icon = window.L.divIcon({
      className: "provider-marker-wrap",
      html: '<span class="provider-map-marker"><b>' + initial + '</b><i aria-hidden="true"></i></span>',
      iconSize: [42, 42], iconAnchor: [21, 21], popupAnchor: [0, -20]
    });
    window.L.marker([point.lat, point.lng], {
      icon, title: service.provider?.displayName || service.title || "Available provider"
    }).bindPopup(details).addTo(layer);
  }

  function renderList(services) {
    if (!list) return;
    const unique = [];
    const seen = new Set();
    for (const service of services) {
      const id = service.provider?.id || service.id;
      if (seen.has(id)) continue;
      seen.add(id);
      unique.push(service);
    }
    list.innerHTML = unique.length
      ? unique.slice(0, 30).map(service => {
        const count = services.filter(item => item.provider?.id && item.provider.id === service.provider?.id).length;
        return '<article class="map-list-item"><div class="map-list-top"><strong>' + esc(service.provider?.displayName || service.title || "Service provider") +
        '</strong><span class="map-available-dot" aria-label="Available"></span></div><span>' + esc(service.provider?.primaryCategory || service.category?.name || service.title || "Service provider") + '</span><small>' +
        esc(service.location || service.provider?.location || "Approximate service area") + " · " + count + (count === 1 ? " service" : " services") +
        (Number.isFinite(service.distanceKm) ? " · " + service.distanceKm + " km away" : "") +
        '</small><a class="map-profile-link" href="provider-profile.html?id=' + encodeURIComponent(service.provider?.id || "") + '&service=' + encodeURIComponent(service.id || '') + '">View profile <span aria-hidden="true">→</span></a></article>';
      }).join("")
      : '<div class="map-empty-state">No available providers with live listings were found in this area. Search a wider area or check back later.</div>';
  }

  async function showRoute(destinationLat, destinationLng) {
    if (!searchCenter || ![searchCenter.lat, searchCenter.lng, destinationLat, destinationLng].every(Number.isFinite)) {
      say("A valid route location could not be found.");
      return;
    }
    say("Calculating a Geoapify driving route…");
    try {
      const response = await fetch(API + "/api/maps/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: { lat: searchCenter.lat, lon: searchCenter.lng },
          destination: { lat: destinationLat, lon: destinationLng }
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !Array.isArray(data.coordinates) || !data.coordinates.length) {
        throw new Error(data.message || "Geoapify routing is unavailable.");
      }
      const path = data.coordinates.map(([lon, lat]) => [Number(lat), Number(lon)])
        .filter(([lat, lon]) => Number.isFinite(lat) && Number.isFinite(lon));
      if (!path.length) throw new Error("No usable route was returned.");
      routeLayer.clearLayers();
      geoRouteLine = window.L.polyline(path, { color: "#0e5135", weight: 5, opacity: 0.9 }).addTo(routeLayer);
      map.fitBounds(geoRouteLine.getBounds(), { padding: [20, 20] });
      const distance = Number(data.distanceMeters);
      const seconds = Number(data.timeSeconds);
      const summary = [
        Number.isFinite(distance) && distance > 0 ? (distance / 1000).toFixed(1) + " km" : "",
        Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds / 60) + " min" : ""
      ].filter(Boolean).join(" · ");
      say("Geoapify driving route" + (summary ? ": " + summary : "") + ". Estimates can change with traffic and road conditions.");
    } catch {
      say("Geoapify couldn't calculate this route right now. Check the Render MAPS_API_KEY and try again.");
    }
  }

  async function refresh(selectedPoint, preserveViewport = false) {
    const sequence = ++searchSequence;
    await initializeMap();
    if (!selectedPoint) {
      say("Turn on device location to find services near you.");
      return;
    }
    searchCenter = { lat: Number(selectedPoint.lat), lng: Number(selectedPoint.lng) };
    searchRadiusKm = selectedRadius();
    if (!preserveViewport) map.setView([searchCenter.lat, searchCenter.lng], zoomForRadius(searchRadiusKm));
    coverage.setLatLng([searchCenter.lat, searchCenter.lng]);
    coverage.setRadius(searchRadiusKm * 1000);
    coverage.addTo(map);
    clearMarkers();

    say("Finding nearby service listings…");
    const params = new URLSearchParams({
      latitude: String(searchCenter.lat), longitude: String(searchCenter.lng), radiusKm: String(searchRadiusKm)
    });
    let services = [];
    try {
      const response = await fetch(API + "/api/services?" + params.toString());
      const data = await response.json().catch(() => []);
      if (!response.ok) throw new Error(data.message || "Could not load nearby listings.");
      services = Array.isArray(data) ? data : [];
    } catch (error) {
      if (sequence === searchSequence) say(error.message || "Bradcall listings could not be reached. Check the backend connection.");
      renderList([]);
      return;
    }
    if (sequence !== searchSequence) return;
    renderList(services);
    let marked = 0;
    const markedProviders = new Set();
    for (const service of services.slice(0, 200)) {
      if (sequence !== searchSequence) return;
      const providerId = service.provider?.id || service.id;
      if (markedProviders.has(providerId)) continue;
      markedProviders.add(providerId);
      // The API only exposes coordinates rounded to about 1 km for public map markers.
      const lat = Number(service.mapLatitude), lng = Number(service.mapLongitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      addMarker(service, { lat, lng });
      marked++;
    }
    if (sequence !== searchSequence) return;
    say("Showing " + markedProviders.size + " available provider" + (markedProviders.size === 1 ? "" : "s") +
      " within " + searchRadiusKm + " km. " + marked + " privacy-rounded service-area marker" + (marked === 1 ? "" : "s") +
      " displayed. Listings without saved device coordinates remain in the list but do not get a map pin.");
  }

  function refreshFromViewport() {
    clearTimeout(viewportTimer);
    viewportTimer = setTimeout(() => {
      if (!map) return;
      const center = map.getCenter();
      const point = { lat: center?.lat, lng: center?.lng };
      const zoom = Number(map.getZoom());
      if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng) || !Number.isFinite(zoom)) return;
      const radius = zoom >= 13 ? 5 : zoom >= 11 ? 10 : zoom >= 9 ? 25 : 50;
      const sameCentre = searchCenter &&
        Math.abs(point.lat - searchCenter.lat) < 0.005 &&
        Math.abs(point.lng - searchCenter.lng) < 0.005;
      if (sameCentre && radius === searchRadiusKm) return;
      searchRadiusKm = radius;
      if (radiusSelect) radiusSelect.value = String(radius);
      refresh(point, true);
    }, 450);
  }

  function requestDeviceLocation() {
    if (!navigator.geolocation) {
      if (locationStatus) locationStatus.textContent = "This browser does not support device location.";
      say("This browser does not support device location.");
      return;
    }
    button.disabled = true;
    if (locationStatus) locationStatus.textContent = "Waiting for device location permission…";
    say("Finding your approximate area…");
    navigator.geolocation.getCurrentPosition(async position => {
      const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
      search.value = "Your current area";
      if (locationStatus) locationStatus.textContent = "Location enabled. Showing nearby services; your exact position is not shown publicly.";
      try {
        await initializeMap();
        try {
          const response = await fetch(API + "/api/maps/reverse?lat=" + encodeURIComponent(coords.lat) + "&lon=" + encodeURIComponent(coords.lng));
          const area = await response.json();
          if (response.ok && area.formatted) search.value = area.formatted.split(",").slice(0, 2).join(",").trim();
        } catch {
          // Coordinates still work when reverse geocoding is unavailable.
        }
        await refresh(coords);
      } catch (error) {
        say(error.message || "Could not load nearby services.");
        if (locationStatus) locationStatus.textContent = "Location was found, but the map could not load. Please try again.";
      } finally {
        button.disabled = false;
      }
    }, error => {
      const message = error?.code === 1
        ? "Location permission is off. Search an area or enable location in your browser settings."
        : error?.code === 3
          ? "Location lookup timed out. Try again or search for an area."
          : "We couldn't determine your location. Try again or search for an area.";
      if (locationStatus) locationStatus.textContent = message;
      say(message);
      button.disabled = false;
    }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 });
  }

  if (button) button.addEventListener("click", requestDeviceLocation);
  radiusSelect?.addEventListener("change", () => { if (searchCenter) refresh(searchCenter); });
  document.addEventListener("click", event => {
    const routeButton = event.target.closest("[data-route-lat][data-route-lng]");
    if (!routeButton || !root.contains(routeButton) && !routeButton.closest(".leaflet-popup, .gm-style")) return;
    showRoute(Number(routeButton.dataset.routeLat), Number(routeButton.dataset.routeLng));
  });
  search.readOnly = false;
  search.removeAttribute("aria-readonly");
  search.setAttribute("autocomplete", "off");
  search.setAttribute("placeholder", "Search an area or landmark");
  suggestionBox = document.createElement("div");
  suggestionBox.className = "community-map-suggestions";
  suggestionBox.id = "community-map-suggestions";
  suggestionBox.setAttribute("role", "listbox");
  suggestionBox.hidden = true;
  search.insertAdjacentElement("afterend", suggestionBox);

  function hideSuggestions() {
    if (suggestionBox) {
      suggestionBox.hidden = true;
      suggestionBox.innerHTML = "";
    }
  }

  async function loadSuggestions(query) {
    const sequence = ++autocompleteSequence;
    const term = query.trim();
    if (term.length < 2) return hideSuggestions();
    try {
      const response = await fetch(API + "/api/maps/autocomplete?q=" + encodeURIComponent(term));
      const data = await response.json().catch(() => ({}));
      if (sequence !== autocompleteSequence) return;
      if (!response.ok) {
        hideSuggestions();
        say(response.status === 503
          ? "The base map still works, but area search is not configured on the backend. Check Render's MAPS_API_KEY."
          : "Area suggestions are temporarily unavailable. You can still use your location or move around the map.");
        return;
      }
      const suggestions = Array.isArray(data.suggestions) ? data.suggestions : [];
      suggestionBox.innerHTML = suggestions.map((item, index) =>
        '<button type="button" class="community-map-suggestion" role="option" data-suggestion-index="' + index + '">' + esc(item.formatted) + '</button>'
      ).join("");
      suggestionBox.hidden = suggestions.length === 0;
      suggestionBox._items = suggestions;
      if (!suggestions.length) say("No matching areas found. Try a nearby landmark or town.");
    } catch {
      if (sequence !== autocompleteSequence) return;
      hideSuggestions();
      say("Area suggestions could not connect. The base map still works; try your location or move around the map.");
    }
  }

  search.addEventListener("input", () => {
    clearTimeout(autocompleteTimer);
    autocompleteTimer = setTimeout(() => loadSuggestions(search.value), 250);
  });
  suggestionBox.addEventListener("click", async event => {
    const option = event.target.closest("[data-suggestion-index]");
    if (!option) return;
    const item = suggestionBox._items?.[Number(option.dataset.suggestionIndex)];
    if (!item) return;
    search.value = item.formatted;
    hideSuggestions();
    const point = { lat: Number(item.lat), lng: Number(item.lon) };
    if (Number.isFinite(point.lat) && Number.isFinite(point.lng)) await refresh(point);
  });
  search.addEventListener("keydown", async event => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    hideSuggestions();
    const point = await geocode(search.value);
    if (point) {
      search.value = point.label;
      await refresh({ lat: point.lat, lng: point.lng });
    } else {
      say("We couldn't find that area. Try selecting an address suggestion.");
    }
  });
  document.addEventListener("click", event => {
    if (!event.target.closest(".community-map-search")) hideSuggestions();
  });
  initializeMap().then(() => {
    const resizeMap = () => {
      if (!map) return;
      map.invalidateSize({ pan: false });
    };
    window.addEventListener("load", resizeMap, { once: true });
    window.addEventListener("resize", resizeMap);
    map.on("moveend zoomend", refreshFromViewport);
    requestAnimationFrame(() => requestAnimationFrame(resizeMap));
    say("Map ready. The base map works independently; Geoapify powers area search and driving routes. Allow location to see nearby providers, or search any area.");
    // This page is explicitly a nearby-services map, so ask for location on entry.
    // The browser controls permission; a denied permission never blocks manual area search.
    let locationPrompted = false;
    try { locationPrompted = localStorage.getItem("bradcall_map_location_prompted_v1") === "1"; } catch {}
    const markLocationPrompted = () => {
      try { localStorage.setItem("bradcall_map_location_prompted_v1", "1"); } catch {}
    };
    if (navigator.permissions?.query) {
      navigator.permissions.query({ name: "geolocation" }).then(permission => {
        if (permission.state === "denied") {
          if (locationStatus) locationStatus.textContent = "Location is blocked in browser settings. Search an area to explore services.";
          return;
        }
        if (permission.state === "granted" || !locationPrompted) {
          if (permission.state !== "granted") markLocationPrompted();
          requestDeviceLocation();
        }
      }).catch(() => {
        if (!locationPrompted) {
          markLocationPrompted();
          requestDeviceLocation();
        }
      });
    } else if (!locationPrompted) {
      markLocationPrompted();
      requestDeviceLocation();
    }
  }).catch(error => {
    say("Geoapify interactive map could not start. Check your connection and the Render MAPS_API_KEY, then reload.");
    if (mapNode) {
      mapNode.setAttribute("role", "status");
      mapNode.innerHTML = '<div class="community-map-load-error">The Geoapify map could not load. Check your connection and map configuration, then reload.</div>';
    }
    if (locationStatus) locationStatus.textContent = "Bradcall uses Geoapify for its map, place search and driving routes.";
  });
})();