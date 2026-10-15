(() => {
  "use strict";

  const API = (window.BRADCALL_API_URL || (location.hostname === "localhost" || location.hostname === "127.0.0.1" ? "http://localhost:5000" : location.origin)).replace(/\/$/, "");
  const GOOGLE_KEY = String(window.BRADCALL_GOOGLE_MAPS_API_KEY || document.querySelector('meta[name="bradcall-google-maps-key"]')?.content || "").trim();
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
  let mapProvider = "leaflet";
  let layer;
  let coverage;
  let routeLayer;
  let directionsRenderer;
  let googleGeocoder;
  let geoRouteLine = null;
  let suggestionBox = null;
  let autocompleteTimer = null;
  let autocompleteSequence = 0;
  let searchCenter = null;
  let searchRadiusKm = 10;
  let searchSequence = 0;
  const geocodeCache = new Map();

  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));
  const money = value => new Intl.NumberFormat("en-NG", {
    style: "currency", currency: "NGN", maximumFractionDigits: 0
  }).format(Number(value) || 0);
  const say = message => { if (caption) caption.textContent = message; };
  const selectedRadius = () => { const value = Number(radiusSelect?.value || 10); return [5, 10, 25, 50].includes(value) ? value : 10; };
  const zoomForRadius = km => km <= 5 ? 13 : km <= 10 ? 12 : km <= 25 ? 10 : 9;

  function loadScript(src, dataAttribute) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector("script[" + dataAttribute + "]");
      if (existing) {
        if (existing.dataset.loaded === "true") return resolve();
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", () => reject(new Error("The map service could not load. Check your connection and API configuration.")), { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.dataset[dataAttribute.replace("data-", "").replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = "true";
      script.setAttribute(dataAttribute, "true");
      script.onload = () => { script.dataset.loaded = "true"; resolve(); };
      script.onerror = () => reject(new Error("The map service could not load. Check your connection and API configuration."));
      document.head.appendChild(script);
    });
  }

  async function loadGoogleMaps() {
    if (window.google?.maps?.Map) return true;
    if (!GOOGLE_KEY) return false;
    await new Promise((resolve, reject) => {
      if (window.google?.maps?.Map) return resolve();
      const callbackName = "__bradcallGoogleMapsReady";
      window[callbackName] = () => { delete window[callbackName]; resolve(); };
      const existing = document.querySelector('script[data-bradcall-google-maps]');
      if (existing) {
        existing.addEventListener("load", () => window.google?.maps?.Map ? resolve() : reject(new Error("Google Maps did not initialize. Check that Maps JavaScript API is enabled.")), { once: true });
        existing.addEventListener("error", () => reject(new Error("Google Maps could not load. Check the API key and allowed website referrers.")), { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = "https://maps.googleapis.com/maps/api/js?key=" + encodeURIComponent(GOOGLE_KEY) + "&libraries=places&callback=" + callbackName + "&v=weekly";
      script.async = true;
      script.defer = true;
      script.dataset.bradcallGoogleMaps = "true";
      script.onerror = () => reject(new Error("Google Maps could not load. Check the API key and allowed website referrers."));
      document.head.appendChild(script);
    });
    return Boolean(window.google?.maps?.Map);
  }

  async function loadLeaflet() {
    if (window.L) return;

    // Use a second CDN so a blocked or unavailable unpkg host doesn't leave a blank map.
    if (!document.querySelector("link[data-bradcall-leaflet-css]")) {
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css";
      css.dataset.bradcallLeafletCss = "true";
      document.head.appendChild(css);
    }

    const sources = [
      "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js",
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
    try {
      if (await loadGoogleMaps()) {
        mapProvider = "google";
        map = new google.maps.Map(mapNode, {
          center: DEFAULT_CENTER, zoom: 6, mapTypeControl: false,
          streetViewControl: false, fullscreenControl: true,
          gestureHandling: "greedy"
        });
        googleGeocoder = new google.maps.Geocoder();
        layer = [];
        routeLayer = new google.maps.DirectionsRenderer({
          map, suppressMarkers: false, polylineOptions: { strokeColor: "#0E9F91", strokeWeight: 5, strokeOpacity: 0.85 }
        });
        coverage = new google.maps.Circle({
          map: null, center: DEFAULT_CENTER, radius: 10000, strokeColor: "#0E9F91",
          strokeOpacity: 0.8, strokeWeight: 2, fillColor: "#0E9F91", fillOpacity: 0.08
        });
        return;
      }
    } catch (error) {
      say(error.message || "Google Maps could not load. Showing the community map fallback.");
    }
    mapProvider = "leaflet";
    await loadLeaflet();
    map = window.L.map(mapNode, { scrollWheelZoom: false }).setView([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], 6);
    const osmTiles = window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>'
    }).addTo(map);
    let tileFallbackUsed = false;
    osmTiles.once("tileerror", () => {
      if (tileFallbackUsed) return;
      tileFallbackUsed = true;
      map.removeLayer(osmTiles);
      window.L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        maxZoom: 19,
        subdomains: "abcd",
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
      }).addTo(map);
    });
    layer = window.L.layerGroup().addTo(map);
    routeLayer = window.L.layerGroup().addTo(map);
    coverage = window.L.circle([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], {
      radius: 10000, color: "#0E9F91", weight: 2, fillColor: "#0E9F91", fillOpacity: 0.08
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
    if (mapProvider === "google" && googleGeocoder) {
      const result = await googleGeocoder.geocode({ address: query, region: "ng" });
      const item = result.results?.[0];
      if (item) point = {
        lat: item.geometry.location.lat(), lng: item.geometry.location.lng(),
        label: item.formatted_address || query
      };
    } else {
      const response = await fetch(API + "/api/maps/geocode?q=" + encodeURIComponent(query));
      const data = await response.json().catch(() => ({}));
      if (response.ok && Number.isFinite(Number(data.lat)) && Number.isFinite(Number(data.lon))) {
        point = { lat: Number(data.lat), lng: Number(data.lon), label: data.formatted || query };
      } else {
        // Keep area search usable if the Geoapify service is not configured or is temporarily down.
        const fallback = await fetch("https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=ng&q=" + encodeURIComponent(query), { headers: { Accept: "application/json" } });
        if (fallback.ok) {
          const results = await fallback.json();
          if (results[0]) point = { lat: Number(results[0].lat), lng: Number(results[0].lon), label: results[0].display_name || query };
        }
      }
    }
    if (point && Number.isFinite(point.lat) && Number.isFinite(point.lng)) geocodeCache.set(key, point);
    return point;
  }

  function clearMarkers() {
    if (mapProvider === "google") {
      layer.forEach(marker => marker.setMap(null));
      layer = [];
      routeLayer.set("directions", null);
      if (geoRouteLine) { geoRouteLine.setMap(null); geoRouteLine = null; }
    } else {
      layer.clearLayers();
      routeLayer.clearLayers();
    }
  }

  function addMarker(service, point) {
    const title = esc(service.title || service.provider?.displayName || "Local service area");
    const profileHref = "provider-profile.html?id=" + encodeURIComponent(service.provider?.id || "") + "&service=" + encodeURIComponent(service.id || "");
    const details = '<div class="map-popup"><strong>' + title + '</strong><p>' +
      esc(service.category?.name || "Service provider") + '</p><p>' +
      esc(service.location || "Approximate service area") + '</p><p>' + money(service.price) +
      '</p><a class="map-profile-link" href="' + esc(profileHref) + '">View provider profile</a><p><button type="button" class="map-route-button" data-route-lat="' + point.lat + '" data-route-lng="' + point.lng + '">Show driving route</button></p><p><a target="_blank" rel="noopener noreferrer" href="' +
      esc("https://www.google.com/maps/dir/?api=1&destination=" + point.lat + "," + point.lng) +
      '">Get directions in Google Maps</a></p></div>';
    if (mapProvider === "google") {
      const marker = new google.maps.Marker({ map, position: { lat: point.lat, lng: point.lng }, title: service.title || "Service area" });
      const info = new google.maps.InfoWindow({ content: details });
      marker.addListener("click", () => info.open({ map, anchor: marker }));
      layer.push(marker);
    } else {
      window.L.marker([point.lat, point.lng]).bindPopup(details).addTo(layer);
    }
  }

  function renderList(services) {
    if (!list) return;
    list.innerHTML = services.length
      ? services.slice(0, 30).map(service => '<article class="map-list-item"><div class="map-list-top"><strong>' + esc(service.provider?.displayName || service.title || "Service provider") +
        '</strong><span class="map-available-dot" aria-label="Available"></span></div><span>' + esc(service.title || service.category?.name || "Service") + '</span><small>' +
        esc(service.location || "Approximate service area") + " · " + esc(service.category?.name || "Service") + " · " + money(service.price) +
        (Number.isFinite(service.distanceKm) ? " · " + service.distanceKm + " km away" : "") +
        '</small><a class="map-profile-link" href="provider-profile.html?id=' + encodeURIComponent(service.provider?.id || "") + '&service=' + encodeURIComponent(service.id || '') + '">View profile <span aria-hidden="true">→</span></a></article>').join("")
      : '<div class="dash-empty">No available providers with live listings were found in this area. Search a wider area or check back later.</div>';
  }

  async function showRoute(destinationLat, destinationLng) {
    if (!searchCenter || ![searchCenter.lat, searchCenter.lng, destinationLat, destinationLng].every(Number.isFinite)) {
      say("A valid route location could not be found.");
      return;
    }
    say("Calculating a driving route…");
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
      if (mapProvider === "google") {
        if (geoRouteLine) geoRouteLine.setMap(null);
        geoRouteLine = new google.maps.Polyline({
          map, path: path.map(([lat, lng]) => ({ lat, lng })),
          strokeColor: "#0E9F91", strokeWeight: 5, strokeOpacity: 0.9
        });
        const bounds = new google.maps.LatLngBounds();
        path.forEach(([lat, lng]) => bounds.extend({ lat, lng }));
        map.fitBounds(bounds);
      } else {
        routeLayer.clearLayers();
        geoRouteLine = window.L.polyline(path, { color: "#0E9F91", weight: 5, opacity: 0.9 }).addTo(routeLayer);
        map.fitBounds(geoRouteLine.getBounds(), { padding: [20, 20] });
      }
      const distance = Number(data.distanceMeters);
      const seconds = Number(data.timeSeconds);
      const summary = [
        Number.isFinite(distance) && distance > 0 ? (distance / 1000).toFixed(1) + " km" : "",
        Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds / 60) + " min" : ""
      ].filter(Boolean).join(" · ");
      say("Geoapify driving route" + (summary ? ": " + summary : "") + ". Estimates can change with traffic and road conditions.");
    } catch {
      const url = "https://www.google.com/maps/dir/?api=1&origin=" +
        encodeURIComponent(searchCenter.lat + "," + searchCenter.lng) + "&destination=" +
        encodeURIComponent(destinationLat + "," + destinationLng) + "&travelmode=driving";
      window.open(url, "_blank", "noopener,noreferrer");
      say("Bradcall couldn't calculate an in-map route just now, so directions opened in Google Maps.");
    }
  }

  async function refresh(selectedPoint) {
    const sequence = ++searchSequence;
    await initializeMap();
    if (!selectedPoint) {
      say("Turn on device location to find services near you.");
      return;
    }
    searchCenter = { lat: Number(selectedPoint.lat), lng: Number(selectedPoint.lng) };
    searchRadiusKm = selectedRadius();
    if (mapProvider === "google") {
      map.setCenter(searchCenter);
      map.setZoom(zoomForRadius(searchRadiusKm));
      coverage.setCenter(searchCenter);
      coverage.setRadius(searchRadiusKm * 1000);
      coverage.setMap(map);
      routeLayer.set("directions", null);
    } else {
      map.setView([searchCenter.lat, searchCenter.lng], zoomForRadius(searchRadiusKm));
      coverage.setLatLng([searchCenter.lat, searchCenter.lng]);
      coverage.setRadius(searchRadiusKm * 1000);
      coverage.addTo(map);
      clearMarkers();
    }
    if (mapProvider === "google") clearMarkers();

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
    for (const service of services.slice(0, 100)) {
      if (sequence !== searchSequence) return;
      // The API only exposes coordinates rounded to about 1 km for public map markers.
      const lat = Number(service.mapLatitude), lng = Number(service.mapLongitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      addMarker(service, { lat, lng });
      marked++;
    }
    if (sequence !== searchSequence) return;
    say("Showing " + services.length + " nearby listing" + (services.length === 1 ? "" : "s") +
      " within " + searchRadiusKm + " km. " + marked + " privacy-rounded service-area marker" + (marked === 1 ? "" : "s") +
      " displayed. Listings without saved device coordinates remain in the list but do not get a map pin.");
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
        if (mapProvider === "google") {
          const result = await googleGeocoder.geocode({ location: coords });
          const address = result.results?.[0]?.formatted_address;
          if (address) search.value = address.split(",").slice(0, 2).join(",").trim();
        } else {
          try {
            const response = await fetch(API + "/api/maps/reverse?lat=" + encodeURIComponent(coords.lat) + "&lon=" + encodeURIComponent(coords.lng));
            const area = await response.json();
            if (response.ok && area.formatted) search.value = area.formatted.split(",").slice(0, 2).join(",").trim();
          } catch {
            // Coordinates still work when reverse geocoding is unavailable.
          }
        }
        await refresh(coords);
      } catch (error) {
        say(error.message || "Could not load nearby services.");
        if (locationStatus) locationStatus.textContent = "Location was found, but the map could not load. Please try again.";
      } finally {
        button.disabled = false;
      }
    }, () => {
      if (locationStatus) locationStatus.textContent = "Turn on device location and allow browser access, then try again.";
      say("Location permission is needed to show nearby service areas.");
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
    if (query.trim().length < 2) return hideSuggestions();
    try {
      const response = await fetch(API + "/api/maps/autocomplete?q=" + encodeURIComponent(query.trim()));
      const data = await response.json().catch(() => ({}));
      if (sequence !== autocompleteSequence || !response.ok) return hideSuggestions();
      const suggestions = Array.isArray(data.suggestions) ? data.suggestions : [];
      suggestionBox.innerHTML = suggestions.map((item, index) =>
        '<button type="button" class="community-map-suggestion" role="option" data-suggestion-index="' + index + '">' + esc(item.formatted) + '</button>'
      ).join("");
      suggestionBox.hidden = suggestions.length === 0;
      suggestionBox._items = suggestions;
    } catch {
      hideSuggestions();
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
      if (mapProvider === "google") google.maps.event.trigger(map, "resize");
      else map.invalidateSize({ pan: false });
    };
    window.addEventListener("load", resizeMap, { once: true });
    window.addEventListener("resize", resizeMap);
    requestAnimationFrame(() => requestAnimationFrame(resizeMap));
    say("Map ready. Use device location or search for an area. Geoapify powers address suggestions and in-map driving routes.");
  }).catch(error => {
    say(error.message || "Could not load the community map. Check your connection and reload this page.");
    if (mapNode) {
      mapNode.setAttribute("role", "status");
      mapNode.innerHTML = '<div class="community-map-load-error">The map could not load. Check your internet connection, then reload the page.</div>';
    }
  });
})();