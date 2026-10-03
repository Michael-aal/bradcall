import {Router} from "express";
import {prisma} from "../lib/prisma.js";
import {auth,roles} from "../middleware/auth.js";
const router=Router();
router.use(auth,roles("ADMIN"));
router.get("/users",async(req,res,next)=>{try{
 const users=await prisma.user.findMany({select:{id:true,name:true,email:true,role:true,createdAt:true},orderBy:{createdAt:"desc"},take:100});
 res.json({users});
}catch(e){next(e)}});
export default router;