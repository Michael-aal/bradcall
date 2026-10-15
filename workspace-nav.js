(() => {
  "use strict";
  const raw = localStorage.getItem("bradcall_user");
  let user = null;
  try { user = raw ? JSON.parse(raw) : null; } catch {}
  const root = document.querySelector("#dashboard-root");
  const protectedWorkspace = document.body.dataset.workspace || root || document.querySelector("#tracking-map");
  if (!protectedWorkspace || !user || !["PARTNER", "PROVIDER", "ADMIN"].includes(user.role)) return;

  const role = user.role;
  const home = role === "PROVIDER" ? "provider-dashboard.html" : role === "ADMIN" ? "admin-dashboard.html" : "consumer-dashboard.html";
  const links = role === "PROVIDER" ? [
    ["Overview", "provider-dashboard.html"], ["My services", "provider-dashboard.html#provider-services"],
    ["Jobs & requests", "bookings.html"], ["Map & tracking", "tracking.html"],
    ["Messages", "messages.html"], ["Payments & earnings", "payments.html"], ["Finance & AI", "finance.html"],
    ["Payout account", "payout-account.html"], ["Reviews", "reviews.html"], ["Help & disputes", "help-center.html"],
    ["My profile", "profile-setup.html?edit=1"]
  ] : role === "ADMIN" ? [
    ["Overview", "admin-dashboard.html"], ["Marketplace", "services.html"],
    ["Verification & trust", "admin-verification.html"], ["Bookings", "bookings.html"],
    ["Payments", "payments.html"], ["Finance & AI", "finance.html"], ["Support", "help-center.html"]
  ] : [
    ["Home", "consumer-dashboard.html"], ["Find services", "services.html"],
    ["My bookings", "bookings.html"], ["Map & tracking", "tracking.html"],
    ["Messages", "messages.html"], ["Payments & history", "payments.html"], ["Finance & AI", "finance.html"],
    ["Reviews", "reviews.html"], ["Help & disputes", "help-center.html"]
  ];

  const nav = document.querySelector(".mp-nav, .topbar nav, header nav");
  if (nav) {
    nav.replaceChildren();
    for (const [label, href] of links) {
      const a = document.createElement("a");
      a.textContent = label;
      a.href = href;
      if (location.pathname.endsWith(href.split("#")[0]) && (!href.includes("#") || location.hash === href.slice(href.indexOf("#")))) {
        a.setAttribute("aria-current", "page");
      }
      nav.append(a);
    }
  }

  const mobileItems = role === "ADMIN"
    ? [["Home", home], ["Bookings", "bookings.html"], ["Trust", "admin-verification.html"], ["Messages", "messages.html"], ["Profile", "profile-setup.html?edit=1"]]
    : [["Explore", "services.html"], ["Bookings", "bookings.html"], ["My tasks", "tasks.html"], ["Messages", "messages.html"], ["Profile", "profile-setup.html?edit=1"]];
  const style = document.createElement("style");
  style.textContent = `
    .mobile-tabbar{display:none!important}.workspace-mobile-nav{display:none}
    @media(max-width:760px){
      body{padding-bottom:78px!important}
      .workspace-mobile-nav{position:fixed;z-index:1000;left:0;right:0;bottom:0;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:4px;padding:8px max(8px,env(safe-area-inset-left)) calc(8px + env(safe-area-inset-bottom));background:rgba(255,255,255,.97);border-top:1px solid #dce9e4;box-shadow:0 -6px 24px rgba(24,51,45,.08);backdrop-filter:blur(12px)}
      .workspace-mobile-nav a{display:flex;align-items:center;justify-content:center;min-height:44px;padding:6px 2px;border-radius:10px;color:#52655f;text-decoration:none;font:700 12px/1.2 "DM Sans",system-ui,sans-serif;text-align:center}
      .workspace-mobile-nav a[aria-current=page]{background:#e4f5ef;color:#087d69}
      .workspace-mobile-nav a:focus-visible{outline:3px solid #ffbf42;outline-offset:2px}
    }
  `;
  document.head.append(style);
  const mobile = document.createElement("nav");
  mobile.className = "workspace-mobile-nav";
  mobile.setAttribute("aria-label", "Quick navigation");
  mobileItems.forEach(([label, href]) => {
    const a = document.createElement("a");
    a.textContent = label;
    a.href = href;
    if (location.pathname.endsWith(href.split("#")[0]) && (!href.includes("#") || location.hash === href.slice(href.indexOf("#")))) a.setAttribute("aria-current", "page");
    mobile.append(a);
  });
  document.body.append(mobile);
})();