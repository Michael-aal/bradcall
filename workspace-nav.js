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
  const company = role === "PROVIDER" && String(user.provider?.providerType || user.providerType || "").toUpperCase() === "COMPANY";
  const links = role === "ADMIN" ? [
    ["Overview", "admin-dashboard.html"], ["Marketplace", "services.html"],
    ["Verification & trust", "admin-verification.html"], ["Bookings", "bookings.html"],
    ["Payments", "payments.html"], ["Support", "help-center.html"]
  ] : company ? [
    ["Company overview", "provider-dashboard.html"], ["Service catalogue", "provider-dashboard.html#provider-services"],
    ["Customer requests", "bookings.html"], ["Messages", "messages.html"],
    ["Company finance", "finance.html"], ["Payout account", "payout-account.html"],
    ["Company profile", "profile-setup.html?edit=1"], ["Help", "help-center.html"]
  ] : role === "PROVIDER" ? [
    ["Overview", "provider-dashboard.html"], ["Explore services", "services.html"],
    ["My listings", "provider-dashboard.html#provider-services"], ["Jobs & requests", "bookings.html"],
    ["Messages", "messages.html"], ["Payments", "payments.html"], ["My profile", "profile-setup.html?edit=1"]
  ] : [
    ["Home", "consumer-dashboard.html"], ["Explore services", "services.html"],
    ["My bookings", "bookings.html"], ["Messages", "messages.html"],
    ["My profile", "profile-setup.html?edit=1"], ["Help", "help-center.html"]
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
    ? [["Home", home], ["Marketplace", "services.html"], ["Trust", "admin-verification.html"], ["Bookings", "bookings.html"], ["Profile", "profile-setup.html?edit=1"]]
    : company
      ? [["Overview", home], ["Listings", "provider-dashboard.html#provider-services"], ["Requests", "bookings.html"], ["Messages", "messages.html"], ["Company", "profile-setup.html?edit=1"]]
      : role === "PROVIDER"
        ? [["Overview", home], ["Explore", "services.html"], ["Jobs", "bookings.html"], ["Messages", "messages.html"], ["Profile", "profile-setup.html?edit=1"]]
        : [["Home", home], ["Explore", "services.html"], ["Bookings", "bookings.html"], ["Messages", "messages.html"], ["Profile", "profile-setup.html?edit=1"]];
  const style = document.createElement("style");
  style.textContent = `
    .mobile-tabbar{display:none!important}.workspace-mobile-nav{display:none}
    @media(max-width:760px){
      body{padding-bottom:78px!important}
      .workspace-mobile-nav{position:fixed;z-index:1000;left:0;right:0;bottom:0;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:4px;padding:8px max(8px,env(safe-area-inset-left)) calc(8px + env(safe-area-inset-bottom));background:rgba(7,27,20,.98);border-top:1px solid #244b35;box-shadow:0 -6px 24px rgba(7,27,20,.22);backdrop-filter:blur(12px)}
      .workspace-mobile-nav a{display:flex;align-items:center;justify-content:center;min-height:44px;padding:6px 2px;border-radius:10px;color:#c0d4c6;text-decoration:none;font:700 12px/1.2 "DM Sans",system-ui,sans-serif;text-align:center}
      .workspace-mobile-nav a[aria-current=page]{background:#173e2a;color:#b7f36b}
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

  // First-run permission choices are shown once; exact location is never posted automatically.
  if (!localStorage.getItem("bradcall_permissions_prompted_v1") && !document.querySelector("#bradcall-permission-prompt")) {
    const overlay=document.createElement("div");
    overlay.id="bradcall-permission-prompt";
    overlay.setAttribute("role","dialog");
    overlay.setAttribute("aria-modal","true");
    overlay.setAttribute("aria-labelledby","bradcall-permission-title");
    overlay.innerHTML='<section class="bc-permission-card"><p class="bc-permission-kicker">PERSONALISE YOUR BRADCALL</p><h2 id="bradcall-permission-title">Make nearby discovery easier</h2><p>Choose whether Bradcall can use your device location for nearby matching and send browser notifications about booking updates. You can say no to either.</p><div class="bc-permission-actions"><button type="button" data-permission="location">Allow location</button><button type="button" data-permission="notifications">Enable notifications</button><button type="button" data-permission="later">Not now</button></div><p class="bc-permission-status" aria-live="polite"></p></section>';
    const css=document.createElement("style");
    css.textContent='#bradcall-permission-prompt{position:fixed;inset:0;z-index:2000;background:#142d3377;display:grid;place-items:center;padding:18px}.bc-permission-card{width:min(100%,460px);background:#fff;border-radius:22px;padding:26px;box-shadow:0 24px 80px #142d3333;color:#142d33}.bc-permission-kicker{font-size:11px;font-weight:900;letter-spacing:.12em;color:#087c75}.bc-permission-card h2{font-size:25px;line-height:1.1;margin:10px 0}.bc-permission-card p{line-height:1.6;color:#62736d}.bc-permission-actions{display:grid;gap:9px;margin-top:18px}.bc-permission-actions button{min-height:46px;border:0;border-radius:11px;background:#0e9f91;color:#fff;font-weight:800;padding:12px}.bc-permission-actions button[data-permission="later"]{background:#eef5f3;color:#142d33}.bc-permission-status{font-size:12px}';
    document.head.append(css);
    document.body.append(overlay);
    const done=new Set();if(localStorage.getItem("bradcall_location_permission_prompted_v1"))done.add("location");if(localStorage.getItem("bradcall_notification_permission_prompted_v1"))done.add("notifications");if(done.size===2){localStorage.setItem("bradcall_permissions_prompted_v1","1");overlay.remove();}
    const finish=()=>{if(done.has("location")&&done.has("notifications")){localStorage.setItem("bradcall_permissions_prompted_v1","1");overlay.remove();}};
    overlay.querySelectorAll("button").forEach(button=>button.addEventListener("click",()=>{
      const action=button.dataset.permission,status=overlay.querySelector(".bc-permission-status");
      if(action==="later"){localStorage.setItem("bradcall_location_permission_prompted_v1","1");localStorage.setItem("bradcall_notification_permission_prompted_v1","1");localStorage.setItem("bradcall_permissions_prompted_v1","1");overlay.remove();return;}
      button.disabled=true;
      if(action==="location"){
        localStorage.setItem("bradcall_location_permission_prompted_v1","1");
        if(!navigator.geolocation){status.textContent="This browser does not support device location.";done.add("location");}
        else navigator.geolocation.getCurrentPosition(()=>{status.textContent="Location permission granted. Bradcall only uses location for nearby matching when you choose it.";done.add("location");finish();},()=>{status.textContent="Location was not allowed. You can still search by state and area.";done.add("location");finish();},{enableHighAccuracy:false,timeout:10000,maximumAge:60000});
      }else{
        localStorage.setItem("bradcall_notification_permission_prompted_v1","1");
        if(!("Notification" in window)){status.textContent="This browser does not support notifications.";done.add("notifications");}
        else Notification.requestPermission().then(permission=>{status.textContent=permission==="granted"?"Notifications enabled.":"Notifications not enabled. You can still use Bradcall normally.";done.add("notifications");finish();}).catch(()=>{done.add("notifications");finish();});
      }
      finish();
    }));
  }
})();