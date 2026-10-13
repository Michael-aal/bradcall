(() => {
  // Add your Geoapify browser key locally. Do not commit a real key to GitHub.\n  // Restrict the key to Geocoding, Autocomplete, and Routing in the Geoapify dashboard.\n  if (!window.BRADCALL_GEOAPIFY_API_KEY) window.BRADCALL_GEOAPIFY_API_KEY = "";\n\n  const metaUrl = document.querySelector('meta[name="bradcall-api-url"]')?.content?.trim();
  if (metaUrl) {
    window.BRADCALL_API_URL = metaUrl.replace(/\/$/, "");
  } else if (!window.BRADCALL_API_URL) {
    const local = location.hostname === "localhost" || location.hostname === "127.0.0.1";
    window.BRADCALL_API_URL = local ? "http://localhost:5000" : location.origin;
  }
})();
