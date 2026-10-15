import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { auth, roles } from "../middleware/auth.js";

const router = Router();
router.use(auth, roles("PROVIDER"));

const periods = {
  "7d": { days: 7, label: "Last 7 days" },
  "30d": { days: 30, label: "Last 30 days" },
  "12m": { days: 365, label: "Last 12 months" }
};
const startOfDay = date => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
const formatBucket = (date, monthly) => monthly
  ? date.toLocaleDateString("en-NG", { month: "short", year: "2-digit", timeZone: "UTC" })
  : date.toLocaleDateString("en-NG", { day: "numeric", month: "short", timeZone: "UTC" });

router.get("/", async (req, res, next) => {
  try {
    const periodKey = Object.hasOwn(periods, String(req.query.period || "")) ? String(req.query.period) : "30d";
    const period = periods[periodKey];
    const since = new Date(Date.now() - period.days * 24 * 60 * 60 * 1000);
    const provider = await prisma.providerProfile.findUnique({ where: { userId: req.user.id }, select: { id: true } });
    if (!provider) return res.status(404).json({ message: "Complete your provider profile to view business analytics." });

    const [requests, payments] = await Promise.all([
      prisma.serviceRequest.findMany({
        where: { providerId: provider.id, createdAt: { gte: since } },
        select: {
          id: true, partnerId: true, status: true, createdAt: true,
          service: { select: { id: true, title: true } },
          partner: { select: { id: true, name: true } }
        },
        orderBy: { createdAt: "desc" },
        take: 5000
      }),
      prisma.payment.findMany({
        where: { providerId: provider.id, status: "PAID", paidAt: { gte: since } },
        select: { id: true, amountKobo: true, commissionKobo: true, providerAmountKobo: true, method: true, paidAt: true },
        orderBy: { paidAt: "asc" },
        take: 5000
      })
    ]);

    const customerBookings = new Map();
    const serviceCounts = new Map();
    for (const request of requests) {
      const customer = customerBookings.get(request.partnerId) || { id: request.partner.id, name: request.partner.name, bookings: 0 };
      customer.bookings += 1;
      customerBookings.set(request.partnerId, customer);
      const serviceId = request.service?.id || "unknown";
      const service = serviceCounts.get(serviceId) || { id: serviceId, title: request.service?.title || "Service", bookings: 0 };
      service.bookings += 1;
      serviceCounts.set(serviceId, service);
    }

    const totalPaidKobo = payments.reduce((sum, payment) => sum + payment.amountKobo, 0);
    const commissionKobo = payments.reduce((sum, payment) => sum + payment.commissionKobo, 0);
    const providerNetKobo = payments.reduce((sum, payment) => sum + payment.providerAmountKobo, 0);
    const buckets = new Map();
    const monthly = periodKey === "12m";
    for (const payment of payments) {
      const date = new Date(payment.paidAt);
      const keyDate = monthly ? new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)) : startOfDay(date);
      const key = keyDate.toISOString().slice(0, 10);
      const bucket = buckets.get(key) || { date: key, label: formatBucket(keyDate, monthly), amountKobo: 0, transactions: 0 };
      bucket.amountKobo += payment.providerAmountKobo;
      bucket.transactions += 1;
      buckets.set(key, bucket);
    }

    const customerList = [...customerBookings.values()].sort((a, b) => b.bookings - a.bookings).slice(0, 5);
    const returningCustomers = [...customerBookings.values()].filter(customer => customer.bookings > 1).length;
    res.set("Cache-Control", "private, no-store");
    res.json({
      period: periodKey,
      periodLabel: period.label,
      generatedAt: new Date().toISOString(),
      bookings: {
        total: requests.length,
        pending: requests.filter(item => item.status === "PENDING").length,
        active: requests.filter(item => ["ACCEPTED", "IN_PROGRESS"].includes(item.status)).length,
        completed: requests.filter(item => item.status === "COMPLETED").length,
        cancelled: requests.filter(item => ["CANCELLED", "REJECTED"].includes(item.status)).length
      },
      customers: { unique: customerBookings.size, returning: returningCustomers, firstTime: customerBookings.size - returningCustomers },
      money: { totalPaidKobo, commissionKobo, providerNetKobo, confirmedTransactions: payments.length },
      revenueSeries: [...buckets.values()],
      popularServices: [...serviceCounts.values()].sort((a, b) => b.bookings - a.bookings).slice(0, 5),
      recentCustomers: customerList
    });
  } catch (error) { next(error); }
});

export default router;
