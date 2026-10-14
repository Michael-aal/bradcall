import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { auth, roles } from "../middleware/auth.js";

const router = Router();
const TYPES = new Set(["INCOME", "EXPENSE"]);
const PERSONAL_CATEGORIES = new Set(["Service income", "Salary", "Sales", "Transport", "Materials", "Data & airtime", "Food", "Rent", "Utilities", "Equipment", "Marketing", "Fees", "Savings", "Other"]);
const COMPANY_CATEGORIES = new Set(["Commission", "Subscription", "Other income", "Staff", "Hosting & software", "Marketing", "Operations", "Professional services", "Refunds", "Other"]);
const MAX_AMOUNT_KOBO = 100_000_000_000;

function dateOrNull(value) {
  if (value === undefined || value === null || value === "") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) || date.getTime() > Date.now() ? null : date;
}
function parseEntry(body, categories) {
  const type = String(body?.type || "").toUpperCase();
  const category = String(body?.category || "").trim();
  const amountNaira = Number(body?.amountNaira);
  const amountKobo = Math.round(amountNaira * 100);
  const occurredAt = body?.occurredAt ? dateOrNull(body.occurredAt) : new Date();
  const description = String(body?.description || "").trim();
  if (!TYPES.has(type)) return { error: "Choose income or expense." };
  if (!categories.has(category)) return { error: "Choose a valid category." };
  if (!Number.isFinite(amountNaira) || amountNaira <= 0 || !Number.isSafeInteger(amountKobo) || amountKobo > MAX_AMOUNT_KOBO) return { error: "Enter a valid amount greater than zero." };
  if (!occurredAt) return { error: "Choose a valid date that is not in the future." };
  if (description.length > 500) return { error: "Description must be 500 characters or fewer." };
  return { data: { type, category, amountKobo, occurredAt, description: description || null } };
}
function sixMonthStart(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth() - 5, 1);
}
function monthLabel(date) {
  return date.toLocaleDateString("en-NG", { month: "short", year: "2-digit" });
}
function monthlyBuckets(start, now, entries) {
  const buckets = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    buckets.push({ key: d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"), label: monthLabel(d), incomeKobo: 0, expenseKobo: 0 });
  }
  const map = new Map(buckets.map(item => [item.key, item]));
  for (const entry of entries) {
    const d = new Date(entry.occurredAt);
    const bucket = map.get(d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"));
    if (!bucket) continue;
    if (entry.type === "INCOME") bucket.incomeKobo += entry.amountKobo;
    else bucket.expenseKobo += entry.amountKobo;
  }
  return buckets;
}
function summarizeEntries(entries, now = new Date()) {
  const start = sixMonthStart(now);
  const incomeKobo = entries.filter(e => e.type === "INCOME").reduce((sum, e) => sum + e.amountKobo, 0);
  const expenseKobo = entries.filter(e => e.type === "EXPENSE").reduce((sum, e) => sum + e.amountKobo, 0);
  const categoryTotals = new Map();
  for (const entry of entries.filter(e => e.type === "EXPENSE")) categoryTotals.set(entry.category, (categoryTotals.get(entry.category) || 0) + entry.amountKobo);
  const categories = [...categoryTotals].map(([category, amountKobo]) => ({ category, amountKobo })).sort((a, b) => b.amountKobo - a.amountKobo);
  return { period: "last-six-months", incomeKobo, expenseKobo, netKobo: incomeKobo - expenseKobo, expenseRatioPercent: incomeKobo > 0 ? Math.round(expenseKobo / incomeKobo * 100) : null, categories, monthly: monthlyBuckets(start, now, entries), entryCount: entries.length };
}
async function personalData(userId) {
  const start = sixMonthStart();
  const entries = await prisma.personalFinanceEntry.findMany({ where: { userId, occurredAt: { gte: start } }, orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }], take: 500 });
  return { entries, summary: summarizeEntries(entries) };
}
async function companyData() {
  const start = sixMonthStart();
  const [entries, payments, cashDue] = await Promise.all([
    prisma.companyFinanceEntry.findMany({ where: { occurredAt: { gte: start } }, orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }], take: 1000 }),
    prisma.payment.findMany({ where: { status: "PAID", method: "PAYSTACK", paidAt: { gte: start } }, select: { amountKobo: true, commissionKobo: true, paidAt: true } }),
    prisma.payment.aggregate({ where: { status: "PAID", method: "CASH" }, _sum: { commissionKobo: true } })
  ]);
  const manualIncome = entries.filter(e => e.type === "INCOME").reduce((s, e) => s + e.amountKobo, 0);
  const expenses = entries.filter(e => e.type === "EXPENSE").reduce((s, e) => s + e.amountKobo, 0);
  const commissionKobo = payments.reduce((s, p) => s + p.commissionKobo, 0);
  const transactionVolumeKobo = payments.reduce((s, p) => s + p.amountKobo, 0);
  const combined = [
    ...entries,
    ...payments.filter(p => p.paidAt).map(p => ({ type: "INCOME", category: "Commission", amountKobo: p.commissionKobo, occurredAt: p.paidAt }))
  ];
  const summary = summarizeEntries(combined);
  return { entries, summary: { ...summary, incomeKobo: manualIncome + commissionKobo, expenseKobo: expenses, netKobo: manualIncome + commissionKobo - expenses, commissionKobo, transactionVolumeKobo, cashCommissionDueKobo: cashDue._sum.commissionKobo || 0, monthly: monthlyBuckets(start, new Date(), combined), entryCount: entries.length } };
}
router.use(auth);

router.get("/me/summary", async (req, res, next) => {
  try { const data = await personalData(req.user.id); res.json(data.summary); } catch (error) { next(error); }
});
router.get("/me/entries", async (req, res, next) => {
  try { res.json(await prisma.personalFinanceEntry.findMany({ where: { userId: req.user.id }, orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }], take: 100 })); } catch (error) { next(error); }
});
router.post("/me/entries", async (req, res, next) => {
  try {
    const parsed = parseEntry(req.body, PERSONAL_CATEGORIES);
    if (parsed.error) return res.status(400).json({ message: parsed.error });
    const entry = await prisma.personalFinanceEntry.create({ data: { ...parsed.data, userId: req.user.id } });
    res.status(201).json(entry);
  } catch (error) { next(error); }
});
router.delete("/me/entries/:id", async (req, res, next) => {
  try {
    const result = await prisma.personalFinanceEntry.deleteMany({ where: { id: req.params.id, userId: req.user.id } });
    if (!result.count) return res.status(404).json({ message: "Finance entry not found." });
    res.status(204).end();
  } catch (error) { next(error); }
});

router.get("/company/summary", roles("ADMIN"), async (req, res, next) => {
  try { const data = await companyData(); res.json(data.summary); } catch (error) { next(error); }
});
router.get("/company/entries", roles("ADMIN"), async (req, res, next) => {
  try { res.json(await prisma.companyFinanceEntry.findMany({ orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }], take: 200, include: { createdBy: { select: { name: true } } } })); } catch (error) { next(error); }
});
router.post("/company/entries", roles("ADMIN"), async (req, res, next) => {
  try {
    const parsed = parseEntry(req.body, COMPANY_CATEGORIES);
    if (parsed.error) return res.status(400).json({ message: parsed.error });
    const entry = await prisma.companyFinanceEntry.create({ data: { ...parsed.data, createdById: req.user.id } });
    res.status(201).json(entry);
  } catch (error) { next(error); }
});
router.delete("/company/entries/:id", roles("ADMIN"), async (req, res, next) => {
  try {
    const result = await prisma.companyFinanceEntry.deleteMany({ where: { id: req.params.id } });
    if (!result.count) return res.status(404).json({ message: "Company finance entry not found." });
    res.status(204).end();
  } catch (error) { next(error); }
});

const aiCooldown = new Map();
router.post("/insights", async (req, res) => {
  const key = req.user.id;
  const now = Date.now();
  if (now - (aiCooldown.get(key) || 0) < 30000) return res.status(429).json({ message: "Please wait 30 seconds before requesting another AI insight." });
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return res.status(503).json({ message: "AI insights are not configured yet. Add OPENROUTER_API_KEY to the backend environment." });
  try {
    aiCooldown.set(key, now);
    const scope = req.body?.scope === "company" && req.user.role === "ADMIN" ? "company" : "personal";
    const data = scope === "company" ? await companyData() : await personalData(req.user.id);
    const s = data.summary;
    const safeData = {
      period: s.period,
      incomeNaira: Math.round(s.incomeKobo / 100),
      expensesNaira: Math.round(s.expenseKobo / 100),
      netNaira: Math.round(s.netKobo / 100),
      expenseCategories: s.categories.map(c => ({ category: c.category, amountNaira: Math.round(c.amountKobo / 100) })).slice(0, 8),
      monthly: s.monthly.map(m => ({ month: m.label, incomeNaira: Math.round(m.incomeKobo / 100), expensesNaira: Math.round(m.expenseKobo / 100) })),
      ...(scope === "company" ? { platformCommissionNaira: Math.round((s.commissionKobo || 0) / 100), transactionVolumeNaira: Math.round((s.transactionVolumeKobo || 0) / 100), cashCommissionDueNaira: Math.round((s.cashCommissionDueKobo || 0) / 100) } : {})
    };
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json", "HTTP-Referer": process.env.OPENROUTER_SITE_URL || process.env.APP_URL || "https://bradcall.vercel.app", "X-OpenRouter-Title": process.env.OPENROUTER_SITE_NAME || "Bradcall Finance Insights" },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || "nvidia/nemotron-3-super-120b-a12b:free",
        temperature: 0.2,
        max_tokens: 450,
        messages: [
          { role: "system", content: "You are Bradcall's financial record explainer, not a licensed financial adviser. Use only the supplied aggregated records. Give 3 concise, practical observations and next steps. State when there is insufficient data. Never invent facts or amounts, never recommend specific investments, loans, or financial products, and do not claim to know bank balances or unrecorded cash. Clarify that the numbers reflect only records entered or confirmed in Bradcall. Be supportive, non-judgmental, and avoid guarantees." },
          { role: "user", content: "Analyse this " + scope + " finance summary and provide cautious budgeting insights in plain English. Data (amounts in NGN): " + JSON.stringify(safeData) }
        ]
      }),
      signal: AbortSignal.timeout(18000)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return res.status(502).json({ message: "The AI provider could not generate an insight right now. Please try again later." });
    const insight = result.choices?.[0]?.message?.content;
    if (typeof insight !== "string" || !insight.trim()) return res.status(502).json({ message: "The AI provider returned an empty insight." });
    res.json({ scope, insight: insight.trim(), basedOn: "Your recorded financial entries and confirmed Bradcall transactions only." });
  } catch (error) {
    res.status(502).json({ message: "Could not reach the AI service. Please try again later." });
  }
});
export default router;
