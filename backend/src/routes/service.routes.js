import {Router} from "express";
import {z} from "zod";
import {prisma} from "../lib/prisma.js";
import {auth,roles} from "../middleware/auth.js";

const router=Router();
const serviceSchema=z.object({title:z.string().trim().min(2).max(120),description:z.string().trim().min(10).max(3000),category:z.string().trim().min(2).max(80),price:z.coerce.number().nonnegative().finite(),location:z.string().trim().min(2).max(120)});

router.get("/",async(req,res,next)=>{
  try{
    const q=typeof req.query.q==="string"?req.query.q.trim():undefined;
    const location=typeof req.query.location==="string"?req.query.location.trim():undefined;
    const category=typeof req.query.category==="string"?req.query.category.trim():undefined;
    const services=await prisma.service.findMany({
      where:{active:true,...location?{location:{contains:location,mode:"insensitive"}}:{},...category?{category:{name:{contains:category,mode:"insensitive"}}}:{},...q?{OR:[{title:{contains:q,mode:"insensitive"}},{description:{contains:q,mode:"insensitive"}},{category:{name:{contains:q,mode:"insensitive"}}}]}:{}},
      include:{category:true,provider:{select:{id:true,displayName:true,verified:true,location:true}}},
      orderBy:{createdAt:"desc"},take:50
    });
    res.json(services);
  }catch(err){next(err)}
});

router.get("/:id",async(req,res,next)=>{
  try{
    const service=await prisma.service.findFirst({where:{id:req.params.id,active:true},include:{category:true,provider:{select:{id:true,displayName:true,bio:true,verified:true,location:true}}}});
    if(!service)return res.status(404).json({message:"Service not found"});
    res.json(service);
  }catch(err){next(err)}
});

router.post("/",auth,roles("PROVIDER","ADMIN"),async(req,res,next)=>{
  try{
    const data=serviceSchema.parse(req.body);
    const provider=req.user.role==="ADMIN"&&req.body.providerId
      ? await prisma.providerProfile.findUnique({where:{id:req.body.providerId}})
      : await prisma.providerProfile.findUnique({where:{userId:req.user.sub}});
    if(!provider)return res.status(400).json({message:"Provider profile not found"});
    const category=await prisma.category.upsert({where:{name:data.category},update:{},create:{name:data.category}});
    const service=await prisma.service.create({data:{title:data.title,description:data.description,price:data.price,location:data.location,providerId:provider.id,categoryId:category.id},include:{category:true}});
    res.status(201).json(service);
  }catch(err){next(err)}
});

router.patch("/:id",auth,roles("PROVIDER","ADMIN"),async(req,res,next)=>{
  try{
    const existing=await prisma.service.findUnique({where:{id:req.params.id}});
    if(!existing)return res.status(404).json({message:"Service not found"});
    if(req.user.role!=="ADMIN"){
      const provider=await prisma.providerProfile.findUnique({where:{userId:req.user.sub}});
      if(existing.providerId!==provider?.id)return res.status(403).json({message:"Forbidden"});
    }
    const data=serviceSchema.partial().parse(req.body);
    const category=data.category?await prisma.category.upsert({where:{name:data.category},update:{},create:{name:data.category}}):undefined;
    const updated=await prisma.service.update({where:{id:existing.id},data:{...data,price:data.price===undefined?undefined:data.price,categoryId:category?.id}});
    res.json(updated);
  }catch(err){next(err)}
});

router.delete("/:id",auth,roles("PROVIDER","ADMIN"),async(req,res,next)=>{
  try{
    const existing=await prisma.service.findUnique({where:{id:req.params.id}});
    if(!existing)return res.status(404).json({message:"Service not found"});
    if(req.user.role!=="ADMIN"){
      const provider=await prisma.providerProfile.findUnique({where:{userId:req.user.sub}});
      if(existing.providerId!==provider?.id)return res.status(403).json({message:"Forbidden"});
    }
    await prisma.service.update({where:{id:existing.id},data:{active:false}});
    res.status(204).end();
  }catch(err){next(err)}
});

export default router;