(() => {
  // Browser keys are public by design. Restrict them by website referrer and enabled APIs.
  // Google Maps: enable Maps JavaScript API, Places API, and Geocoding API.
  // Do not put server-side secrets or unrestricted keys in this file.
  if (!window.BRADCALL_GOOGLE_MAPS_API_KEY) window.BRADCALL_GOOGLE_MAPS_API_KEY = "";
  // Optional legacy fallback key. Leave blank if Google Maps is configured.
  if (!window.BRADCALL_GEOAPIFY_API_KEY) window.BRADCALL_GEOAPIFY_API_KEY = "";

  const metaUrl = document.querySelector('meta[name="bradcall-api-url"]')?.content?.trim();
  const local = location.hostname === "localhost" || location.hostname === "127.0.0.1";

  // A page-level meta tag can override this URL when needed.
  window.BRADCALL_API_URL = (metaUrl || (
    local
      ? "http://localhost:5000"
      : "https://bradcall.onrender.com"
  )).replace(/\/$/, "");
})();
