(() => {
  const metaUrl = document.querySelector('meta[name="bradcall-api-url"]')?.content?.trim();
  if (metaUrl) {
    window.BRADCALL_API_URL = metaUrl.replace(/\/$/, "");
  } else if (!window.BRADCALL_API_URL) {
    const local = location.hostname === "localhost" || location.hostname === "127.0.0.1";
    window.BRADCALL_API_URL = local ? "http://localhost:5000" : location.origin;
  }
})();
