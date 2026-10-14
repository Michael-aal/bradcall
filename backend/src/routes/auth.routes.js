import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";
import { auth } from "../middleware/auth.js";
const router=Router(), POLICY_VERSION="2026-10-12-v1";
const publicUser=u=>({id:u.id,name:u.name,email:u.email,phone:u.phone,location:u.location,latitude:u.latitude,longitude:u.longitude,profileCompletedAt:u.profileCompletedAt,profileComplete:Boolean(u.profileCompletedAt),role:u.role,status:u.status,provider:u.provider?{id:u.provider.id,displayName:u.provider.displayName,providerType:u.provider.providerType,companyName:u.provider.companyName,phone:u.provider.phone,bio:u.provider.bio,skills:u.provider.skills,yearsExperience:u.provider.yearsExperience,location:u.provider.location,latitude:u.provider.latitude,longitude:u.provider.longitude,serviceRadiusKm:u.provider.serviceRadiusKm,available:u.provider.available,verified:u.provider.verified}:undefined});
const sign=u=>{if(!process.env.JWT_SECRET||process.env.JWT_SECRET.length<32)throw new Error("JWT_SECRET must be configured with at least 32 characters");return jwt.sign({id:u.id},process.env.JWT_SECRET,{expiresIn:"7d"});};
router.post("/register",async(req,res,next)=>{try{
 const name=typeof req.body.name==="string"?req.body.name.trim():"",email=typeof req.body.email==="string"?req.body.email.trim().toLowerCase():"",password=typeof req.body.password==="string"?req.body.password:"",role=req.body.role||"PARTNER";
 if(!name||name.length>100||!email||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!password)return res.status(400).json({message:"Enter a valid name, email, and password."});
 if(password.length<8||password.length>128)return res.status(400).json({message:"Password must be between 8 and 128 characters."});
 if(!["PARTNER","PROVIDER"].includes(role))return res.status(400).json({message:"Invalid role."});
 if(req.body.acceptedPolicies!==true)return res.status(400).json({message:"You must accept the Terms of Service and Privacy Policy."});
 if(await prisma.user.findUnique({where:{email}}))return res.status(409).json({message:"Email already registered."});
 const now=new Date(),u=await prisma.user.create({data:{name,email,passwordHash:await bcrypt.hash(password,12),role,provider:role==="PROVIDER"?{create:{displayName:name}}:undefined,policyAcceptances:{create:{policyVersion:POLICY_VERSION,termsAcceptedAt:now,privacyAcceptedAt:now}}},include:{provider:true}});
 return res.status(201).json({user:publicUser(u),token:sign(u)});
}catch(e){next(e)}});
router.post("/login",async(req,res,next)=>{try{
 const email=typeof req.body.email==="string"?req.body.email.trim().toLowerCase():"",password=typeof req.body.password==="string"?req.body.password:"";
 if(!email||!password)return res.status(400).json({message:"Email and password are required."});
 const u=await prisma.user.findUnique({where:{email},include:{provider:true}});
 if(!u||!(await bcrypt.compare(password,u.passwordHash)))return res.status(401).json({message:"Invalid email or password."});
 if(u.status==="SUSPENDED"||u.status==="BANNED")return res.status(403).json({message:"This account is restricted. Contact Bradcall support or submit an appeal."});
 return res.json({user:publicUser(u),token:sign(u)});
}catch(e){next(e)}});
router.get("/me",auth,async(req,res,next)=>{try{const u=await prisma.user.findUnique({where:{id:req.user.id},include:{provider:true}});if(!u)return res.status(404).json({message:"Account not found."});res.json({user:publicUser(u)});}catch(e){next(e)}});
router.patch("/provider-profile",auth,async(req,res,next)=>{try{
 if(req.user.role!=="PROVIDER")return res.status(403).json({message:"Only provider accounts can edit a provider profile."});
 const displayName=typeof req.body.displayName==="string"?req.body.displayName.trim():"",phone=typeof req.body.phone==="string"?req.body.phone.trim():"",bio=typeof req.body.bio==="string"?req.body.bio.trim():"",location=typeof req.body.location==="string"?req.body.location.trim():"";
 if(!displayName||displayName.length>100||phone.length>30||(phone&&!/^\+?[0-9 ()-]{7,30}$/.test(phone))||bio.length>1000||location.length>120)return res.status(400).json({message:"Enter a valid display name, bio, and service area."});
 const data={displayName,phone:phone||null,bio:bio||null,location:location||null};
 if((req.body.latitude!==undefined&&req.body.latitude!=="")||(req.body.longitude!==undefined&&req.body.longitude!=="")){const lat=Number(req.body.latitude),lon=Number(req.body.longitude);if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat < -90||lat > 90||lon < -180||lon > 180)return res.status(400).json({message:"The service-area location is invalid."});data.latitude=Math.round(lat*1000)/1000;data.longitude=Math.round(lon*1000)/1000;}
 if(req.body.serviceRadiusKm!==undefined&&req.body.serviceRadiusKm!==""){const radius=Number(req.body.serviceRadiusKm);if(!Number.isFinite(radius)||radius<1||radius>50)return res.status(400).json({message:"Service coverage must be between 1 and 50 km."});data.serviceRadiusKm=radius;}
 if(req.body.available!==undefined){const v=req.body.available;if(![true,false,"true","false"].includes(v))return res.status(400).json({message:"Availability must be true or false."});data.available=v===true||v==="true";}
 const p=await prisma.providerProfile.update({where:{userId:req.user.id},data});
 res.json({provider:{id:p.id,displayName:p.displayName,phone:p.phone,bio:p.bio,location:p.location,latitude:p.latitude,longitude:p.longitude,serviceRadiusKm:p.serviceRadiusKm,available:p.available,verified:p.verified}});
}catch(e){next(e)}});
export default router;
