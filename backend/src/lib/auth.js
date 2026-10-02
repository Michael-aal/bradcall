import jwt from "jsonwebtoken";
const secret=process.env.JWT_SECRET;
if(!secret||secret.length<32)throw new Error("JWT_SECRET must be at least 32 characters.");
export const signToken=user=>jwt.sign({sub:user.id,role:user.role},secret,{expiresIn:"7d"});
export const verifyToken=token=>jwt.verify(token,secret);