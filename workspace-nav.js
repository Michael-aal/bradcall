(() => {
  "use strict";
  const raw = localStorage.getItem("bradcall_user");
  let user = null;
  try { user = raw ? JSON.parse(raw) : null; } catch {}
  const root = document.querySelector("#dashboard-root");
  const protectedWorkspace = document.body.dataset.workspace || root || document.querySelector("#tracking-map") || document.body.classList.contains("profile-setup-page");
  if (!protectedWorkspace || !user || !["PARTNER", "PROVIDER", "ADMIN", "CONSUMER", "CUSTOMER"].includes(String(user.role || "").toUpperCase())) return;

  const role = user.role;
  const home = role === "PROVIDER" ? "provider-dashboard.html" : role === "ADMIN" ? "admin-dashboard.html" : "consumer-dashboard.html";
  const company = role === "PROVIDER" && String(user.provider?.providerType || user.providerType || "").toUpperCase() === "COMPANY";
  const links = role === "ADMIN" ? [
    ["Overview", "admin-dashboard.html"], ["Marketplace", "services.html"], ["Community map", "map.html"],
    ["Verification & trust", "admin-verification.html"], ["Bookings", "bookings.html"],
    ["Payments", "payments.html"], ["Messages", "messages.html"], ["Support", "help-center.html"], ["Trust Centre", "trust-center.html"]
  ] : company ? [
    ["Company overview", "provider-dashboard.html"], ["Community map", "map.html"], ["Service catalogue", "provider-dashboard.html#provider-services"],
    ["Customer requests", "bookings.html"], ["Messages", "messages.html"], ["Company finance", "finance.html"],
    ["Payout account", "payout-account.html"], ["Company profile", "profile-setup.html?edit=1"], ["Reviews", "reviews.html"], ["Help", "help-center.html"]
  ] : role === "PROVIDER" ? [
    ["Overview", "provider-dashboard.html"], ["Explore services", "services.html"], ["Community map", "map.html"],
    ["My listings", "provider-dashboard.html#provider-services"], ["Jobs & requests", "bookings.html"],
    ["Payments", "payments.html"], ["Messages", "messages.html"], ["Reviews", "reviews.html"],
    ["My profile", "profile-setup.html?edit=1"], ["Help", "help-center.html"], ["Trust Centre", "trust-center.html"]
  ] : [
    ["Home", "consumer-dashboard.html"], ["Explore services", "services.html"], ["Community map", "map.html"],
    ["My bookings", "bookings.html"], ["Payments", "payments.html"], ["Messages", "messages.html"],
    ["Reviews", "reviews.html"], ["My profile", "profile-setup.html?edit=1"], ["Help", "help-center.html"], ["Trust Centre", "trust-center.html"]
  ];

  const iconPaths = {
    "Overview":'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="13" width="7" height="8" rx="1"/>',
    "Home":'<path d="m3 10 9-7 9 7"/><path d="M5 9v12h14V9M9 21v-7h6v7"/>',
    "Marketplace":'<path d="M3 3h18v18H3z"/><path d="M3 9h18M9 21V9"/>',
    "Community map":'<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15m6-12v15"/><circle cx="15" cy="9" r="2"/>',
    "Map":'<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15m6-12v15"/><circle cx="15" cy="9" r="2"/>',
    "Explore services":'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    "Explore":'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    "My listings":'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    "Listings":'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    "Jobs & requests":'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 5V3h8v2M7 12l3 3 7-7"/>',
    "Requests":'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 5V3h8v2M7 12l3 3 7-7"/>',
    "My bookings":'<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 9h18"/>',
    "Bookings":'<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 9h18"/>',
    "Customer requests":'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 5V3h8v2M7 12l3 3 7-7"/>',
    "Messages":'<path d="M21 11.5a8.5 8.5 0 0 1-12.8 7.3L3 20l1.2-4.1A8.5 8.5 0 1 1 21 11.5Z"/>',
    "Payments":'<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>',
    "Company finance":'<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>',
    "Payout account":'<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>',
    "My profile":'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    "Company profile":'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    "Company":'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    "Profile":'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    "Verification & trust":'<path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/>',
    "Trust":'<path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/>',
    "Support":'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4.3 1.7c-1.1 1-1.8 1.3-1.8 3.3M12 17h.01"/>',
    "Help":'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4.3 1.7c-1.1 1-1.8 1.3-1.8 3.3M12 17h.01"/>'
  };
  iconPaths["Finance"] = '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h3"/>';
  iconPaths["Jobs"] = '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 5V3h8v2M7 12l3 3 7-7"/>';
  iconPaths["More"] = '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>';
  iconPaths["Reviews"] = '<path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z"/>';
  iconPaths["Trust Centre"] = '<path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/>';
  const iconMarkup = label => '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + (iconPaths[label] || iconPaths["Overview"]) + '</svg>';
  const decorateLink = (a, label) => { a.classList.add("workspace-nav-link"); a.innerHTML = iconMarkup(label) + '<span>' + label + '</span>'; };

  const nav = document.querySelector(".mp-nav, .topbar nav, header nav");
  const isCurrent = href => location.pathname.endsWith(href.split("#")[0]) && (!href.includes("#") || location.hash === href.slice(href.indexOf("#")));
  const createNavLink = ([label, href]) => {
    const a = document.createElement("a");
    decorateLink(a, label);
    a.href = href;
    if (isCurrent(href)) a.setAttribute("aria-current", "page");
    return a;
  };
  if (nav) {
    nav.replaceChildren();
    links.slice(0, 4).forEach(item => nav.append(createNavLink(item)));
    const moreLinks = links.slice(4);
    if (moreLinks.length) {
      const more = document.createElement("div");
      more.className = "workspace-more";
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "workspace-more-toggle";
      toggle.setAttribute("aria-expanded", "false");
      toggle.innerHTML = iconMarkup("More") + '<span>More</span><svg class="workspace-more-chevron" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>';
      const panel = document.createElement("div");
      panel.className = "workspace-more-panel";
      panel.hidden = true;
      panel.setAttribute("aria-label", "More workspace sections");
      moreLinks.forEach(item => panel.append(createNavLink(item)));
      toggle.addEventListener("click", () => {
        const open = toggle.getAttribute("aria-expanded") !== "true";
        toggle.setAttribute("aria-expanded", String(open));
        panel.hidden = !open;
      });
      document.addEventListener("click", event => {
        if (!more.contains(event.target)) { toggle.setAttribute("aria-expanded", "false"); panel.hidden = true; }
      });
      document.addEventListener("keydown", event => {
        if (event.key === "Escape" && !panel.hidden) { toggle.setAttribute("aria-expanded", "false"); panel.hidden = true; toggle.focus(); }
      });
      more.append(toggle, panel);
      nav.append(more);
    }
  }

  const mobileItems = role === "ADMIN"
    ? [["Home", home], ["Marketplace", "services.html"], ["Payments", "payments.html"], ["Trust", "admin-verification.html"], ["Profile", "profile-setup.html?edit=1"]]
    : company
      ? [["Overview", home], ["Map", "map.html"], ["Requests", "bookings.html"], ["Finance", "finance.html"], ["Profile", "profile-setup.html?edit=1"]]
      : role === "PROVIDER"
        ? [["Overview", home], ["Map", "map.html"], ["Jobs", "bookings.html"], ["Payments", "payments.html"], ["Profile", "profile-setup.html?edit=1"]]
        : [["Home", home], ["Explore", "services.html"], ["Map", "map.html"], ["Bookings", "bookings.html"], ["Payments", "payments.html"]];
  const style = document.createElement("style");
  style.textContent = `
    .workspace-more{position:relative;display:inline-flex;align-items:center}
    .workspace-more-toggle{display:inline-flex;align-items:center;gap:7px;min-height:40px;padding:0 10px;border:1px solid transparent;border-radius:10px;background:transparent;color:inherit;font:700 13px/1 "DM Sans",system-ui,sans-serif;cursor:pointer}
    .workspace-more-toggle>svg:first-child{width:17px;height:17px;flex:0 0 auto}
    .workspace-more-chevron{width:14px;height:14px;transition:transform .18s ease}
    .workspace-more-toggle[aria-expanded="true"] .workspace-more-chevron{transform:rotate(180deg)}
    .workspace-more-toggle:hover,.workspace-more-toggle:focus-visible{background:#0e5135;color:#fff}
    .workspace-more-panel{position:absolute;z-index:1200;top:calc(100% + 8px);right:0;width:min(280px,80vw);max-height:min(65vh,440px);overflow:auto;padding:8px;border:1px solid #315b43;border-radius:14px;background:#071b14;box-shadow:0 18px 45px #06160f55}
    .workspace-more-panel[hidden]{display:none!important}
    .workspace-more-panel a{display:flex!important;align-items:center;gap:10px;min-height:42px;padding:10px 12px;border-radius:9px;color:#e2eee5!important;text-decoration:none;font:700 13px/1.25 "DM Sans",system-ui,sans-serif}
    .workspace-more-panel a svg{width:17px;height:17px;flex:0 0 auto}
    .workspace-more-panel a:hover,.workspace-more-panel a[aria-current="page"]{background:#0e5135;color:#fff!important}
    .workspace-more-toggle:focus-visible,.workspace-more-panel a:focus-visible{outline:3px solid #b7f36b;outline-offset:2px}
    .mobile-tabbar{display:none!important}
    .workspace-mobile-nav,.workspace-mobile-header,.workspace-mobile-drawer{display:none}
    .workspace-mobile-drawer:not([hidden]){display:block}
    .workspace-mobile-header{box-sizing:border-box}
    .workspace-mobile-header .workspace-brand{display:flex;align-items:center;gap:9px;color:#f6fff8;text-decoration:none;font:800 19px/1 "Manrope","DM Sans",system-ui,sans-serif;letter-spacing:-.045em}
    .workspace-mobile-header .workspace-brand-mark{display:grid;place-items:center;width:36px;height:36px;border-radius:11px;background:#0e5135;color:#f6fff8;font:900 17px/1 "Manrope","DM Sans",system-ui,sans-serif}
    .workspace-mobile-menu-button{display:grid;place-items:center;width:42px;height:42px;border:1px solid #315b43;border-radius:12px;background:#0e5135;color:#fff}
    .workspace-mobile-menu-button svg{width:21px;height:21px}
    .workspace-mobile-drawer{position:fixed;z-index:1002;inset:62px 0 auto;background:#071b14;color:#fff;border-bottom:1px solid #315b43;box-shadow:0 18px 35px #06160f55;padding:12px 16px 18px;max-height:calc(100dvh - 140px);overflow:auto;opacity:0;transform:translateY(-8px);pointer-events:none;transition:opacity .18s ease,transform .2s cubic-bezier(.2,.75,.25,1)}
    .workspace-mobile-drawer.is-open{opacity:1;transform:translateY(0);pointer-events:auto}
    .workspace-mobile-drawer.is-closing{opacity:0;transform:translateY(-6px);pointer-events:none}
    .workspace-mobile-drawer[hidden]{display:none!important}
    .workspace-more-panel{opacity:0;transform:translateY(-5px);transition:opacity .16s ease,transform .16s ease}
    .workspace-more-panel:not([hidden]){opacity:1;transform:translateY(0)}
    @media(prefers-reduced-motion:reduce){.workspace-mobile-drawer,.workspace-more-chevron,.workspace-more-panel{transition:none!important;animation:none!important}}
    .workspace-mobile-drawer[hidden]{display:none!important}
    .workspace-mobile-drawer nav{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}
    .workspace-mobile-drawer a{display:flex;align-items:center;gap:10px;min-height:42px;padding:10px 12px;border-radius:10px;color:#e2eee5;text-decoration:none;font:700 13px/1.25 "DM Sans",system-ui,sans-serif;background:#0e5135}.workspace-mobile-drawer a svg,.topbar nav a.workspace-nav-link svg{width:17px;height:17px;flex:0 0 auto}.topbar nav a.workspace-nav-link{display:inline-flex;align-items:center;gap:7px}
    .workspace-mobile-drawer a[aria-current=page]{background:#0e5135;color:#f6fff8}
    .workspace-mobile-drawer .workspace-mobile-signout{width:100%;min-height:44px;margin-top:10px;border:1px solid #315b43;border-radius:10px;background:transparent;color:#f6fff8;font-weight:800}
    @media(max-width:760px){
      body{padding-top:68px!important;padding-bottom:94px!important}
      body>header.topbar,body>header.mp-top,body>header.payout-topbar,body>header.profile-topbar{display:none!important}
      .workspace-mobile-header{position:fixed;z-index:1001;top:0;left:0;right:0;display:flex;align-items:center;justify-content:space-between;gap:12px;height:68px;padding:10px 18px;background:#071b14;border-bottom:1px solid #244b35;box-shadow:0 5px 20px #06160f30}
      .workspace-mobile-nav{position:fixed;z-index:1000;left:0;right:0;bottom:0;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px;padding:10px max(12px,env(safe-area-inset-left)) calc(10px + env(safe-area-inset-bottom));background:rgba(7,27,20,.98);border-top:1px solid #244b35;box-shadow:0 -6px 24px rgba(7,27,20,.22);backdrop-filter:blur(12px)}
      .workspace-mobile-nav a{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;min-width:0;min-height:54px;padding:8px 3px;border-radius:12px;color:#c0d4c6;text-decoration:none;font:700 10px/1.25 "DM Sans",system-ui,sans-serif;text-align:center}.workspace-mobile-nav a svg{width:21px;height:21px;flex:0 0 auto}.workspace-mobile-nav a span{display:block;max-width:100%;overflow-wrap:anywhere}
      .workspace-mobile-nav a[aria-current=page]{background:#0e5135;color:#fff}
      .workspace-mobile-nav a:focus-visible{outline:3px solid #ffbf42;outline-offset:2px}
    }
    @media(min-width:761px){.workspace-mobile-drawer{display:none!important}}
  `;
  document.head.append(style);
  const mobileHeader = document.createElement("header");
  mobileHeader.className = "workspace-mobile-header";
  mobileHeader.innerHTML = '<a class="workspace-brand" href="' + home + '" aria-label="Bradcall workspace home"><span class="workspace-brand-mark" aria-hidden="true">B</span><span>bradcall</span></a><button class="workspace-mobile-menu-button" type="button" aria-label="Open workspace menu" aria-controls="workspace-mobile-drawer" aria-expanded="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg></button>';
  const drawer = document.createElement("div");
  drawer.className = "workspace-mobile-drawer";
  drawer.id = "workspace-mobile-drawer";
  drawer.hidden = true;
  const drawerNav = document.createElement("nav");
  drawerNav.setAttribute("aria-label", "Workspace menu");
  for (const [label, href] of links) {
    const a = document.createElement("a");
    decorateLink(a, label);
    a.href = href;
    if (location.pathname.endsWith(href.split("#")[0]) && (!href.includes("#") || location.hash === href.slice(href.indexOf("#")))) a.setAttribute("aria-current", "page");
    drawerNav.append(a);
  }
  drawer.append(drawerNav);
  const signout = document.createElement("button");
  signout.type = "button";
  signout.className = "workspace-mobile-signout";
  signout.textContent = "Log out";
  signout.addEventListener("click", () => {
    const existing = document.querySelector("[data-signout]");
    if (existing) existing.click();
    else { localStorage.removeItem("bradcall_token"); localStorage.removeItem("bradcall_user"); location.href = "login.html"; }
  });
  drawer.append(signout);
  const menuButton = mobileHeader.querySelector("button");
  let drawerCloseTimer;
  const setDrawerState = open => {
    menuButton.setAttribute("aria-expanded", String(open));
    menuButton.setAttribute("aria-label", open ? "Close workspace menu" : "Open workspace menu");
    menuButton.innerHTML = open
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m6 6 12 12M18 6 6 18"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>';
  };
  const openDrawer = () => {
    if (!drawer.hidden) return;
    if (drawerCloseTimer) clearTimeout(drawerCloseTimer);
    drawer.classList.remove("is-closing");
    drawer.hidden = false;
    setDrawerState(true);
    requestAnimationFrame(() => drawer.classList.add("is-open"));
    const firstLink = drawer.querySelector("a[href]");
    if (firstLink) firstLink.focus();
  };
  const closeDrawer = ({restoreFocus = false, immediate = false} = {}) => {
    if (drawer.hidden) return;
    if (drawerCloseTimer) clearTimeout(drawerCloseTimer);
    drawer.classList.remove("is-open");
    drawer.classList.add("is-closing");
    setDrawerState(false);
    const finish = () => {
      if (menuButton.getAttribute("aria-expanded") === "true") return;
      drawer.hidden = true;
      drawer.classList.remove("is-closing");
      if (restoreFocus) menuButton.focus();
    };
    if (immediate) { finish(); return; }
    drawerCloseTimer = setTimeout(finish, 190);
  };
  menuButton.addEventListener("click", () => drawer.hidden ? openDrawer() : closeDrawer({restoreFocus:true}));
  drawer.addEventListener("click", event => { if (event.target.closest("a")) closeDrawer(); });
  document.addEventListener("click", event => {
    if (!drawer.hidden && !drawer.contains(event.target) && !menuButton.contains(event.target)) closeDrawer();
  });
  document.addEventListener("keydown", event => { if (event.key === "Escape" && !drawer.hidden) closeDrawer({restoreFocus:true}); });
  drawer.addEventListener("keydown", event => {
    if (event.key !== "Tab") return;
    const focusable = [...drawer.querySelectorAll('a[href],button:not([disabled])')].filter(el => el.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  window.addEventListener("resize", () => { if (window.innerWidth > 760 && !drawer.hidden) closeDrawer({immediate:true}); });
  document.body.prepend(mobileHeader, drawer);
  const mobile = document.createElement("nav");
  mobile.className = "workspace-mobile-nav";
  mobile.setAttribute("aria-label", "Quick navigation");
  mobileItems.forEach(([label, href]) => {
    const a = document.createElement("a");
    decorateLink(a, label);
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
    css.textContent='#bradcall-permission-prompt{position:fixed;inset:0;z-index:2000;background:#071b1477;display:grid;place-items:center;padding:18px}.bc-permission-card{width:min(100%,460px);background:#fff;border-radius:22px;padding:26px;box-shadow:0 24px 80px #071b1433;color:#071b14}.bc-permission-kicker{font-size:11px;font-weight:900;letter-spacing:.12em;color:#071b14}.bc-permission-card h2{font-size:25px;line-height:1.1;margin:10px 0}.bc-permission-card p{line-height:1.6;color:#62736d}.bc-permission-actions{display:grid;gap:9px;margin-top:18px}.bc-permission-actions button{min-height:46px;border:0;border-radius:11px;background:#0e5135;color:#fff;font-weight:800;padding:12px}.bc-permission-actions button[data-permission="later"]{background:#eef5f3;color:#071b14}.bc-permission-status{font-size:12px}';
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