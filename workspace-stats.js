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
    const data = await response.json().catch(() => []);
    if (!response.ok) throw new Error(data.message || "Could not load workspace summary.");
    return data;
  };
  const card = (label, value) => {
    const article = document.createElement("article");
    article.className = "stat-card";
    const caption = document.createElement("span");
    caption.textContent = label;
    const number = document.createElement("strong");
    number.textContent = String(value);
    article.append(caption, number);
    return article;
  };
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
      const note = document.createElement("p");
      note.className = "dash-empty";
      note.textContent = "Your summary will appear when Bradcall can load your bookings. " + error.message;
      host.append(note);
    }
  })();
})();