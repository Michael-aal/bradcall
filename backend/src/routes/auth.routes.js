import { Router } from "express";
import { createHash, randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";
import { auth } from "../middleware/auth.js";
import { validateProviderRegistration } from "../lib/registration.js";
const router=Router(), POLICY_VERSION="2026-10-12-v1";
const hashCode=code=>createHash("sha256").update(code).digest("hex");
async function deliverVerification(user,method,code){
 const text="Your Bradcall verification code is "+code+". It expires in 10 minutes. Do not share this code.";
 if(method==="EMAIL"){
  if(!process.env.RESEND_API_KEY)throw new Error("Email verification delivery is not configured.");
  const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:"Bearer "+process.env.RESEND_API_KEY,"Content-Type":"application/json"},body:JSON.stringify({from:process.env.EMAIL_FROM||"Bradcall <onboarding@resend.dev>",to:[user.email],subject:"Verify your Bradcall account",text})});
  if(!response.ok)throw new Error("Email verification delivery failed.");
  return;
 }
 if(!process.env.TERMII_API_KEY||!process.env.TERMII_SENDER_ID)throw new Error("SMS verification delivery is not configured.");
 const phone=String(user.phone||"").replace(/[^+\d]/g,"");
 const normalized=phone.startsWith("+")?phone.slice(1):phone.startsWith("0")?"234"+phone.slice(1):phone;
 const response=await fetch("https://api.ng.termii.com/api/sms/send",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({to:normalized,from:process.env.TERMII_SENDER_ID,sms:text,type:"plain",channel:process.env.TERMII_CHANNEL||"generic",api_key:process.env.TERMII_API_KEY})});
 if(!response.ok)throw new Error("SMS verification delivery failed.");
 const result=await response.json().catch(()=>({}));if(result.code&&String(result.code)!=="ok"&&String(result.code)!=="200")throw new Error("SMS verification delivery failed.");
}
async function issueCode(user,method){
 const code=String(randomInt(0,1000000)).padStart(6,"0"),now=new Date();
 await prisma.user.update({where:{id:user.id},data:{verificationMethod:method,verificationCodeHash:hashCode(code),verificationExpiresAt:new Date(now.getTime()+10*60*1000),verificationSentAt:now,verificationAttempts:0}});
 await deliverVerification(user,method,code);
}

const publicUser=u=>({id:u.id,name:u.name,email:u.email,phone:u.phone,state:u.state,location:u.location,latitude:u.latitude,longitude:u.longitude,profileCompletedAt:u.profileCompletedAt,profileComplete:Boolean(u.profileCompletedAt),role:u.role,status:u.status,provider:u.provider?{id:u.provider.id,displayName:u.provider.displayName,providerType:u.provider.providerType,companyName:u.provider.companyName,primaryCategory:u.provider.primaryCategory,phone:u.provider.phone,bio:u.provider.bio,skills:u.provider.skills,yearsExperience:u.provider.yearsExperience,location:u.provider.location,latitude:u.provider.latitude,longitude:u.provider.longitude,serviceRadiusKm:u.provider.serviceRadiusKm,available:u.provider.available,availabilityUpdatedAt:u.provider.availabilityUpdatedAt,verified:u.provider.verified}:undefined});
const sign=u=>{if(!process.env.JWT_SECRET||process.env.JWT_SECRET.length<32)throw new Error("JWT_SECRET must be configured with at least 32 characters");return jwt.sign({id:u.id},process.env.JWT_SECRET,{expiresIn:"7d"});};
router.post("/register",async(req,res,next)=>{try{
 const name=typeof req.body.name==="string"?req.body.name.trim():"",email=typeof req.body.email==="string"?req.body.email.trim().toLowerCase():"",password=typeof req.body.password==="string"?req.body.password:"",role=req.body.role||"PARTNER";
 const providerType=role==="PROVIDER"?(req.body.providerType||"INDIVIDUAL"):null;
 const providerRegistration=validateProviderRegistration({providerType,companyName:req.body.companyName});
 const phone=typeof req.body.phone==="string"?req.body.phone.trim():"",state=typeof req.body.state==="string"?req.body.state.trim():"",location=typeof req.body.location==="string"?req.body.location.trim():"",primaryCategory=typeof req.body.primaryCategory==="string"?req.body.primaryCategory.trim():"";
 const verificationMethod="EMAIL"; // Bradcall currently verifies new accounts by email only.
 if(!name||name.length>100||!email||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!password)return res.status(400).json({message:"Enter a valid name, email, and password."});
 if(password.length<8||password.length>128)return res.status(400).json({message:"Password must be between 8 and 128 characters."});
 if(!["PARTNER","PROVIDER"].includes(role))return res.status(400).json({message:"Invalid role."});
 if(!state||state.length>80)return res.status(400).json({message:"Choose your state."});
 if(!location||location.length>120)return res.status(400).json({message:"Enter your town or area."});
 if(role==="PROVIDER"&&providerRegistration.error)return res.status(400).json({message:providerRegistration.error});
 if(role==="PROVIDER"&&(!phone||phone.length>30||!/^\+?[0-9 ()-]{7,30}$/.test(phone)))return res.status(400).json({message:"Enter a valid provider phone number."});
 if(role==="PROVIDER"&&(!location||location.length>120||!primaryCategory||primaryCategory.length>80))return res.status(400).json({message:"Enter your service location and choose a service category."});
 if(req.body.acceptedPolicies!==true)return res.status(400).json({message:"You must accept the Terms of Service and Privacy Policy."});
 if(await prisma.user.findUnique({where:{email}}))return res.status(409).json({message:"Email already registered. Try logging in or verifying the existing account."});
 const now=new Date(),u=await prisma.user.create({data:{name,email,phone:phone||null,state,location,passwordHash:await bcrypt.hash(password,12),role,verificationRequired:true,verificationMethod,provider:role==="PROVIDER"?{create:{displayName:providerRegistration.providerType==="COMPANY"?providerRegistration.companyName:name,providerType:providerRegistration.providerType,companyName:providerRegistration.companyName,phone:phone||null,location:location||null,primaryCategory:primaryCategory||null}}:undefined,policyAcceptances:{create:{policyVersion:POLICY_VERSION,termsAcceptedAt:now,privacyAcceptedAt:now}}},include:{provider:true}});
 try{await issueCode(u,verificationMethod);return res.status(201).json({verificationRequired:true,deliveryPending:false,method:verificationMethod,email:u.email,message:"Verification code sent."});}
 catch(error){console.error("Bradcall verification delivery failed:",error.message);return res.status(201).json({verificationRequired:true,deliveryPending:true,method:verificationMethod,email:u.email,message:"Your account was created, but the verification code could not be delivered. Check delivery settings and request a new code."});}
}catch(e){next(e)}});
router.post("/verify",async(req,res,next)=>{try{
 const email=typeof req.body.email==="string"?req.body.email.trim().toLowerCase():"",code=typeof req.body.code==="string"?req.body.code.trim():"";
 if(!email||!/^\d{6}$/.test(code))return res.status(400).json({message:"Enter your email and the six-digit verification code."});
 const user=await prisma.user.findUnique({where:{email}});if(!user||!user.verificationRequired)return res.status(400).json({message:"No pending verification was found for this account."});
 const verified=user.verificationMethod==="PHONE"?user.phoneVerifiedAt:user.emailVerifiedAt;if(verified)return res.json({verified:true,message:"This account is already verified."});
 if(!user.verificationCodeHash||!user.verificationExpiresAt||user.verificationExpiresAt<new Date())return res.status(400).json({message:"This code has expired. Request a new code."});
 if(user.verificationAttempts>=5)return res.status(429).json({message:"Too many incorrect attempts. Request a new code."});
 if(hashCode(code)!==user.verificationCodeHash){await prisma.user.update({where:{id:user.id},data:{verificationAttempts:{increment:1}}});return res.status(400).json({message:"That code is not correct. Try again."});}
 await prisma.user.update({where:{id:user.id},data:{[user.verificationMethod==="PHONE"?"phoneVerifiedAt":"emailVerifiedAt"]:new Date(),verificationCodeHash:null,verificationExpiresAt:null,verificationAttempts:0}});
 res.json({verified:true,message:"Contact verified. You can now log in."});
}catch(e){next(e)}});
router.post("/resend-verification",async(req,res,next)=>{try{
 const email=typeof req.body.email==="string"?req.body.email.trim().toLowerCase():"";if(!email)return res.status(400).json({message:"Enter the email address used to register."});
 const user=await prisma.user.findUnique({where:{email}});if(!user||!user.verificationRequired)return res.json({message:"If an account needs verification, a new code will be sent."});
 const switchingToEmail=user.verificationMethod!=="EMAIL";
 if(!switchingToEmail&&user.verificationSentAt&&Date.now()-user.verificationSentAt.getTime()<60000)return res.status(429).json({message:"Wait one minute before requesting another code."});
 try{await issueCode(user,"EMAIL");res.json({message:"A new email verification code was sent."});}catch(error){console.error("Bradcall verification resend failed:",error.message);res.status(503).json({message:"We could not deliver the email code. Please try again later."});}
}catch(e){next(e)}});
router.post("/login",async(req,res,next)=>{try{
 const email=typeof req.body.email==="string"?req.body.email.trim().toLowerCase():"",password=typeof req.body.password==="string"?req.body.password:"";
 if(!email||!password)return res.status(400).json({message:"Email and password are required."});
 const u=await prisma.user.findUnique({where:{email},include:{provider:true}});
 if(!u||!(await bcrypt.compare(password,u.passwordHash)))return res.status(401).json({message:"Invalid email or password."});
 if(u.status==="SUSPENDED"||u.status==="BANNED")return res.status(403).json({message:"This account is restricted. Contact Bradcall support or submit an appeal."});
 if(u.verificationRequired&&!(u.verificationMethod==="PHONE"?u.phoneVerifiedAt:u.emailVerifiedAt)){
  if(u.verificationMethod!=="EMAIL")await prisma.user.update({where:{id:u.id},data:{verificationMethod:"EMAIL",verificationCodeHash:null,verificationExpiresAt:null,verificationSentAt:null,verificationAttempts:0}});
  return res.status(403).json({code:"VERIFICATION_REQUIRED",method:"EMAIL",message:"Verify your email address before logging in."});
 }
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
 if(req.body.available!==undefined){const v=req.body.available;if(![true,false,"true","false"].includes(v))return res.status(400).json({message:"Availability must be true or false."});data.available=v===true||v==="true";data.availabilityUpdatedAt=new Date();}
 const p=await prisma.providerProfile.update({where:{userId:req.user.id},data});
 res.json({provider:{id:p.id,displayName:p.displayName,phone:p.phone,bio:p.bio,location:p.location,latitude:p.latitude,longitude:p.longitude,serviceRadiusKm:p.serviceRadiusKm,available:p.available,availabilityUpdatedAt:p.availabilityUpdatedAt,verified:p.verified}});
}catch(e){next(e)}});
export default router;
