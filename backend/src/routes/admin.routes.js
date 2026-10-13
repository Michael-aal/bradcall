import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { auth, roles } from "../middleware/auth.js";

const router = Router();
router.use(auth, roles("ADMIN"));

router.get("/stats", async (req, res, next) => {
  try {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const paidPayments = { status: "PAID" };
    const [
      users, providers, partners, services, activeServices, requests, pendingRequests,
      paidPaymentCount, paymentVolume, platformCommission, monthlyCommission, pendingPayments
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: "PROVIDER" } }),
      prisma.user.count({ where: { role: "PARTNER" } }),
      prisma.service.count(),
      prisma.service.count({ where: { active: true } }),
      prisma.serviceRequest.count(),
      prisma.serviceRequest.count({ where: { status: "PENDING" } }),
      prisma.payment.count({ where: paidPayments }),
      prisma.payment.aggregate({ where: paidPayments, _sum: { amountKobo: true } }),
      prisma.payment.aggregate({ where: paidPayments, _sum: { commissionKobo: true } }),
      prisma.payment.aggregate({ where: { ...paidPayments, paidAt: { gte: monthStart } }, _sum: { commissionKobo: true } }),
      prisma.payment.count({ where: { status: "PENDING" } })
    ]);
    res.json({
      users, providers, partners, services, activeServices, requests, pendingRequests,
      paidPaymentCount,
      paymentVolumeKobo: paymentVolume._sum.amountKobo || 0,
      platformCommissionKobo: platformCommission._sum.commissionKobo || 0,
      monthlyCommissionKobo: monthlyCommission._sum.commissionKobo || 0,
      pendingPayments
    });
  } catch (error) { next(error); }
});

router.get("/users", async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 100
    });
    res.json(users);
  } catch (error) { next(error); }
});

router.get("/requests", async (req, res, next) => {
  try {
    const requests = await prisma.serviceRequest.findMany({
      include: {
        service: { select: { id: true, title: true, price: true } },
        partner: { select: { id: true, name: true, email: true } },
        provider: { include: { user: { select: { id: true, name: true, email: true } } } }
      },
      orderBy: { createdAt: "desc" },
      take: 100
    });
    res.json(requests);
  } catch (error) { next(error); }
});

router.get("/providers",async(req,res,next)=>{try{res.json(await prisma.providerProfile.findMany({include:{user:{select:{id:true,name:true,email:true,status:true}},_count:{select:{services:true,requests:true}}},orderBy:{user:{createdAt:"desc"}},take:200}));}catch(error){next(error);}});
router.patch("/providers/:id/verification",async(req,res,next)=>{try{if(typeof req.body.verified!=="boolean")return res.status(400).json({message:"verified must be true or false."});const p=await prisma.providerProfile.update({where:{id:req.params.id},data:{verified:req.body.verified}});res.json({id:p.id,verified:p.verified});}catch(error){next(error);}});
export default router;
