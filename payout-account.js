(() => {
  "use strict";
  const API = (window.BRADCALL_API_URL || (location.hostname === "localhost" || location.hostname === "127.0.0.1" ? "http://localhost:5000" : location.origin)).replace(/\/$/, "");
  const $ = selector => document.querySelector(selector);
  const token = () => localStorage.getItem("bradcall_token") || "";
  const state = { banks: [], selectedBank: null, resolved: null, saved: null };
  const message = (text, type = "") => {
    const el = $("#payout-message");
    el.textContent = text;
    el.className = "payout-message" + (type ? " " + type : "");
    el.hidden = false;
  };
  const hideMessage = () => { $("#payout-message").hidden = true; };
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[char]));
  async function api(path, options = {}) {
    const response = await fetch(API + path, {
      ...options,
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token(), ...(options.headers || {}) }
    });
    const data = await response.json().catch(() => ({ message: "Unexpected server response." }));
    if (!response.ok) throw new Error(data.message || "Request failed.");
    return data;
  }
  function resetVerification() {
    state.resolved = null;
    $("#resolved-account").hidden = true;
    $("#ownership-row").hidden = true;
    $("#ownership-confirmed").checked = false;
    $("#save-account").disabled = true;
  }
  function renderSaved(account, configured) {
    const root = $("#saved-account");
    const badge = $("#saved-badge");
    if (!account) {
      root.innerHTML = '<p class="payout-muted">No payout account has been saved yet.</p>';
      badge.textContent = "Not set up";
      badge.classList.remove("is-saved");
      return;
    }
    root.innerHTML = '<strong class="saved-bank">' + esc(account.bankName) + '</strong><strong>' + esc(account.accountName) + '</strong><span class="saved-detail">Account number: ' + esc(account.accountNumberMasked || "••••") + '</span><span class="saved-detail">Account verification: ' + (account.verifiedAt ? "verified" : "not verified") + '</span><div class="saved-warning">' + (configured ? "Your destination is saved. This does not mean payouts are enabled." : "This account is not currently ready for payouts. Contact Bradcall support.") + '</div>';
    badge.textContent = configured ? "Verified account" : "Needs review";
    badge.classList.toggle("is-saved", Boolean(configured));
  }
  function renderBankOptions() {
    const query = $("#bank-search").value.trim().toLocaleLowerCase();
    const options = $("#bank-options");
    const matches = state.banks.filter(bank => bank.name.toLocaleLowerCase().includes(query) || (bank.slug || "").toLocaleLowerCase().includes(query)).slice(0, 30);
    options.replaceChildren();
    if (!matches.length) {
      const empty = document.createElement("div");
      empty.className = "bank-empty";
      empty.textContent = state.banks.length ? "No matching bank. Try a shorter search." : "Bank directory is unavailable.";
      options.append(empty);
    } else {
      for (const bank of matches) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "bank-option";
        button.setAttribute("role", "option");
        button.textContent = bank.name;
        button.addEventListener("click", () => {
          state.selectedBank = bank;
          $("#bank-search").value = bank.name;
          $("#bank-code").value = bank.code;
          options.hidden = true;
          $("#bank-search").setAttribute("aria-expanded", "false");
          resetVerification();
          hideMessage();
        });
        options.append(button);
      }
    }
    options.hidden = false;
    $("#bank-search").setAttribute("aria-expanded", "true");
  }
  async function load() {
    if (!token()) {
      message("Please log in as a service provider to manage your payout account.", "error");
      $("#saved-account").textContent = "A provider account is required.";
      return;
    }
    try {
      const [bankData, accountData] = await Promise.all([api("/api/payout/banks"), api("/api/payout/account")]);
      state.banks = Array.isArray(bankData.banks) ? bankData.banks : [];
      state.saved = accountData.account;
      renderSaved(accountData.account, accountData.configured);
      if (!state.banks.length) message("Paystack did not return a supported Nigerian bank list. Check the backend Paystack configuration and try again.", "error");
    } catch (error) {
      message(error.message, "error");
      $("#saved-account").textContent = "Could not load your payout account.";
    }
  }

  $("#bank-search").addEventListener("focus", renderBankOptions);
  $("#bank-search").addEventListener("input", () => {
    state.selectedBank = null;
    $("#bank-code").value = "";
    resetVerification();
    renderBankOptions();
  });
  $("#bank-search").addEventListener("keydown", event => {
    if (event.key === "Escape") {
      $("#bank-options").hidden = true;
      $("#bank-search").setAttribute("aria-expanded", "false");
    }
  });
  document.addEventListener("click", event => {
    if (!event.target.closest(".payout-field")) {
      $("#bank-options").hidden = true;
      $("#bank-search").setAttribute("aria-expanded", "false");
    }
  });
  $("#account-number").addEventListener("input", () => {
    $("#account-number").value = $("#account-number").value.replace(/\D/g, "").slice(0, 10);
    resetVerification();
  });
  $("#ownership-confirmed").addEventListener("change", () => {
    $("#save-account").disabled = !(state.resolved && $("#ownership-confirmed").checked);
  });

  $("#verify-account").addEventListener("click", async () => {
    hideMessage();
    const bankCode = $("#bank-code").value;
    const accountNumber = $("#account-number").value.trim();
    if (!state.selectedBank || !bankCode) return message("Search for and select a bank from the list first.", "error");
    if (!/^\d{10}$/.test(accountNumber)) return message("Enter a valid 10-digit Nigerian account number.", "error");
    const button = $("#verify-account");
    button.disabled = true;
    button.textContent = "Verifying…";
    try {
      const data = await api("/api/payout/resolve", { method: "POST", body: JSON.stringify({ bankCode, accountNumber }) });
      state.resolved = { bankCode, accountNumber, accountName: data.accountName };
      $("#resolved-account").innerHTML = "<strong>" + esc(data.accountName) + "</strong><span>" + esc(data.bank.name) + " · account ending " + esc(data.accountNumberMasked) + "</span>";
      $("#resolved-account").hidden = false;
      $("#ownership-row").hidden = false;
      $("#save-account").disabled = !$("#ownership-confirmed").checked;
      message("Account name verified. Check the name carefully before saving.", "success");
    } catch (error) {
      resetVerification();
      message(error.message, "error");
    } finally {
      button.disabled = false;
      button.textContent = "Verify account";
    }
  });

  $("#payout-form").addEventListener("submit", async event => {
    event.preventDefault();
    hideMessage();
    if (!state.resolved || !$("#ownership-confirmed").checked) return message("Verify the account and confirm ownership before saving.", "error");
    if (state.resolved.bankCode !== $("#bank-code").value || state.resolved.accountNumber !== $("#account-number").value.trim()) {
      resetVerification();
      return message("The bank or account number changed. Verify the account again.", "error");
    }
    const button = $("#save-account");
    button.disabled = true;
    button.textContent = "Saving…";
    try {
      const data = await api("/api/payout/account", {
        method: "POST",
        body: JSON.stringify({ bankCode: state.resolved.bankCode, accountNumber: state.resolved.accountNumber, accountOwnershipConfirmed: true })
      });
      state.saved = data.account;
      renderSaved(data.account, true);
      $("#account-number").value = "";
      $("#bank-search").value = "";
      $("#bank-code").value = "";
      state.selectedBank = null;
      resetVerification();
      message(data.message + " " + data.payoutNotice, "success");
    } catch (error) {
      message(error.message, "error");
      button.disabled = false;
    } finally {
      button.textContent = "Save payout account";
      if (!state.resolved) button.disabled = true;
    }
  });

  document.querySelectorAll("[data-signout]").forEach(button => button.addEventListener("click", () => {
    localStorage.removeItem("bradcall_token");
    localStorage.removeItem("bradcall_user");
    location.href = "login.html";
  }));
  load();
})();
