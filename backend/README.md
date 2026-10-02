# Bradcall API

Express + Prisma + PostgreSQL backend for the Bradcall service marketplace.

Setup: copy .env.example to .env, set DATABASE_URL/JWT_SECRET/CLIENT_URL, then run npm install, npx prisma generate, npx prisma migrate dev --name init, and npm run dev.

Health check: GET /api/health