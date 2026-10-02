import jwt from "jsonwebtoken";

export function auth(req,res,next){
  const header=req.headers.authorization;
  if(!header?.startsWith("Bearer ")) return res.status(401).json({message:"Authentication required"});
  try{
    req.user=jwt.verify(header.slice(7),process.env.JWT_SECRET);
    next();
  }catch{
    return res.status(401).json({message:"Invalid or expired token"});
  }
}

export function roles(...allowed){
  return (req,res,next)=>{
    if(!allowed.includes(req.user?.role)) return res.status(403).json({message:"Forbidden"});
    next();
  };
}