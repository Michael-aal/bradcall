import {Router} from "express";
import {z} from "zod";
import {prisma} from "../lib/prisma.js";
import {auth,roles} from "../middleware/auth.js";

const router=Router();
router.use(auth);
const createSchema=z.object({serviceId:z.string().min(1),details:z.string().trim().min(5).max(3000),location:z.string().trim().min(2).max(120).optional()});
const statusSchema=z.object({status:z.enum(["ACCEPTED","REJECTED","IN_PROGRESS","COMPLETED","CANCELLED"])}); 

router.post("/",roles("PARTNER"),async(req,res,next)=>{
  try{
    const data=createSchema.parse(req.body);
    const service=await prisma.service.findFirst({where:{id:data.serviceId,active:true}});
    if(!service)return res.status(404).json({message:"Service not found"});
    const request=await prisma.serviceRequest.create({data:{serviceId:service.id,partnerId:req.user.sub,providerId:service.providerId,details:data.details,location:data.location||service.location}});
    res.status(201).json(request);
  }catch(err){next(err)}
});

router.get("/",async(req,res,next)=>{
  try{
    const where=req.user.role==="PROVIDER"
      ? {provider:{userId:req.user.sub}}
      : req.user.role==="ADMIN" ? {} : {partnerId:req.user.sub};
    const requests=await prisma.serviceRequest.findMany({where,include:{service:true,partner:{select:{id:true,name:true,email:true}},provider:{select:{id:true,displayName:true}}},orderBy:{createdAt:"desc"}});
    res.json(requests);
  }catch(err){next(err)}
});

router.patch("/:id",roles("PROVIDER","ADMIN"),async(req,res,next)=>{
  try{
    const data=statusSchema.parse(req.body);
    const request=await prisma.serviceRequest.findUnique({where:{id:req.params.id}});
    if(!request)return res.status(404).json({message:"Request not found"});
    if(req.user.role==="PROVIDER"){
      const provider=await prisma.providerProfile.findUnique({where:{userId:req.user.sub}});
      if(request.providerId!==provider?.id)return res.status(403).json({message:"Forbidden"});
    }
    const updated=await prisma.serviceRequest.update({where:{id:request.id},data:{status:data.status}});
    res.json(updated);
  }catch(err){next(err)}
});

export default router;