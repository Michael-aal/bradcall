import {Router} from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {z} from "zod";
import {prisma} from "../lib/prisma.js";

const router=Router();
const credentials=z.object({email:z.string().email().max(254),password:z.string().min(8).max(128)});
const registerSchema=credentials.extend({name:z.string().trim().min(2).max(100),role:z.enum(["PARTNER","PROVIDER"]).default("PARTNER")});

function token(user){
  return jwt.sign({sub:user.id,role:user.role},process.env.JWT_SECRET,{expiresIn:"7d"});
}

router.post("/register",async(req,res,next)=>{
  try{
    const data=registerSchema.parse(req.body);
    const email=data.email.toLowerCase();
    const exists=await prisma.user.findUnique({where:{email}});
    if(exists)return res.status(409).json({message:"Email already registered"});
    const user=await prisma.user.create({
      data:{name:data.name,email,passwordHash:await bcrypt.hash(data.password,12),role:data.role,
        providerProfile:data.role==="PROVIDER"?{create:{displayName:data.name}}:undefined},
      select:{id:true,name:true,email:true,role:true}
    });
    res.status(201).json({user,token:token(user)});
  }catch(err){next(err)}
});

router.post("/login",async(req,res,next)=>{
  try{
    const data=credentials.parse(req.body);
    const user=await prisma.user.findUnique({where:{email:data.email.toLowerCase()}});
    if(!user||!(await bcrypt.compare(data.password,user.passwordHash)))return res.status(401).json({message:"Invalid email or password"});
    res.json({user:{id:user.id,name:user.name,email:user.email,role:user.role},token:token(user)});
  }catch(err){next(err)}
});

export default router;