# Bradcall API

Express + Prisma + PostgreSQL backend for the Bradcall marketplace.

## Setup

1. Install Node.js LTS and run `npm install` in this folder.
2. Copy `.env.example` to `.env` and set `DATABASE_URL`, a random `JWT_SECRET` of at least 32 characters, and the allowed frontend origins in `CORS_ORIGIN`.
3. For a new/empty database, apply the checked-in schema with `npx prisma migrate deploy`.
4. Generate Prisma Client with `npm run prisma:generate`.
5. Run `npm run check` to check JavaScript syntax, then start with `npm run dev`.

Health check: `GET /api/health`.

## Provision the first administrator

Set `ADMIN_NAME`, `ADMIN_EMAIL`, and a unique `ADMIN_PASSWORD` of at least 12 characters in the environment, then run `npm run admin:seed`. There is intentionally no public admin-registration endpoint.

## Existing databases

The initial migration is intended for a new database. If your current database already contains these tables but does not have matching Prisma migration history, inspect the live schema and baseline carefully before deploying migrations. Do not run the initial migration blindly against an existing database.

## API routes

- `/api/auth`: registration, login, current-user details, provider profile updates.
- `/api/services`: public search plus provider-owned listing management.
- `/api/requests`: consumer requests and provider status updates.
- `/api/admin`: admin-only counts, account listing, and all requests.
