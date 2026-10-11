import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { auth, roles } from "../middleware/auth.js";
const router=Router();router.use(auth);
router.post("/",roles("PARTNER"),async(req,res,next)=>{try{
 const serviceId=typeof req.body.serviceId==="string"?req.body.serviceId.trim():"",details=typeof req.body.details==="string"?req.body.details.trim():"",location=typeof req.body.location==="string"?req.body.location.trim():"";
 if(!serviceId||!details||details.length>3000||location.length>120)return res.status(400).json({message:"A service, request description (up to 3000 characters), and valid location are required."});
 const service=await prisma.service.findFirst({where:{id:serviceId,active:true}});if(!service)return res.status(404).json({message:"Service not found or unavailable."});
 const appointmentAt=req.body.appointmentAt?new Date(req.body.appointmentAt):null;if(appointmentAt&&Number.isNaN(appointmentAt.getTime()))return res.status(400).json({message:"Appointment date is invalid."});
 const r=await prisma.serviceRequest.create({data:{serviceId,partnerId:req.user.id,providerId:service.providerId,details,location:location||service.location,appointmentAt},include:{service:true,provider:{select:{id:true,displayName:true}}}});
 res.status(201).json(r);
}catch(e){next(e)}});
router.get("/",async(req,res,next)=>{try{let where={};if(req.user.role==="PROVIDER"){const p=await prisma.providerProfile.findUnique({where:{userId:req.user.id}});if(!p)return res.json([]);where={providerId:p.id};}else if(req.user.role==="PARTNER")where={partnerId:req.user.id};res.json(await prisma.serviceRequest.findMany({where,include:{service:true,partner:{select:{id:true,name:true}},provider:{include:{user:{select:{id:true,name:true}}}},payments:{orderBy:{createdAt:"desc"},take:3}},orderBy:{createdAt:"desc"},take:100}));}catch(e){next(e)}});
router.patch("/:id",roles("PROVIDER","ADMIN"),async(req,res,next)=>{try{
 const r=await prisma.serviceRequest.findUnique({where:{id:req.params.id}});if(!r)return res.status(404).json({message:"Request not found."});
 const data={};if(req.body.status!==undefined){if(!["ACCEPTED","REJECTED","IN_PROGRESS","COMPLETED","CANCELLED"].includes(req.body.status))return res.status(400).json({message:"Invalid request status."});data.status=req.body.status;}
 if(req.user.role==="PROVIDER"){const p=await prisma.providerProfile.findUnique({where:{userId:req.user.id}});if(r.providerId!==p?.id)return res.status(403).json({message:"You cannot update another provider's request."});if(req.body.agreedPrice!==undefined){const n=Number(req.body.agreedPrice);if(!Number.isFinite(n)||n<1||n>100000000)return res.status(400).json({message:"Agreed price must be a valid positive amount."});data.agreedPrice=n;}if(req.body.appointmentAt!==undefined){const d=req.body.appointmentAt===null?null:new Date(req.body.appointmentAt);if(d&&Number.isNaN(d.getTime()))return res.status(400).json({message:"Appointment date is invalid."});data.appointmentAt=d;}}
 if(!Object.keys(data).length)return res.status(400).json({message:"No valid request changes provided."});
 res.json(await prisma.serviceRequest.update({where:{id:r.id},data,include:{service:true,partner:{select:{id:true,name:true}},provider:{include:{user:{select:{id:true,name:true}}}}}}));
}catch(e){next(e)}});
export default router;
