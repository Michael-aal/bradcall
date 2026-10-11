import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";
export async function auth(req,res,next){
 const h=req.headers.authorization;
 if(!h?.startsWith("Bearer "))return res.status(401).json({message:"Authentication required"});
 try{
  const token=jwt.verify(h.slice(7),process.env.JWT_SECRET);
  const u=await prisma.user.findUnique({where:{id:token.id},select:{id:true,role:true,status:true}});
  if(!u)return res.status(401).json({message:"Account not found"});
  const limitedAllowed=req.originalUrl.startsWith("/api/auth/me")||req.originalUrl.startsWith("/api/trust/appeals")||req.originalUrl.startsWith("/api/trust/my-actions");
  if((u.status==="SUSPENDED"||u.status==="BANNED")&&!limitedAllowed)return res.status(403).json({message:"This account is restricted. You may view the restriction and submit an appeal."});
  req.user={id:u.id,role:u.role,status:u.status};next();
 }catch(e){if(e?.name==="JsonWebTokenError"||e?.name==="TokenExpiredError")return res.status(401).json({message:"Invalid or expired token"});next(e);}
}
export function roles(...allowed){return(req,res,next)=>allowed.includes(req.user?.role)?next():res.status(403).json({message:"Forbidden"});}
