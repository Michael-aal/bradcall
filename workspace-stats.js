(() => {
  "use strict";
  const host = document.getElementById("workspace-stats");
  if (!host) return;
  const API = (window.BRADCALL_API_URL || "https://bradcall.onrender.com").replace(/\/$/, "");
  const token = localStorage.getItem("bradcall_token") || "";
  let user = {};
  try { user = JSON.parse(localStorage.getItem("bradcall_user") || "{}"); } catch {}
  const request = async path => {
    const response = await fetch(API + path, { headers: { Authorization: "Bearer " + token } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Could not load workspace summary.");
    return data;
  };
  const money = kobo => new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format((Number(kobo) || 0) / 100);
  const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = String(text); return node; };
  const card = (label, value, note) => {
    const article = el("article", "stat-card");
    article.append(el("span", "", label), el("strong", "", value));
    if (note) article.append(el("small", "stat-note", note));
    return article;
  };
  const insights = document.getElementById("provider-analytics-insights");
  const analyticsStatus = document.getElementById("provider-analytics-status");
  const analyticsContent = document.getElementById("provider-analytics-content");
  const periodSelect = document.getElementById("analytics-period");
  const chartHost = document.getElementById("provider-revenue-chart");
  const servicesHost = document.getElementById("provider-popular-services");
  const customersHost = document.getElementById("provider-recent-customers");
  const customerInsights = document.getElementById("provider-customer-insights");

  function renderAnalytics(data) {
    insights.replaceChildren(
      card("Confirmed transaction value", money(data.money.totalPaidKobo), data.money.confirmedTransactions + " confirmed payments"),
      card("Estimated provider earnings", money(data.money.providerNetKobo), "After recorded Bradcall commission"),
      card("Platform commission", money(data.money.commissionKobo), "From confirmed payments"),
      card("Unique customers", data.customers.unique, data.customers.returning + " returning in this period")
    );
    chartHost.replaceChildren();
    const series = data.revenueSeries || [];
    if (!series.length) {
      chartHost.append(el("div", "dash-empty", "No confirmed earnings in this period yet. Once payments are confirmed, your trend will appear here."));
    } else {
      const max = Math.max(...series.map(item => item.amountKobo), 1);
      for (const point of series) {
        const row = el("div", "revenue-row");
        row.append(el("span", "revenue-label", point.label));
        const track = el("div", "revenue-track");
        const bar = el("div", "revenue-bar");
        bar.style.width = Math.max(2, (point.amountKobo / max) * 100) + "%";
        bar.setAttribute("role", "img");
        bar.setAttribute("aria-label", point.label + ": " + money(point.amountKobo));
        track.append(bar);
        row.append(track, el("strong", "revenue-value", money(point.amountKobo)));
        chartHost.append(row);
      }
    }
    servicesHost.replaceChildren();
    if (!(data.popularServices || []).length) servicesHost.append(el("div", "dash-empty", "Your most requested services will appear after customers send requests."));
    else data.popularServices.forEach(item => {
      const row = el("div", "analytics-list-row");
      row.append(el("span", "", item.title), el("strong", "", item.bookings + (item.bookings === 1 ? " request" : " requests")));
      servicesHost.append(row);
    });
    customerInsights.replaceChildren(
      el("div", "customer-number", String(data.customers.firstTime)),
      el("div", "customer-caption", "First-time customers"),
      el("div", "customer-number secondary-number", String(data.customers.returning)),
      el("div", "customer-caption", "Returning customers (2+ requests)")
    );
    customersHost.replaceChildren();
    if (!(data.recentCustomers || []).length) customersHost.append(el("div", "dash-empty", "Customer insights will appear as bookings arrive."));
    else data.recentCustomers.forEach(customer => {
      const row = el("div", "analytics-list-row");
      row.append(el("span", "", customer.name), el("strong", "", customer.bookings + (customer.bookings === 1 ? " booking" : " bookings")));
      customersHost.append(row);
    });
    analyticsStatus.hidden = true;
    analyticsContent.hidden = false;
  }
  async function loadAnalytics() {
    if (!analyticsStatus || user.role !== "PROVIDER") return;
    analyticsStatus.hidden = false;
    analyticsStatus.textContent = "Loading your business analytics…";
    analyticsContent.hidden = true;
    try {
      const data = await request("/api/services/analytics?period=" + encodeURIComponent(periodSelect?.value || "30d"));
      renderAnalytics(data);
    } catch (error) {
      analyticsStatus.textContent = "Business analytics are temporarily unavailable. " + error.message;
    }
  }
  periodSelect?.addEventListener("change", loadAnalytics);
  (async () => {
    try {
      const requests = await request("/api/requests");
      let cards;
      if (user.role === "PROVIDER") {
        const services = await request("/api/services/mine");
        cards = [
          ["New requests", requests.filter(item => item.status === "PENDING").length],
          ["Active jobs", requests.filter(item => ["ACCEPTED", "IN_PROGRESS"].includes(item.status)).length],
          ["Completed jobs", requests.filter(item => item.status === "COMPLETED").length],
          ["Published services", services.filter(item => item.active).length]
        ];
        loadAnalytics();
      } else {
        cards = [
          ["My requests", requests.length],
          ["Awaiting response", requests.filter(item => item.status === "PENDING").length],
          ["Active bookings", requests.filter(item => ["ACCEPTED", "IN_PROGRESS"].includes(item.status)).length],
          ["Completed services", requests.filter(item => item.status === "COMPLETED").length]
        ];
      }
      host.replaceChildren(...cards.map(([label, value]) => card(label, value)));
    } catch (error) {
      host.replaceChildren();
      const note = el("p", "dash-empty", "Your summary will appear when Bradcall can load your bookings. " + error.message);
      host.append(note);
      if (user.role === "PROVIDER") loadAnalytics();
    }
  })();
})();