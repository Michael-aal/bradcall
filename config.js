(() => {
  // Map-provider credentials stay on the backend. The browser calls Bradcall's
  // /api/maps endpoints; never expose MAPS_API_KEY in frontend code.
  const metaUrl = document.querySelector('meta[name="bradcall-api-url"]')?.content?.trim();
  const local = location.hostname === "localhost" || location.hostname === "127.0.0.1";

  // A page-level meta tag can override this URL when needed.
  window.BRADCALL_API_URL = (metaUrl || (
    local
      ? "http://localhost:5000"
      : "https://bradcall.onrender.com"
  )).replace(/\/$/, "");
})();
