import "dotenv/config"; import express from "express"; import cors from "cors"; import {prisma} from "./lib/prisma.js"; import authRoutes from "./routes/auth.routes.js"; import serviceRoutes from "./routes/service.routes.js"; import requestRoutes from "./routes/request.routes.js";
const app=express(); app.use(cors()); app.use(express.json({limit:"1mb"}));
app.get("/api/health",async(req,res)=>{try{await prisma.$queryRawUnsafe("SELECT 1");res.json({ok:true,service:"bradcall-api"})}catch{res.status(503).json({ok:false,service:"bradcall-api",database:"unavailable"})}});
app.use("/api/auth",authRoutes); app.use("/api/services",serviceRoutes); app.use("/api/requests",requestRoutes);
app.use((req,res)=>res.status(404).json({message:"Route not found"})); app.use((err,req,res,next)=>{console.error(err);res.status(500).json({message:"Internal server error"})});
const port=Number(process.env.PORT)||5000; app.listen(port,()=>console.log("Bradcall API running on port "+port));