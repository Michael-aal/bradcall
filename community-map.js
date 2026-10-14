(() => {
  "use strict";

  const API = (window.BRADCALL_API_URL || (location.hostname === "localhost" || location.hostname === "127.0.0.1" ? "http://localhost:5000" : location.origin)).replace(/\/$/, "");
  const GOOGLE_KEY = String(window.BRADCALL_GOOGLE_MAPS_API_KEY || document.querySelector('meta[name="bradcall-google-maps-key"]')?.content || "").trim();
  const GEOAPIFY_KEY = String(window.BRADCALL_GEOAPIFY_API_KEY || "").trim();
  const root = document.querySelector("[data-community-map]");
  if (!root) return;

  const $ = selector => root.querySelector(selector);
  const mapNode = $("#community-map-canvas");
  const search = $("#community-map-search");
  const button = $("#community-map-submit");
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
  let searchCenter = null;
  let searchSequence = 0;
  const geocodeCache = new Map();

  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));
  const money = value => new Intl.NumberFormat("en-NG", {
    style: "currency", currency: "NGN", maximumFractionDigits: 0
  }).format(Number(value) || 0);
  const say = message => { if (caption) caption.textContent = message; };

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

  function loadLeaflet() {
    return new Promise((resolve, reject) => {
      if (window.L) return resolve();
      if (!document.querySelector("link[data-bradcall-leaflet]")) {
        const css = document.createElement("link");
        css.rel = "stylesheet";
        css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        css.dataset.bradcallLeaflet = "true";
        document.head.appendChild(css);
      }
      loadScript("https://unpkg.com/leaflet@1.9.4/dist/leaflet.js", "data-bradcall-leaflet")
        .then(resolve).catch(reject);
    });
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
          map, suppressMarkers: false, polylineOptions: { strokeColor: "#019E81", strokeWeight: 5, strokeOpacity: 0.85 }
        });
        coverage = new google.maps.Circle({
          map: null, center: DEFAULT_CENTER, radius: 3000, strokeColor: "#019E81",
          strokeOpacity: 0.8, strokeWeight: 2, fillColor: "#019E81", fillOpacity: 0.08
        });
        return;
      }
    } catch (error) {
      say(error.message || "Google Maps could not load. Showing the community map fallback.");
    }
    mapProvider = "leaflet";
    await loadLeaflet();
    map = window.L.map(mapNode, { scrollWheelZoom: false }).setView([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], 6);
    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>'
    }).addTo(map);
    layer = window.L.layerGroup().addTo(map);
    routeLayer = window.L.layerGroup().addTo(map);
    coverage = window.L.circle([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], {
      radius: 3000, color: "#019E81", weight: 2, fillColor: "#019E81", fillOpacity: 0.08
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
    } else if (GEOAPIFY_KEY) {
      const url = new URL("https://api.geoapify.com/v1/geocode/search");
      url.searchParams.set("text", query);
      url.searchParams.set("limit", "1");
      url.searchParams.set("format", "json");
      url.searchParams.set("apiKey", GEOAPIFY_KEY);
      const response = await fetch(url);
      if (!response.ok) throw new Error("Area lookup is temporarily unavailable.");
      const data = await response.json();
      const item = data.results?.[0];
      if (item) point = { lat: Number(item.lat), lng: Number(item.lon), label: item.formatted || query };
    } else {
      const url = "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=" + encodeURIComponent(query);
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error("Area lookup is temporarily unavailable.");
      const data = await response.json();
      if (data[0]) point = { lat: Number(data[0].lat), lng: Number(data[0].lon), label: data[0].display_name || query };
    }
    if (point && Number.isFinite(point.lat) && Number.isFinite(point.lng)) geocodeCache.set(key, point);
    return point;
  }

  function clearMarkers() {
    if (mapProvider === "google") {
      layer.forEach(marker => marker.setMap(null));
      layer = [];
      routeLayer.set("directions", null);
    } else {
      layer.clearLayers();
      routeLayer.clearLayers();
    }
  }

  function addMarker(service, point) {
    const title = esc(service.title || service.provider?.displayName || "Local service area");
    const details = '<div class="map-popup"><strong>' + title + '</strong><p>' +
      esc(service.category?.name || "Service provider") + '</p><p>' +
      esc(service.location || "Approximate service area") + '</p><p>' + money(service.price) +
      '</p><a href="register.html">Join to request this service</a><p><button type="button" class="map-route-button" data-route-lat="' + point.lat + '" data-route-lng="' + point.lng + '">Show driving route</button></p><p><a target="_blank" rel="noopener noreferrer" href="' +
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
      ? services.slice(0, 6).map(service => '<article class="map-list-item"><strong>' + esc(service.title) +
        '</strong><span>' + esc(service.location || "Approximate service area") + '</span><small>' +
        esc(service.category?.name || "Service") + " · " + money(service.price) +
        (Number.isFinite(service.distanceKm) ? " · " + service.distanceKm + " km away" : "") +
        '</small></article>').join("")
      : '<div class="dash-empty">No public service listings found within this area yet. Try again later or check whether providers have enabled availability.</div>';
  }

  async function showRoute(destinationLat, destinationLng) {
    if (!searchCenter || ![searchCenter.lat, searchCenter.lng, destinationLat, destinationLng].every(Number.isFinite)) {
      say("A valid route location could not be found.");
      return;
    }
    const destination = destinationLat + "," + destinationLng;
    if (mapProvider !== "google") {
      const url = "https://www.google.com/maps/dir/?api=1&origin=" +
        encodeURIComponent(searchCenter.lat + "," + searchCenter.lng) + "&destination=" +
        encodeURIComponent(destination) + "&travelmode=driving";
      window.open(url, "_blank", "noopener,noreferrer");
      say("Opened driving directions in Google Maps. Travel times may vary with traffic.");
      return;
    }
    say("Calculating a driving route…");
    try {
      const service = new google.maps.DirectionsService();
      const result = await service.route({
        origin: searchCenter, destination: { lat: destinationLat, lng: destinationLng },
        travelMode: google.maps.TravelMode.DRIVING
      });
      routeLayer.setDirections(result);
      const leg = result.routes?.[0]?.legs?.[0];
      const summary = [leg?.distance?.text, leg?.duration?.text].filter(Boolean).join(" · ");
      say("Driving route" + (summary ? ": " + summary : "") + ". Travel estimates can change with traffic and road conditions.");
    } catch {
      say("Google Maps could not calculate a route. Try opening directions directly in Google Maps.");
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
    if (mapProvider === "google") {
      map.setCenter(searchCenter);
      map.setZoom(13);
      coverage.setCenter(searchCenter);
      coverage.setMap(map);
      routeLayer.set("directions", null);
    } else {
      map.setView([searchCenter.lat, searchCenter.lng], 13);
      coverage.setLatLng([searchCenter.lat, searchCenter.lng]);
      coverage.addTo(map);
      clearMarkers();
    }
    if (mapProvider === "google") clearMarkers();

    say("Finding nearby service listings…");
    const params = new URLSearchParams({
      latitude: String(searchCenter.lat), longitude: String(searchCenter.lng), radiusKm: "10"
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
      " within 10 km. " + marked + " privacy-rounded service-area marker" + (marked === 1 ? "" : "s") +
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
            const area = await geocode(coords.lat + "," + coords.lng);
            if (area?.label) search.value = area.label.split(",").slice(0, 2).join(",").trim();
          } catch {
            // Coordinates still work even when reverse geocoding is unavailable.
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
  document.addEventListener("click", event => {
    const routeButton = event.target.closest("[data-route-lat][data-route-lng]");
    if (!routeButton || !root.contains(routeButton) && !routeButton.closest(".leaflet-popup, .gm-style")) return;
    showRoute(Number(routeButton.dataset.routeLat), Number(routeButton.dataset.routeLng));
  });
  search.readOnly = true;
  search.setAttribute("aria-readonly", "true");
  initializeMap().then(() => {
    if (!GOOGLE_KEY) say("Map ready. Enable device location to find nearby services. Google Maps can be enabled by adding a restricted browser key in config.js.");
    else say("Map ready. Enable device location to find nearby services.");
  }).catch(error => say(error.message || "Could not load the community map."));
})();