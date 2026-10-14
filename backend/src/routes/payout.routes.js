import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { auth, roles } from "../middleware/auth.js";

const router = Router();
const PAYSTACK_BASE = "https://api.paystack.co";
let bankCache = [];
let bankCacheAt = 0;
const BANK_CACHE_MS = 10 * 60 * 1000;
const clean = (value, max = 200) => typeof value === "string" ? value.trim().slice(0, max) : "";

function paystackSecret() {
  return process.env.PAYSTACK_SECRET_KEY || "";
}

async function paystack(path, options = {}) {
  const secret = paystackSecret();
  if (!secret) {
    const error = new Error("Payout setup is temporarily unavailable. Please try again later.");
    error.status = 503;
    throw error;
  }
  const response = await fetch(PAYSTACK_BASE + path, {
    ...options,
    headers: {
      Authorization: "Bearer " + secret,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {})
    },
    signal: AbortSignal.timeout(12000)
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.status) {
    const error = new Error(
      response.status === 401 || response.status === 403
        ? "Paystack rejected the server credentials. Please contact Bradcall support."
        : "Paystack could not complete that request. Check the details and try again."
    );
    error.status = response.status === 401 || response.status === 403 ? 503 : 400;
    throw error;
  }
  return data;
}

async function listSupportedBanks() {
  if (bankCache.length && Date.now() - bankCacheAt < BANK_CACHE_MS) return bankCache;
  const banks = [];
  let cursor = "";
  for (let page = 0; page < 10; page += 1) {
    const params = new URLSearchParams({
      country: "nigeria",
      currency: "NGN",
      use_cursor: "true",
      perPage: "100"
    });
    if (cursor) params.set("next", cursor);
    const result = await paystack("/bank?" + params.toString());
    const rows = Array.isArray(result.data) ? result.data : [];
    banks.push(...rows);
    const next = result.meta?.next;
    if (!next || rows.length === 0) break;
    cursor = String(next);
  }

  // Use Paystack's current directory rather than a hard-coded list, so new
  // supported Nigerian banks and eligible digital banks can appear automatically.
  const unique = new Map();
  for (const bank of banks) {
    const code = clean(String(bank.code ?? ""), 40);
    const name = clean(bank.name, 120);
    const type = String(bank.type || "").toLowerCase();
    if (!code || !name || bank.active === false || bank.is_deleted === true) continue;
    if (String(bank.currency || "NGN").toUpperCase() !== "NGN") continue;
    if (type && type !== "nuban") continue;
    unique.set(code, { code, name, slug: clean(bank.slug, 140) });
  }
  bankCache = [...unique.values()].sort((a, b) => a.name.localeCompare(b.name));
  bankCacheAt = Date.now();
  return bankCache;
}

function accountNumberFrom(value) {
  return typeof value === "string" ? value.replace(/\s/g, "") : "";
}

async function resolveBankAccount(bankCode, accountNumber) {
  const banks = await listSupportedBanks();
  const bank = banks.find(item => item.code === bankCode);
  if (!bank) {
    const error = new Error("Choose a bank from the supported Nigerian bank list.");
    error.status = 400;
    throw error;
  }
  if (!/^\d{10}$/.test(accountNumber)) {
    const error = new Error("Enter the 10-digit account number.");
    error.status = 400;
    throw error;
  }
  const params = new URLSearchParams({ account_number: accountNumber, bank_code: bank.code });
  const result = await paystack("/bank/resolve?" + params.toString());
  const accountName = clean(result.data?.account_name, 160);
  if (!accountName) {
    const error = new Error("Paystack could not confirm the account name. Check the account number and bank.");
    error.status = 400;
    throw error;
  }
  return { bank, accountNumber, accountName };
}

router.get("/banks", auth, roles("PROVIDER"), async (req, res, next) => {
  try {
    const query = clean(req.query.search, 100).toLocaleLowerCase();
    const banks = await listSupportedBanks();
    const filtered = query
      ? banks.filter(bank => bank.name.toLocaleLowerCase().includes(query) || bank.slug.toLocaleLowerCase().includes(query))
      : banks;
    res.set("Cache-Control", "private, max-age=300");
    res.json({ banks: filtered });
  } catch (error) { next(error); }
});

router.get("/account", auth, roles("PROVIDER"), async (req, res, next) => {
  try {
    const provider = await prisma.providerProfile.findUnique({ where: { userId: req.user.id } });
    if (!provider) return res.status(404).json({ message: "Provider profile not found." });
    res.json({
      configured: Boolean(provider.paystackRecipientCode && provider.payoutAccountVerifiedAt),
      account: provider.paystackRecipientCode ? {
        bankName: provider.payoutBankName,
        bankCode: provider.payoutBankCode,
        accountName: provider.payoutAccountName,
        accountNumberMasked: provider.payoutAccountNumberMasked,
        verifiedAt: provider.payoutAccountVerifiedAt
      } : null,
      payoutStatus: "NOT_ENABLED",
      payoutNotice: "Saving a payout account does not activate transfers. Bradcall must first confirm an approved payout arrangement with Paystack."
    });
  } catch (error) { next(error); }
});

router.post("/resolve", auth, roles("PROVIDER"), async (req, res, next) => {
  try {
    const bankCode = clean(req.body.bankCode, 40);
    const accountNumber = accountNumberFrom(req.body.accountNumber);
    const resolved = await resolveBankAccount(bankCode, accountNumber);
    res.json({
      verified: true,
      bank: { code: resolved.bank.code, name: resolved.bank.name },
      accountName: resolved.accountName,
      accountNumberMasked: "••••••" + resolved.accountNumber.slice(-4)
    });
  } catch (error) { next(error); }
});

router.post("/account", auth, roles("PROVIDER"), async (req, res, next) => {
  try {
    const bankCode = clean(req.body.bankCode, 40);
    const accountNumber = accountNumberFrom(req.body.accountNumber);
    if (req.body.accountOwnershipConfirmed !== true) {
      return res.status(400).json({ message: "Confirm that this account belongs to you or your registered business before saving it." });
    }

    // Resolve again on save. Never trust a bank name or account name supplied by the browser.
    const resolved = await resolveBankAccount(bankCode, accountNumber);
    const recipient = await paystack("/transferrecipient", {
      method: "POST",
      body: JSON.stringify({
        type: "nuban",
        name: resolved.accountName,
        account_number: resolved.accountNumber,
        bank_code: resolved.bank.code,
        currency: "NGN",
        description: "Bradcall provider payout"
      })
    });
    const recipientCode = clean(recipient.data?.recipient_code, 120);
    if (!recipientCode) {
      const error = new Error("Paystack did not return a payout recipient. Please try again.");
      error.status = 502;
      throw error;
    }

    // Store only the Paystack recipient code and masked account details.
    // The full account number is sent to Paystack but is not saved in Bradcall.
    const provider = await prisma.providerProfile.update({
      where: { userId: req.user.id },
      data: {
        payoutBankName: resolved.bank.name,
        payoutBankCode: resolved.bank.code,
        payoutAccountName: resolved.accountName,
        payoutAccountNumberMasked: "••••••" + resolved.accountNumber.slice(-4),
        paystackRecipientCode: recipientCode,
        payoutAccountVerifiedAt: new Date()
      }
    });
    res.json({
      message: "Payout account saved and verified.",
      account: {
        bankName: provider.payoutBankName,
        bankCode: provider.payoutBankCode,
        accountName: provider.payoutAccountName,
        accountNumberMasked: provider.payoutAccountNumberMasked,
        verifiedAt: provider.payoutAccountVerifiedAt
      },
      payoutStatus: "NOT_ENABLED",
      payoutNotice: "Your destination is saved. Transfers remain disabled until Bradcall's payout arrangement is approved and enabled."
    });
  } catch (error) { next(error); }
});

export default router;
