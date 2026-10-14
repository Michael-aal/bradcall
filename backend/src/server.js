import "dotenv/config";
import express from "express";
import cors from "cors";
import { prisma } from "./lib/prisma.js";
import authRoutes from "./routes/auth.routes.js";
import profileRoutes from "./routes/profile.routes.js";
import payoutRoutes from "./routes/payout.routes.js";
import serviceRoutes from "./routes/service.routes.js";
import requestRoutes from "./routes/request.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import paymentRoutes from "./routes/payments.routes.js";
import communicationRoutes from "./routes/communication.routes.js";
import trustRoutes from "./routes/trust.routes.js";
import trackingRoutes from "./routes/tracking.routes.js";
import reviewRoutes from "./routes/reviews.routes.js";
import mapsRoutes from "./routes/maps.routes.js";
import financeRoutes from "./routes/finance.routes.js";
const app=express();
const defaultOrigins=[
  "https://bradcall.vercel.app",
  "https://www.bradcall.vercel.app",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  "http://localhost:3000",
  "http://127.0.0.1:3000"
];
const normalizeOrigin=value=>value.trim().replace(/\/$/,"");
const configuredOrigins=(process.env.CORS_ORIGIN||"").split(",").map(normalizeOrigin).filter(Boolean);
const allowedOrigins=[...new Set([...defaultOrigins,...configuredOrigins])];
function isAllowedOrigin(origin){
  if(allowedOrigins.includes(origin)) return true;
  // Permit preview deployments for this project, not arbitrary Vercel sites.
  return /^https:\/\/bradcall-[a-z0-9-]+\.vercel\.app$/i.test(origin);
}
app.use(cors({origin(origin,callback){if(!origin||isAllowedOrigin(origin))return callback(null,true);return callback(new Error("Origin not allowed by CORS"));}}));
app.use(express.json({limit:"1mb",verify:(req,res,buf)=>{req.rawBody=Buffer.from(buf);}}));
app.get("/api/health",async(req,res)=>{try{await prisma.$queryRawUnsafe("SELECT 1");res.json({ok:true,service:"bradcall-api"})}catch{res.status(503).json({ok:false,service:"bradcall-api",database:"unavailable"})}});
app.use("/api/auth",authRoutes); app.use("/api/profile",profileRoutes); app.use("/api/payout",payoutRoutes); app.use("/api/requests",trackingRoutes); app.use("/api/services",serviceRoutes); app.use("/api/requests",requestRoutes); app.use("/api/admin",adminRoutes);
app.use("/api/maps",mapsRoutes); app.use("/api/finance",financeRoutes); app.use("/api/payments",paymentRoutes); app.use("/api/communication",communicationRoutes); app.use("/api/trust",trustRoutes); app.use("/api/reviews",reviewRoutes);
app.use((req,res)=>res.status(404).json({message:"Route not found"}));
app.use((err,req,res,next)=>{console.error(err);const status=Number.isInteger(err.status)&&err.status>=400&&err.status<600?err.status:500;res.status(status).json({message:status===500?"Internal server error":err.message});});
const port=Number(process.env.PORT)||5000;
app.listen(port,()=>console.log("Bradcall API running on port "+port));
