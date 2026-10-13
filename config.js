(() => {
  const metaUrl = document.querySelector('meta[name="bradcall-api-url"]')?.content?.trim();
  const local = location.hostname === "localhost" || location.hostname === "127.0.0.1";

  // A page-level meta tag can override this URL when needed.
  window.BRADCALL_API_URL = (metaUrl || (
    local
      ? "http://localhost:5000"
      : "https://bradcall.onrender.com"
  )).replace(/\/$/, "");
})();
